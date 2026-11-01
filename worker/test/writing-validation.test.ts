import worker from '../src/index.js';
import type { Env } from '../src/types.js';

console.log('--- Testing Worker /api/v1/explain-writing Validation ---');

const mockEnv: Env = {
  AI: null,
  CACHE: null as any,
  ALLOWED_ORIGIN: '*',
};

async function testValidation() {
  // Test 1: OPTIONS preflight
  const optionsReq = new Request('https://worker.local/api/v1/explain-writing', {
    method: 'OPTIONS',
  });
  const optionsRes = await worker.fetch(optionsReq, mockEnv);
  if (optionsRes.status !== 204) {
    throw new Error(`Expected OPTIONS 204, got ${optionsRes.status}`);
  }
  console.log('✅ OPTIONS preflight returned 204');

  // Test 2: Missing fields (400)
  const badReq = new Request('https://worker.local/api/v1/explain-writing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: 'test' }),
  });
  const badRes = await worker.fetch(badReq, mockEnv);
  if (badRes.status !== 400) {
    throw new Error(`Expected 400 for missing fields, got ${badRes.status}`);
  }
  console.log('✅ Missing fields properly rejected with 400');

  // Test 3: Stem exceeding 2000 chars (400)
  const oversizedReq = new Request('https://worker.local/api/v1/explain-writing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionId: 'test-oversized',
      category: 'Test',
      stem: 'a'.repeat(2001),
      marks: 10,
    }),
  });
  const oversizedRes = await worker.fetch(oversizedReq, mockEnv);
  if (oversizedRes.status !== 400) {
    throw new Error(`Expected 400 for stem > 2000 chars, got ${oversizedRes.status}`);
  }
  console.log('✅ Stem > 2000 chars rejected with 400');

  // Test 4: Valid Request with fallback execution (200)
  const validReq = new Request('https://worker.local/api/v1/explain-writing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionId: 'write-it-001',
      category: 'Focus Writing & Essay',
      stem: 'বাংলাদেশের ব্যাংকিং খাতে কৃত্রিম বুদ্ধিমত্তার প্রয়োগ...',
      marks: 10,
    }),
  });
  const validRes = await worker.fetch(validReq, mockEnv);
  if (validRes.status !== 200) {
    throw new Error(`Expected 200 for valid request, got ${validRes.status}`);
  }
  const json: any = await validRes.json();
  if (!json.ok || !json.modelAnswer || !json.generatedBy) {
    throw new Error('Invalid writing response body structure');
  }
  console.log('✅ Valid request returned 200 with model answer and telemetry');
}

testValidation().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

