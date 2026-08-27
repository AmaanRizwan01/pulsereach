# 🤖 Pulsereach — AI Agent Auto-Setup Instructions

Copy and paste the entire prompt below into any autonomous AI coding assistant (Cursor, Antigravity, Claude Code, Windsurf, Devin, etc.) to set up Pulsereach automatically on your system.

---

```markdown
# 🚀 Pulsereach Auto-Configuration Task

You are acting as a DevOps and setup engineer. Your goal is to fully configure and verify **Pulsereach** (`pulsereach`), an autonomous, human-in-the-loop job outreach and application engine with a $0.00/month operational budget.

Please execute the following setup pipeline autonomously:

## Phase 1: Environment & Dependencies
1. Run `pnpm install` or `npm install` to ensure all dependencies and Playwright Chromium binaries are installed.
2. Check if `.env` exists. If not, copy `.env.example` to `.env`.
3. Prompt the user or ask for their credentials if not already provided:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Google Cloud Console OAuth2)
   - `GOOGLE_STORAGE_REFRESH_TOKEN` (Drive & Sheets storage account)
   - `GMAIL_REFRESH_TOKEN` and `GMAIL_SENDER_EMAIL` (Outreach account)
   - `GOOGLE_SPREADSHEET_ID` (10-column tracking Google Sheet)
   - `GEMINI_API_KEY` (Free Google AI Studio key)
   - `TELEGRAM_BOT_TOKEN` (From @BotFather) and `TELEGRAM_CHAT_ID` (From @userinfobot)
   - `WEBHOOK_SECRET` (Random secure 16+ char string)
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase project)

## Phase 2: Supabase Candidate Profile Setup
1. If Supabase MCP or credentials are provided:
   - Check if table `candidate_profiles` exists.
   - If not, execute the following SQL migration:
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
     create policy "Public read candidate_profiles" on candidate_profiles for select using (true);
     create policy "Public write candidate_profiles" on candidate_profiles for all using (true);
     ```
2. Guide the user to populate their candidate information in `profile.json` (referencing `profile.example.json`).
3. Run `pnpm profile:seed` to upload their profile directly to the Supabase database.

## Phase 3: Comprehensive Verification
Run the following test suite commands and verify 100% compliance:
- `pnpm typecheck`
- `pnpm test:candidate`
- `pnpm test:deliverability`
- `pnpm test:e2e`

## Phase 4: Production Deployment Guidance
1. If deploying to Vercel:
   - Deploy via Vercel CLI or GitHub integration.
   - Sync environment variables from `.env`.
   - Run `pnpm set-webhook` to point the Telegram bot to `/api/telegram`.
2. Guide the user to install the Google Apps Script in their Google Sheet from `src/sheets/apps-script-template.js`.

Execute these steps with zero fluff, clear diagnostics, and verify every step before completing.
```
