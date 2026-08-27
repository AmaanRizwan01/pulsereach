import { getEnv } from '../config/env.js';
import { fetchLatestJobsFromSheet } from './sheets-client.js';

console.log('=== Testing Live Google Sheet Ingestion ===');
const env = getEnv();
console.log('• Google Sheet ID:', env.GOOGLE_SPREADSHEET_ID);
console.log('• Storage Account:', env.GOOGLE_STORAGE_USER_EMAIL);
console.log('• Candidate Account:', env.GMAIL_SENDER_EMAIL);
console.log('• Telegram Chat ID:', env.TELEGRAM_CHAT_ID);

try {
  const jobs = await fetchLatestJobsFromSheet();
  console.log(`\n✅ Successfully connected to Google Sheet!`);
  console.log(`• Total rows parsed: ${jobs.length}`);
  if (jobs.length > 0) {
    console.log('• First row sample:', JSON.stringify(jobs[0], null, 2));
  } else {
    console.log('• Sheet is currently empty or has only header row.');
  }
} catch (err: any) {
  console.error('❌ Error fetching from live Google Sheet:', err.message);
}
