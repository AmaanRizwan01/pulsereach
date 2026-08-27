# 📝 Rule: Continuous Professional Documentation Standard

## Purpose
Ensure every code change, architectural evolution, sprint completion, and configuration update in Pulsereach is immediately and thoroughly documented, creating a zero-context-loss repository accessible to any human developer or AI agent.

## Rules for Agents Working in this Repository
1. **Never make silent changes:** Whenever a feature, bugfix, or refactor is implemented, document:
   - What changed (with clickable file links).
   - Why it changed (architectural / business rationale).
   - Verification evidence (exact terminal commands and output logs).
2. **Synchronize Documentation with Code:**
   - Update [`PLAN.md`](file:///c:/Coding/JobSearch/PLAN.md) sprint checkboxes and status tags upon completing tasks.
   - If APIs, data contracts, environment variables, or schemas change, update the corresponding markdown documents in [`PLAN/`](file:///c:/Coding/JobSearch/PLAN/) or [`docs/`](file:///c:/Coding/JobSearch/docs/).
3. **Maintain Professional Handover Quality:**
   - Documentation must be clear, precise, and self-contained.
   - Format with markdown headers, tables, code blocks, diffs, and mermaid flowcharts where appropriate.
4. **Enforce Core Project Standards:**
   - Candidate truth-anchoring (100% verified data, zero hallucinations).
   - Strict anti-em-dash rule across all AI outputs and communications.
   - Strict 1-page A4 PDF constraint for both resumes and cover letters.
   - Draft-first email gating with Telegram approval and anti-spam deliverability limits (15-min spacing, UAE business hours 8 AM - 6 PM UTC+4).
