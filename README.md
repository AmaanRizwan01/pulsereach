# 🚀 Pulsereach

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-orange?logo=playwright)](https://playwright.dev/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-2.0_Flash-purple?logo=google)](https://aistudio.google.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-emerald?logo=supabase)](https://supabase.com/)
[![Budget](https://img.shields.io/badge/Operational_Budget-$0.00%2Fmonth-brightgreen)]()

**Autonomous, Human-in-the-Loop Job Application & Outreach Cockpit.**  
*Tailors FAANG-grade single-page A4 resumes, cover letters, and cold emails with $0.00/month infrastructure.*

[**Human Setup Manual**](docs/SETUP_MANUAL.md) • [**AI Agent Auto-Setup**](docs/SETUP_AI_AGENT.md) • [**Candidate Profile Guide**](docs/PROFILE_GUIDE.md) • [**Architecture Handover**](docs/MASTER_HANDOVER.md)

</div>

---

## 🌟 What is Pulsereach?

**Pulsereach** is an autonomous, production-grade job application assistant engineered to help software engineers and technical professionals land roles faster with zero manual document formatting.

Instead of generic template spamming, Pulsereach uses **truth-anchored AI reasoning** to:
1. Ingest job vacancies from a Google Sheet.
2. Evaluate job-candidate compatibility and target ATS keywords.
3. Tailor a strict **single-page A4 PDF resume** (Google XYZ metric bullet format, ≥ 85% ATS score).
4. Compose a tailored **4-paragraph A4 PDF cover letter**.
5. Craft a personalized outreach email.
6. Create an **RFC 2822 MIME Gmail draft** with both PDFs attached.
7. Send an interactive review card to your **Telegram Mobile Cockpit** for a 1-tap review (`[✅ Applied]`, `[📄 Send CV]`, `[📝 Send CL]`, `[⏭️ Skip]`).

---

## 🏗️ Architecture & Invariants

```mermaid
flowchart TD
    A[Google Sheet: New Job Lead] --> B[Pulsereach Ingestion & Deduplication]
    B --> C[Candidate Profile Store: Supabase / Local]
    C --> D[Google Gemini AI Engine]
    D --> E[Tailored Resume & Cover Letter HTML]
    E --> F[Playwright Headless Chromium A4 PDFs]
    F --> G[Google Drive 5TB PDF Archiver]
    F --> H[Gmail API RFC 2822 Draft Builder]
    H --> I[Telegram Mobile Cockpit Review Card]
    I -->|Tap [✅ Applied]| J[Live Gmail Outreach & Sheet Status Update]
```

### Non-Negotiable Engineering Invariants:
- 🛡️ **Candidate Truth-Anchoring:** Resumes and cover letters stem *strictly* from your verified profile. Zero hallucinations.
- 🚫 **Strict Anti-Em-Dash Policy:** Zero em-dashes (`—` or `--`) anywhere in generated text or PDFs.
- 📄 **Single-Page A4 Guarantee:** Dynamic autofit CSS ensures both CV and Cover Letter fit on exactly 1 single A4 page.
- 📬 **100% Human-in-the-Loop:** Emails are dispatched *only* when you tap `[✅ Applied]` in your Telegram cockpit.
- 💰 **Zero-Cost Free Tier ($0.00/month):** Runs on Google Cloud free tier, Gemini Flash, Vercel Hobby, and Supabase free tier.

---

## 🚀 Quick Start (Choose Your Setup Path)

### Option A: Let an AI Agent Do It For You 🤖
If you use Cursor, Antigravity, Claude Code, Windsurf, or Devin:
👉 Open [**`docs/SETUP_AI_AGENT.md`**](docs/SETUP_AI_AGENT.md), copy the single prompt, and paste it into your AI assistant.

---

### Option B: Manual Setup 🛠️
Follow the complete step-by-step guide in [**`docs/SETUP_MANUAL.md`**](docs/SETUP_MANUAL.md).

#### 1. Clone & Install
```bash
git clone https://github.com/AmaanRizwan01/pulsereach.git
cd pulsereach
pnpm install
npx playwright install chromium
cp .env.example .env
```

#### 2. Configure Candidate Profile
```bash
cp profile.example.json profile.json
# Edit profile.json with your real projects, experience, and contact details
pnpm profile:seed
```

#### 3. Run Test Suites & Start Cockpit
```bash
# Verify everything passes
pnpm typecheck
pnpm test:candidate
pnpm test:deliverability
pnpm test:e2e

# Start local interactive Telegram Cockpit
pnpm bot:listen
```

---

## 📱 Telegram Mobile Cockpit

When a lead is fetched, Pulsereach prepares everything and sends a rich review card directly to your phone:

<div align="center">

```
🚀 Senior Frontend Engineer @ Careem
📍 Dubai, UAE | 🎯 ATS Score: 94/100 • 📁 CV | 📝 Cover Letter

📬 To: careers@careem.com
📝 Subject: Application: Senior Frontend Engineer - Your Name

> Hi Careem Team, I am reaching out regarding the Frontend Engineer opening...

[  ✅ Applied (Send Email)  ]
[  📄 Send CV  ] [  📝 Send CL  ]
[  ⏭️ Skip  ]    [  🚫 Not Relevant  ]
[  🔗 Open Careers Portal  ]
```

</div>

- **`[✅ Applied (Send Email)]`**: Sends the Gmail draft with attachments and marks the Google Sheet row `Applied (Email Sent)`.
- **`[📄 Send CV]` / `[📝 Send CL]`**: Streams the compiled single-page A4 PDF directly into your Telegram chat.
- **`[⚡ Next Lead]`**: On-demand fetches the next unapplied lead from your Google Sheet (newest first).

---

## 🧪 Comprehensive Verification Suite

```bash
pnpm test:candidate       # Candidate profile schema, truth-anchoring & em-dash tests
pnpm test:deliverability  # 4-week warm-up ladder, 15-min cooldown & UAE business hours
pnpm test:ai              # Gemini AI structured output tests
pnpm test:resume          # Resume tailoring & ATS scoring tests
pnpm test:cover-letter    # 4-paragraph cover letter tests
pnpm test:pdf             # Playwright A4 PDF compilation tests
pnpm test:gmail           # RFC 2822 MIME builder tests
pnpm test:e2e             # Master end-to-end 25-assertion suite
pnpm typecheck            # TypeScript compiler check
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Feel free to star ⭐ the repository, fork it, and adapt it for your own career search!
