# RCA: [One-line incident title — what broke, in plain terms]

**Date:** YYYY-MM-DD
**Severity:** [Critical / High / Medium / Low] — [one-line impact summary]
**Status:** [Resolved / Mitigated / Monitoring / Open]
**Environment:** [path through the stack — e.g., `service-a` → `kafka-cluster-x` → `postgres-prod`]

---

## 1. Summary

[2–4 sentences. Lead with what broke and the user-visible effect. Then the trigger. Then the resolution in one phrase. A reader skimming should grasp the whole incident from this paragraph alone. No jargon without context.]

Example pattern: *"After [trigger event] on [date], [system] [failure mode]. [Symptom that masked the failure]. [Brief mention of detection and resolution]."*

---

## 2. Impact

Quantify the blast radius. Vague impact ("some customers were affected") is worthless for severity calibration and post-incident review. Use concrete numbers wherever possible; if a number is unknown, say so explicitly rather than skipping the dimension.

| Dimension | Impact |
|---|---|
| **User-visible** | [Who was affected and how. E.g., "~38% of `/token` requests failed for 52 minutes — every consumer service that hit auth during that window saw 500s on token issuance." If no user impact, state that.] |
| **System** | [What internal services / pipelines / jobs were degraded. E.g., "`order-processor` consumer group fell 2.3M messages behind on `orders-events`; downstream order-fulfilment delayed for the duration of the backlog."] |
| **Data** | [Was data lost, corrupted, duplicated, or just delayed? Be precise. E.g., "No data loss — at-least-once Kafka semantics replayed the backlog cleanly. ~14 messages duplicated across rebalance boundaries." If you don't know yet, say "Data integrity verification pending — see Recommendations."] |
| **Financial / SLA** | [Customer-facing SLA breach? Refund obligations? Lost revenue estimate? Or "N/A — internal staging only".] |
| **Duration** | [Time the impact was active, with start and end timestamps. Distinguish from time-to-detection and time-to-resolution if they differ.] |

---

## 3. Timeline

All times in UTC. Every row is an **observable event** with a source (log line, metric, alert, human action) — not a narrative beat.

| Time (UTC) | Event |
|---|---|
| YYYY-MM-DD HH:MM:SS | [Triggering event — the first thing that went wrong, with the log/metric source] |
| YYYY-MM-DD HH:MM:SS | [System response — what the system did automatically: retry, restart, failover] |
| YYYY-MM-DD HH:MM:SS | [Detection — how/when the failure was noticed; include the gap from trigger to detection] |
| YYYY-MM-DD HH:MM:SS | Investigation started |
| YYYY-MM-DD HH:MM:SS | Workaround applied (if any) — [one-line summary] |
| YYYY-MM-DD HH:MM:SS | Root cause confirmed — [one-line summary] |
| YYYY-MM-DD HH:MM:SS | Mitigation / fix applied |
| YYYY-MM-DD HH:MM:SS | Recovery verified — [evidence summary, e.g., "first successful event flushed"] |

**Time to detection:** [trigger → detection]
**Time to mitigation:** [trigger → workaround applied, if applicable]
**Time to resolution:** [trigger → recovery verified]

---

## 4. Infrastructure

The exact resources involved. Anyone investigating a recurrence should be able to find these without guesswork.

| Component | Details |
|---|---|
| [Service / Process] | [version, image tag, host, zone] |
| [Database] | [version, host:port, instance name, data location] |
| [Message bus / Queue] | [cluster, broker addresses, auth model] |
| [Connector / Job / Worker name] | [identifier as it appears in tooling] |
| [Topic / Queue / Slot names] | [exact strings used in config] |
| [Storage location] | [topic / table / bucket where state is persisted] |

---

## 5. Root Cause

### Primary cause
[The trigger — what action or condition initiated the failure. Be specific: not "the database was unavailable" but "the developer dropped and restored the database, rolling back the WAL timeline to an earlier LSN".]

### Why it appeared healthy
[**This is usually the most valuable section.** What masked the failure? Why didn't the existing health checks / status / alerts catch it? In the Debezium incident this was: connector reconnected, reported `RUNNING`, but its stored offset pointed to a no-longer-existing WAL position so it silently scanned forever. Explain the mechanism precisely.]

### Secondary mechanisms
[Internal gates, retries, caches, or state that contributed. Example: "Debezium's flush gate only opens after the first event streams in a session — so the offset commit warnings were emitted forever because the streaming phase was never reached." If there's no secondary mechanism, write "N/A".]

### State at time of investigation

```
[Captured concrete state values that demonstrate the failure — the contrast
 between expected and observed is what makes the diagnosis legible.]

Expected state    : [value]
Observed state    : [value]   ← [why this is wrong]
Drift / lag / gap : [value]
```

---

## 6. Contributing Factors

Numbered list of conditions that turned a recoverable event into an extended incident. These are *not* the root cause — they're the gaps that let the root cause hurt.

1. **[Process gap]** — [e.g., no DB-change communication / no runbook step for CDC pipeline]
2. **[Silent failure mode]** — [the system reported healthy when it wasn't; describe how]
3. **[Documentation / knowledge gap]** — [behaviour that's underdocumented or counterintuitive]
4. **[Missing alerting]** — [the metric that would have caught this earlier; how long the gap was]

---

## 7. Workaround (Temporary Mitigation)

The fast, low-risk action a developer or on-call can apply *before* the root cause is fully understood — to stop the bleeding while the real fix is investigated. Distinct from the resolution: a workaround buys time, the resolution closes the case.

If no workaround was applied (the team went straight to the real fix), write "N/A — root cause was identified quickly enough that no temporary mitigation was needed" rather than deleting this section.

### Workaround applied
```bash
[exact command or change — failover, traffic shift, feature flag, scale change, kill switch, etc.]
```

**Effect:** [What it bought you. E.g., "reduced error rate from 38% to <2% by routing /token to the previous deployment's pods" or "drained queue lag by manually compacting the topic". Even if temporary, state the *measured* effect — not the hoped-for one.]

**Why this is a workaround, not a fix:** [What it does NOT address. E.g., "this papers over the symptom; the underlying JWKS cache mismatch will reoccur on the next rotation." Explicit scope-of-the-band-aid.]

**Risk and side effects:** [What the workaround costs. Reduced redundancy? Stale data? Increased load elsewhere? Customer-visible degradation? If none, write "None observed."]

**Time to revert:** [Whether the workaround needs to be rolled back after the real fix lands, and how. E.g., "revert traffic split once new pods are healthy; tracked in [ticket]."]

### Quick playbook for next time

If this *exact* failure mode recurs, the on-call's first move should be:

```bash
[the workaround command, ready to copy-paste]
```

[One-line trigger condition: "Apply this if /token error rate > 10% within 5 min of a JWKS rotation."]

---

## 8. Resolution

The actual fix, with **ordering rationale**. Each step explains *why this order* and *why this approach* — not just what command to run.

### Step 1 — [Action]
```bash
[exact command]
```
[Why this is needed and why it must come first. What happens if you skip it.]

### Step 2 — [Action]
```bash
[exact command]
```
[Why now and not earlier. What state this changes.]

### Step 3 — [Action]
[Repeat as needed. If a step has a precondition or interacts oddly with an earlier step, call it out explicitly. Example from Debezium RCA: "This must happen *after* the offset reset — restarting the container without resetting the offset first leaves the stale value in the config topic."]

### Final state after resolution

```
[Concrete state values proving the fix held — mirror the structure
 of the "State at time of investigation" block above.]

Healthy state  : [value]    (advancing / steady / within SLO)
Lag / drift    : [value]    (within normal range)
Service state  : [RUNNING / OK / Green]
```

**End-to-end verification:** [What test confirmed the system actually works, not just *appears* to work. E.g., "test row inserted, flowed to Kafka within 60s, confirmed_flush_lsn advanced autonomously."]

---

## 9. Recovery Script / Runbook

If a reusable script or runbook was created (or should be), document it here. Otherwise: "N/A — incident was one-off; no runbook produced."

**Location:** [path]
**Sources config from:** [`.env` file / secret manager / config repo — no hardcoded values]

**Steps:**

| Step | Action | Notes |
|---|---|---|
| 0 | [Backup / snapshot] | Always runs |
| 1 | [Action] | [precondition] |
| ... | ... | ... |
| N | [Verification step] | Inserts test data, confirms capture, cleans up |

**To run:**
```bash
[exact invocation command]
```

---

## 10. Diagnostic Commands

Copy-pasteable commands used during investigation. Keep them runnable — these will be reused in the next incident.

```bash
# Check service status
[command]

# Check stored state / offset / position (key indicator of THIS failure mode)
[command]

# Check downstream lag / queue depth / replication position
[command with placeholders for credentials, NOT actual secrets]

# Tail logs with relevant filters
[command]
```

**Signs of this specific failure:**
- [Distinctive log line that appears repeatedly when this failure mode is active]
- [Metric pattern — e.g., "X frozen across multiple checks while Y advances"]
- [Status that *looks* healthy but masks the issue]

---

## 11. Five Whys

A short causal chain from the visible symptom down to the systemic cause. Stop when you reach a "why" whose answer is a *system gap* (missing alert, missing review, missing test, missing knowledge) — that gap is what should drive the recommendations below.

Each "why" should narrow on a specific mechanism, not a synonym. If two adjacent answers say the same thing in different words, you're padding — collapse them.

1. **Why did [user-visible symptom] happen?**
   [Direct technical cause — what the system did.]
2. **Why did [direct cause] happen?**
   [The mechanism behind it — what state or input produced the cause.]
3. **Why did [the mechanism] occur?**
   [The trigger that put the system in that state.]
4. **Why was [the trigger] possible / unguarded?**
   [The missing guardrail — code-level or config-level gap.]
5. **Why was [the guardrail] missing?**
   [The systemic gap — process, review, alerting, or knowledge gap. **This answer should map directly to a Recommendation below.**]

---

## 12. Recommendations

### Immediate (alerting & detection)
- [ ] [Specific alert with threshold and duration. E.g., "Alert when `pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) > 100MB` for 5+ minutes."]
- [ ] [Synthetic check — e.g., "If service state is RUNNING but no events produced in 10+ minutes during business hours, page on-call."]

### Process
- [ ] [Runbook addition — what step needs to be added to which existing procedure]
- [ ] [Communication change — e.g., "DB maintenance windows must be announced 24h ahead"]

### Configuration
- [ ] [Specific config setting with value and rationale. E.g., "Add `heartbeat.interval.ms=10000` to connector config — emits WAL heartbeat so flush gate opens promptly after restart."]
- [ ] [Setting to *not* change — capture decisions you considered and rejected, with rationale]

---

## 13. What Did NOT Work (and Why)

The dead ends. Future-you will be tempted to try these. Save them the time.

| Approach | Why It Failed |
|---|---|
| [Intuitive fix #1] | [Mechanism — what state it didn't address, what assumption was wrong] |
| [Intuitive fix #2] | [Why this is the *most tempting* wrong answer — frequently the second-best diagnosis] |
| [Workaround attempt] | [Why waiting / retrying / restarting wasn't sufficient] |

---

*Investigated and resolved by [name(s)] on YYYY-MM-DD.*
