/**
 * Pulsereach — Telegram Bot Long-Polling Listener
 * Continuously polls Telegram Bot API for incoming button callbacks and message updates
 * when running locally without requiring a public webhook URL.
 */

import { getEnv } from '../config/env.js';
import { getProfile } from '../profile/profile-loader.js';
import {
  handleTelegramCallback,
  handleTelegramMessage,
  syncTelegramBotCommands,
} from './bot-service.js';

let isPolling = false;

/**
 * Starts continuous long-polling for Telegram Bot callback queries and messages.
 */
export async function startTelegramPolling(): Promise<void> {
  await getProfile();
  const env = getEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  isPolling = true;

  console.log(`\n📱 =========================================================`);
  console.log(`🤖 PULSEREACH TELEGRAM BOT POLLING LISTENER ACTIVE`);
  console.log(`👂 Listening for inline button taps: [✅ Applied], [📄 Send CV], [⏭️ Skip]...`);
  console.log(`=========================================================\n`);

  // Clean up registered Telegram bot commands
  try {
    await syncTelegramBotCommands();
  } catch (err: any) {
    console.warn(`[TelegramPoller] Warning syncing commands: ${err.message}`);
  }

  // First, delete any existing webhook so long-polling can receive updates
  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
  } catch (err: any) {
    console.warn(`[TelegramPoller] Warning deleting webhook: ${err.message}`);
  }

  let offset = 0;

  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=10`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.warn(`[TelegramPoller] HTTP ${res.status} from getUpdates. Retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      const data: any = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          if (update.callback_query) {
            console.log(`\n🎯 [TelegramPoller] Processing callback: "${update.callback_query.data}" from user ${update.callback_query.from?.first_name || update.callback_query.from?.id}`);
            await handleTelegramCallback(update.callback_query);
          } else if (update.message) {
            console.log(`💬 [TelegramPoller] Message received: "${update.message.text}" from chat ${update.message.chat?.id}`);
            await handleTelegramMessage(update.message);
          }
        }
      }
    } catch (err: any) {
      if (isPolling) {
        // Transient network/timeout errors are expected during long-polling; retry quietly
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  console.log(`🛑 [TelegramPoller] Polling stopped gracefully.`);
}

/**
 * Stops the Telegram polling loop.
 */
export function stopTelegramPolling(): void {
  isPolling = false;
}

// Allow direct CLI invocation: pnpm tsx src/telegram/poll-service.ts
if (process.argv[1]?.endsWith('poll-service.ts') || process.argv[1]?.endsWith('poll-service.js')) {
  process.on('SIGINT', () => {
    console.log('\n[TelegramPoller] Received SIGINT. Shutting down...');
    stopTelegramPolling();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[TelegramPoller] Received SIGTERM. Shutting down...');
    stopTelegramPolling();
    process.exit(0);
  });

  startTelegramPolling().catch((err) => {
    console.error('Fatal Poller Error:', err);
    process.exit(1);
  });
}
