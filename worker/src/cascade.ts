import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';
import type {
  AIExplanationPayload,
  Env,
  ExplainApiRequest,
  OptionKey,
} from './types.js';

interface RawOptionDiagnostic {
  status: 'CORRECT' | 'TRAP_DISTRACTOR';
  verdict: string;
}

interface RawExplanationResponse {
  coreConcept: string;
  examHallShortcut: string;
  stepByStep: string;
  optionDiagnostics: Record<OptionKey, RawOptionDiagnostic>;
}

export function parseAndValidateAIResponse(
  rawText: string,
  req: ExplainApiRequest,
  modelName: string
): AIExplanationPayload | null {
  try {
    let clean = rawText.trim();
    // Strip markdown code fences if present
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(clean) as RawExplanationResponse;

    if (!parsed.coreConcept || !parsed.examHallShortcut || !parsed.optionDiagnostics) {
      return null;
    }

    const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
    const diagnostics: Record<OptionKey, { status: 'CORRECT' | 'TRAP_DISTRACTOR'; verdict: string }> = {} as any;

    for (const key of optionKeys) {
      const diag = parsed.optionDiagnostics[key];
      const isCorrect = key === req.correctOption;
      diagnostics[key] = {
        status: isCorrect ? 'CORRECT' : 'TRAP_DISTRACTOR',
        verdict:
          diag?.verdict ||
          (isCorrect
            ? `Matches the official answer key: ${req.options[key]}`
            : `Plausible distractor trap for ${req.options[key]}`),
      };
    }

    return {
      questionId: req.questionId,
      coreConcept: parsed.coreConcept,
      examHallShortcut: parsed.examHallShortcut,
      stepByStep: parsed.stepByStep || 'Step-by-step derivation aligned with IBA/BIBM standard.',
      optionDiagnostics: diagnostics,
      generatedBy: modelName,
      cachedAt: Date.now(),
    };
  } catch (err: any) {
    console.error(`Failed to parse AI output from ${modelName}:`, err?.message);
    return null;
  }
}

export async function executeAICascade(
  req: ExplainApiRequest,
  env: Env
): Promise<AIExplanationPayload> {
  const userPrompt = buildUserPrompt(req);

  // --- Tier 1: Cloudflare Workers AI - Llama 3.3 70B ---
  try {
    if (env.AI) {
      const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
      const aiResponse: any = await env.AI.run(model, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      });

      const responseText = aiResponse?.response || aiResponse?.text || '';
      const payload = parseAndValidateAIResponse(responseText, req, model);
      if (payload) return payload;
    }
  } catch (e: any) {
    console.warn('Tier 1 (@cf/meta/llama-3.3-70b) failed:', e?.message);
  }

  // --- Tier 2: Cloudflare Workers AI - Llama 3.1 8B Fast ---
  try {
    if (env.AI) {
      const model = '@cf/meta/llama-3.1-8b-instruct-fast';
      const aiResponse: any = await env.AI.run(model, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      });

      const responseText = aiResponse?.response || aiResponse?.text || '';
      const payload = parseAndValidateAIResponse(responseText, req, model);
      if (payload) return payload;
    }
  } catch (e: any) {
    console.warn('Tier 2 (@cf/meta/llama-3.1-8b) failed:', e?.message);
  }

  // --- Tier 3: OpenRouter Free Fallback ---
  if (env.OPENROUTER_API_KEY) {
    try {
      const model = 'meta-llama/llama-3.3-70b-instruct:free';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://bank-intel.workers.dev',
          'X-Title': 'Bank Intel PWA',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const json: any = await res.json();
        const content = json.choices?.[0]?.message?.content || '';
        const payload = parseAndValidateAIResponse(content, req, model);
        if (payload) return payload;
      }
    } catch (e: any) {
      console.warn('Tier 3 OpenRouter Free failed:', e?.message);
    }

    // --- Tier 4: OpenRouter Paid Fallback (gpt-4o-mini) ---
    try {
      const model = 'openai/gpt-4o-mini';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://bank-intel.workers.dev',
          'X-Title': 'Bank Intel PWA',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const json: any = await res.json();
        const content = json.choices?.[0]?.message?.content || '';
        const payload = parseAndValidateAIResponse(content, req, model);
        if (payload) return payload;
      }
    } catch (e: any) {
      console.warn('Tier 4 OpenRouter gpt-4o-mini failed:', e?.message);
    }
  }

  // Deterministic algorithmic fallback if all AI models timeout or fail
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
          ? `Exact match with the standard solution: ${req.options.A}.`
          : `Distractor trap: Candidates select "${req.options.A}" due to premature evaluation or sign inversion.`,
    },
    B: {
      status: req.correctOption === 'B' ? 'CORRECT' : 'TRAP_DISTRACTOR',
      verdict:
        req.correctOption === 'B'
          ? `Exact match with the standard solution: ${req.options.B}.`
          : `Distractor trap: Candidates select "${req.options.B}" due to rounding or overlooking constraint bounds.`,
    },
    C: {
      status: req.correctOption === 'C' ? 'CORRECT' : 'TRAP_DISTRACTOR',
      verdict:
        req.correctOption === 'C'
          ? `Exact match with the standard solution: ${req.options.C}.`
          : `Distractor trap: Candidates select "${req.options.C}" by confusing numerator and denominator values.`,
    },
    D: {
      status: req.correctOption === 'D' ? 'CORRECT' : 'TRAP_DISTRACTOR',
      verdict:
        req.correctOption === 'D'
          ? `Exact match with the standard solution: ${req.options.D}.`
          : `Distractor trap: Common arithmetic misstep or incorrect grammatical rule application.`,
    },
  };

  return {
    questionId: req.questionId,
    coreConcept: isMath
      ? 'Apply fundamental algebraic identity or proportional rate formula.'
      : `Core standard principle for ${req.subject.toLowerCase().replace('_', ' ')}.`,
    examHallShortcut: `Eliminate extremes immediately. Focus strictly on option [${req.correctOption}] (${correctText}) under 30s.`,
    stepByStep: `1. Identify target property from prompt.\n2. Deduce canonical value: [${req.correctOption}] (${correctText}).\n3. Confirm alignment with exam answer key.`,
    optionDiagnostics,
    generatedBy: 'deterministic-faculty-fallback',
    cachedAt: Date.now(),
  };
}

