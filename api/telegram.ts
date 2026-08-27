/**
 * Pulsereach — Vercel Serverless Webhook Endpoint: Telegram Bot Updates & Callback Query Dispatcher
 * Receives incoming Telegram inline button interactions and routes them to bot-service.ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTelegramCallback, handleTelegramMessage } from '../src/telegram/bot-service.js';
import { getProfile } from '../src/profile/profile-loader.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await getProfile();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let update = req.body;
  if (typeof update === 'string') {
    try {
      update = JSON.parse(update);
    } catch {}
  }

  if (!update || typeof update !== 'object') {
    return res.status(400).json({ error: 'Bad request: Expected JSON update payload.' });
  }

  try {
    // 1. Handle Inline Button Callback Queries
    if (update.callback_query) {
      console.log(`[TelegramWebhook] Received callback query "${update.callback_query.data}" from user ${update.callback_query.from?.id}`);
      await handleTelegramCallback(update.callback_query);
      return res.status(200).json({ ok: true, handled: 'callback_query' });
    }

    // 2. Handle Direct Messages or Slash Commands (/status, /help, /start)
    if (update.message) {
      const text = update.message.text || '';
      console.log(`[TelegramWebhook] Received direct message: "${text}" from chat ${update.message.chat?.id}`);
      await handleTelegramMessage(update.message);
      return res.status(200).json({ ok: true, handled: 'message' });
    }

    return res.status(200).json({ ok: true, handled: 'noop' });
  } catch (err: any) {
    console.error('[TelegramWebhook] Error processing update:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
