/**
 * Pulsereach — Vercel Serverless Webhook Endpoint: Manual JIT Trigger
 * Authenticated endpoint for on-demand lead generation.
 * No longer auto-triggered by Google Sheets Apps Script.
 * Can be called manually (e.g. from a bookmarklet or HTTP client) for cloud-based generation.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processSingleJobJustInTime, runJobBatchPipeline } from '../src/worker/pipeline.js';
import { getEnv } from '../src/config/env.js';

let lastTriggerTimestamp = 0;
const DEBOUNCE_WINDOW_MS = 30 * 1000; // 30 seconds debounce

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const env = getEnv();
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {}
  }

  const providedSecret =
    req.headers['x-webhook-secret'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    body?.secret;

  if (!providedSecret || providedSecret !== env.WEBHOOK_SECRET) {
    console.warn('[WebhookTrigger] Unauthorized trigger request rejected.');
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing webhook secret.' });
  }

  const now = Date.now();
  const timeSinceLastRun = now - lastTriggerTimestamp;

  if (timeSinceLastRun < DEBOUNCE_WINDOW_MS) {
    const waitSeconds = Math.ceil((DEBOUNCE_WINDOW_MS - timeSinceLastRun) / 1000);
    console.log(`[WebhookTrigger] Debounce active. Last run was ${Math.floor(timeSinceLastRun / 1000)}s ago. Skipping duplicate.`);
    return res.status(429).json({
      message: `Trigger debounced. Please wait ${waitSeconds}s before re-triggering.`,
      debounced: true,
    });
  }

  lastTriggerTimestamp = now;

  try {
    const isBatch = body?.mode === 'batch';
    if (isBatch) {
      const maxJobs = typeof body?.maxJobs === 'number' ? body.maxJobs : 5;
      console.log(`[WebhookTrigger] Batch mode requested. Starting batch pipeline (maxJobs: ${maxJobs})...`);
      const summary = await runJobBatchPipeline({ maxJobs });
      return res.status(200).json({
        message: 'Batch pipeline executed successfully.',
        summary,
      });
    }

    // Default: JIT single lead generation (executed directly, no GitHub Actions roundtrip)
    console.log('[WebhookTrigger] Authenticated trigger received. Running JIT single lead generation...');
    const targetRow = typeof body?.targetRowNumber === 'number' ? body.targetRowNumber : undefined;
    const jitResult = await processSingleJobJustInTime({ targetRowNumber: targetRow });

    return res.status(200).json({
      message: 'JIT single lead pipeline executed.',
      jitResult,
    });
  } catch (err: any) {
    console.error('[WebhookTrigger] Pipeline execution error:', err);
    return res.status(500).json({
      error: 'Pipeline execution failed.',
      details: err.message,
    });
  }
}
