import type {
  AIExplanationPayload,
  Env,
  ExplainApiRequest,
  ExplainWritingRequest,
  OptionKey,
} from './types.js';

// 3 Cloudflare Workers AI Models (Primary -> Secondary -> Fast Fallback)
const WORKERS_AI_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',      // Tier 1: Flagship 70B FP8 Fast
  '@cf/mistralai/mistral-small-3.1-24b-instruct',  // Tier 2: Strong 24B Math & Reasoning
  '@cf/meta/llama-3.1-8b-instruct-fast',           // Tier 3: Ultra-low-latency 8B Fallback
] as const;

// OpenRouter Free Fallback Models (Zero-Cost Background Fallback)
const OPENROUTER_FREE_MODELS = [
  'openrouter/free',                               // Auto-selects healthy free model supporting JSON
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-r1:free',
  'qwen/qwen-2.5-72b-instruct:free',
] as const;

const SYSTEM_PROMPT = `You are an elite Bangladesh Bank Exam Faculty (IBA/BIBM standard).
Analyze the English MCQ and return ONLY a raw, valid JSON object (no markdown fences, no extra prose) matching this exact structure:
{
  "coreConcept": "1-sentence fundamental formula or grammar/GK rule.",
  "examHallShortcut": "How to solve or eliminate options in under 30 seconds in the exam hall.",
  "stepByStep": "Clear, concise step-by-step derivation showing why the correct answer is right.",
  "optionDiagnostics": {
    "A": { "status": "CORRECT or TRAP_DISTRACTOR", "verdict": "Why option A is right or what calculation/cognitive trap makes it wrong." },
    "B": { "status": "CORRECT or TRAP_DISTRACTOR", "verdict": "Why option B is right or what trap makes it wrong." },
    "C": { "status": "CORRECT or TRAP_DISTRACTOR", "verdict": "Why option C is right or what trap makes it wrong." },
    "D": { "status": "CORRECT or TRAP_DISTRACTOR", "verdict": "Why option D is right or what trap makes it wrong." }
  }
}
Rules:
1. Wrap any math equations in single dollar signs ($...$) for KaTeX.
2. Keep explanations crisp, accurate, and in clear English.`;

function buildUserPrompt(req: ExplainApiRequest): string {
  return `Question: ${req.stem}
Options:
A) ${req.options.A}
B) ${req.options.B}
C) ${req.options.C}
D) ${req.options.D}
Official Correct Answer: ${req.correctOption}

Return the JSON analysis now:`;
}

function extractAndValidateJson(
  rawText: string,
  req: ExplainApiRequest,
  modelName: string
): AIExplanationPayload {
  // Strip markdown code fences if present
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(`Invalid JSON boundaries from ${modelName}`);
  }

  const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));

  if (!parsed.coreConcept || !parsed.examHallShortcut || !parsed.optionDiagnostics) {
    throw new Error(`Missing required schema fields from ${modelName}`);
  }

  const keys: OptionKey[] = ['A', 'B', 'C', 'D'];
  const optionDiagnostics: Record<OptionKey, { status: 'CORRECT' | 'TRAP_DISTRACTOR'; verdict: string }> = {} as any;

  for (const k of keys) {
    const diag = parsed.optionDiagnostics[k];
    const isCorrect = k === req.correctOption;

    if (!diag?.verdict) {
      optionDiagnostics[k] = {
        status: isCorrect ? 'CORRECT' : 'TRAP_DISTRACTOR',
        verdict: isCorrect
          ? `Matches the derived solution: ${req.options[k]}.`
          : `Does not satisfy the conditions in the question stem (${req.options[k]}).`,
      };
    } else {
      optionDiagnostics[k] = {
        status: isCorrect ? 'CORRECT' : 'TRAP_DISTRACTOR',
        verdict: String(diag.verdict),
      };
    }
  }

  return {
    questionId: req.questionId,
    coreConcept: String(parsed.coreConcept),
    examHallShortcut: String(parsed.examHallShortcut),
    stepByStep: String(parsed.stepByStep || parsed.examHallShortcut),
    optionDiagnostics,
    generatedBy: modelName,
    cachedAt: Date.now(),
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms in ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function executeAICascade(
  req: ExplainApiRequest,
  env: Env
): Promise<AIExplanationPayload> {
  const userPrompt = buildUserPrompt(req);
  const errors: string[] = [];

  // =========================================================================
  // STAGE 1: 3x Cloudflare Workers AI Binding Cascade (Primary Edge Inference)
  // =========================================================================
  if (env.AI) {
    for (const model of WORKERS_AI_MODELS) {
      try {
        const aiResult: any = await withTimeout(
          env.AI.run(model as any, {
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.15,
            max_tokens: 900,
          }),
          9500,
          model
        );

        const rawResponse =
          typeof aiResult?.response === 'string'
            ? aiResult.response
            : aiResult?.choices?.[0]?.message?.content ??
              (typeof aiResult?.text === 'string' ? aiResult.text : JSON.stringify(aiResult));

        if (rawResponse) {
          const payload = extractAndValidateJson(rawResponse, req, `workers-ai:${model}`);
          return payload;
        }
      } catch (err: any) {
        errors.push(`[${model}]: ${err?.message || String(err)}`);
        // Continue immediately to the next Workers AI model in the cascade
      }
    }
  }

  // =========================================================================
  // STAGE 2: OpenRouter Free Models Fallback (Background Zero-Cost Fallback)
  // =========================================================================
  if (env.OPENROUTER_API_KEY) {
    for (const freeModel of OPENROUTER_FREE_MODELS) {
      try {
        const res = await withTimeout(
          fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://bank-intel-pwa.vercel.app',
              'X-Title': 'BankIntel PWA',
            },
            body: JSON.stringify({
              model: freeModel,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.15,
              max_tokens: 900,
            }),
          }),
          12000,
          `openrouter:${freeModel}`
        );

        if (res.ok) {
          const data: any = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            const usedModel = data?.model || freeModel;
            return extractAndValidateJson(content, req, `openrouter-free:${usedModel}`);
          }
        }
      } catch (err: any) {
        errors.push(`[openrouter:${freeModel}]: ${err?.message || String(err)}`);
      }
    }
  }

  // =========================================================================
  // STAGE 3: Deterministic High-Quality Fallback (Safety Net)
  // =========================================================================
  console.warn(`All AI tiers exhausted (${errors.join(' | ')}). Using deterministic faculty fallback.`);
  return generateDeterministicFallback(req);
}

function generateDeterministicFallback(req: ExplainApiRequest): AIExplanationPayload {
  const correctText = req.options[req.correctOption];
  const isMath = req.subject === 'MATH';

  const optionDiagnostics: Record<OptionKey, { status: 'CORRECT' | 'TRAP_DISTRACTOR'; verdict: string }> = {
    A: {
      status: req.correctOption === 'A' ? 'CORRECT' : 'TRAP_DISTRACTOR',
      verdict:
        req.correctOption === 'A'
          ? `Exact match with the official solution: ${req.options.A}.`
          : `Distractor trap: Candidates select "${req.options.A}" due to sign inversion or premature calculation.`,
    },
    B: {
      status: req.correctOption === 'B' ? 'CORRECT' : 'TRAP_DISTRACTOR',
      verdict:
        req.correctOption === 'B'
          ? `Exact match with the official solution: ${req.options.B}.`
          : `Distractor trap: Candidates select "${req.options.B}" by overlooking boundary constraints.`,
    },
    C: {
      status: req.correctOption === 'C' ? 'CORRECT' : 'TRAP_DISTRACTOR',
      verdict:
        req.correctOption === 'C'
          ? `Exact match with the official solution: ${req.options.C}.`
          : `Distractor trap: Candidates select "${req.options.C}" by confusing numerator and denominator values.`,
    },
    D: {
      status: req.correctOption === 'D' ? 'CORRECT' : 'TRAP_DISTRACTOR',
      verdict:
        req.correctOption === 'D'
          ? `Exact match with the official solution: ${req.options.D}.`
          : `Distractor trap: Common grammatical trap or computational misstep.`,
    },
  };

  return {
    questionId: req.questionId,
    coreConcept: isMath
      ? 'Apply fundamental algebraic identity or proportional rate formula.'
      : `Core standard principle for ${req.subject?.toLowerCase().replace('_', ' ') || 'exam subject'}.`,
    examHallShortcut: `Eliminate extremes immediately. Focus strictly on option [${req.correctOption}] (${correctText}) under 30s.`,
    stepByStep: `1. Identify target constraint from question stem.\n2. Deduce canonical value: [${req.correctOption}] (${correctText}).\n3. Confirm alignment with official answer key.`,
    optionDiagnostics,
    generatedBy: 'deterministic-faculty-fallback',
    cachedAt: Date.now(),
  };
}

// =========================================================================
// WRITING CASCADE: Subjective & Descriptive Written Answers
// =========================================================================

export interface WritingCascadeResult {
  markdown: string;
  generatedBy: string;
}

const WRITING_SYSTEM_PROMPT = `You are an expert examiner for Bangladesh Bank (Assistant Director, Officer IT) and Bangladesh Public Service Commission (BPSC/BSC) written examinations.
Your task is to write an exemplary, examiner-standard model answer for a subjective/descriptive written exam question.

Instructions:
1. Language Consistency: If the question stem is written in Bengali, write your entire model answer in formal academic Bengali. If the question stem is in English, write in formal professional English.
2. Structure & Formatting:
   - Use Markdown headings (##, ###) for major sections.
   - Use bullet points and numbered lists for readability.
   - For comparative concepts or architectural comparisons, include a Github-Flavored Markdown (GFM) comparison table.
   - For mathematical or algorithmic expressions, format formulas with KaTeX ($...$ or $$...$$).
   - For coding or SQL questions, write clean, well-commented code inside fenced code blocks (\`\`\`c, \`\`\`python, or \`\`\`sql) with language tags, along with input/output examples and a Time & Space Complexity analysis.
   - Conclude with a concise "Key Takeaway" (বা "মূল সারসংক্ষেপ") summarizing the primary takeaway for the candidate.
3. Exam-Appropriate Depth:
   - For 10 marks: Write a comprehensive, high-scoring answer of approximately 250 to 350 words.
   - For 15 marks: Write an in-depth answer of approximately 400 to 550 words.
4. Professional Standard: Be precise, technically rigorous, and directly address all parts of the question prompt without unnecessary fluff.`;

function buildWritingUserPrompt(req: ExplainWritingRequest): string {
  return `Exam Category: ${req.category}
Marks: ${req.marks}
Question:
${req.stem}

Write the comprehensive examiner-standard model answer in Markdown now:`;
}

export async function runWritingCascade(
  req: ExplainWritingRequest,
  env: Env
): Promise<WritingCascadeResult> {
  const userPrompt = buildWritingUserPrompt(req);
  const errors: string[] = [];

  // 1. Workers AI Cascade (Primary 20s timeout per model)
  if (env.AI) {
    for (const model of WORKERS_AI_MODELS) {
      try {
        const aiResult: any = await withTimeout(
          env.AI.run(model as any, {
            messages: [
              { role: 'system', content: WRITING_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 1200,
          }),
          20000,
          model
        );

        const rawResponse =
          typeof aiResult?.response === 'string'
            ? aiResult.response
            : aiResult?.choices?.[0]?.message?.content ??
              (typeof aiResult?.text === 'string' ? aiResult.text : null);

        if (rawResponse && rawResponse.trim().length > 50) {
          return {
            markdown: rawResponse.trim(),
            generatedBy: `workers-ai:${model}`,
          };
        }
      } catch (err: any) {
        errors.push(`[${model}]: ${err?.message || String(err)}`);
      }
    }
  }

  // 2. OpenRouter Free Models Fallback (20s timeout per model)
  if (env.OPENROUTER_API_KEY) {
    for (const freeModel of OPENROUTER_FREE_MODELS) {
      try {
        const res = await withTimeout(
          fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://bank-intel-pwa.vercel.app',
              'X-Title': 'BankIntel PWA - Written Prep',
            },
            body: JSON.stringify({
              model: freeModel,
              messages: [
                { role: 'system', content: WRITING_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.3,
              max_tokens: 1200,
            }),
          }),
          20000,
          `openrouter:${freeModel}`
        );

        if (res.ok) {
          const data: any = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content && content.trim().length > 50) {
            const usedModel = data?.model || freeModel;
            return {
              markdown: content.trim(),
              generatedBy: `openrouter-free:${usedModel}`,
            };
          }
        }
      } catch (err: any) {
        errors.push(`[openrouter:${freeModel}]: ${err?.message || String(err)}`);
      }
    }
  }

  // 3. High-Standard Deterministic Fallback
  console.warn(`All AI tiers exhausted for writing (${errors.join(' | ')}). Using deterministic faculty answer.`);
  return {
    markdown: getDeterministicWritingAnswer(req),
    generatedBy: 'deterministic-faculty-standard',
  };
}

function getDeterministicWritingAnswer(req: ExplainWritingRequest): string {
  const isBn = /[\u0980-\u09FF]/.test(req.stem);

  if (req.questionId === 'write-it-001') {
    return `## ব্যাংকিং খাতে কৃত্রিম বুদ্ধিমত্তা (AI): দক্ষতা ও নিরাপত্তা বনাম ঝুঁকি

### ১. কার্যক্রমের দক্ষতা বৃদ্ধিতে AI-এর ভূমিকা
* **গ্রাহক সেবা স্বয়ংক্রিয়করণ:** AI চ্যাটবট ও ভার্চুয়াল অ্যাসিস্ট্যান্ট ২৪/৭ রিয়েল-টাইম সহায়তা প্রদান করে কল সেন্টারের চাপ ও পরিচালন ব্যয় ৬০% কমায়।
* **ঋণ মূল্যায়ন ও আন্ডাররাইটিং:** মেশিন লার্নিং অ্যালগরিদম আবেদনকারীর ডিজিটাল ফুটপ্রিন্ট, লেনদেনের ইতিহাস ও ক্যাশ-ফ্লো বিশ্লেষণ করে স্বয়ংক্রিয় ক্রেডিট স্কোরিং প্রদান করে।
* **প্রসেস অটোমেশন (RPA):** চেক ক্লিয়ারিং, ডেটা রিকনসিলিয়েশন ও অ্যাকাউন্ট ক্লোজিংয়ের মতো রুটিন কাজগুলো মানুষের ভুল ছাড়া সেকেন্ডের মধ্যে সম্পন্ন হয়।

### ২. ব্যাংকিং নিরাপত্তা সুদৃঢ়করণ
* **রিয়েল-টাইম জালিয়াতি সনাক্তকরণ (Fraud Detection):** Anomaly Detection অ্যালগরিদম অস্বাভাবিক লেনদেন (যেমন: অবস্থান বা ভলিউমের আকস্মিক পরিবর্তন) তৎক্ষণাৎ ফ্ল্যাগ বা ব্লক করে।
* **বায়োমেট্রিক ও আচরণগত প্রমাণীকরণ:** ফেসিয়াল রিকগনিশন ও টাইপিং প্যাটার্ন অ্যানালাইসিসের মাধ্যমে অননুমোদিত অ্যাক্সেস প্রতিরোধ করা হয়।

### ৩. সম্ভাব্য ঝুঁকি ও নৈতিক চ্যালেঞ্জ
| ঝুঁকির ক্ষেত্র | কারণ ও প্রভাব | প্রশমন কৌশল |
| :--- | :--- | :--- |
| **অ্যালগরিদমিক পক্ষপাত (Bias)** | ট্রেনিং ডেটায় ঐতিহাসিক বৈষম্য থাকলে নির্দিষ্ট জনগোষ্ঠীর ঋণ প্রাপ্তি বাধাগ্রস্ত হয় | ফেয়ারনেস অডিট ও আনবায়াসড ডেটাসেট ব্যবহার |
| **সাইবার দুর্বলতা ও বিষাক্ত ডেটা** | মডেল পয়জনিং বা অ্যাডভারসারিয়াল অ্যাটাক | এন্ড-টু-এন্ড এনক্রিপশন ও মডেল গার্ডরেইল |
| **ব্ল্যাক-বক্স সমস্যা (Lack of Explainability)** | জটিল ডিপ লার্নিং মডেলের সিদ্ধান্ত গ্রহণের যুক্তি ব্যাখ্যা করা কঠিন | Explainable AI (XAI) ফ্রেমওয়ার্ক বাধ্যতামূলক করা |
| **কর্মসংস্থান হ্রাস** | এন্ট্রি-লেভেল ব্যাংকিং পদের সংকোচন | কর্মীদের আপস্কিলিং ও এআই তদারকি ভূমিকায় স্থানান্তর |

> **মূল সারসংক্ষেপ:** ব্যাংকিং খাতে এআই প্রয়োগের মূল লক্ষ্য কেবল অটোমেশন নয়, বরং কঠোর নিয়ন্ত্রক তদারকি (বাংলাদেশ ব্যাংক গাইডলাইন) ও নৈতিক কাঠামোর মধ্যে থেকে স্বচ্ছ ও অন্তর্ভুক্তিমূলক আর্থিক সেবা নিশ্চিত করা।`;
  }

  if (req.questionId === 'write-it-003') {
    return `## SQL Joins: Explanation, Representation, and Syntax

In relational database systems, joins combine records from two or more tables based on a related column.

### Given Tables
* **Customers**: \`customer_id\`, \`first_name\`
* **Orders**: \`order_id\`, \`customer_id\`, \`order_date\`, \`amount\`

---

### 1. Inner Join
Returns only the rows where there is a matching \`customer_id\` in both tables.

\`\`\`sql
SELECT c.customer_id, c.first_name, o.order_id, o.amount
FROM Customers c
INNER JOIN Orders o ON c.customer_id = o.customer_id;
\`\`\`

---

### 2. Left (Outer) Join
Returns all rows from the **Customers** table, along with matching rows from **Orders**. If no match exists, \`NULL\` is returned for Orders columns.

\`\`\`sql
SELECT c.customer_id, c.first_name, o.order_id, o.amount
FROM Customers c
LEFT JOIN Orders o ON c.customer_id = o.customer_id;
\`\`\`

---

### 3. Right (Outer) Join
Returns all rows from the **Orders** table, along with matching rows from **Customers**. If an order has an orphaned or unmatched \`customer_id\`, Customers columns will be \`NULL\`.

\`\`\`sql
SELECT c.customer_id, c.first_name, o.order_id, o.amount
FROM Customers c
RIGHT JOIN Orders o ON c.customer_id = o.customer_id;
\`\`\`

---

### 4. Full (Outer) Join
Returns all rows when there is a match in either the left or right table. Unmatched records on either side contain \`NULL\`.

\`\`\`sql
SELECT c.customer_id, c.first_name, o.order_id, o.amount
FROM Customers c
FULL OUTER JOIN Orders o ON c.customer_id = o.customer_id;
\`\`\`

---

### Join Comparison Matrix
| Join Type | Left Table (Customers) | Right Table (Orders) | Unmatched Rows Handling |
| :--- | :--- | :--- | :--- |
| **Inner Join** | Only matched rows | Only matched rows | Dropped entirely |
| **Left Join** | **All rows preserved** | Matched rows only | Unmatched right side is \`NULL\` |
| **Right Join** | Matched rows only | **All rows preserved** | Unmatched left side is \`NULL\` |
| **Full Join** | **All rows preserved** | **All rows preserved** | \`NULL\` where matches are missing |

> **Key Takeaway:** For financial transaction queries, **Inner Join** is standard for verified purchase records, while **Left Join** is critical for customer ledger auditing to identify inactive accounts with zero orders.`;
  }

  if (req.questionId === 'write-it-004') {
    return `## Sum of Even Numbers from 1 to $n$

### 1. Algorithmic Approach
We can calculate the sum of all even integers up to $n$ using two primary techniques:
1. **Iterative Accumulation:** Loop from $2$ to $n$ stepping by $2$.
2. **Closed-Form Formula (Optimal):**
   Let $k = \\lfloor n / 2 \\rfloor$ be the count of even integers. The sum of the first $k$ even integers is:
   $$\\sum_{i=1}^k 2i = 2 \\sum_{i=1}^k i = 2 \\cdot \\frac{k(k + 1)}{2} = k(k + 1)$$

---

### 2. Python Implementation

\`\`\`python
def sum_of_even_numbers(n: int) -> int:
    """Calculates sum of even numbers from 1 to n in O(1) time."""
    if n < 2:
        return 0
    k = n // 2
    return k * (k + 1)

# Example Execution
if __name__ == "__main__":
    test_n = 10
    result = sum_of_even_numbers(test_n)
    print(f"Sum of even numbers from 1 to {test_n} is: {result}")
    # Output: Sum of even numbers from 1 to 10 is: 30 (2 + 4 + 6 + 8 + 10)
\`\`\`

### 3. C Implementation

\`\`\`c
#include <stdio.h>

long long sum_of_even_numbers(long long n) {
    if (n < 2) return 0;
    long long k = n / 2;
    return k * (k + 1);
}

int main() {
    long long n;
    printf("Enter integer n: ");
    if (scanf("%lld", &n) == 1) {
        printf("Sum of even numbers from 1 to %lld: %lld\\n", n, sum_of_even_numbers(n));
    }
    return 0;
}
\`\`\`

---

### 4. Complexity Analysis
| Metric | Iterative Solution | Closed-Form Mathematical Solution |
| :--- | :--- | :--- |
| **Time Complexity** | $\\mathcal{O}(n)$ | **$\\mathcal{O}(1)$** (Direct arithmetic operations) |
| **Space Complexity** | $\\mathcal{O}(1)$ | **$\\mathcal{O}(1)$** (Fixed memory registers) |

> **Key Takeaway:** In high-throughput banking systems and competitive recruitment exams, mathematical reduction from $\\mathcal{O}(n)$ to $\\mathcal{O}(1)$ demonstrates superior algorithmic proficiency and prevents integer overflow traps.`;
  }

  // Generic Structured Model Answer for other questions
  if (isBn) {
    return `## পরীক্ষার আদর্শ সমাধান: ${req.category} (${req.marks} নম্বর)

### ১. মূল তত্ত্ব ও প্রেক্ষাপট
প্রশ্নোক্ত বিষয়টি বাংলাদেশ ব্যাংকিং ও প্রযুক্তিগত কাঠামোর অন্যতম গুরুত্বপূর্ণ দিক। এর সফল বাস্তবায়ন কার্যক্রমের নির্ভরযোগ্যতা ও নিরাপত্তা বৃদ্ধি করে।

### ২. কাঠামোগত বিশ্লেষণ ও প্রভাব
* **মূল উদ্দেশ্য:** সিস্টেমের নির্ভরযোগ্যতা বৃদ্ধি এবং সংবেদনশীল তথ্যের নিরাপত্তা নিশ্চিতকরণ।
* **বাস্তবায়ন কৌশল:** আধুনিক সফটওয়্যার ও প্রটোকল আর্কিটেকচার মেনে চলা।
* **নিয়ন্ত্রক প্রয়োজনীয়তা:** বাংলাদেশ ব্যাংক ও আন্তর্জাতিক ডেটা গভর্নেন্স মানদণ্ড অনুসরণ।

### ৩. তুলনামূলক বিশ্লেষণ
| উপাদান | ঐতিহ্যবাহী পদ্ধতি | আধুনিক মানদণ্ড |
| :--- | :--- | :--- |
| **দক্ষতা** | ধীরগতি ও ত্রুটিপ্রবণ | স্বয়ংক্রিয় ও নির্ভুল |
| **নিরাপত্তা** | প্রতিক্রিয়াশীল (Reactive) | সক্রিয় পর্যবেক্ষণ (Proactive) |

> **মূল সারসংক্ষেপ:** এই নীতিটির যথাযথ প্রয়োগ ব্যাংকিং খাতের স্থিতিশীলতা এবং প্রাতিষ্ঠানিক সক্ষমতা নিশ্চিত করে।`;
  }

  return `## Examiner Model Answer: ${req.category} (${req.marks} Marks)

### 1. Conceptual Framework & Core Principles
The prompt addresses a foundational requirement in banking infrastructure and mission-critical systems engineering. Understanding this architectural paradigm is vital for both system resilience and institutional compliance.

### 2. Technical Analysis & Sequence of Operations
* **Primary Objective:** Ensure fault tolerance, deterministic latency, and system integrity under high concurrent loads.
* **Architectural Trade-offs:** Balancing performance throughput against strict consistency constraints.
* **Security & Compliance:** Aligning system operations with central bank directives and international standards.

### 3. Comparison Matrix
| Architectural Aspect | Standard Implementation | Optimal Banking Grade Pattern |
| :--- | :--- | :--- |
| **Latency / Throughput** | Best-effort delivery | Guaranteed deterministic response |
| **Fault Resilience** | Manual recovery | Automated failover & circuit breakers |

> **Key Takeaway:** Demonstrating both theoretical mastery and practical architectural implications is essential for scoring full marks in descriptive technical bank examinations.`;
}

