# 🚀 Pulsereach: Handover & Architectural Reference

The complete, zero-context-loss Master Handover Document has been compiled and is maintained in:

👉 [**`docs/MASTER_HANDOVER.md`**](file:///c:/Coding/JobSearch/docs/MASTER_HANDOVER.md)

---

## 📑 Quick Directory Index

- **Candidate Master Profile Loader:** [`src/profile/profile-loader.ts`](file:///c:/Coding/JobSearch/src/profile/profile-loader.ts)
- **Candidate Types & Schema:** [`src/profile/types.ts`](file:///c:/Coding/JobSearch/src/profile/types.ts)
- **Pipeline Orchestrator:** [`src/worker/pipeline.ts`](file:///c:/Coding/JobSearch/src/worker/pipeline.ts)
- **Telegram Cockpit Service:** [`src/telegram/bot-service.ts`](file:///c:/Coding/JobSearch/src/telegram/bot-service.ts)
- **Single-Page Resume Compiler:** [`src/ai/resume-compiler.ts`](file:///c:/Coding/JobSearch/src/ai/resume-compiler.ts)
- **ATS Scoring Engine:** [`src/ai/ats-evaluator.ts`](file:///c:/Coding/JobSearch/src/ai/ats-evaluator.ts)
- **Cover Letter Engine:** [`src/ai/cover-letter-generator.ts`](file:///c:/Coding/JobSearch/src/ai/cover-letter-generator.ts)
- **Email Drafter & Salutation Sanitizer:** [`src/ai/email-generator.ts`](file:///c:/Coding/JobSearch/src/ai/email-generator.ts)
- **Playwright Single-Page A4 PDF Compiler:** [`src/ai/pdf-compiler.ts`](file:///c:/Coding/JobSearch/src/ai/pdf-compiler.ts)
- **Google Sheets 14-Column Ingestion Client:** [`src/sheets/sheets-client.ts`](file:///c:/Coding/JobSearch/src/sheets/sheets-client.ts)
- **Google Drive Subfolder Archiver:** [`src/drive/drive-service.ts`](file:///c:/Coding/JobSearch/src/drive/drive-service.ts)
- **Gmail Multi-Recipient Draft Service:** [`src/gmail/draft-service.ts`](file:///c:/Coding/JobSearch/src/gmail/draft-service.ts)
- **Anti-Spam Shield & DNS MX Verifier:** [`src/anti-spam/email-verifier.ts`](file:///c:/Coding/JobSearch/src/anti-spam/email-verifier.ts)
- **Multi-Service Rate Limiter:** [`src/rate-limiter/token-bucket.ts`](file:///c:/Coding/JobSearch/src/rate-limiter/token-bucket.ts)

---

## ⚡ Quick Start for Developers & Agents

```bash
# 1. Start manual on-demand Telegram cockpit
pnpm tsx src/index.ts

# 2. Run single JIT lead generation (newest-first)
pnpm pulse:next

# 3. Target a specific Google Sheet row
pnpm tsx src/index.ts --single --row=14

# 4. Run full integration test suite
pnpm test:e2e

# 5. Typecheck TypeScript sources
pnpm typecheck
```
