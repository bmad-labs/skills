# bmad-auto Skill — Full Evaluation & Benchmark Report

**Date:** 2026-03-09
**Skill Version:** Post-improvement (team-based architecture, collaborative escalation, manual task automation)
**Analysis by:** 3 parallel exploration agents + manual review

---

## Executive Summary

The bmad-auto skill is a complex orchestration skill (551 lines, 3,551 words in SKILL.md + 8,052 words in 15 reference files). It coordinates BMAD Phase 4 implementation through team-based sub-agents with persistent context and a 3-tier escalation ladder.

**Overall Score: 3.8 / 5.0**

The skill has a strong architectural foundation and excellent progressive disclosure, but has **critical control flow gaps** around infinite loop prevention, timeout handling, and state tracking that need addressing before production use.

---

## 1. Structure & Token Efficiency — 4/5

| Metric | Value |
|--------|-------|
| SKILL.md lines | 551 (guideline: 500) |
| SKILL.md words | 3,551 (167 frontmatter + 3,384 body) |
| Reference files | 15 files, 8,052 words |
| Total content | 11,603 words |
| SKILL.md % of total | 30.6% |
| Sub-agent definitions | 6 |
| Critical rules | 14 |
| Decision points | 39 lines |

**SKILL.md Body Breakdown:**

| Section | ~Words | % |
|---------|--------|---|
| Architecture & Team Patterns | 1,100 | 31% |
| Startup & Status Logic | 400 | 11% |
| Main Loop & Steps 1-5 | 1,300 | 37% |
| Error Handling & Rules | 400 | 11% |

**Findings:**
- Good progressive disclosure ratio (30.6% SKILL.md / 69.4% references)
- No content duplication between SKILL.md and reference files
- All reference files are properly referenced from SKILL.md
- Collaborative Escalation Pattern (~60 lines) and Error Handling (~30 lines) repeat similar concepts — could be consolidated
- Validation guide Report Templates are repeated across 13 files — a shared template would save ~30%

**Optimization potential:** ~300-400 tokens (3%) through consolidation of repeated patterns.

---

## 2. Completeness & Decision Coverage — 4/5

### Full Decision Tree

| Location | Decision Point | Success Path | Failure Path | Retry Limit | Dead End? |
|----------|---------------|-------------|-------------|-------------|-----------|
| Startup §1 | sprint-status.yaml exists? | Read → §2 | bmad-help → STOP | N/A | Yes (intentional) |
| Startup §2 | All done? | bmad-help → STOP | Continue → §3 | N/A | Yes (intentional) |
| Step 1 | Story created? | Shutdown → Step 2 | Feedback → retry | 2 | Halt for user |
| Step 2 | Validation passes? | Shutdown → Step 3 | Feedback → retry | 2 | Halt for user |
| Step 3 | Dev succeeds? | Shutdown → Step 4 | Escalation ladder | 2+3 collab | Halt for user |
| Step 3 | Manual task? | Automate → continue | Halt for user | N/A | Yes (waits for user) |
| Step 4 | Review passes? | Shutdown → Step 4.5 | Respawn dev+reviewer | 2 | Halt for user |
| Step 4.5 PASS | — | Shutdown → Step 5 | — | — | — |
| Step 4.5 PARTIAL | — | Shutdown → Step 5 (warn) | — | — | — |
| Step 4.5 FAIL | Fix? | Re-run 4+4.5 | Escalation ladder | 2+3 collab | Halt for user |
| Step 5 | User approves commit? | Commit → next story | Wait | N/A | Yes (waits for user) |
| Epic done | All stories done? | Retro → next epic | Continue loop | N/A | No |

**Gaps found:**
- No handling for unexpected story status values (e.g., `blocked`, `cancelled`)
- Status query doesn't handle missing sprint-status.yaml (startup does, but status query doesn't)
- Step 4 (Code Review) skips collaborative escalation tier — inconsistent with Steps 3 and 4.5

---

## 3. Consistency — 4/5

| Check | Result |
|-------|--------|
| All prompts include "Do NOT make any git commits" | 6/6 |
| All prompts include collaboration template line | 6/6 |
| All prompts include shutdown_request handling | 6/6 |
| All prompts report via SendMessage | 6/6 |
| Naming convention (kebab-case) | Consistent |
| Team name consistency | "bmad-auto" throughout |

**Issues:**
- Retry limit phrasing varies: "Retry up to 2 times" vs "2 rounds of feedback" vs "2 feedback rounds"
- Validation guide naming is inconsistent: `*-application.md` vs `*-testing.md` vs compound names
- Skill invocation arg format varies: `args: "1.1"` vs `args: "validate 1.1"`

---

## 4. Clarity — 3.5/5

**Ambiguities found:**

| Issue | Location | Impact |
|-------|----------|--------|
| "Re-read sprint-status.yaml" — when and why? | Multiple steps | Unclear trigger for re-reads |
| "Already passed in this session" — how tracked? | Step 4, line 238 | No mechanism to record code review results |
| "3 collaboration rounds" — what counts as a round? | Escalation pattern | Vague measurement |
| "Monitor via idle notifications" — what is idle? | Collaborative escalation | No timeout defined |
| Step 2 invokes same skill as Step 1 with "validate" prefix | Steps 1-2 | Muddies step boundaries |

---

## 5. Error Handling & Escalation — 3.5/5

**Escalation Ladder (3 tiers):**
1. Orchestrator feedback (2 rounds)
2. Collaborative escalation — peer-to-peer researcher + worker (3 rounds)
3. Halt for user

**Critical gaps:**

| # | Gap | Severity | Description |
|---|-----|----------|-------------|
| 1 | **No SendMessage timeout** | CRITICAL | If sub-agent hangs/dies, orchestrator waits forever |
| 2 | **No retry counter mechanism** | HIGH | "Retry up to 2 times" stated but no tracking mechanism defined |
| 3 | **Epic status verification** | HIGH | After sprint-planning, no check that status advanced from `backlog` — could loop |
| 4 | **Step 4 missing escalation tier** | MEDIUM | Code review goes: 2 retries → halt (skips collaborative escalation) |
| 5 | **No concurrency protection** | MEDIUM | No handling for user running bmad-auto twice, or editing sprint-status.yaml during run |
| 6 | **Skill invocation failures** | MEDIUM | No fallback if a dependent skill (e.g., bmad-bmm-create-story) itself errors |

---

## 6. Infinite Loop Risk Analysis — CRITICAL

| Risk | Severity | Description |
|------|----------|-------------|
| **SendMessage hang** | CRITICAL | Sub-agent never responds → orchestrator blocks forever. No timeout defined. |
| **Epic status loop** | HIGH | If sprint-planning doesn't advance epic from `backlog`, orchestrator could re-invoke sprint-planning indefinitely |
| **Feedback loop counting** | HIGH | No formalized counter for retry rounds. Orchestrator must track state but mechanism isn't specified. |
| **Review cycle** | MEDIUM | Step 4 dev→review→dev→review could theoretically loop if status stays `review` |
| **Collaboration rounds** | MEDIUM | "3 rounds" is vague. Researcher and worker could exchange messages indefinitely without hitting the limit. |

---

## 7. Progressive Disclosure — 5/5

| Level | Content | When Loaded |
|-------|---------|-------------|
| Metadata | 167 words | Always in context |
| SKILL.md body | 3,384 words | When skill triggers |
| functional-validation-prompt.md | 296 words | During Step 4.5 only |
| functional-validation-strategies.md | 950 words | During Step 4.5 only |
| 1 of 13 guide files | 300-800 words | Only the relevant project type |

**Typical run loads:** SKILL.md + 1 strategy file + 1 guide = ~4,800 words (not all 11,603).

Excellent layered disclosure. Best-in-class for skill design.

---

## 8. Description & Triggering — 4/5

**Trigger eval set:** 19 queries (9 should-trigger, 10 should-not)

| Trigger Category | Example | Expected |
|-----------------|---------|----------|
| Auto-implement | "auto implement" | Trigger |
| Status check | "how many stories are done?" | Trigger |
| Resume | "continue from where we left off" | Trigger |
| Manual story dev | "help me implement story 2.3" | No trigger |
| Planning phase | "create PRD and architecture" | No trigger |
| Code review | "review code for SOLID principles" | No trigger |

**Risk areas:**
- "create a sprint planning board" shares keywords but should NOT trigger — description handles this well
- "manually implement story" is a good edge case — description's emphasis on "automatic" should prevent false trigger
- The "if unsure, use it" push in the description may cause over-triggering on BMAD-adjacent queries

---

## 9. Scoring Summary

| Dimension | Score | Key Issue |
|-----------|-------|-----------|
| Structure & Token Efficiency | 4/5 | 51 lines over guideline; repeated patterns |
| Completeness | 4/5 | Unknown status handling; status query gap |
| Consistency | 4/5 | Prompt template ✓; retry phrasing varies |
| Clarity | 3.5/5 | Session state tracking undefined; round counting vague |
| Error Handling | 3.5/5 | No timeout; Step 4 missing escalation tier |
| Infinite Loop Prevention | 2.5/5 | **CRITICAL**: No SendMessage timeout; no retry counter mechanism |
| Progressive Disclosure | 5/5 | Excellent layered loading |
| Description/Triggering | 4/5 | Good coverage; may over-trigger |
| **Overall** | **3.8/5** | |

---

## 10. Prioritized Recommendations

### CRITICAL (fix before use)

| # | Issue | Fix |
|---|-------|-----|
| 1 | No sub-agent timeout | Add: "If sub-agent doesn't respond within 2 idle cycles, send a status check. If no response after 2 checks, shut down and respawn." |
| 2 | No retry counter tracking | Add: "Orchestrator MUST count feedback rounds explicitly. Include round number in each feedback message (e.g., 'Round 2/2'). After exhausting limit, escalate or halt." |
| 3 | Epic status loop risk | Add: "After sprint-planning, verify epic status is NOT still `backlog`. If unchanged, halt with error: 'Sprint planning did not advance epic status.'" |

### HIGH (fix soon)

| # | Issue | Fix |
|---|-------|-----|
| 4 | Step 4 missing escalation tier | Add collaborative escalation to Code Review, matching Steps 3 and 4.5 |
| 5 | Unknown story status | Add catch-all: "If story status is unrecognized, report to user and pause." |
| 6 | Status query + missing file | Add bmad-help fallback to Status Query section |
| 7 | Collaboration round definition | Define: "A collaboration round = one message from researcher + one response from worker + one fix attempt." |

### MEDIUM (improve quality)

| # | Issue | Fix |
|---|-------|-----|
| 8 | Move Collaborative Escalation to reference | Extract to `references/collaborative-escalation.md` to reduce SKILL.md to ~490 lines |
| 9 | Standardize retry phrasing | Use "up to N feedback rounds" consistently everywhere |
| 10 | Add guide index to SKILL.md | Table listing all 13 validation guides with project type mapping |
| 11 | Unique sub-agent names | Use `story-developer-{epic}-{story}` to avoid name collision on respawn |

---

## 11. Files in This Evaluation

| File | Purpose |
|------|---------|
| `bmad-auto-workspace/evaluation-report.md` | This report |
| `bmad-auto-workspace/evals/evals.json` | 5 behavioral test cases with assertions |
| `bmad-auto-workspace/trigger-eval.json` | 19 trigger evaluation queries |
