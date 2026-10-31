import type {
  AIExplanationPayload,
  Env,
  ExplainApiRequest,
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
