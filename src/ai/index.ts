/**
 * Pulsereach — Core Gemini AI Client & Structured Output Engine
 * Interfaces with Google Gemini with token-bucket rate limiting, intelligent multi-model fast failover,
 * in-memory circuit breaker cooldown, AbortController timeouts, and zero em-dash sanitization.
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

/**
 * Verified list of active Google Gemini models ordered by throughput, speed, and availability.
 */
const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
];

/** In-memory circuit breaker cooldown map (model -> expiration timestamp) */
const MODEL_COOLDOWNS = new Map<string, number>();
const COOLDOWN_DURATION_MS = 2 * 60 * 1000; // 2 minutes cooldown on capacity error

let lastSuccessfulModel = 'gemini-3.5-flash';

/**
 * Returns the model identifier that successfully generated the most recent AI response.
 */
export function getLastUsedModel(): string {
  return lastSuccessfulModel;
}

/**
 * Checks if a model is currently in temporary cooldown due to a capacity/quota spike.
 */
export function isModelInCooldown(model: string): boolean {
  const expiresAt = MODEL_COOLDOWNS.get(model);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    MODEL_COOLDOWNS.delete(model);
    return false;
  }
  return true;
}

/**
 * Marks a model into cooldown so subsequent calls bypass it immediately.
 */
export function markModelCooldown(model: string, durationMs = COOLDOWN_DURATION_MS): void {
  MODEL_COOLDOWNS.set(model, Date.now() + durationMs);
}

/**
 * Determines whether an error message warrants immediate fast-failover to the next fallback model.
 */
function isImmediateFailoverError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes('high demand') ||
    lower.includes('spikes in demand') ||
    lower.includes('overloaded') ||
    lower.includes('no longer available') ||
    lower.includes('quota exceeded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('503') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('aborted') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('fetch failed')
  );
}

/**
 * Recursively strips em-dashes from strings within objects and arrays.
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
 * Calls Google Gemini API with token-bucket rate limiting, immediate multi-model fast failover,
 * and in-memory circuit breaker cooldown.
 *
 * @param options - Prompt, schema, and model configuration
 * @returns Strongly typed structured JSON response
 */
export async function generateStructuredJson<T>(options: GenerateJsonOptions): Promise<T> {
  const env = getEnv();
  const primaryModel = options.model || env.AI_TAILORING_MODEL || env.AI_MODEL || 'gemini-3.5-flash';

  const allModels = Array.from(new Set([primaryModel, ...FALLBACK_MODELS]));
  // Prioritize models that are not in cooldown
  const candidateModels = [
    ...allModels.filter((m) => !isModelInCooldown(m)),
    ...allModels.filter((m) => isModelInCooldown(m)),
  ];

  let lastError: Error | undefined;

  for (const model of candidateModels) {
    if (isModelInCooldown(model) && candidateModels.some((m) => !isModelInCooldown(m))) {
      console.log(`⏭️ [AI Client] Skipping model '${model}' (in active cooldown)...`);
      continue;
    }

    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok || !data.candidates || data.candidates.length === 0) {
          const errorMsg = data.error?.message || `HTTP ${response.status} (${response.statusText})`;

          if (isImmediateFailoverError(errorMsg)) {
            markModelCooldown(model);
            console.warn(`⚡ [AI Client] Model '${model}' capacity/quota error: ${errorMsg}. Instantly switching to next fallback model...`);
            lastError = new Error(`Gemini API Error (${model}): ${errorMsg}`);
            break; // Immediately exit retry loop and try next model
          }

          // Check for temporary short quota spike
          const retryMatch = errorMsg.match(/Please retry in (\d+(\.\d+)?)s/i);
          if (retryMatch) {
            const waitSec = parseFloat(retryMatch[1]);
            if (waitSec <= 3) {
              const waitMs = Math.ceil(waitSec * 1000) + 1000;
              console.log(`⏳ [AI Client] Short rate quota on '${model}'. Waiting ${Math.ceil(waitMs / 1000)}s for reset...`);
              await new Promise((r) => setTimeout(r, waitMs));
              continue;
            } else {
              markModelCooldown(model);
              console.warn(`⚡ [AI Client] Model '${model}' quota wait too long (${waitSec}s). Fast failing over to next model...`);
              lastError = new Error(`Gemini API Error (${model}): ${errorMsg}`);
              break;
            }
          }

          throw new Error(`Gemini API Error (${model}): ${errorMsg}`);
        }

        const rawText = data.candidates[0].content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error(`Gemini API Error (${model}): Empty content in candidate parts`);
        }

        lastSuccessfulModel = model;
        return parseJsonSafely<T>(rawText);
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        lastError = err instanceof Error ? err : new Error(String(err));

        if (isImmediateFailoverError(lastError.message)) {
          markModelCooldown(model);
          console.warn(`⚡ [AI Client] Model '${model}' failed with '${lastError.message}'. Instantly failing over to next fallback model...`);
          break;
        }

        console.warn(`⚠️ [AI Client] Model '${model}' attempt ${attempts} failed: ${lastError.message}`);
        await new Promise((r) => setTimeout(r, 1000));
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
