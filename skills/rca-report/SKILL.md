---
name: rca-report
description: Use when documenting a resolved or contained production incident, outage, near-miss, silent pipeline/service failure, data corruption event, or post-mortem — guides evidence collection while the post-fix state is still observable AND produces a rich, reproducible Root Cause Analysis report. Trigger on phrases like "write an RCA", "post-mortem for X", "document this incident", "what went wrong with...", "the pipeline broke yesterday and we fixed it, write it up", or when the user wants help structuring evidence for a write-up of a recently-resolved incident. Also use proactively when the user finishes resolving an incident in-session and the resolution context is fresh — offer to capture it as an RCA before details fade. If the incident is still live and the user needs help finding the cause or fixing it, use ultrathink-protocol instead and come back here once it is contained.
---

# RCA Report

Produce post-mortems that are **reproducible, layered, and operationally useful** — not just narrative. A good RCA lets a future engineer (or future you) understand the incident, verify the fix held, and avoid repeating it. This skill covers both the investigation flow (what to gather while the incident is fresh) and the report itself.

## Output location

First check whether the project already keeps incident write-ups somewhere (e.g. `docs/incidents/`, `docs/postmortems/`, `postmortems/`, `incidents/`, `docs/rca/`) and save there, following any naming convention you find. Otherwise save to the current working directory.

Default filename: `<topic>-rca-<YYYY-MM-DD>.md`, where:
- `<topic>` is a short kebab-case identifier of the failing system (e.g. `cdc-pipeline`, `auth-service`, `kafka-consumer-lag`)
- `<YYYY-MM-DD>` is the **incident date** (when it occurred), not necessarily today

Example: `cdc-pipeline-rca-2026-05-05.md`, `auth-500s-rca-2026-04-12.md`

## The two-phase workflow

### Phase 1 — Investigation (gather evidence)

Before writing anything, walk through `references/investigation-checklist.md` with the user. The goal is to lock in **concrete, reproducible facts** — timestamps, version numbers, exact LSNs/IDs/error strings, command outputs — *while the system state is still observable*. Memory degrades fast; logs rotate; replication slots advance. Capture now, write later.

Do not skip this phase even if the user says "I already fixed it" — fixed-state evidence (for example, in a database CDC incident: the healthy `confirmed_flush_lsn` advancing and a test row flowing through Kafka; in a web-service incident: the 5xx rate back to baseline and a canary request returning 200) is what proves the resolution actually held. That proof is what separates a real RCA from a story.

If the user already has notes/transcripts/scrollback from the live incident, mine those first before asking questions. Don't make them re-type what's already in the conversation.

### Phase 2 — Write the report

Use `templates/rca-report.md` as the structural skeleton. Fill it section by section using the evidence from Phase 1. Then validate against `references/quality-rubric.md` before declaring done.

## What makes an RCA actually good

A strong RCA has all of the following. The examples below come from two sample incidents (a database CDC pipeline and an auth web service) — use whatever the equivalent is in your domain.

1. **A timeline with UTC timestamps for every observable event** — "the connector was wedged for ~18h" is narrative; "2026-05-04 09:54:16 Postgres terminated replication connection" or "2026-04-12 14:03:51 auth-service deploy v2.14.0 reached 100%" is evidence. Always prefer the precise version.

2. **An infrastructure table that fully identifies the system** — versions, hostnames, zones, service/deployment names, and domain identifiers (e.g. connector, topic and slot names for a data pipeline; endpoints, load balancers and feature flags for a web service). Someone reading this six months later should be able to find the exact resources without ambiguity.

3. **Quantified impact across user, system, data, and SLA dimensions** — vague impact ("some customers were affected") is worthless for severity calibration. State user-visible effect, internal system degradation, data integrity status, and SLA / financial cost as concrete numbers. If a number is unknown, say so explicitly rather than skipping the dimension.

4. **Layered root cause analysis** — not just *what* broke, but:
   - The **primary cause** (the trigger event)
   - **Why it appeared healthy** (what masked the failure — this is usually the most valuable part)
   - **Secondary mechanisms** (gates, retries, internal state that contributed)

5. **State snapshots with actual values** — the *contrast* between expected state and observed state is what makes the diagnosis click. Example from a replication incident: `confirmed_flush_lsn = 1/AD5B16C0 (pre-restore stale value)` next to `pg_current_wal_lsn = 1/ADC4B740 (current)` tells the whole story in two lines. Capture similar contrasts for whatever domain you're in (queue depth, error rate, version mismatch, schema drift — e.g. `token cache TTL = 0s (new config)` vs `300s (previous release)`).

6. **Workaround / temporary mitigation captured separately from the resolution** — the fast, low-risk action that stopped the bleeding before the root cause was fully understood. Workarounds and resolutions answer different questions: *workaround* = what does on-call do at 3am next time this fires; *resolution* = what permanently closes the case. Document the workaround's effect, its risks, and the trigger condition for applying it.

7. **Resolution with ordering rationale** — not just "I ran these commands", but *why this order*. If step 4 must come after step 3 because of in-memory state, say so. The next person hitting this will try the obvious order first and fail; document why obvious-order doesn't work.

8. **A Five Whys chain that lands on a systemic gap** — the chain is only useful if it stops at a missing guardrail (alert / review / test / knowledge), not at the technical trigger. Each "why" should narrow on a different mechanism — synonyms across adjacent steps mean you're padding. The final answer should map directly to a Recommendation below it.

9. **A "What did NOT work" section** — capture the dead ends. Future-you will be tempted to try the same thing. The most valuable entries are the most intuitive fixes that silently fail (e.g. "drop the replication slot and recreate the connector without resetting its offset", or "roll back the deploy without flushing the poisoned cache").

10. **Diagnostic commands as a copy-paste block** — the next incident in this domain will reuse 80% of these. Make them runnable, not pseudocode.

11. **Verification evidence** — proof the fix held. Test data flowing end-to-end. Replication lag stabilizing. Error rate returning to baseline. *With actual values from the post-fix state.*

12. **Recommendations binned by urgency** — Immediate (alerting/monitoring), Process (runbooks, comms), Configuration (settings changes). Bins force the user to think about timeline, not just "stuff to do".

## Anti-patterns to avoid

- **Vague timelines**: "The next morning we noticed..." — when? What did "noticed" actually mean? Who saw what?
- **Single-layer root cause**: stopping at the trigger event without explaining the masking mechanism. If the system *appeared* healthy, that masking *is* the root cause for the duration of the outage.
- **Resolution without rationale**: a list of commands with no explanation of why this order or why this approach. That's a runbook, not an RCA.
- **Hand-wavy recommendations**: "improve monitoring" is not actionable. "Alert when `pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) > 100MB` for 5+ minutes" or "Page when the 5xx rate on `/token` exceeds 2% for 5 minutes" is.
- **Skipping the failed approaches**: every dead end you don't document is a trap for the next person.
- **No verification**: closing the report without proof the fix actually worked. This is how RCAs become folklore.

## Workflow

1. **Confirm the incident is resolved or contained.** If still actively firing, defer this skill — fix first (the ultrathink-protocol skill helps find the cause), document after.
2. **Mine existing context first.** Conversation transcripts, scrollback, prior notes — extract everything you can before asking the user questions.
3. **Walk the investigation checklist** (`references/investigation-checklist.md`). Fill gaps by asking targeted questions or running diagnostic commands. Do this even for "small" incidents — the structure forces depth.
4. **Capture state snapshots.** If the system is reachable, grab the current healthy state values now (replication lag, queue depth, error rate, etc.) — these go in the verification section. Lose them and you can't prove the fix.
5. **Draft the report** using `templates/rca-report.md`. Fill every section; if a section truly doesn't apply, write "N/A — [reason]" rather than deleting it.
6. **Validate against the quality rubric** (`references/quality-rubric.md`). Fix any rubric failures before presenting.
7. **Save to `<topic>-rca-<YYYY-MM-DD>.md`** in the project's existing incidents/postmortems folder if there is one, otherwise in CWD (see Output location).
8. **Show the user the file path and offer to walk through any section.** Don't dump the full report into chat unless asked — they'll read the file.

## Tone

Match the operator's voice: technical, concise, evidence-led. Lead each section with the answer, then the reasoning. No corporate hedging ("there may have been some impact") — state what happened. No blame language — focus on system gaps, not individuals. The quality rubric is the bar: if any rubric axis is thin, dig deeper before presenting.
