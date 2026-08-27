# 📖 Pulsereach — Complete Manual Setup Guide

This guide walks you through setting up **Pulsereach** step-by-step from scratch on a **$0.00/month** operational budget using free-tier services.

---

## 📋 Architecture Overview

Pulsereach consists of:
1. **Google Sheets**: The live ingestion database where leads (job title, company, recruiter email, description) are tracked.
2. **Google Drive**: Free-tier PDF archive storage for all generated tailored CVs and cover letters.
3. **Gmail API**: OAuth2-authenticated draft creation and sending service.
4. **Google Gemini AI**: Free 15 RPM / 1,500 RPD API for ATS evaluation, CV tailoring, cover letter generation, and cold email drafting.
5. **Telegram Cockpit Bot**: Mobile interactive interface with review cards, on-demand PDF streaming, and manual `[✅ Applied]` sending triggers.
6. **Supabase**: Free managed Postgres database for storing and querying your structured candidate profile.
7. **Vercel / GitHub Actions**: Zero-cost hosting and on-demand serverless webhook execution.

---

## 🛠️ Step-by-Step Setup

### Step 1: Clone Repository & Install Dependencies

```bash
git clone https://github.com/YOUR_USERNAME/pulsereach.git
cd pulsereach
pnpm install
cp .env.example .env
```

---

### Step 2: Google Cloud Console Setup (Sheets, Drive, Gmail)

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Pulsereach`.
3. Enable the following 3 APIs under **APIs & Services > Library**:
   - **Google Sheets API**
   - **Google Drive API**
   - **Gmail API**
4. Configure **OAuth Consent Screen**:
   - User Type: **External**
   - Add Test Users: Add your Google email address(es).
   - Scopes:
     - `https://www.googleapis.com/auth/spreadsheets`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/gmail.compose`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
5. Create Credentials:
   - Go to **Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Authorized redirect URIs: `https://developers.google.com/oauthplayground`
   - Copy the **Client ID** and **Client Secret** into your `.env`:
     ```env
     GOOGLE_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=your_oauth_client_secret
     ```
6. Generate OAuth2 Refresh Tokens via [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):
   - Click the **Gear icon (⚙️)** in top-right.
   - Check **Use your own OAuth credentials** and enter your Client ID and Client Secret.
   - Authorize the scopes above.
   - Exchange authorization code for refresh token and paste into `.env`:
     ```env
     GOOGLE_STORAGE_USER_EMAIL=your_storage_account@gmail.com
     GOOGLE_STORAGE_REFRESH_TOKEN=your_storage_refresh_token
     GMAIL_SENDER_EMAIL=your_outreach_email@gmail.com
     GMAIL_REFRESH_TOKEN=your_outreach_refresh_token
     ```

---

### Step 3: Google Sheets Setup

1. Create a new Google Sheet.
2. Ensure the sheet has the following 10-column header row in Row 1:
   ```
   [Timestamp | Job Title | Company | Location | Domain | Recruiter Email | LinkedIn | Job Link | Outreach Strategy | ATS Keywords]
   ```
3. Copy the Sheet ID from your browser URL:
   `https://docs.google.com/spreadsheets/d/{YOUR_SPREADSHEET_ID}/edit`
4. Put into `.env`:
   ```env
   GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
   ```

---

### Step 4: Google Gemini AI Key

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Create a free API key.
3. Put into `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   AI_MODEL=gemini-2.0-flash
   ```

---

### Step 5: Telegram Mobile Cockpit Setup

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow prompts to name your bot and choose a username.
3. Copy the HTTP API token into `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
   ```
4. Find your Telegram User/Chat ID by messaging [@userinfobot](https://t.me/userinfobot) or [@getidsbot](https://t.me/getidsbot).
5. Put into `.env`:
   ```env
   TELEGRAM_CHAT_ID=your_numeric_chat_id
   ```

---

### Step 6: Supabase Setup (Candidate Profile Store)

1. Create a free account at [Supabase](https://supabase.com/).
2. Create a new project (e.g. `pulsereach`).
3. Go to **SQL Editor** and run the profile table migration:
   ```sql
   create table if not exists candidate_profiles (
     id uuid primary key default gen_random_uuid(),
     profile_id text unique not null default 'default',
     name text not null,
     email text not null,
     phone text,
     visa_status text,
     linkedin_url text,
     github_url text,
     portfolio_url text,
     default_headline text,
     default_summary text,
     skills jsonb not null default '{}'::jsonb,
     experience jsonb not null default '[]'::jsonb,
     projects jsonb not null default '{}'::jsonb,
     education jsonb not null default '[]'::jsonb,
     certifications jsonb not null default '[]'::jsonb,
     is_active boolean not null default true,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );

   alter table candidate_profiles enable row level security;

   create policy "Public read candidate_profiles"
     on candidate_profiles for select
     using (true);

   create policy "Public write candidate_profiles"
     on candidate_profiles for all
     using (true);
   ```
4. Copy your project URL and Anon Key into `.env`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your_project_id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```
5. Seed your profile:
   - Create a local `profile.json` by copying `profile.example.json` and filling in your real projects and details.
   - Run: `pnpm profile:seed`

---

### Step 7: Local Verification & Polling Mode

Test that all credentials and connections work:

```bash
# 1. Typecheck
pnpm typecheck

# 2. Run test suites
pnpm test:candidate
pnpm test:deliverability
pnpm test:e2e

# 3. Start local Telegram listener
pnpm bot:listen
```

---

### Step 8: Production Deployment (Vercel Serverless + GitHub Actions)

#### Vercel Serverless Webhook:
1. Push your repository to GitHub.
2. Import repository into [Vercel](https://vercel.com/).
3. Add all environment variables from `.env` into Vercel Project Settings.
4. Set your Telegram webhook:
   ```bash
   pnpm set-webhook
   ```

#### Google Apps Script Auto-Trigger:
1. Open your Google Sheet.
2. Click **Extensions > Apps Script**.
3. Paste the contents of [`src/sheets/apps-script-template.js`](file:///c:/Coding/JobSearch/src/sheets/apps-script-template.js).
4. Replace `YOUR_VERCEL_PROJECT` and `YOUR_WEBHOOK_SECRET`.
5. Add an `On change` trigger under **Triggers (⏰)**.

🎉 **Setup Complete!** You now have a fully automated, 100% free job application engine.
