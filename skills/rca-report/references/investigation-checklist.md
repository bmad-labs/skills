# Investigation Checklist

Walk through this with the user (or fill in from existing conversation context) **before** writing the RCA. Each item maps to a section of the report. Don't ask the user every question — extract what you can from logs, transcripts, and command output first; ask only for what's missing.

## Goal

Lock in concrete, reproducible facts while system state is still observable. The deeper the evidence collected here, the better the RCA.

---

## 0. Triage — is this the right time?

Before anything else:

- [ ] **Is the incident resolved or contained?** If still actively burning, defer the RCA — fix first.
- [ ] **Is the system reachable?** If yes, you can capture *current healthy state* values for the verification section. Lose this window and you can't prove the fix held.
- [ ] **Is there session context to mine?** Conversation transcripts, scrollback, prior chat, PR descriptions — extract what's already there before asking the user to re-type.

---

## 1. Incident framing

Ask if not already known:

- [ ] **One-line title** — what broke, in plain terms (becomes the RCA title)
- [ ] **Severity** — Critical / High / Medium / Low; what was the user-visible impact?
- [ ] **Detection** — how did you find out? (alert, customer report, accidental observation, scheduled check)
- [ ] **Detection delay** — gap between trigger and detection (this often becomes a contributing factor)

## 1b. Impact quantification

Pin down the blast radius across all four dimensions. Vague impact statements are worthless for severity review.

- [ ] **User-visible** — Who was affected and how? Number of users, percent of requests failed, geographic / tenant scope, duration of degradation. If no user impact, say so explicitly.
- [ ] **System** — Which internal services / pipelines / jobs were degraded? Backlog size, queue depth, processing delay, downstream knock-on effects.
- [ ] **Data** — Was anything lost, corrupted, duplicated, or just delayed? At-least-once / exactly-once semantics implications. If verification is pending, log it as a follow-up.
- [ ] **Financial / SLA** — Customer SLA breach? Refund obligations? Estimated revenue impact? Or "internal staging only — no SLA scope".
- [ ] **Active duration** — When did impact start, when did it end, and is that the same as time-to-resolution? Often the workaround stops user-visible impact well before the resolution lands — capture both.

## 2. Timeline evidence

Build the timeline from log lines, metrics, and human actions. Each entry should have a **source**, not just a recollection.

- [ ] **Triggering event** — first abnormal log line / metric / action, with UTC timestamp
- [ ] **System's automatic response** — restarts, retries, failovers (with timestamps from container/orchestrator logs)
- [ ] **Detection moment** — first alert fired / first human noticed / first ticket
- [ ] **Investigation start** — when active debugging began
- [ ] **Root cause confirmed** — the moment the diagnosis clicked (often a specific command output)
- [ ] **Mitigation applied** — exact time the fix command was run
- [ ] **Recovery verified** — when fresh state values confirmed the fix

If timestamps aren't precise (e.g., user says "around 10am"), state that explicitly — `~10:00 UTC` is fine, just don't fake precision.

## 3. Infrastructure inventory

Capture exact identifiers — version strings, hostnames, fully-qualified resource names. Things to gather:

- [ ] **Service versions** — image tags, package versions, commit SHAs (`docker inspect`, `helm get values`, etc.)
- [ ] **Hosts / VMs** — exact hostnames and zones / regions
- [ ] **Database identifiers** — host, port, instance name, database name, schema if relevant
- [ ] **Connection / cluster identifiers** — Kafka cluster, Redis instance, broker addresses
- [ ] **Authentication model** — SASL/IAM/mTLS — *don't capture the secrets themselves*, just the method
- [ ] **Resource names as they appear in tooling** — connector names, slot names, topic names, queue names, job IDs
- [ ] **State storage locations** — where the system persists offsets / state / cursors / leader election

## 4. Failure mode characterization

This is the heart of the diagnosis. Push hard on the *why-it-appeared-healthy* angle.

- [ ] **What was the visible symptom?** (errors, lag, missing data, wrong data, slow response)
- [ ] **What did status / health endpoints report?** (RUNNING? Green? OK? — *this is critical if it disagreed with reality*)
- [ ] **What masked the failure?** (silent retry loops, stale caches, incorrect state inference, gates that never opened)
- [ ] **What was the secondary mechanism?** (gates, leases, in-memory state, cached config that contributed to extension)
- [ ] **State snapshot at failure** — concrete values showing the failure:
  - Expected state (what the system should have shown)
  - Observed state (what it actually showed)
  - Drift / lag / gap value
  - Examples to look for in different domains:
    - **Data pipelines:** offset / LSN / cursor position vs current position
    - **Queues:** depth, oldest message age, consumer lag
    - **Caches:** version, TTL remaining, stale-key indicators
    - **Distributed systems:** leader/follower view divergence, version skew, heartbeat gaps
    - **Storage:** free space, replication lag, checksum mismatches
    - **Auth/sessions:** token expiry, key rotation status, clock skew

## 5a. Workaround / temporary mitigation

Did anyone apply something *before* the root cause was known, to stop the bleeding? This is distinct from the eventual fix and belongs in its own section.

- [ ] **What was applied?** (failover, traffic shift, feature flag toggle, scale change, kill switch, rollback, manual replay) — exact command
- [ ] **What effect did it have?** Measured, not hoped-for. Error rate dropped from X% to Y%. Queue drained at Z msgs/sec.
- [ ] **What did it NOT address?** The root cause — say what's still broken underneath.
- [ ] **What did it cost?** Reduced redundancy, stale data window, increased load elsewhere, capacity reservation. Or "no observable cost".
- [ ] **Does it need to be reverted later?** If yes, what's the trigger condition for revert?
- [ ] **Trigger condition for the next on-call** — under what symptom should they reach for this workaround again? (This is the playbook line for next time.)

If the team went straight to the real fix without a workaround, capture that explicitly — "no workaround applied; root cause was identified within X minutes." That's still useful information; don't just leave the section empty.

## 5b. Resolution evidence

The resolution section needs more than a command list — it needs ordering rationale.

- [ ] **Exact command sequence** that fixed it (preserve order)
- [ ] **Why this order?** Are there dependencies between steps? (e.g., "step N must come after step N-1 because in-memory state would otherwise overwrite the fix")
- [ ] **What state did each step change?** (cleared cache, reset offset, restarted process, dropped slot)
- [ ] **What happens if a step is skipped?** (turns into a "what did NOT work" entry)

## 6. Failed approaches

Capture the dead ends — these prevent repeat investigations.

- [ ] **What did you try first that didn't work?** (often the most "obvious" fix)
- [ ] **Why did it fail?** (state it didn't address, assumption that was wrong)
- [ ] **What did you almost try but reasoned out of?** (with the reasoning — saves the next person from trying it)

For each: capture the *mechanism* of failure, not just "didn't work". "Tombstone to offset topic had no effect" is incomplete; "Debezium 2.x stores offsets in the config topic, not the offset topic — tombstone targeted the wrong topic" is the actual finding.

## 6b. Five Whys chain

Walk the chain *down* from the visible symptom toward a systemic gap. Five is a target, not a rule — sometimes the chain is shorter, sometimes longer.

- [ ] **Why-1** — Why did the visible symptom happen? (direct technical cause)
- [ ] **Why-2** — Why did that direct cause happen? (the mechanism behind it)
- [ ] **Why-3** — Why did that mechanism occur? (the trigger that put the system in that state)
- [ ] **Why-4** — Why was the trigger possible / unguarded? (the missing code or config-level guardrail)
- [ ] **Why-5** — Why was the guardrail missing? (the systemic gap — process, review, alerting, or knowledge)

The final answer should map to a Recommendation. If your chain ends at "we just didn't think of it" with no follow-up action, push another why deeper or restart — you haven't reached the systemic level yet.

Watch for two anti-patterns:
1. **Synonym padding** — adjacent answers that say the same thing in different words. Collapse them.
2. **Stopping at blame** — "the developer made a mistake" is not a systemic gap. The systemic gap is *the absence of the review / lint / test / alert that would have caught the mistake*. Push past the human and onto the missing guardrail.

## 7. Verification

Proof the fix held. Capture *now*, while the system is healthy and observable.

- [ ] **Healthy state values** — current readings of the same metrics that were broken (slot lag, queue depth, error rate, freshness)
- [ ] **End-to-end test** — synthetic data flowing through the system. Insert / publish / send a test record, watch it traverse, confirm arrival.
- [ ] **Autonomous recovery proof** — did the system self-heal after the fix, or does it need ongoing intervention? If autonomous, capture the moment the metric advanced without manual kicking.

## 8. Recommendations input

For the recommendations section, gather:

- [ ] **What metric, if alerted, would have caught this earlier?** (and at what threshold / duration)
- [ ] **What process gap let this turn into an extended incident?** (no runbook, no comms, no review)
- [ ] **What configuration setting would prevent or shorten the next occurrence?** (heartbeat intervals, timeouts, retry policies)
- [ ] **What did you consider changing but decide not to, and why?** (often as valuable as what you did change)

## 9. Ownership & attribution

- [ ] **Who investigated?** (names go at the bottom of the report)
- [ ] **Date of resolution** (becomes the report filename and footer)

---

## Quick prompts to extract evidence

If the user is short on context, these targeted asks usually surface what's needed:

- "Paste the first error log line, with its timestamp."
- "What did `<service> status` show while it was broken?"
- "What did you run that fixed it? In what order?"
- "What did you try first that didn't work?"
- "Run `<diagnostic command>` now and paste the output — that's our 'healthy state' baseline."
- "Was there an alert? If not, what would the alert have looked like?"
