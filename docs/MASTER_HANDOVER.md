# 🚀 Pulsereach: Master Architecture & Technical Handover Document

> **Zero-Context-Loss Engineering Manual & Operational Specification**  
> **Target Region:** United Arab Emirates (Dubai, Abu Dhabi, Sharjah, Ajman, Remote)  
> **Candidate Profile:** Amaan Rizwan (Software Engineer | TypeScript, Next.js, Node.js, Python, PostgreSQL, Docker, Cloud Infrastructure)  
> **Operational Budget:** $0.00 / Month (100% Free Tier Infrastructure)  
> **Target Audience:** Senior Software Engineers, DevOps Engineers, and Autonomous AI Coding Agents  

---

## 📑 Table of Contents

1. [Executive Summary & High-Level Mission](#1-executive-summary--high-level-mission)
2. [Non-Negotiable System Invariants & Hard Guardrails](#2-non-negotiable-system-invariants--hard-guardrails)
3. [Multi-Account & Service Topology Architecture](#3-multi-account--service-topology-architecture)
4. [Complete End-to-End System Dataflows & Sequences](#4-complete-end-to-end-system-dataflows--sequences)
   - 4.1 [Just-In-Time (JIT) On-Demand Outreach Flow](#41-just-in-time-jit-on-demand-outreach-flow)
   - 4.2 [Email Outreach Lead vs. Portal Application Lead Routing](#42-email-outreach-lead-vs-portal-application-lead-routing)
   - 4.3 [Telegram Review Cockpit & Approval Dispatch Sequence](#43-telegram-review-cockpit--approval-dispatch-sequence)
   - 4.4 [Web Dashboard Async Generation & Polling Flow](#44-web-dashboard-async-generation--polling-flow)
5. [Complete File-by-File Codebase Architecture](#5-complete-file-by-file-codebase-architecture)
   - 5.1 [Configuration & Rate Limiting Subsystem](#51-configuration--rate-limiting-subsystem)
   - 5.2 [Google Sheets Ingestion & Contact Parser](#52-google-sheets-ingestion--contact-parser)
   - 5.3 [AI & Document Generation Engine](#53-ai--document-generation-engine)
   - 5.4 [Anti-Spam, Deliverability & Real-Time DNS Verifier](#54-anti-spam-deliverability--real-time-dns-verifier)
   - 5.5 [Storage & Google Drive Archiving Subsystem](#55-storage--google-drive-archiving-subsystem)
   - 5.6 [Gmail MIME & Multi-Recipient Drafting Service](#56-gmail-mime--multi-recipient-drafting-service)
   - 5.7 [Telegram Mobile Cockpit & Long-Polling Engine](#57-telegram-mobile-cockpit--long-polling-engine)
   - 5.8 [Pipeline Orchestration, JIT Queue & State Store](#58-pipeline-orchestration-jit-queue--state-store)
   - 5.9 [Vercel Serverless Webhooks & Endpoints](#59-vercel-serverless-webhooks--endpoints)
   - 5.10 [GitHub Actions CI/CD & Playwright Cloud Runners](#510-github-actions-cicd--playwright-cloud-runners)
   - 5.11 [Web Dashboard Frontend UI & Supabase Auth](#511-web-dashboard-frontend-ui--supabase-auth)
6. [Data Schemas, Type Definitions & State Machines](#6-data-schemas-type-definitions--state-machines)
7. [AI Prompt Catalog, Scoring Models & Self-Correction](#7-ai-prompt-catalog-scoring-models--self-correction)
8. [Anti-Spam Engineering, Rate Limiting & Deliverability](#8-anti-spam-engineering-rate-limiting--deliverability)
9. [Telegram Cockpit Specification & Mobile Interface](#9-telegram-cockpit-specification--mobile-interface)
10. [Environment Variables & Credentials Setup Guide](#10-environment-variables--credentials-setup-guide)
11. [Developer & Operator Playbook (CLI, Testing, Debugging)](#11-developer--operator-playbook-cli-testing-debugging)
12. [Failure Modes, Edge Cases & Recovery Handbook](#12-failure-modes-edge-cases--recovery-handbook)

---

## 1. Executive Summary & High-Level Mission

**Pulsereach** is an autonomous, human-in-the-loop job application, tailoring, and outreach engine tailored specifically for the UAE tech market. It operates with a **$0.00/month operational budget** by orchestrating free tier resources across Google Gemini AI, Google Sheets API, Gmail API, Google Drive API, Telegram Bot API, GitHub Actions, and Vercel Serverless Functions.

### Core Philosophy
1. **Human-in-the-Loop Cockpit:** The system prepares tailored resumes, cover letters, and outreach emails just-in-time, creating drafts in Gmail and delivering rich review cards to Telegram. Emails are sent **only** when the user taps `[✅ Applied (Send Email)]` in Telegram.
2. **Zero Hallucination Guarantee:** Candidate facts, metrics, and project details are anchored to an immutable verified profile loaded via [`src/profile/profile-loader.ts`](file:///c:/Coding/JobSearch/src/profile/profile-loader.ts) (stored in Supabase `candidate_profiles` or local `profile.json`).
3. **Strict ATS Compliance (>= 85%):** Resumes are evaluated against target job descriptions using a 5-factor scoring model. Any score below 85% triggers an automated self-correction loop.
4. **Strict Single-Page A4 Guarantee:** Both Resumes and Cover Letters are dynamically formatted using micro-spacing and line-height autofit algorithms to guarantee that they render on exactly one single A4 page.
5. **Preemptive LIFO Priority Queue:** Jobs in Google Sheets are processed newest-first (based on parsed time and row position), ensuring that fresh leads are addressed immediately.

---

## 2. Non-Negotiable System Invariants & Hard Guardrails

Every engineer and AI agent modifying this repository must uphold the following rules:

### Invariant 1: Candidate Truth-Anchoring (Zero Hallucination Policy)
- All resume bullets, cover letters, outreach emails, and LinkedIn messages must derive **exclusively** from the verified profile of **Amaan Rizwan** in [`src/ai/candidate-catalog.ts`](file:///c:/Coding/JobSearch/src/ai/candidate-catalog.ts).
- Never invent metrics, unverified employers, degrees, GPA figures, or technologies not present in the master profile.

### Invariant 2: Strict Anti-Em-Dash Policy
- Generated output across all channels (Resumes, Cover Letters, Emails, Telegram Cards, LinkedIn DMs) must **never contain em-dashes** (`—`, `--`, `–`).
- Replace dashes with standard commas, semicolons, colons, parentheses, or periods.
- Always filter AI responses through `removeEmDashes()` or `sanitizeEmDashes()`.

### Invariant 3: Single-Page A4 Print Budget
- Resumes and Cover Letters must fit within **exactly 1 single A4 page** (297mm height).
- The compiler dynamically calculates content line weight and toggles between High-Density (8.45pt font, 1.22 line height), Medium-Density (8.75pt font, 1.25 line height), and Standard-Density (9.05pt font, 1.30 line height) profiles to prevent multi-page spillover.

### Invariant 4: Dual Google Account Isolation (Optional)
To maximize free storage and prevent mailbox suspension, the system optionally divides responsibilities between two separate Google Accounts:
- **Account 1 (Storage Account):** Storage & Data Ingestion (Google Drive PDF archive folders, Google Sheets API).
- **Account 2 (Outreach Account):** Candidate Outreach (Gmail API draft creation and email dispatch).

### Invariant 5: 100% Manual On-Demand Telegram Cockpit
- No automated mass emailing.
- Pipeline execution is initiated on-demand by tapping `[⚡ Next Lead]` or running `/next` in Telegram.
- Email dispatch requires explicit user confirmation via `[✅ Applied (Send Email)]`.

### Invariant 6: Zero-Cost Cloud Infrastructure ($0.00 / Month)
- All services must operate strictly within free tier allowances:
  - **Google Gemini AI:** 15 Requests Per Minute (RPM), 1,500 Requests Per Day (RPD).
  - **Gmail API & Sheets API:** Free OAuth2 user quotas.
  - **Telegram Bot API:** 30 messages per second free.
  - **GitHub Actions:** 2,000 free runner minutes per month for Playwright Chromium PDF compilation.
  - **Vercel Hobby:** Serverless functions for webhooks and dashboard API.

---

## 3. Multi-Account & Service Topology Architecture

```
                                  +-------------------------------------------------------------+
                                  |                  PULSEREACH SYSTEM TOPOLOGY                 |
                                  +-------------------------------------------------------------+
                                                                 |
               +-------------------------------------------------+-------------------------------------------------+
               |                                                 |                                                 |
               v                                                 v                                                 v
+-------------------------------+             +-----------------------------------+             +-------------------------------+
|    GOOGLE ACCOUNT 1           |             |       CORE PROCESSING ENGINE      |             |    GOOGLE ACCOUNT 2           |
|    (Storage & Sheets)         |             |       (Local / VPS / GitHub)      |             |    (Outreach Mailbox)         |
+-------------------------------+             +-----------------------------------+             +-------------------------------+
| • User: rizwan.shan2016       |             | • Runtime: Node.js 22 + TypeScript|             | • User: amaanrizwan2016       |
| • 5TB Google Drive Storage    | <=========> | • Rate Limiter: Token Bucket      | <=========> | • Primary Outreach Sender     |
| • Google Sheets (14 Columns)  |  (OAuth2)   | • AI Client: Google Gemini Flash  |  (OAuth2)   | • Gmail API (Drafts & Send)   |
| • PDF Archive Subfolders:     |             | • PDF Engine: Playwright Chromium |             | • Multi-Recipient RFC 2822    |
|   - "Resumes/"                |             | • State Store: state.json         |             |   MIME Multipart Bundler      |
|   - "Cover Letters/"          |             +-----------------------------------+             +-------------------------------+
|   - "Dashboard Results/"      |                               ^
+-------------------------------+                               |
                                                                |
               +------------------------------------------------+--------------------------------+
               |                                                                                 |
               v                                                                                 v
+-------------------------------+                                               +-------------------------------+
|     TELEGRAM COCKPIT BOT      |                                               |    VERCEL SERVERLESS & WEB    |
+-------------------------------+                                               +-------------------------------+
| • BotFather Token             |                                               | • Webhook: /api/telegram      |
| • Long-Polling / Webhook      |                                               | • Trigger: /api/trigger       |
| • 5-Button Matrix Review Card |                                               | • Dashboard API:              |
| • On-Demand Document Stream   |                                               |   - /api/dashboard/trigger    |
|   ([Send CV] / [Send CL])     |                                               |   - /api/dashboard/status     |
| • Slash Commands:             |                                               | • Supabase Auth Guard         |
|   /next, /status, /reset      |                                               | • UI: dashboard.html          |
+-------------------------------+                                               +-------------------------------+
```

---

## 4. Complete End-to-End System Dataflows & Sequences

### 4.1 Just-In-Time (JIT) On-Demand Outreach Flow

```
[ User in Telegram ]
        |
        | 1. Taps [⚡ Next Lead] or sends /next (or /next <row>)
        v
[ Telegram Poller / Webhook ] (bot-service.ts)
        |
        | 2. Calls processSingleJobJustInTime()
        v
[ Pipeline Orchestrator ] (pipeline.ts)
        |
        | 3. Ingests Rows from Google Sheets API v4 (Columns A:N)
        | 4. Deduplicates against state.json and Sheet Status column
        | 5. Sorts via Preemptive LIFO (Newest dateFetched timestamp -> highest rowNumber)
        | 6. Runs 4-Tier DNS MX & Syntax Email Verification (email-verifier.ts)
        |
        +-----> If Email Lead (Deliverable emails found):
        |          * Synthesizes tailored Resume (resume-tailorer.ts)
        |          * Evaluates ATS score >= 85% (ats-evaluator.ts) with self-correction
        |          * Generates 4-paragraph Cover Letter (cover-letter-generator.ts)
        |          * Generates concise cold email <120 words (email-generator.ts)
        |          * Compiles single-page A4 PDFs via Playwright (pdf-compiler.ts)
        |          * Archives PDFs to Google Drive "Resumes" & "Cover Letters" (drive-service.ts)
        |          * Creates multi-recipient Gmail Draft in Account 2 with attached PDFs (draft-service.ts)
        |          * Updates Sheet row to "Draft Created (Pending Review)"
        |          * Sends Telegram Review Card with [✅ Applied (Send Email)] button
        |
        +-----> If Portal Lead (No valid email found):
                   * Synthesizes tailored Resume and 4-paragraph Cover Letter
                   * Generates tailored LinkedIn Recruiter InMail Subject & DM (<80 words)
                   * Compiles single-page A4 PDFs via Playwright
                   * Archives PDFs to Google Drive
                   * Updates Sheet row to "Portal Lead (Ready to Apply)"
                   * Sends Telegram Review Card with [✅ Applied on Portal] + [🔗 Open Careers Portal]
```

### 4.2 Email Outreach Lead vs. Portal Application Lead Routing

| Dimension | Email Outreach Lead (Column F contains valid emails) | Portal Application Lead (No valid emails in Column F) |
|---|---|---|
| **Primary Action Button** | `[✅ Applied (Send Email)]` (`approve:r<row>:<jobKey>`) | `[✅ Applied on Portal]` (`portal_applied:r<row>:<jobKey>`) |
| **Gmail Draft** | Created in Account 2 with dual PDF attachments | Skipped (No draft created) |
| **Recruiter Outreach** | Cold Email (<120 words) with salutation sanitization | LinkedIn DM pitch (<80 words) + InMail Subject line |
| **Sheet Write-Back** | `Draft Created (Pending Review)` $\rightarrow$ `Applied (Email Sent)` | `Portal Lead (Ready to Apply)` $\rightarrow$ `Applied (Portal)` |
| **PDF Delivery** | Attached to Gmail Draft + available via `[Send CV]`/`[Send CL]` | Accessible via Drive links + streamed via `[Send CV]`/`[Send CL]` |

### 4.3 Telegram Review Cockpit & Approval Dispatch Sequence

```
Telegram Card Sent to Chat
        |
        +---> User clicks [📄 Send CV] ----> Streams compiled Resume PDF directly into chat
        |
        +---> User clicks [📝 Send CL] ----> Streams compiled Cover Letter PDF into chat
        |
        +---> User clicks [🔗 Open Portal] -> Opens target job application link in browser
        |
        +---> User clicks [⏭️ Skip] --------> Updates state to SKIPPED, updates Sheet to "Skipped by Candidate", edits card
        |
        +---> User clicks [🚫 Not Relevant] -> Updates state to NOT_RELEVANT, updates Sheet to "Not Relevant", edits card
        |
        +---> User clicks [✅ Applied]:
                 1. If Email Lead: Calls sendDraftForJob() to dispatch draft via Gmail API
                 2. Updates local state.json to SENT / APPROVED
                 3. Updates Google Sheet Columns K & L to "Applied (Email Sent)" or "Applied (Portal)"
                 4. Updates Telegram Card text with confirmation banner:
                    "✅ STATUS: EMAIL DISPATCHED VIA GMAIL API"
                 5. Replaces inline buttons with static "[✅ Sent & Applied]"
```

### 4.4 Web Dashboard Async Generation & Polling Flow

```
[ Frontend: dashboard.html ]
        |
        | 1. User inputs Job Title, Company, Job Description (min 50 chars)
        | 2. Checks Supabase JWT session -> Sends POST to /api/dashboard/trigger
        v
[ Vercel API: /api/dashboard/trigger ]
        |
        | 3. Validates JWT / Webhook Secret
        | 4. Generates unique jobId: dash-{timestamp}
        | 5. Calls GitHub REST API to trigger workflow_dispatch on dashboard-generate.yml (<5s)
        | 6. Returns { jobId, status: "TRIGGERED" }
        v
[ Frontend: dashboard.html ]
        |
        | 7. Begins polling /api/dashboard/status?id=dash-{timestamp} every 4 seconds
        v
[ GitHub Actions Runner ] (dashboard-generate.yml)
        |
        | 8. Installs Playwright Chromium
        | 9. Runs generate-worker.ts (Resume, Cover Letter, Email, PDFs, Drive upload)
        | 10. Uploads results JSON to Google Drive: "Dashboard Results/results-dash-{timestamp}.json"
        v
[ Vercel API: /api/dashboard/status ]
        |
        | 11. Searches Drive for results-dash-{timestamp}.json
        | 12. If found -> Returns parsed JSON with ATS breakdown, Drive URLs, Email text
        v
[ Frontend: dashboard.html ]
        |
        | 13. Renders ATS Score Radar (0-100), Grade badge, Matched Keywords, Email preview, PDF download buttons
```

---

## 5. Complete File-by-File Codebase Architecture

```
pulsereach/
├── package.json                      # Project dependencies, build scripts, and engine constraints
├── tsconfig.json                     # Strict TypeScript compiler options
├── vercel.json                       # Vercel deployment routes and serverless configuration
├── state.json                        # Persistent deduplication state and active job lock
├── AGENTS.md                         # Master operational guidelines and invariants
├── PLAN.md                           # Sprint tracking and architectural roadmap
├── README.md                         # Repository introduction and overview
├── .github/
│   └── workflows/
│       ├── pulse-pipeline.yml        # GitHub Actions runner for JIT / batch Playwright pipeline
│       └── dashboard-generate.yml    # GitHub Actions runner for web dashboard generation
├── api/
│   ├── telegram.ts                   # Vercel serverless webhook for Telegram callback queries
│   ├── trigger.ts                    # Vercel serverless webhook for manual JIT / batch trigger
│   └── dashboard/
│       ├── trigger.ts                # Dashboard trigger endpoint (dispatches GitHub Actions)
│       └── status.ts                 # Dashboard status polling endpoint (reads Drive JSON)
├── public/
│   ├── index.html                    # Public landing redirect
│   ├── login.html                    # Supabase authentication interface
│   └── dashboard.html                # Executive resume tailoring web dashboard
└── src/
    ├── index.ts                      # CLI entrypoint and manual cockpit starter
    ├── config/
    │   └── env.ts                    # Zod validated environment variables schema
    ├── rate-limiter/
    │   └── token-bucket.ts           # Token-bucket rate limiter for external APIs
    ├── sheets/
    │   ├── sheets-client.ts          # Google Sheets API 14-column reader and parser
    │   └── apps-script-template.js   # Reference Google Apps Script trigger
    ├── ai/
    │   ├── candidate-catalog.ts      # Immutable verified candidate profile (Amaan Rizwan)
    │   ├── candidate-data.ts         # Profile helper methods and skills flatter
    │   ├── index.ts                  # Rate-limited Gemini client with quota retry
    │   ├── resume-tailorer.ts        # AI resume tailoring engine with self-correction
    │   ├── resume-compiler.ts        # Single-page A4 HTML/CSS template compiler
    │   ├── ats-evaluator.ts          # 5-factor ATS scoring engine (target >= 85%)
    │   ├── cover-letter-generator.ts # 4-paragraph cover letter engine and HTML compiler
    │   ├── email-generator.ts        # Cold email drafter and salutation noise filter
    │   ├── followup-generator.ts     # Day 4 and Day 9 automated follow-up sequences
    │   ├── conversation-classifier.ts# 8-intent recruiter inbound reply classifier
    │   ├── response-drafter.ts       # Contextual candidate reply drafter
    │   ├── conversational-modifier.ts# Natural language revision engine
    │   ├── match-evaluator.ts        # Job-to-candidate qualification match scorer
    │   └── pdf-compiler.ts           # Playwright single-page A4 PDF compiler
    ├── anti-spam/
    │   ├── deliverability-shield.ts  # 4-week warm-up ladder and 15-minute throttle
    │   └── email-verifier.ts         # 4-tier real-time DNS MX email verifier
    ├── drive/
    │   └── drive-service.ts          # Google Drive subfolder archiver and downloader
    ├── gmail/
    │   └── draft-service.ts          # RFC 2822 multipart/mixed MIME builder & Gmail service
    ├── telegram/
    │   ├── bot-service.ts            # Telegram card builder, callback router & PDF streamer
    │   ├── poll-service.ts           # Local long-polling runner for development
    │   └── set-webhook.ts            # Utility script to bind Telegram webhook URL
    ├── utils/
    │   └── file-naming.ts            # Mobile-safe filename generator (<=65 chars)
    ├── worker/
    │   ├── pipeline.ts               # Master pipeline and JIT queue orchestrator
    │   ├── state-tracker.ts          # State manager with atomic disk writes
    │   └── daemon.ts                 # Background cockpit daemon runner
    ├── dashboard/
    │   └── generate-worker.ts        # GitHub Actions generation worker for web dashboard
    └── scripts/
        ├── auth_helper.ts            # OAuth2 token exchange and credential diagnostic tool
        ├── fresh_start.ts            # Clears local cache and unlocks queue
        ├── init-cockpit.ts           # Interactive cockpit setup script
        └── inspect_and_clean.ts      # Verifies state.json integrity
```

---

### 5.1 Configuration & Rate Limiting Subsystem

#### [`src/config/env.ts`](file:///c:/Coding/JobSearch/src/config/env.ts)
- **Role:** Loads `.env`, validates runtime variables with Zod schemas, and provides structured diagnostics.
- **Key Functions:**
  - `getEnv(): EnvConfig`: Returns cached, validated environment variables. Throws descriptive terminal errors if keys are missing.
  - `resetEnvCache(): void`: Clears cached environment configuration for unit testing.
- **Transformations:** Automatically normalizes alias keys (e.g. `GOOGLE_CLIENT_ID` fallback to `GMAIL_CLIENT_ID`, `GOOGLE_SPREADSHEET_ID` fallback to `GOOGLE_SHEET_ID`).

#### [`src/rate-limiter/token-bucket.ts`](file:///c:/Coding/JobSearch/src/rate-limiter/token-bucket.ts)
- **Role:** Implements a token-bucket rate limiter to protect Gemini, Gmail, Sheets, and Telegram from rate limits.
- **Service Budgets:**
  - `gemini`: max 8 tokens, refill 0.25 tokens/s, 2000ms min delay, daily budget 1500.
  - `gmail`: max 5 tokens, refill 1.0 token/s, 1000ms min delay, daily budget 250.
  - `sheets`: max 5 tokens, refill 1.0 token/s, 1000ms min delay, daily budget 1000.
  - `telegram`: max 1 token, refill 0.67 token/s, 1500ms min delay, daily budget 5000.
- **Key Functions:**
  - `throttle(service: ServiceName, cost?: number): Promise<void>`: Awaits until sufficient tokens are refilled.
  - `getLimiterState(service: ServiceName)`: Returns active tokens and daily counts.
  - `resetLimiter(service: ServiceName): void`: Resets token bucket state.

---

### 5.2 Google Sheets Ingestion & Contact Parser

#### [`src/sheets/sheets-client.ts`](file:///c:/Coding/JobSearch/src/sheets/sheets-client.ts)
- **Role:** Reads and writes to Google Sheets API v4 using Google Account 1 credentials.
- **14-Column Layout (A:N):**
  - `Col A`: Date Fetched (e.g. `2026-08-23 06:00 PM GST`)
  - `Col B`: Job Title
  - `Col C`: Company Name
  - `Col D`: Work Location
  - `Col E`: Domain Category
  - `Col F`: Contact Emails (Raw strings with separators)
  - `Col G`: Recruiter LinkedIn Profile URL
  - `Col H`: Direct Application / Careers Portal URL
  - `Col I`: Outreach Strategy Notes
  - `Col J`: ATS Keywords & Exact Phrasing
  - `Col K`: Status (e.g. `Draft Created (Pending Review)`, `Applied (Email Sent)`, `Applied (Portal)`, `Skipped by Candidate`, `Not Relevant`)
  - `Col L`: Applied Timestamp
  - `Col M`: Resume Google Drive Link
  - `Col N`: Cover Letter Google Drive Link
- **Key Functions:**
  - `parseContactEmails(rawEmails?: string): string[]`: Extracts, cleans, deduplicates, and strips candidate self-emails.
  - `cleanUrl(raw?: string): string`: Extracts clean HTTP/HTTPS links from markdown syntax (`[url](url)`).
  - `parseSheetRow(rawRow: unknown[], index: number): SheetJobRow | null`: Maps a 2D array row into a typed model.
  - `fetchLatestJobsFromSheet(options?): Promise<SheetJobRow[]>`: Ingests all rows from range `A2:N`.
  - `updateSheetJobStatus(rowNumber: number, status: string, options?): Promise<boolean>`: Updates columns K through N for a given row.

---

### 5.3 AI & Document Generation Engine

#### [`src/ai/candidate-catalog.ts`](file:///c:/Coding/JobSearch/src/ai/candidate-catalog.ts)
- **Role:** Single source of truth for candidate data.
- **Candidate:** **Amaan Rizwan**
- **Location & Visa:** Ajman, UAE | UAE Residence Visa Holder | Available Immediately (0 days notice)
- **Education:**
  - BS Software Engineering, Sir Syed University of Engineering & Technology (SSUET, 3.55/4.0 CGPA, 2021-2025)
  - Advanced Diploma in Software Engineering, Aptech Pakistan (2018-2021)
- **7 Verified Projects:**
  1. `intralead`: Full-Stack B2B Lead Gen SaaS (Next.js App Router, TypeScript, Supabase, PostgreSQL, Dodo Payments atomic wallet, RLS).
  2. `proxmox_infra`: Self-Hosted Virtualized Cloud Infrastructure (Proxmox VE, LXC, Docker, Cloudflare Zero Trust, Tailscale, Redis, 75%+ power reduction).
  3. `transform_paint`: Transform and Restore Paint Commercial Portal (WordPress, Elementor Pro, Technical SEO, 348 search impressions, 7.2% CTR).
  4. `lisa_flowers`: Lisa Flowers & Balloons E-Commerce Platform (Shopify Liquid, Custom Theme, SEO 7.8% organic CTR, Page 1 Google).
  5. `smiths_blades`: Smith's Blades Custom E-Commerce Theme (Shopify Liquid, JavaScript ES6+, Section Schemas, zero app bloat).
  6. `route21`: Route 21 High-Performance E-Commerce Store (WooCommerce, PHP, MySQL, Redis object caching, sub-100ms catalog queries).
  7. `swipetify`: Swipetify Luxury Lifestyle Platform (React.js, TypeScript, GSAP 60 FPS animations, ScrollTrigger, Vite).
- **Verified Experience:**
  - Software Engineer Intern, Cronix Solutions (Remote, Jun 2026 - Aug 2026)
  - Freelance Software & Web Developer, Upwork (Remote, Aug 2025 - Present, 100% Job Success Score)

#### [`src/ai/index.ts`](file:///c:/Coding/JobSearch/src/ai/index.ts)
- **Role:** Interfaces with Google Gemini API (`gemini-3.7-flash` with fallbacks to `gemini-3.6-flash` and `gemini-3.5-flash-lite`).
- **Features:** Rate-limited outbound throttling, intelligent 429 quota backoff parsing, recursive em-dash removal.
- **Key Functions:**
  - `generateStructuredJson<T>(options: GenerateJsonOptions): Promise<T>`
  - `parseJsonSafely<T>(raw: string): T`
  - `sanitizeEmDashes<T>(value: T): T`

#### [`src/ai/resume-tailorer.ts`](file:///c:/Coding/JobSearch/src/ai/resume-tailorer.ts)
- **Role:** Generates tailored resume structures matching target job descriptions.
- **Rules:** Selects 3 projects from the verified catalog, reorders skills by relevance, crafts FAANG-grade headlines, formats bullets using Google XYZ format, and enforces ATS scoring thresholds >= 85%.
- **Key Functions:**
  - `generateTailoredResumeData(options: TailorResumeOptions): Promise<TailoredResumeOutput>`
  - `selectRelevantCertifications(jobTitle, jobDescription, maxCerts?): Array<{ name, issuer }>`

#### [`src/ai/resume-compiler.ts`](file:///c:/Coding/JobSearch/src/ai/resume-compiler.ts)
- **Role:** Compiles `ResumeData` into pixel-perfect single-column A4 HTML.
- **Autofit Density Profiles:**
  - High Density (>44 lines): 8.45pt font, 1.22 line-height, 4.2px section margins.
  - Medium Density (>35 lines): 8.75pt font, 1.25 line-height, 5.5px section margins.
  - Standard Density: 9.05pt font, 1.30 line-height, 7.0px section margins.
- **Key Function:** `generateResumeHtml(data: ResumeData): string`

#### [`src/ai/ats-evaluator.ts`](file:///c:/Coding/JobSearch/src/ai/ats-evaluator.ts)
- **Role:** Simulates enterprise ATS scoring across 5 weighted dimensions:
  1. Hard Skill & Tech Stack Match (40% Weight)
  2. Job Title & Headline Alignment (20% Weight)
  3. Google XYZ & Quantifiable Bullet Impact (20% Weight)
  4. Contextual Keyword Density (15% Weight)
  5. Formatting & Parseability (5% Weight)
- **Key Function:** `evaluateResumeAtsScore(options): Promise<AtsEvaluationResult>`

#### [`src/ai/cover-letter-generator.ts`](file:///c:/Coding/JobSearch/src/ai/cover-letter-generator.ts)
- **Role:** Generates 4-paragraph cover letters (250-350 words) with single-page A4 HTML rendering.
- **Paragraph Architecture:**
  1. Paragraph 1: Direct Hook & UAE 0-Day Immediate Availability.
  2. Paragraph 2: Technical Stack Alignment against JD.
  3. Paragraph 3: Production Impact Deep Dive with verified project metrics.
  4. Paragraph 4: Professional Call to Action for interview.
- **Key Functions:**
  - `generateTailoredCoverLetter(options): Promise<CoverLetterResult>`
  - `generateCoverLetterHtml(data): string`

#### [`src/ai/email-generator.ts`](file:///c:/Coding/JobSearch/src/ai/email-generator.ts)
- **Role:** Drafts cold outreach emails (<120 words across 3 paragraphs) and LinkedIn recruiter InMail pitches (<80 words).
- **Features:** Salutation noise filter that strips corporate/department artifacts (e.g. "Talent Acquisition Group" $\rightarrow$ "Hi Hiring Team,").
- **Key Functions:**
  - `generateTailoredOutreachEmail(options): Promise<TailoredEmailResult>`
  - `generateLinkedInRecruiterPitch(options): Promise<LinkedInPitchResult>`
  - `sanitizeSalutation(rawName?, companyName?, contactType?): string`
  - `removeEmDashes(text: string): string`

#### [`src/ai/pdf-compiler.ts`](file:///c:/Coding/JobSearch/src/ai/pdf-compiler.ts)
- **Role:** Headless Chromium PDF compiler powered by Playwright.
- **Features:** Strict A4 page dimensions, background graphics printing, zero margin overrides, and process safety via `finally` browser closure blocks.
- **Key Functions:**
  - `compileHtmlToPdfBuffer(html: string, options?): Promise<Buffer>`
  - `compileResumePdf(resumeData: ResumeData): Promise<Buffer>`
  - `compileCoverLetterPdf(coverLetter): Promise<Buffer>`

---

### 5.4 Anti-Spam, Deliverability & Real-Time DNS Verifier

#### [`src/anti-spam/email-verifier.ts`](file:///c:/Coding/JobSearch/src/anti-spam/email-verifier.ts)
- **Role:** 4-tier real-time deliverability validator.
- **Tiers:**
  1. Syntax & Character Validation (RFC 5322 regex).
  2. Local-Part & Domain Blacklisting (blocks `noreply@`, `mailer-daemon@`, `example.com`, `mailinator.com`, and candidate self-emails).
  3. Real-Time DNS MX Resolution with in-memory caching and fallback to RFC 5321 implicit A-record resolution.
  4. Deliverability Confirmation.
- **Key Functions:**
  - `verifyEmailDeliverability(email: string): Promise<EmailVerificationResult>`
  - `filterDeliverableEmails(emails: string[]): Promise<string[]>`
  - `checkDomainMxRecords(domain: string, timeoutMs?): Promise<{ hasMx: boolean; mxHost?: string }>`

#### [`src/anti-spam/deliverability-shield.ts`](file:///c:/Coding/JobSearch/src/anti-spam/deliverability-shield.ts)
- **Role:** Protects sender mailbox health.
- **Warm-Up Ladder:**
  - Week 1: 5 emails/day (max 2 per trigger)
  - Week 2: 10 emails/day (max 3 per trigger)
  - Week 3: 15 emails/day (max 4 per trigger)
  - Week 4+: 20 emails/day (max 5 per trigger)
- **Circuit Breaker:** Automatically trips and pauses sends if the bounce rate exceeds 5% on 10+ sent emails.
- **Timezone Helper:** Computes UAE GST (UTC+4) business hours (08:00 to 18:00 Mon-Fri).

---

### 5.5 Storage & Google Drive Archiving Subsystem

#### [`src/drive/drive-service.ts`](file:///c:/Coding/JobSearch/src/drive/drive-service.ts)
- **Role:** Archives generated PDFs on Account 1 (5TB Google Drive) and provides binary PDF downloads.
- **Folder Hierarchy:**
  - Root: `Pulsereach Applications/`
    - Subfolder: `Resumes/`
    - Subfolder: `Cover Letters/`
    - Subfolder: `Dashboard Results/`
- **Key Functions:**
  - `uploadPdfToDrive(fileName, pdfBuffer, category): Promise<DriveUploadResult>`
  - `downloadDrivePdfBuffer(fileIdOrUrl: string): Promise<Buffer | null>`
  - `archiveApplicationPdfs(options): Promise<{ resumeDriveUrl, coverLetterDriveUrl }>`

---

### 5.6 Gmail MIME & Multi-Recipient Drafting Service

#### [`src/gmail/draft-service.ts`](file:///c:/Coding/JobSearch/src/gmail/draft-service.ts)
- **Role:** Creates and sends Gmail drafts on Account 2 (`amaanrizwan2016@gmail.com`).
- **Features:** Builds RFC 2822 `multipart/mixed` MIME messages with UTF-8 base64 subjects and attached single-page A4 PDFs.
- **Resilient Sender (`sendDraftForJob`):** Attempts send by `draftId`; if missing or expired, searches recent mailbox drafts for matching recipients and subjects to ensure delivery.
- **Key Functions:**
  - `buildMimeMessage(options: CreateDraftOptions): { rawMime: string; base64Url: string }`
  - `createMultiRecipientGmailDraft(options: CreateDraftOptions): Promise<GmailDraftResult>`
  - `sendApprovedGmailDraft(draftId: string): Promise<{ messageId: string }>`
  - `sendDraftForJob(options): Promise<{ sent: boolean; messageId: string }>`

---

### 5.7 Telegram Mobile Cockpit & Long-Polling Engine

#### [`src/telegram/bot-service.ts`](file:///c:/Coding/JobSearch/src/telegram/bot-service.ts)
- **Role:** Formats HTML review cards, handles inline keyboard button callbacks, and streams PDF documents on demand.
- **Interactive Button Matrix:**
  - Row 1: `[✅ Applied (Send Email)]` or `[✅ Applied on Portal]`
  - Row 2: `[📄 Send CV]` and `[📝 Send CL]`
  - Row 3: `[⏭️ Skip]` and `[🚫 Not Relevant]`
  - Row 4: `[🔗 Open Careers Portal]` (if portal URL exists)
  - Row 5: `[💼 Recruiter / Company LinkedIn]` (if LinkedIn URL exists)
- **Key Functions:**
  - `formatTelegramCardHtml(data: JobCardData): string`
  - `generateInlineKeyboard(jobId, appLink?, isPortal?, linkedIn?, rowNumber?): TelegramInlineKeyboardMarkup`
  - `sendTelegramReviewCard(cardData: JobCardData): Promise<number>`
  - `sendTelegramDocument(chatId, pdfBuffer, fileName, caption?): Promise<number>`
  - `handleTelegramCallback(callbackQuery, options?): Promise<void>`
  - `handleTelegramMessage(message: any): Promise<void>`

#### [`src/telegram/poll-service.ts`](file:///c:/Coding/JobSearch/src/telegram/poll-service.ts)
- **Role:** Manages continuous long-polling for local runs.
- **Features:** Deletes existing webhooks on startup, polls `getUpdates`, and invokes callback and message handlers.

---

### 5.8 Pipeline Orchestration, JIT Queue & State Store

#### [`src/worker/pipeline.ts`](file:///c:/Coding/JobSearch/src/worker/pipeline.ts)
- **Role:** Core pipeline orchestrator supporting both Just-In-Time (single job) and batch execution.
- **Key Logic:**
  - `parseSheetDateTimestamp(rawDate)`: Converts 12-hour AM/PM and GST timezone dates into Unix epoch ms.
  - `sortJobsByPriority(jobs)`: Preemptive LIFO sorting (newest date timestamp first, highest row number first).
  - `processSingleJobJustInTime(options)`: Processes the next unapplied lead, synthesizes documents, creates drafts, and dispatches review cards.
  - `runJobBatchPipeline(options)`: Runs batch processing up to daily limit.

#### [`src/worker/state-tracker.ts`](file:///c:/Coding/JobSearch/src/worker/state-tracker.ts)
- **Role:** Manages application state and deduplication in `state.json`.
- **Features:** Atomic file writes via tempfile rename, normalized job keys (`generateJobKey(company, title)`), and queue locks.
- **Key Functions:**
  - `loadState(filePath?): Promise<StateStore>`
  - `saveState(state: StateStore, filePath?): Promise<void>`
  - `filterUnprocessedJobs(jobs: SheetJobRow[]): Promise<SheetJobRow[]>`
  - `updateJobStatus(jobKey, status, extra?): Promise<void>`
  - `clearAllLocks(): Promise<void>`

---

### 5.9 Vercel Serverless Webhooks & Endpoints

#### [`api/telegram.ts`](file:///c:/Coding/JobSearch/api/telegram.ts)
- Receives Telegram webhook events (button clicks, messages) and routes them to `handleTelegramCallback()` or `handleTelegramMessage()`.

#### [`api/trigger.ts`](file:///c:/Coding/JobSearch/api/trigger.ts)
- Authenticated webhook endpoint (`x-webhook-secret`) for manual JIT lead generation or batch execution.

#### [`api/dashboard/trigger.ts`](file:///c:/Coding/JobSearch/api/dashboard/trigger.ts)
- Authenticated via Supabase JWT or Webhook Secret.
- Validates job inputs and dispatches GitHub Actions workflow `dashboard-generate.yml` via GitHub REST API in <5 seconds.

#### [`api/dashboard/status.ts`](file:///c:/Coding/JobSearch/api/dashboard/status.ts)
- Polls Google Drive for `results-dash-{timestamp}.json` uploaded by the GitHub Actions worker. Returns parsed ATS results, Drive links, and email text.

---

### 5.10 GitHub Actions CI/CD & Playwright Cloud Runners

#### [`.github/workflows/pulse-pipeline.yml`](file:///c:/Coding/JobSearch/.github/workflows/pulse-pipeline.yml)
- **Trigger:** Manual `workflow_dispatch` with optional parameters: `dry_run`, `force`, `target_row`.
- **Environment:** Ubuntu-latest, Node.js 22, Playwright Chromium.
- **Action:** Executes `pnpm tsx src/index.ts --single` and commits updated `state.json`.

#### [`.github/workflows/dashboard-generate.yml`](file:///c:/Coding/JobSearch/.github/workflows/dashboard-generate.yml)
- **Trigger:** Automated `workflow_dispatch` triggered by `/api/dashboard/trigger`.
- **Inputs:** `job_id`, `job_title`, `company_name`, `job_description`.
- **Action:** Executes `pnpm tsx src/dashboard/generate-worker.ts` and uploads output JSON to Google Drive.

---

### 5.11 Web Dashboard Frontend UI & Supabase Auth

#### [`public/dashboard.html`](file:///c:/Coding/JobSearch/public/dashboard.html)
- Standalone HTML/CSS/JS frontend styled in Dark Mode with gold and emerald accents.
- Features: Real-time form validation, async trigger call, 4-second polling status loop, ATS Score Radar, matched keywords badges, email body copy block, and Google Drive PDF download buttons.

#### [`public/login.html`](file:///c:/Coding/JobSearch/public/login.html)
- Supabase Auth login screen supporting Email Magic Links and Password sign-in.

---

## 6. Data Schemas, Type Definitions & State Machines

### SheetJobRow (Google Sheets Ingestion Model)

```typescript
export interface SheetJobRow {
  rowNumber: number;              // 1-indexed row number in the sheet
  dateFetched: string;            // Col A: e.g. "2026-08-23 06:00 PM GST"
  jobTitle: string;               // Col B: e.g. "Senior Frontend Engineer"
  companyName: string;            // Col C: e.g. "Careem"
  location: string;               // Col D: e.g. "Dubai, UAE"
  domainCategory: string;         // Col E: e.g. "Frontend / React"
  contactEmails: string[];        // Col F: Cleaned list of valid emails
  recruiterLinkedIn?: string;     // Col G: Recruiter / Company LinkedIn URL
  applicationLink: string;        // Col H: Careers portal URL
  outreachStrategy: string;       // Col I: Strategy / guidance notes
  atsKeywordsAndPhrasing: string; // Col J: Keywords to emphasize
  status?: string;                // Col K: Status write-back
  appliedAt?: string;             // Col L: Timestamp write-back
  cvLink?: string;                // Col M: Google Drive CV link
  coverLetterLink?: string;       // Col N: Google Drive Cover Letter link
  rawRow: string[];               // Raw API cell values
}
```

### ApplicationRecord & State Store (`state.json`)

```typescript
export type JobApplicationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'DRAFT_CREATED'
  | 'APPROVED'
  | 'SENT'
  | 'SKIPPED'
  | 'NOT_RELEVANT'
  | 'FOLLOWUP_DAY4_DRAFTED'
  | 'FOLLOWUP_DAY4_SENT'
  | 'FOLLOWUP_DAY9_DRAFTED'
  | 'FOLLOWUP_DAY9_SENT'
  | 'CANCELLED_REPLY_RECEIVED'
  | 'FAILED';

export interface ApplicationRecord {
  jobKey: string;                 // Deterministic key: company_title
  rowNumber: number;
  jobTitle: string;
  companyName: string;
  location: string;
  status: JobApplicationStatus;
  atsScore?: number;
  matchScore?: number;
  selectedProjects?: string[];
  contactEmails: string[];
  recruiterLinkedIn?: string;
  applicationLink?: string;
  draftId?: string;
  telegramMessageId?: number;
  resumeDriveUrl?: string;
  coverLetterDriveUrl?: string;
  appliedAt?: string;
  followUpDay4At?: string;
  followUpDay9At?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StateStore {
  version: number;
  lastSyncTime: string;
  totalProcessedCount: number;
  activeJobKey?: string;
  lastActionTimestamp?: string;
  nextEligibleDispatchAt?: string;
  applications: Record<string, ApplicationRecord>;
}
```

---

## 7. AI Prompt Catalog, Scoring Models & Self-Correction

### ATS Evaluation Prompt & 5-Factor Scoring Rules

```typescript
// System instruction for ATS scoring
const systemInstruction = `You are a state-of-the-art enterprise ATS simulator and technical recruiting auditor.
Evaluate candidate match against the job description across 5 weighted factors:
1. HARD SKILL & TECH STACK MATCH (40% Weight)
2. JOB TITLE & HEADLINE ALIGNMENT (20% Weight)
3. GOOGLE XYZ & QUANTIFIABLE BULLET IMPACT (20% Weight)
4. CONTEXTUAL KEYWORD DENSITY (15% Weight)
5. FORMATTING & PARSEABILITY (5% Weight)

SCORING GUIDELINES:
- Score 90-100 (A+, High 90-99% pass probability)
- Score 85-89 (A, High pass probability)
- Score 75-84 (B, Medium pass probability)
- Score <75 (C/D, Low pass probability)`;
```

### Self-Correction Loop
If the ATS score returned is `< 85`, [`src/ai/resume-tailorer.ts`](file:///c:/Coding/JobSearch/src/ai/resume-tailorer.ts) triggers an automated refinement pass:
1. Feeds the initial draft and specific ATS recommendations back to Gemini.
2. Instructs the model to rewrite summary and project bullets to incorporate missing technical keywords.
3. Re-evaluates ATS score before proceeding to PDF compilation.

---

## 8. Anti-Spam Engineering, Rate Limiting & Deliverability

### RFC 2822 Multipart/Mixed MIME Builder Structure

```
From: Amaan Rizwan <amaanrizwan2016@gmail.com>
To: recipient@company.ae
Subject: =?UTF-8?B?...?=
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="__boundary_xxx__"

--__boundary_xxx__
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: 8bit

[Cold Email Body Text]

--__boundary_xxx__
Content-Type: application/pdf; name="Amaan_Rizwan_CV_Company_Role.pdf"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="Amaan_Rizwan_CV_Company_Role.pdf"

[Base64 PDF Content]

--__boundary_xxx__
Content-Type: application/pdf; name="Amaan_Rizwan_CoverLetter_Company_Role.pdf"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="Amaan_Rizwan_CoverLetter_Company_Role.pdf"

[Base64 Cover Letter PDF Content]
--__boundary_xxx__--
```

---

## 9. Telegram Cockpit Specification & Mobile Interface

### Review Card Layout

```
🚀 Senior Full Stack Engineer @ Careem
📍 Dubai, UAE | 🎯 ATS Score: 92/100 • 📁 CV | 📝 Cover Letter
💼 LinkedIn: Recruiter / Company Profile

📬 To: careers@careem.com
📝 Subject: Senior Full Stack Engineer Application - Amaan Rizwan

> Hi Hiring Team,
> 
> I am writing to express my strong interest in the Senior Full Stack Engineer opening at Careem. As a UAE Residence Visa holder based in Ajman, I am available immediately with zero notice period.
> 
> With hands-on expertise in Next.js App Router, TypeScript, PostgreSQL, and scalable microservices, I recently engineered Intralead, a B2B SaaS platform featuring atomic wallet transactions and sub-second API latencies.
> 
> I have attached my tailored CV and Cover Letter for your review and welcome the opportunity to discuss how my background aligns with your engineering goals.
```

### Button Matrix

```
+-------------------------------------------------------------+
|               [ ✅ Applied (Send Email) ]                   |
+------------------------------+------------------------------+
|        [ 📄 Send CV ]        |        [ 📝 Send CL ]        |
+------------------------------+------------------------------+
|          [ ⏭️ Skip ]         |       [ 🚫 Not Relevant ]    |
+------------------------------+------------------------------+
|               [ 🔗 Open Careers Portal ]                    |
+-------------------------------------------------------------+
|             [ 💼 Recruiter / Company LinkedIn ]             |
+-------------------------------------------------------------+
```

### Slash Commands

| Command | Action |
|---|---|
| `/next` or `⚡ Next Lead` | Fetches and prepares the highest priority unprocessed lead from Google Sheets |
| `/next <rowNumber>` | Targets a specific row number in Google Sheets (e.g. `/next 14`) |
| `/status` or `📊 Status` | Displays active lead, backlog queue count, and total applications processed |
| `/reset` or `/unlock` | Clears stuck active job locks and resets cooldowns in `state.json` |
| `/help` | Displays the mobile cockpit command guide |

---

## 10. Environment Variables & Credentials Setup Guide

| Key | Required | Purpose / Location |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI Studio free API key (15 RPM / 1,500 RPD) |
| `AI_MODEL` | No | Default AI model (`gemini-3.7-flash`) |
| `GOOGLE_CLIENT_ID` | Yes | Google Cloud Console OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google Cloud Console OAuth2 Client Secret |
| `GOOGLE_STORAGE_REFRESH_TOKEN` | Yes | Storage & Sheets account Refresh Token |
| `GOOGLE_SPREADSHEET_ID` | Yes | Google Sheets Document ID (from sheet URL) |
| `GMAIL_REFRESH_TOKEN` | Yes | Outreach Gmail Refresh Token |
| `GMAIL_SENDER_EMAIL` | Yes | Candidate Outreach Sender Email (e.g. `you@example.com`) |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram Bot token from `@BotFather` |
| `TELEGRAM_CHAT_ID` | Yes | Telegram User/Chat ID from `@userinfobot` |
| `WEBHOOK_SECRET` | Yes | Random secure secret string for authenticating API triggers |
| `GITHUB_TOKEN` | Optional | GitHub Personal Access Token (PAT) with `actions:write` scope |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL for dashboard authentication |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase publishable anonymous API key |

---

## 11. Developer & Operator Playbook (CLI, Testing, Debugging)

### Running Locally

```bash
# 1. Start the Manual On-Demand Cockpit (Long-polling mode)
pnpm tsx src/index.ts

# 2. Process a single lead via JIT CLI (Newest first)
pnpm pulse:next

# 3. Process a specific Google Sheet row (e.g. Row 14)
pnpm tsx src/index.ts --single --row=14

# 4. Run batch pipeline (up to 5 leads)
pnpm pulse

# 5. Run dry-run test (generates documents and ATS score without sending)
pnpm tsx src/index.ts --single --dry-run
```

### Running Test Suite

```bash
# Test Google Sheets API ingestion and email parsing
pnpm test:sheets

# Test Candidate Catalog integrity (Amaan Rizwan profile)
pnpm test:candidate

# Test Gemini AI rate limiting and JSON parser
pnpm test:ai

# Test Resume Tailoring & ATS Scoring Engine
pnpm test:resume

# Test Cover Letter Generation (4-paragraph format)
pnpm test:cover-letter

# Test Cold Email Drafter & Salutation Sanitizer
pnpm test:email

# Test Playwright Headless Chromium PDF Compilation
pnpm test:pdf

# Test Gmail MIME Multi-Recipient Draft Creation
pnpm test:gmail

# Test Anti-Spam Deliverability Shield & DNS MX Verifier
pnpm test:deliverability

# Test Google Drive Subfolder Archiver & Downloader
pnpm test:drive

# Test Telegram Review Cards & Button Callbacks
pnpm test:telegram

# Run End-to-End Test (Full Mocked Integration Pipeline)
pnpm test:e2e

# Run TypeScript Strict Typecheck
pnpm typecheck
```

---

## 12. Failure Modes, Edge Cases & Recovery Handbook

### 1. Stuck Active Lead Lock
- **Symptom:** Bot indicates a lead is already active or refuses to fetch new leads.
- **Fix:** Run `/reset` in Telegram or execute `pnpm tsx src/scripts/fresh_start.ts` in the terminal to clear `activeJobKey` in `state.json`.

### 2. Gemini 429 Quota Spike
- **Symptom:** Gemini API returns temporary quota exhaustion error.
- **Handling:** [`src/ai/index.ts`](file:///c:/Coding/JobSearch/src/ai/index.ts) automatically extracts the retry delay (e.g. `Please retry in 8.5s`), pauses execution until the window resets, and falls back to alternate models (`gemini-3.6-flash`, `gemini-3.5-flash-lite`).

### 3. Vercel Serverless Chromium Absence
- **Symptom:** Playwright cannot launch Chromium in Vercel Serverless environment.
- **Architecture:** PDF compilation is routed through GitHub Actions runners (`pulse-pipeline.yml` / `dashboard-generate.yml`), where Chromium is pre-installed. The Vercel function simply triggers the workflow dispatch and polls Drive for results.

### 4. Recruiter Email DNS Failure / Missing MX
- **Symptom:** Google Sheet contains dead or placeholder emails (e.g. `hr@dummycompany.com`).
- **Handling:** [`src/anti-spam/email-verifier.ts`](file:///c:/Coding/JobSearch/src/anti-spam/email-verifier.ts) detects missing MX records in real time and automatically reclassifies the lead as a **Portal Application Lead**, generating LinkedIn pitches instead of creating a broken Gmail draft.

---

## 🏁 Summary Checklist for New Agents & Engineers

1. Review Candidate Ground Truth in [`src/ai/candidate-catalog.ts`](file:///c:/Coding/JobSearch/src/ai/candidate-catalog.ts).
2. Validate `.env` against [Section 10](#10-environment-variables--credentials-setup-guide).
3. Ensure all new code adheres to the **Zero Em-Dash Policy** and **Single-Page A4 Guarantee**.
4. Test changes locally using `pnpm test:e2e` and `pnpm typecheck`.
5. Update [`PLAN.md`](file:///c:/Coding/JobSearch/PLAN.md) upon completing tasks.

*(End of Master Handover Document)*
