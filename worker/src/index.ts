import { rateLimiter } from './ratelimit.js';
import { getCachedExplanation, setCachedExplanation } from './cache.js';
import { executeAICascade, runWritingCascade } from './cascade.js';
import type {
  Env,
  ExplainApiRequest,
  ExplainApiResponse,
  ExplainWritingRequest,
  ExplainWritingResponse,
} from './types.js';

function createCorsHeaders(origin = '*'): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Content-Type', 'application/json');
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = createCorsHeaders(origin);

    // 1. Handle Preflight OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 2. Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'bank-intel-worker',
          version: '1.0.0',
          timestamp: Date.now(),
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. POST /api/v1/explain
    if (url.pathname === '/api/v1/explain' && request.method === 'POST') {
      // Extract client IP
      const ip =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        '127.0.0.1';

      // Evaluate Rate Limiting (60 req/min + 20 burst, O(1) in-memory)
      const rl = rateLimiter.check(ip);
      corsHeaders.set('X-RateLimit-Limit', '80');
      corsHeaders.set('X-RateLimit-Remaining', String(rl.remaining));
      corsHeaders.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)));

      if (!rl.allowed) {
        corsHeaders.set('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
        const errorBody: ExplainApiResponse = {
          ok: false,
          cacheStatus: 'MISS_GENERATED',
          error: 'Rate limit exceeded (60 req/min). Please try again shortly.',
        };
        return new Response(JSON.stringify(errorBody), {
          status: 429,
          headers: corsHeaders,
        });
      }

      // Parse and validate request JSON
      let reqBody: ExplainApiRequest;
      try {
        reqBody = (await request.json()) as ExplainApiRequest;
      } catch {
        const errorBody: ExplainApiResponse = {
          ok: false,
          cacheStatus: 'MISS_GENERATED',
          error: 'Malformed JSON payload.',
        };
        return new Response(JSON.stringify(errorBody), {
          status: 400,
          headers: corsHeaders,
        });
      }

      if (
        !reqBody.questionId ||
        !reqBody.stem ||
        !reqBody.options ||
        !reqBody.correctOption
      ) {
        const errorBody: ExplainApiResponse = {
          ok: false,
          cacheStatus: 'MISS_GENERATED',
          error: 'Missing required fields: questionId, stem, options, correctOption.',
        };
        return new Response(JSON.stringify(errorBody), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const cacheKey = reqBody.hash || reqBody.questionId;

      // Check L3a / L3b Cache
      const { payload: cachedPayload, source } = await getCachedExplanation(
        cacheKey,
        env.CACHE
      );

      if (cachedPayload && source) {
        corsHeaders.set('X-Cache-Status', source);
        const responseBody: ExplainApiResponse = {
          ok: true,
          cacheStatus: source,
          data: cachedPayload,
        };
        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // Cache Miss: Execute Multi-Model Cascade
      try {
        const generatedPayload = await executeAICascade(reqBody, env);

        // Populate L3b (KV with 90-day TTL) & L3a (Isolate LRU)
        await setCachedExplanation(cacheKey, generatedPayload, env.CACHE);

        corsHeaders.set('X-Cache-Status', 'MISS_GENERATED');
        const responseBody: ExplainApiResponse = {
          ok: true,
          cacheStatus: 'MISS_GENERATED',
          data: generatedPayload,
        };
        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: corsHeaders,
        });
      } catch (err: any) {
        console.error('Cascade error:', err?.message);
        const errorBody: ExplainApiResponse = {
          ok: false,
          cacheStatus: 'MISS_GENERATED',
          error: 'Failed to generate explanation. Please try again.',
        };
        return new Response(JSON.stringify(errorBody), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // 4. POST /api/v1/explain-writing (Subjective & Descriptive Writing Answers)
    if (url.pathname === '/api/v1/explain-writing' && request.method === 'POST') {
      const ip =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        '127.0.0.1';

      // Rate limiting check
      const rl = rateLimiter.check(ip);
      corsHeaders.set('X-RateLimit-Limit', '80');
      corsHeaders.set('X-RateLimit-Remaining', String(rl.remaining));
      corsHeaders.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)));

      if (!rl.allowed) {
        corsHeaders.set('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
        const errorBody: ExplainWritingResponse = {
          ok: false,
          error: 'Rate limit exceeded (60 req/min). Please try again shortly.',
        };
        return new Response(JSON.stringify(errorBody), {
          status: 429,
          headers: corsHeaders,
        });
      }

      // Parse and strictly validate body
      let reqBody: any;
      try {
        reqBody = await request.json();
      } catch {
        const errorBody: ExplainWritingResponse = {
          ok: false,
          error: 'Malformed JSON payload.',
        };
        return new Response(JSON.stringify(errorBody), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const { questionId, category, stem, marks } = reqBody ?? {};

      if (
        ![questionId, category, stem].every((v) => typeof v === 'string' && v.trim().length > 0) ||
        typeof marks !== 'number' ||
        marks <= 0 ||
        stem.length > 2000
      ) {
        const errorBody: ExplainWritingResponse = {
          ok: false,
          error:
            'Invalid request body. Required: questionId (string), category (string), stem (string <= 2000 chars), marks (positive number).',
        };
        return new Response(JSON.stringify(errorBody), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const writingReq: ExplainWritingRequest = {
        questionId: questionId.trim(),
        category: category.trim(),
        stem: stem.trim(),
        marks,
      };

      // Check Edge KV Cache if available
      const kvKey = `writing:v1:${writingReq.questionId}`;
      if (env.CACHE) {
        try {
          const cachedAnswer = await env.CACHE.get(kvKey);
          if (cachedAnswer) {
            corsHeaders.set('X-Cache-Status', 'HIT_KV');
            const resp: ExplainWritingResponse = {
              ok: true,
              modelAnswer: cachedAnswer,
              generatedBy: 'edge-kv-cache',
            };
            return new Response(JSON.stringify(resp), {
              status: 200,
              headers: corsHeaders,
            });
          }
        } catch {
          // Ignore KV read failures
        }
      }

      // Execute Multi-Model Writing Cascade
      try {
        const cascadeResult = await runWritingCascade(writingReq, env);

        // Store in KV cache for 90 days (7,776,000 seconds)
        if (env.CACHE && cascadeResult.markdown) {
          env.CACHE.put(kvKey, cascadeResult.markdown, { expirationTtl: 7776000 }).catch(() => {});
        }

        corsHeaders.set('X-Cache-Status', 'MISS_GENERATED');
        const resp: ExplainWritingResponse = {
          ok: true,
          modelAnswer: cascadeResult.markdown,
          generatedBy: cascadeResult.generatedBy,
        };
        return new Response(JSON.stringify(resp), {
          status: 200,
          headers: corsHeaders,
        });
      } catch (err: any) {
        console.error('explain-writing cascade error:', err?.message || String(err));
        const errorBody: ExplainWritingResponse = {
          ok: false,
          error: 'Failed to generate examiner model answer. Please try again.',
        };
        return new Response(JSON.stringify(errorBody), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: false, error: 'Endpoint not found.' }),
      { status: 404, headers: corsHeaders }
    );
  },
};

