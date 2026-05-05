# Quality Rubric

Validate the RCA against this rubric **before** declaring it done. If a rubric item fails, fix it — don't ship a half-RCA.

The Debezium RCA (`debezium-rca-2026-05-05.md`) is the reference. If your output is meaningfully thinner than that on any axis, dig deeper.

---

## Hard requirements (must pass)

| # | Requirement | How to check |
|---|---|---|
| 1 | Title is one specific line, not generic | "RCA: Debezium CDC Pipeline Failure After Database Restore" ✅ — "RCA: Production Issue" ❌ |
| 2 | Impact is quantified across all four dimensions | User-visible / System / Data / Financial-SLA — each has a concrete value or an explicit "N/A" with reason. "Some users affected" ❌ — "38% of /token requests for 52 minutes" ✅ |
| 3 | Every timeline entry has a UTC timestamp | Skim the timeline. Any "later that day" / "the next morning" without a time? Fail. |
| 4 | Infrastructure table has *exact* identifiers | Connector name, slot name, topic name, host, port — copyable into commands. No "the prod cluster". |
| 5 | Root cause has all three layers | (a) primary cause, (b) why it appeared healthy, (c) secondary mechanisms. If (b) is missing the RCA is shallow. |
| 6 | State snapshot block shows expected vs observed | Concrete values, not descriptions. `1/AE07FF98` vs `1/ADC4B740`, not "the offset was wrong". |
| 7 | Workaround section is present and complete | If a workaround was applied: command, measured effect, what it did NOT address, risk, revert plan. If no workaround: explicit "N/A — root cause identified in X minutes" rather than a missing section. |
| 8 | Resolution steps have ordering rationale | For each non-trivial step: why this order? What breaks if reordered? If steps could be reshuffled freely it's a runbook, not an RCA. |
| 9 | Five Whys chain ends at a systemic gap | The 5th why (or final why) names a missing guardrail — alert / review / lint / test / process — not a technical trigger and not "human error". This answer should map to a Recommendation. |
| 10 | "What did NOT work" section has at least one entry | If the user *only* tried things that worked, ask harder — there's usually a wrong attempt that taught something. |
| 11 | Verification section has post-fix state values | Real values from the healthy system, not "everything looks fine". |
| 12 | Recommendations are specific and actionable | "Alert on X > Y for Z minutes" ✅ — "improve monitoring" ❌ |
| 13 | No secrets in the document | Passwords, tokens, JAAS configs, private keys. Use placeholders or `${ENV_VAR}` references. |

---

## Depth checks (these separate good from great)

| # | Check | Pattern of failure |
|---|---|---|
| D1 | The "why it appeared healthy" section explains a *mechanism*, not just a symptom | Bad: "the connector reported running but wasn't" — Good: "connector reconnected, read its last offset from the config topic, entered WAL resume position search for an LSN that no longer existed on the restored timeline, and never reached the streaming phase that would have unblocked the flush gate" |
| D2 | Diagnostic commands are runnable as-is | Each command should work with placeholder substitution only. No pseudocode. |
| D3 | "What did NOT work" entries explain *why* they failed, not just that they did | Bad: "tombstone didn't work" — Good: "Debezium 2.x stores task offsets in the config topic, not the offset topic — the tombstone targeted the wrong topic" |
| D4 | Recommendations bin into Immediate / Process / Configuration | Forces the user to think about timeline. A flat list of "stuff to do" is a punt. |
| D5 | Verification proves *autonomous* recovery, where applicable | Did the system self-heal, or does it need ongoing manual intervention? If self-healed, capture the moment the metric advanced on its own. |
| D6 | Time-to-detection and time-to-resolution called out explicitly | "18 hours from trigger to detection" is a finding worth surfacing. |
| D7 | Contributing factors are *gaps*, not the root cause restated | "No DB-change communication process" is a gap. "The database was dropped" is the root cause; don't repeat it as a contributing factor. |
| D8 | Workaround captures effect *and* what it doesn't address | "Restored 99% availability" without "but the JWKS cache mismatch will reoccur on next rotation" is a half-finished workaround entry — the reader doesn't know it's still papering over the cause. |
| D9 | Workaround section ends with a "next time on-call" trigger | The whole point of capturing a workaround is so the next on-call applies it faster. If there's no copy-paste-ready trigger condition, the section underdelivers. |
| D10 | Five Whys answers narrow on different mechanisms | If two adjacent answers are synonyms, the chain isn't doing work. Each step should reveal a layer not visible in the previous one. |
| D11 | Five Whys final answer maps to at least one Recommendation | The final "why" names a systemic gap; that gap should appear as an Immediate / Process / Configuration item. If the chain dead-ends without producing an action, it's decorative. |

---

## Tone & style checks

- **No hedging.** "There may have been some impact" → "No events were delivered for 18 hours."
- **No blame language.** Focus on system gaps, not people. "The developer dropped the database" is fine — that's an event. "The developer should have known better" is not.
- **No corporate filler.** Skip "we are committed to learning from this incident." The doc itself is the evidence of learning.
- **Lead with the answer.** Each section opens with the conclusion, then the supporting evidence — not the journey to the conclusion.
- **Match the operator voice.** Technical, terse, evidence-first. The Debezium RCA is the calibration point.

---

## Common failure modes — and how to fix them

| Failure | Fix |
|---|---|
| Timeline reads like a story ("we noticed... then we tried...") | Convert to event entries with timestamps and sources. Each row = one observable event. |
| Root cause is one paragraph that doesn't separate trigger / masking / mechanism | Split into the three subsections. The "why it appeared healthy" subsection is usually where the real diagnosis lives. |
| State snapshot is described instead of shown | Replace prose with a code block of actual values. Contrast is the whole point. |
| Resolution is just a command list | Add a one-line *why* under each command. If you can't articulate why a step is needed, you may not understand the fix yet. |
| "What did NOT work" is empty | Push back to the user — what was the first thing they tried? It usually wasn't right. If genuinely no failed attempts, write "N/A — root cause was identified on first investigation pass" rather than deleting the section. |
| Recommendations are a wishlist | Each item should be specific enough that someone could file a ticket from it. Add thresholds, exact config keys, exact files to modify. |
| Verification just says "the system is healthy now" | Replace with concrete post-fix values: lag in kB, error rate in %, queue depth as integer, test record id flowing through end-to-end. |

---

## Final pass

Before declaring done, read the report top-to-bottom **as if you'd never seen the incident**. Ask yourself:

1. Could a stranger reproduce the diagnosis from this document alone?
2. Could a stranger reproduce the fix?
3. If the same incident hit in 6 months, would this document save the responder time?

If any answer is "not really" — that section needs more depth.
