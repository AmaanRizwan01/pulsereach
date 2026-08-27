/**
 * Pulsereach — Telegram Cockpit Initialization Script
 * 1. Registers slash commands (/next, /status, /reset, /help) with Telegram Bot API
 * 2. Sends an activation message with the persistent Reply Keyboard ([⚡ Next Lead] | [📊 Status])
 */

import { syncTelegramBotCommands, sendMessageWithKeyboard } from '../telegram/bot-service.js';
import { getEnv } from '../config/env.js';

async function main() {
  const env = getEnv();
  console.log('🤖 Synchronizing Telegram Bot Cockpit...');
  console.log('• Chat ID:', env.TELEGRAM_CHAT_ID);

  console.log('\n1️⃣ Registering slash commands with Telegram Bot API...');
  const synced = await syncTelegramBotCommands();
  console.log('✅ Commands synced:', synced);

  console.log('\n2️⃣ Sending activation message with Reply Keyboard...');
  const sent = await sendMessageWithKeyboard(
    env.TELEGRAM_CHAT_ID,
    `🎮 <b>Pulsereach Cloud Cockpit Activated!</b>\n\n` +
    `⚡ Tap <b>[⚡ Next Lead]</b> below to fetch and prepare your next job application.\n` +
    `📊 Tap <b>[📊 Status]</b> to inspect queue backlog.\n` +
    `🔄 Type <code>/reset</code> if you ever need to clear locks.`
  );

  if (sent) {
    console.log('✅ Activation message & Reply Keyboard sent to your Telegram chat successfully!');
  } else {
    console.warn('⚠️ Could not deliver message to Telegram chat. Please check your TELEGRAM_CHAT_ID.');
  }
}

main().catch((err) => {
  console.error('Fatal Init Error:', err);
  process.exit(1);
});
