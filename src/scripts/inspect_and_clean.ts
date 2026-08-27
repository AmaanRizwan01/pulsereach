import { google } from 'googleapis';
import { getEnv } from '../config/env.js';

async function main() {
  const env = getEnv();

  console.log('--- 1. Checking Gmail Drafts in Account 2 ---');
  const gmailAuth = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET);
  gmailAuth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth: gmailAuth });

  const draftsRes = await gmail.users.drafts.list({ userId: 'me' });
  const drafts = draftsRes.data.drafts || [];
  console.log(`Found ${drafts.length} total drafts in Account 2:`);

  const draftsDetail = [];
  for (const d of drafts) {
    if (d.id) {
      const detail = await gmail.users.drafts.get({ userId: 'me', id: d.id, format: 'metadata' });
      const headers = detail.data.message?.payload?.headers || [];
      const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
      const to = headers.find((h) => h.name?.toLowerCase() === 'to')?.value || '(No To)';
      draftsDetail.push({ id: d.id, subject, to });
      console.log(`  - Draft ID: ${d.id} | Subject: "${subject}" | To: "${to}"`);
    }
  }

  // If there are duplicate drafts with identical subjects, delete older duplicates
  const seenSubjects = new Map<string, string>();
  for (const item of draftsDetail) {
    if (seenSubjects.has(item.subject)) {
      console.log(`🧹 Deleting duplicate older draft: ${item.id} (${item.subject})`);
      await gmail.users.drafts.delete({ userId: 'me', id: item.id });
    } else {
      seenSubjects.set(item.subject, item.id);
    }
  }

  console.log('\n--- 2. Checking Google Drive Resumes & Cover Letters ---');
  const driveAuth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID || env.GMAIL_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET || env.GMAIL_CLIENT_SECRET
  );
  driveAuth.setCredentials({ refresh_token: env.GOOGLE_STORAGE_REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth: driveAuth });

  const filesRes = await drive.files.list({
    q: "trashed = false and mimeType = 'application/pdf'",
    fields: 'files(id, name, createdTime, parents)',
  });
  const files = filesRes.data.files || [];
  console.log(`Found ${files.length} PDF files in Google Drive:`);

  const filesByName = new Map<string, any[]>();
  for (const f of files) {
    console.log(`  - ID: ${f.id} | Name: "${f.name}" | Created: ${f.createdTime}`);
    const list = filesByName.get(f.name || '') || [];
    list.push(f);
    filesByName.set(f.name || '', list);
  }

  for (const [name, list] of filesByName.entries()) {
    if (list.length > 1) {
      console.log(`🧹 Found ${list.length} duplicates for "${name}". Keeping newest and deleting older duplicates...`);
      list.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
      for (let i = 1; i < list.length; i++) {
        console.log(`   Deleting duplicate file ID: ${list[i].id} (${list[i].createdTime})`);
        await drive.files.delete({ fileId: list[i].id });
      }
    }
  }

  console.log('\n--- 3. Checking Telegram Updates & Pending Callbacks ---');
  const tgToken = env.TELEGRAM_BOT_TOKEN;
  const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/getUpdates`);
  const tgData = await tgRes.json();
  console.log('Telegram getUpdates result:');
  console.log(JSON.stringify(tgData, null, 2));

  console.log('\n✅ Inspection & Deduplication Complete!');
}

main().catch(console.error);
