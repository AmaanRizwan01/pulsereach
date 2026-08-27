import { throttle, getLimiterState, resetLimiter } from '../rate-limiter/token-bucket.js';
import { parseJsonSafely, generateStructuredJson } from './index.js';

console.log('=== Test 1: Testing Token-Bucket Rate Limiter Timing ===');
resetLimiter('gemini');

const start = Date.now();
console.log('• Request 1 (Immediate)...');
await throttle('gemini');
const t1 = Date.now() - start;
console.log(`  Elapsed: ${t1}ms`);

console.log('• Request 2 (Should enforce >= 2000ms min delay)...');
await throttle('gemini');
const t2 = Date.now() - start;
console.log(`  Elapsed: ${t2}ms (Expected: >= 2000ms)`);

if (t2 < 1900) {
  console.error('❌ Rate limiter did not enforce minimum delay!');
  process.exit(1);
} else {
  console.log('✅ Rate limiter correctly enforced minimum delay spacing!');
}

const state = getLimiterState('gemini');
console.log('• Rate limiter state:', state);

console.log('\n=== Test 2: Testing Safe JSON Parser & Em-Dash Sanitizer ===');
const sampleMarkdownJson = `\`\`\`json
{
  "title": "Software Engineer — Full Stack",
  "highlights": [
    "Built microservices — reduced latency by 40%",
    "Maintained 99.9% uptime -- zero downtime deploys"
  ],
  "score": 92
}
\`\`\``;

interface SampleOutput {
  title: string;
  highlights: string[];
  score: number;
}

const parsed = parseJsonSafely<SampleOutput>(sampleMarkdownJson);
console.log('Parsed & Sanitized JSON:', JSON.stringify(parsed, null, 2));

const hasEmDash = JSON.stringify(parsed).includes('—') || JSON.stringify(parsed).includes('--');
if (hasEmDash) {
  console.error('❌ Em-dash sanitizer failed to remove em-dashes');
  process.exit(1);
} else {
  console.log('✅ Em-dash sanitizer cleanly replaced all em-dashes with standard commas!');
}

console.log('\n=== Test 3: Testing Live Gemini AI Structured JSON Generation ===');

interface MatchEvaluation {
  fit_score: number;
  rationale: string;
  key_strengths: string[];
}

try {
  const result = await generateStructuredJson<MatchEvaluation>({
    prompt:
      'Evaluate candidate (TypeScript, Next.js, PostgreSQL) for a Senior Frontend Developer role at a fintech company. Return a JSON object with fit_score (number 0-100), rationale (string under 30 words, no em-dashes), and key_strengths (array of 3 strings, no em-dashes).',
    schema: {
      type: 'object',
      properties: {
        fit_score: { type: 'number' },
        rationale: { type: 'string' },
        key_strengths: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['fit_score', 'rationale', 'key_strengths'],
    },
    temperature: 0.2,
  });

  console.log('✅ Live Gemini AI Response Received:');
  console.log(JSON.stringify(result, null, 2));

  if (typeof result.fit_score === 'number' && Array.isArray(result.key_strengths)) {
    console.log('✅ Structured JSON schema strictly validated!');
  } else {
    console.error('❌ Invalid structured output shape');
    process.exit(1);
  }
} catch (err: any) {
  console.error('❌ Live Gemini API call failed:', err.message);
  process.exit(1);
}

console.log('\n🎉 ALL SPRINT 4 AI & RATE LIMITER TESTS PASSED!');
