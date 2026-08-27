# 🧠 Rule: Mandatory Deep-Dive Planning & Production-Readiness Assessment

## Purpose
Enforce a "Think 10x Before Coding 1x" engineering culture where every task is deeply analyzed for production readiness, robustness, real-world edge cases, and optimization opportunities before any code is written.

## Pre-Implementation Self-Questioning Matrix
Before writing or modifying any implementation, the agent must ask and answer:
1. **Production-Level Robustness:**
   - Is this genuine production-grade code or a brittle prototype?
   - How will it behave under network drops, 429 rate limits, and service outages?
   - Are exponential backoffs and retry mechanisms configured at all I/O boundaries?
2. **Failure Modes & Edge Cases:**
   - What real-world scenarios could break this?
   - How are empty, malformed, non-standard, or oversized inputs handled?
3. **Room for Architectural Improvement & Optimization:**
   - Is there a cleaner, faster, or more maintainable pattern?
   - Can we minimize unnecessary token usage, memory footprint, or roundtrip latency?
4. **State, Concurrency & Idempotency:**
   - Is this operation safe against concurrent triggers or multiple executions?
   - Are state updates atomic?
5. **Cost & Rate Invariants:**
   - Does this strictly maintain the $0.00/month free-tier budget?
