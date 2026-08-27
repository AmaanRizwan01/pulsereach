/**
 * Pulsereach — Manual On-Demand Cockpit Runner
 * Starts the Telegram long-polling listener and waits for manual commands.
 * No automatic lead fetching, no background polling, no crons.
 * The bot only acts when you explicitly tap [⚡ Next Lead] or type /next.
 */

import { startTelegramPolling, stopTelegramPolling } from '../telegram/poll-service.js';

/**
 * Starts the manual on-demand cockpit.
 * Launches Telegram long-polling so button taps and /next commands are processed in real-time.
 */
export async function startManualCockpit(): Promise<void> {
  console.log(`\n🤖 =========================================================`);
  console.log(`🎮 PULSEREACH MANUAL ON-DEMAND COCKPIT STARTED`);
  console.log(`📱 Commands: /next, /status, /reset, /help`);
  console.log(`⚡ Tap [⚡ Next Lead] in Telegram to fetch your next application.`);
  console.log(`=========================================================\n`);

  await startTelegramPolling();
}

/**
 * Stops the cockpit and Telegram polling.
 */
export function stopManualCockpit(): void {
  stopTelegramPolling();
}

// Allow direct CLI invocation: pnpm tsx src/worker/daemon.ts
if (process.argv[1]?.endsWith('daemon.ts') || process.argv[1]?.endsWith('daemon.js')) {
  process.on('SIGINT', () => {
    console.log('\n[Cockpit] Received SIGINT. Shutting down...');
    stopManualCockpit();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Cockpit] Received SIGTERM. Shutting down...');
    stopManualCockpit();
    process.exit(0);
  });

  startManualCockpit().catch((err) => {
    console.error('Fatal Cockpit Error:', err);
    process.exit(1);
  });
}
