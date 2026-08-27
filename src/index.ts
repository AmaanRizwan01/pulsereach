/**
 * Pulsereach — Main Runtime Entrypoint
 * Default mode: starts the manual on-demand Telegram cockpit (listens for /next, /status, /reset).
 * Optional flags: --batch (batch processing), --single/--next (one-shot JIT generation).
 */

import { getEnv } from './config/env.js';
import { processSingleJobJustInTime, runJobBatchPipeline } from './worker/pipeline.js';
import { startManualCockpit } from './worker/daemon.js';

export async function main(): Promise<void> {
  console.log('🚀 === Pulsereach UAE Job Outreach & Application Engine ===\n');

  try {
    const env = getEnv();
    console.log('✅ Configuration loaded and validated successfully.');
    console.log(`• Outreach Sender: ${env.GMAIL_SENDER_EMAIL}`);
    console.log(`• SpreadSheet ID: ${env.GOOGLE_SPREADSHEET_ID}`);
    console.log(`• Telegram Chat: ${env.TELEGRAM_CHAT_ID}`);

    const isDryRun = process.argv.includes('--dry-run');
    const isForce = process.argv.includes('--force');
    const isBatch = process.argv.includes('--batch');
    const isSingle = process.argv.includes('--single') || process.argv.includes('--next');

    if (isBatch) {
      const maxJobsArg = process.argv.find((arg) => arg.startsWith('--max-jobs='));
      const maxJobs = maxJobsArg ? parseInt(maxJobsArg.split('=')[1], 10) : 5;

      console.log(`\n▶️ Executing Job Batch Pipeline (dryRun: ${isDryRun}, maxJobs: ${maxJobs})...\n`);
      const summary = await runJobBatchPipeline({ dryRun: isDryRun, maxJobs });

      console.log('\n========================================');
      console.log('🏁 Batch Run Complete!');
      console.log(`• Total Ingested Rows: ${summary.totalFetched}`);
      console.log(`• Jobs Processed: ${summary.processedCount}`);
      console.log(`• Successful Drafts: ${summary.successCount}`);
      console.log(`• Failed: ${summary.failedCount}`);
      console.log(`• Remaining Daily Budget: ${summary.remainingDailyBudget}`);
      console.log('========================================\n');
      return;
    }

    if (isSingle) {
      const rowArg = process.argv.find((arg) => arg.startsWith('--row='));
      const targetRowNumber = rowArg ? parseInt(rowArg.split('=')[1], 10) : undefined;

      console.log(`\n▶️ Executing Just-In-Time (JIT) Single Lead Generation (dryRun: ${isDryRun}, force: ${isForce}, row: ${targetRowNumber || 'next'})...\n`);
      const jitResult = await processSingleJobJustInTime({ dryRun: isDryRun, force: isForce, targetRowNumber });

      console.log('\n========================================');
      if (jitResult.processed) {
        console.log('🏁 JIT Lead Generation Succeeded!');
        console.log(`• Lead: "${jitResult.jobTitle}" at "${jitResult.companyName}"`);
        console.log(`• ATS Score: ${jitResult.atsScore}/100`);
        console.log(`• Draft ID: ${jitResult.draftId || 'N/A (Portal Lead)'}`);
        console.log(`• Telegram Card Sent: Message ID ${jitResult.telegramMessageId}`);
        console.log('• Status: Review card pending candidate approval in Telegram cockpit.');
      } else {
        console.log('⏳ JIT Queue Skipped / Inactive:');
        console.log(`• Reason: ${jitResult.reason}`);
        if (jitResult.error) {
          console.log(`• Error: ${jitResult.error}`);
        }
      }
      console.log('========================================\n');
      return;
    }

    // Default Mode: Start the manual on-demand Telegram cockpit
    await startManualCockpit();
  } catch (err: any) {
    console.error('💥 Fatal Startup/Pipeline Error:', err.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal Error:', err);
    process.exit(1);
  });
}
