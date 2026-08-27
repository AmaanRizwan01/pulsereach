/**
 * Pulsereach — Google OAuth2 Dual-Account Refresh Token Generator
 *
 * Dedicated tool to generate distinct refresh tokens for:
 * 1. Storage Account (Google Drive + Sheets) -> `pnpm auth:storage`
 * 2. Outreach Account (Candidate Gmail Draft & Send) -> `pnpm auth:outreach`
 */

import http from 'http';
import { exec } from 'child_process';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
  process.exit(1);
}

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] || 'all';

let targetAccountName = 'Google Account';
let targetEnvVar = 'REFRESH_TOKEN';
let SCOPES: string[] = [];

if (modeArg === 'storage') {
  targetAccountName = 'Account 1: Storage & Database (Google Drive + Sheets)';
  targetEnvVar = 'GOOGLE_STORAGE_REFRESH_TOKEN';
  SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];
} else if (modeArg === 'outreach') {
  targetAccountName = 'Account 2: Candidate Outreach (Gmail)';
  targetEnvVar = 'GMAIL_REFRESH_TOKEN';
  SCOPES = [
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ];
} else {
  targetAccountName = 'All Permissions (Storage + Outreach)';
  targetEnvVar = 'REFRESH_TOKEN';
  SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ];
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // Forces Google to issue a permanent refresh_token
  scope: SCOPES,
});

console.log('\n======================================================');
console.log(`🔑 PULSEREACH OAUTH GENERATOR: ${targetAccountName.toUpperCase()}`);
console.log('======================================================\n');
console.log(`👉 IMPORTANT: In your browser, choose: ${targetAccountName}\n`);
console.log('If browser does not open automatically, visit this URL:\n');
console.log(authUrl);
console.log('\n⏳ Waiting for authorization callback on http://localhost:3000/oauth2callback ...\n');

const server = http.createServer(async (req, res) => {
  try {
    if (req.url && req.url.startsWith('/oauth2callback')) {
      const urlParams = new URL(req.url, 'http://localhost:3000').searchParams;
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>❌ Authorization Failed</h1><p>${error}</p>`);
        console.error('❌ OAuth error received:', error);
        server.close();
        process.exit(1);
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>❌ No authorization code found in URL</h1>');
        return;
      }

      const { tokens } = await oauth2Client.getToken(code);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <div style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #2e7d32;">✅ Google Authorization Successful!</h1>
          <p style="font-size: 16px;">Authorized for: <b>${targetAccountName}</b></p>
          <p style="font-size: 14px; color: #666;">You can now close this tab and return to your terminal.</p>
        </div>
      `);

      console.log('\n======================================================');
      console.log('🎉 TOKEN RECEIVED SUCCESSFULLY!');
      console.log('======================================================\n');
      console.log(`📋 Copy your new token for ${targetAccountName}:\n`);
      console.log(`${targetEnvVar}=${tokens.refresh_token}\n`);
      console.log('======================================================');
      console.log('💡 NEXT STEPS:');
      console.log(`1. Update ${targetEnvVar} in your .env file.`);
      console.log(`2. Update ${targetEnvVar} in GitHub Repository Secrets.`);
      console.log(`3. Update ${targetEnvVar} in Vercel Environment Variables.`);
      console.log('======================================================\n');

      server.close();
      process.exit(0);
    }
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Server Error</h1><p>${err.message}</p>`);
    console.error('❌ Error handling callback:', err);
    server.close();
    process.exit(1);
  }
});

server.listen(3000, () => {
  try {
    const startCmd = process.platform === 'win32' ? `start "" "${authUrl}"` : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
    exec(startCmd);
  } catch {}
});
