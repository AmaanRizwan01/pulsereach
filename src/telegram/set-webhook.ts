/**
 * Pulsereach — Telegram Webhook Registrar
 * Registers the Vercel deployment URL as the Telegram Bot Webhook.
 * Usage:
 *   pnpm tsx src/telegram/set-webhook.ts https://your-app.vercel.app
 *   pnpm tsx src/telegram/set-webhook.ts --info
 *   pnpm tsx src/telegram/set-webhook.ts --delete
 */

import { getEnv } from '../config/env.js';

async function main() {
  const env = getEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  const arg = process.argv[2];

  if (!arg || arg === '--info' || arg === '-i') {
    console.log('🔍 Checking current Telegram Webhook info...');
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    console.log('Webhook Status:', JSON.stringify(data, null, 2));
    return;
  }

  if (arg === '--delete' || arg === '-d') {
    console.log('🗑️ Deleting Telegram Webhook (enabling local polling)...');
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
    const data = await res.json();
    console.log('Result:', JSON.stringify(data, null, 2));
    return;
  }

  let baseUrl = arg.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  // Strip trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');

  const webhookUrl = `${baseUrl}/api/telegram`;
  console.log(`🌐 Registering Telegram Webhook to: ${webhookUrl}`);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'callback_query']))}`);
  const data = await res.json();

  if (data.ok) {
    console.log(`\n✅ Telegram Webhook registered successfully!`);
    console.log(`📡 URL: ${webhookUrl}`);
    console.log(`📱 All button taps and /next commands in Telegram will now hit Vercel automatically.`);
  } else {
    console.error(`❌ Failed to set webhook:`, data);
  }
}

main().catch((err) => {
  console.error('Fatal Webhook Error:', err);
  process.exit(1);
});
