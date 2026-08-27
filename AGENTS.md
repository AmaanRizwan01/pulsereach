# 🤖 Pulsereach — Agent Guidelines & Operational Standards

Welcome to **Pulsereach** (`c:/Coding/JobSearch`), an autonomous, human-in-the-loop job outreach and application engine targeting the UAE market with a $0.00/month operational budget.

---

## 🧠 MANDATORY PROTOCOL 1: Deep-Dive Planning & Production-Readiness Self-Assessment

Every agent, engineer, or contributor working on this repository **MUST** adhere to the **"Think 10x Before Coding 1x"** principle. **Never rush to write code.** Before writing or modifying any implementation, every agent must perform a comprehensive deep dive into the requirements and execute the following self-interrogation protocol:

### 1. Mandatory Self-Questioning Matrix
Before writing a single line of code, the agent must ask and answer these critical engineering questions:
1. **Production-Level Robustness:**
   - *Is this solution genuinely production-grade, or is it just a fragile prototype?*
   - *How will this behave under real-world pressure (network drops, rate limits, API timeouts, process restarts)?*
   - *Are error-handling, exponential backoff, and retry policies implemented for all external boundaries?*
2. **Failure Modes & Edge Cases:**
   - *How could this break in a real-world scenario?*
   - *What if inputs are empty, malformed, multi-byte/unicode, or unexpectedly large (e.g. 50+ contact emails, 4000-word job descriptions)?*
   - *What happens if an external dependency (Google Gemini, Gmail API, Telegram API, Sheets API) is degraded or unreachable?*
3. **Room for Architectural Improvement & Optimization:**
   - *Is there a cleaner, more modular, or higher-performance approach?*
   - *Can we reduce token usage, eliminate redundant API roundtrips, or optimize memory/CPU footprint without sacrificing clarity?*
   - *Are abstractions necessary and well-scoped, avoiding over-engineering while preventing tight coupling?*
4. **State, Concurrency & Idempotency:**
   - *Is this operation idempotent? If executed twice with identical input, does it cause side-effects (e.g. duplicate emails or multiple Telegram cards)?*
   - *Are state mutations atomic (e.g. atomic writes to `state.json` or database transactions)?*
   - *What happens if multiple triggers fire concurrently? Is debounce or locking in place?*
5. **Cost & Free-Tier Invariants:**
   - *Does this strictly preserve the $0.00/month zero-cost guarantee within free tier constraints?*
   - *Is token-bucket rate limiting strictly enforced before any outbound call?*

### 2. Pre-Code Implementation Planning Standard
For any non-trivial feature, refactor, or architectural addition:
- Create a structured implementation plan evaluating tradeoffs, dependencies, failure modes, and verification criteria.
- Present the architectural design, schema definitions, and verification strategy clearly before execution.

---

## 📌 MANDATORY PROTOCOL 2: Continuous Professional Documentation Standard

Every agent working on this repository **MUST** keep all documentation 100% synchronized with the code.

### 1. The "Zero-Context-Loss" Rule
Any documentation created or updated must be structured so that **any new agent or external human developer** can join the project with zero prior context and immediately understand:
- Current state of the codebase and sprint progress.
- Architectural decisions, rationale, and technical invariants.
- Exact file paths, schemas, API contracts, and environment variable requirements.
- How to test, verify, run, and deploy changes.
- Outstanding tasks, edge cases, and next steps.

### 2. Mandatory Documentation Updates on Every Change
Whenever code, prompts, schemas, or configurations are created, modified, or deleted:
1. **Update Master Plan / Sprint Tracker:** Mark checklist items in [`PLAN.md`](file:///c:/Coding/JobSearch/PLAN.md) with completion dates and test verification outputs.
2. **Update Component Documentation:** If modifying a subsystem (e.g. AI prompts, PDF templates, Sheets ingestion, Gmail MIME service, Anti-Spam shield, Telegram bot), update the corresponding reference file in [`PLAN/`](file:///c:/Coding/JobSearch/PLAN/) or [`docs/`](file:///c:/Coding/JobSearch/docs/).
3. **Maintain `CHANGELOG.md` / `WALKTHROUGH.md`:** Record:
   - **What changed** (with clickable file links).
   - **Why it was changed** (rationale & design decisions).
   - **Verification proof** (exact command lines executed and terminal outputs).
   - **Breaking changes or configuration migrations** (new `.env` keys, schema migrations).
4. **Preserve Inline Documentation:** All TypeScript source files must have clear JSDoc comments detailing function signatures, parameter types, error handling behavior, and rate-limiting side effects.

---

## 🏗️ Core Architectural Invariants

Every agent working on this codebase **MUST strictly enforce** the following non-negotiable rules:

### 1. 🛡️ Candidate Truth-Anchoring (Zero Hallucination Policy)
- All resume bullets, cover letters, and outreach emails must be derived **exclusively** from the verified candidate profile loaded via [`src/profile/profile-loader.ts`](file:///c:/Coding/JobSearch/src/profile/profile-loader.ts) (from Supabase table `candidate_profiles` or local `profile.json`).
- **Never invent** metrics, degrees, projects, companies, or skills.

### 2. 🚫 Strict Anti-Em-Dash Policy
- Generated output across all channels (Resumes, Cover Letters, Emails, Telegram cards) must **never contain em-dashes** (`—`, `--`, `–`).
- Use standard commas, semicolons, parentheses, or periods instead.
- Run all AI outputs through `removeEmDashes()` sanitizer.

### 3. 🎯 ATS Score & FAANG Presentation Standard (≥ 85%)
- Resumes must achieve a 5-factor ATS score of **≥ 85%** against the job description.
- Use Google XYZ metric bullet format (`Accomplished [X] as measured by [Y] by doing [Z]`).
- Format: Summary → Technical Skills → Experience → Projects → Education → Certifications.
- Differentiated headlines front-loading target role, top 3 matched stack items, and domain focus.
- Trigger self-correction loops if score falls below 85%.

### 4. 📄 Strict Single-Page A4 PDF Constraint
- Both Resume and Cover Letter PDFs must fit on **exactly 1 single A4 page**.
- Use dynamic micro-spacing and line-height autofit (`autoFitResumeData()`) to prevent multi-page overflow.

### 5. 📬 100% Manual On-Demand Telegram Cockpit
- **Zero unexpected automated actions.**
- Leads are prepared strictly on-demand when the human taps `[⚡ Next Lead]` or types `/next` (or `/next <row>`).
- Priority logic: Newest unapplied rows first (LIFO order), automatically skipping rows already marked applied or skipped.
- The pipeline creates a **Gmail Draft** with attached PDFs and sends a **Telegram review card**.
- Email sends are triggered **ONLY** when the human taps `[✅ Applied]` in Telegram.
- No artificial delays, no mandatory cooldown blocks, no daily budget blockers.

### 6. 💰 Zero-Cost Infrastructure ($0.00 / Month)
- All services operate strictly within free tier limits:
  - **Local / VPS Cockpit:** Node.js long-polling listener (`pnpm tsx src/index.ts`).
  - **Vercel Hobby:** Serverless webhooks (`/api/trigger`, `/api/telegram`) for on-demand cloud runs.
  - **GitHub Actions:** Manual `workflow_dispatch` runner with pre-installed Chromium.
  - **Google Gemini Flash:** Free tier (15 RPM / 1,500 RPD).
  - **Gmail API & Telegram Bot API:** Free tier.
- Multi-service token-bucket rate limiter (`src/rate-limiter/token-bucket.ts`) governs all outbound API traffic.

---

## 🗂️ Project Directory Structure

```
pulsereach/
├── AGENTS.md                         # Master agent guidelines, protocols & invariants
├── PLAN.md                           # Master 16-sprint execution plan
├── package.json                      # ESM TypeScript project manifest
├── tsconfig.json                     # TypeScript strict configuration
├── .env.example                      # Template for 9 environment variables
├── .env                              # Local secrets (never committed)
├── .github/
│   └── workflows/
│       └── pulse-pipeline.yml        # GitHub Actions fallback cron (2-hour safety net)
├── api/
│   ├── telegram.ts                   # Vercel serverless Telegram webhook
│   └── trigger.ts                    # Vercel webhook: Google Sheets onChange trigger
├── docs/                             # Architecture, API guides & sprint summaries
├── src/
│   ├── config/
│   │   └── env.ts                    # Zod validated environment variables
│   ├── rate-limiter/
│   │   └── token-bucket.ts           # Token-bucket rate limiter for all services
│   ├── sheets/
│   │   └── sheets-client.ts          # Google Sheets API 9-column reader & email parser
│   ├── ai/
│   │   ├── candidate-catalog.ts      # Master typed candidate profile (7 projects)
│   │   ├── candidate-data.ts         # Profile adapter
│   │   ├── resume-tailorer.ts        # AI resume tailoring engine
│   │   ├── resume-compiler.ts        # HTML/CSS A4 single-page template compiler
│   │   ├── ats-evaluator.ts          # 5-factor ATS scoring model (target ≥ 85%)
│   │   ├── cover-letter-generator.ts # 4-paragraph cover letter engine
│   │   ├── email-generator.ts        # Cold email drafter + salutation sanitizer
│   │   ├── followup-generator.ts     # Day 4 & Day 9 follow-up sequences
│   │   ├── conversation-classifier.ts# 8-intent recruiter classifier
│   │   ├── response-drafter.ts       # Contextual reply drafter
│   │   ├── conversational-modifier.ts# Revision engine
│   │   ├── match-evaluator.ts        # Job-candidate match scorer
│   │   ├── pdf-compiler.ts           # Playwright A4 PDF compiler
│   │   └── index.ts                  # Rate-limited Gemini client & exports
│   ├── anti-spam/
│   │   └── deliverability-shield.ts  # Warm-up ladder, 15-min throttle, business hours
│   ├── gmail/
│   │   └── draft-service.ts          # MIME builder + Gmail draft create & send
│   ├── telegram/
│   │   └── bot-service.ts            # Telegram cards, 5-button matrix, PDF stream
│   ├── worker/
│   │   ├── pipeline.ts               # Master batch pipeline orchestrator
│   │   └── state-tracker.ts          # Deduplication state store (state.json)
│   └── index.ts                      # Main runtime entrypoint
└── prompts/
    └── index.ts                      # Centralized AI prompt catalog
```

---

## 📋 Standard Handover & Sprint Completion Template

When completing a feature or milestone, provide documentation in the following structure:

```markdown
# 🚀 [Sprint/Feature Name] — Completion & Handover Report

## 1. Overview & Objective
Brief explanation of what was implemented and the business/technical objective.

## 2. Deep-Dive Analysis & Production Readiness
- Edge cases and failure modes analyzed and handled.
- Architectural improvements identified and integrated.
- Real-world resilience verification (timeouts, retries, rate limits).

## 3. Changes Made
- [NEW] `path/to/file.ts`: Description of module and exported interfaces.
- [MODIFY] `path/to/existing.ts`: Summary of changes and why they were made.

## 4. Key Technical Decisions & Invariants Upheld
- Architecture choices, rate-limiting considerations, anti-spam protections.
- Zero em-dash compliance and truth-anchoring verified.

## 5. Verification & Testing Evidence
- Exact terminal commands executed.
- Output logs and assertions confirming successful behavior.

## 6. Current Codebase State & Next Actions
- Next sprint/task to execute.
- Open questions or prerequisite credentials needed.
```

---

## ⚡ Summary for Fast Onboarding

1. **Deep-Dive First:** Review the task, evaluate failure modes, edge cases, and optimizations before writing code.
2. Read [`PLAN.md`](file:///c:/Coding/JobSearch/PLAN.md) to understand the active sprint.
3. Check `.env` against `.env.example` before running any scripts.
4. Use `pnpm tsx <script>` for local verification of individual modules.
5. Always test with real/mocked inputs before marking a sprint deliverable complete.
6. Update documentation immediately upon completing or modifying any feature.
