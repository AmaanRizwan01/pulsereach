import { google } from 'googleapis';
import { getEnv } from '../config/env.js';
import { resetState } from '../worker/state-tracker.js';

async function freshStart() {
  const env = getEnv();
  console.log('🔄 Starting fresh reset...');

  // 1. Reset state.json
  console.log('1️⃣ Resetting state.json to clean baseline...');
  await resetState();
  console.log('✅ State store reset successfully.');

  // 2. Clean any existing Gmail Drafts in Account 2
  console.log('2️⃣ Cleaning test drafts in Gmail Account 2...');
  try {
    const gmailAuth = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID || env.GMAIL_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET || env.GMAIL_CLIENT_SECRET
    );
    gmailAuth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth: gmailAuth });

    const draftsRes = await gmail.users.drafts.list({ userId: 'me' });
    const drafts = draftsRes.data.drafts || [];
    for (const d of drafts) {
      if (d.id) {
        console.log(`   Deleting draft ${d.id}...`);
        await gmail.users.drafts.delete({ userId: 'me', id: d.id }).catch(() => {});
      }
    }
    console.log(`✅ Drafts cleaned (${drafts.length} drafts removed).`);
  } catch (err: any) {
    console.warn(`⚠️ Warning cleaning drafts: ${err.message}`);
  }

  console.log('✨ Fresh reset complete! Ready for clean execution.\n');
}

freshStart().catch(console.error);
