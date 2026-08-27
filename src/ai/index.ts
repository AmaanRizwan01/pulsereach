/**
 * Pulsereach — Core Gemini AI Client & Structured Output Engine
 * Interfaces with Google Gemini Flash with token-bucket rate limiting, multi-model fallback,
 * intelligent 429 quota backoff, and em-dash sanitization.
 */

import { getEnv } from '../config/env.js';
import { throttle } from '../rate-limiter/token-bucket.js';

export interface GenerateJsonOptions {
  /** Target Gemini model override (defaults to env.AI_MODEL) */
  model?: string;
  /** Optional system instruction prompt */
  systemInstruction?: string;
  /** Primary user prompt */
  prompt: string;
  /** Optional JSON Schema object for structured generation */
  schema?: Record<string, unknown>;
  /** Sampling temperature (0.0 to 1.0) */
  temperature?: number;
}

const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash'];

/**
 * Recursively strips em-dashes (—, –, --) from strings within objects and arrays.
 */
export function sanitizeEmDashes<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/[\u2014\u2013]/g, ', ')
      .replace(/\s*--\s*/g, ', ') as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEmDashes(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitizedObj[k] = sanitizeEmDashes(v);
    }
    return sanitizedObj as T;
  }

  return value;
}

/**
 * Safely parses JSON from Gemini responses, stripping markdown fences and control characters,
 * and recursively removing em-dashes from string values.
 *
 * @param raw - Raw string from model output
 * @returns Typed parsed JSON object
 */
export function parseJsonSafely<T>(raw: string): T {
  let text = raw.trim();

  // Strip markdown ```json ... ``` or ``` ... ```
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    // Attempt relaxed cleanup for unescaped control characters or quotes
    const cleaned = text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\\'/g, "'");
    parsed = JSON.parse(cleaned) as T;
  }

  return sanitizeEmDashes(parsed);
}

/**
 * Calls Google Gemini API with rate limiting, multi-model fallback, and intelligent quota retry.
 *
 * @param options - Prompt, schema, and model configuration
 * @returns Strongly typed structured JSON response
 */
export async function generateStructuredJson<T>(options: GenerateJsonOptions): Promise<T> {
  const env = getEnv();
  const primaryModel = options.model || env.AI_TAILORING_MODEL || env.AI_MODEL || 'gemini-3.6-flash';

  const candidateModels = Array.from(new Set([primaryModel, ...FALLBACK_MODELS]));
  let lastError: Error | undefined;

  for (const model of candidateModels) {
    let attempts = 0;
    while (attempts < 4) {
      attempts++;
      try {
        await throttle('gemini');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

        const generationConfig: Record<string, unknown> = {
          responseMimeType: 'application/json',
        };

        if (options.schema) {
          generationConfig.responseSchema = options.schema;
        }

        if (typeof options.temperature === 'number') {
          generationConfig.temperature = options.temperature;
        }

        const payload: Record<string, unknown> = {
          contents: [{ parts: [{ text: options.prompt }] }],
          generationConfig,
        };

        if (options.systemInstruction) {
          payload.systemInstruction = {
            parts: [{ text: options.systemInstruction }],
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok || !data.candidates || data.candidates.length === 0) {
          const errorMsg = data.error?.message || `HTTP ${response.status} (${response.statusText})`;
          
          // Check for temporary quota spike and wait for reset window
          const retryMatch = errorMsg.match(/Please retry in (\d+(\.\d+)?)s/i);
          if (retryMatch) {
            const waitMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000;
            console.log(`⏳ [AI Client] Rate quota active on '${model}'. Waiting ${Math.ceil(waitMs / 1000)}s for quota bucket reset...`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }

          throw new Error(`Gemini API Error (${model}): ${errorMsg}`);
        }

        const rawText = data.candidates[0].content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error(`Gemini API Error (${model}): Empty content in candidate parts`);
        }

        return parseJsonSafely<T>(rawText);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`⚠️ [AI Client] Model '${model}' attempt ${attempts} failed: ${lastError.message}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  throw lastError || new Error('All candidate Gemini models exhausted without success');
}

export * from '../profile/types.js';
export * from '../profile/profile-loader.js';
export * from './candidate-data.js';
export * from './ats-evaluator.js';
export * from './resume-compiler.js';
export * from './resume-tailorer.js';
export * from './cover-letter-generator.js';
export * from './email-generator.js';
export * from './followup-generator.js';
export * from './conversation-classifier.js';
export * from './response-drafter.js';
export * from './conversational-modifier.js';
export * from './match-evaluator.js';
export * from './pdf-compiler.js';
