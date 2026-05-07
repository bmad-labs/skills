# Delegation Packet — template + examples

Every handoff message from leader to sub-agent is a Delegation Packet. The slots aren't bureaucracy — they exist to stop the leader from compressing away the context the sub-agent needs.

A fresh sub-agent has no memory of the prior conversation. A persistent agent has stale memory of yesterday's story. Either way, the Delegation Packet is what re-anchors them on the current task.

## Template

```
## Task
<One sentence: what this sub-agent does right now.>

## Why this matters
<The reason — what bug this fixes, what risk it mitigates, what standard it upholds.
This is what lets the agent make good judgment calls on edge cases instead of
following the letter of instructions and missing the spirit.>

## Skill to invoke
<Exact skill name, e.g. "bmad-bmm-dev-story". Always name it. Never write
"figure out which skill to use".>

## Prior findings / report (verbatim)
<If this is a feedback or fix-request: paste the prior report unchanged. No
paraphrase. File paths, line numbers, snippets, and the reviewer's reasoning are
the load-bearing parts — preserve them.>

## Specific actions
<Numbered list. For each: file path + line, what to change, what the end state
should look like. Cross-reference items in the prior findings so the agent can
check off each one.>

## Knowledge sources to consult
<Explicit paths. Pull from {KNOWLEDGE_PATHS} and add ad-hoc relevant ones:
  - Project rules: CLAUDE.md, .cursorrules, docs/conventions.md
  - Architecture & PRD: _bmad-output/planning-artifacts/{specific-file}
  - Story file or tech-spec driving this work
  - References inside this skill (e.g. references/functional-validation.md)
Name sections or line ranges when you know them — "CLAUDE.md §Naming" beats "read CLAUDE.md".>

## Success criteria
<How the agent knows it's done. Concrete: "all 4 issues fixed, `npm test` passes,
no new issues in touched files, lint clean." Round number for retries ("Round 1/2").>

## Report back with
<What the SendMessage to "team-lead" should contain. Usually: items resolved,
verification evidence (tests run, lint output), anything deferred and why.>
```

## Why each slot earns its place

- **Task + Why** are inseparable. Task without Why = literal but wrong fixes.
- **Prior findings verbatim** matters because summarizing loses the file paths and reasoning that made the finding actionable in the first place. Copy-paste beats paraphrase.
- **Knowledge sources** + **Skill to invoke** are the leader's biggest value-add. The leader scanned for these at startup; the sub-agent didn't. Naming them turns a generic developer into one grounded in this project.
- **Success criteria** + **Report back with** close the loop so the next round starts on verifiable state, not hand-waving.

## When to trim

- **First spawn:** *Prior findings* is empty; everything else applies.
- **Approve / shut down:** no packet — just shut down.
- **Simple retry on flaky step:** *Why* and *Prior findings* may collapse to a paragraph; keep *Knowledge sources*, *Success criteria*, *Report back with*.
- **Escalation:** all slots mandatory + round count + what's been tried.

When in doubt, over-include. 30 extra lines of context is trivial compared to a wasted retry round.

## Anti-pattern — never do this

> "Apply fixes for all 4 issues found"

This is the default failure mode. The agent has to guess which 4 issues, re-read the review, re-derive the reasoning, re-discover project conventions. Burns a round. Produces shallow fixes.

---

# Worked Examples

Three filled-in packets covering the most common handoffs. The examples are deliberately specific — real file paths, real reasoning, real skill names — because the point of the template is to surface concreteness the leader already has.

## Example 1 — Reviewer-fixes-issues handoff

Scenario: leader's code review found 2 issues in the auth module. Leader is asking the developer (the same agent that wrote the code) to apply the fixes.

```
## Task
Round 1/2: apply the 2 fixes I identified in code review of story 1-4 (authentication module).

## Why this matters
Issue 1 is a real auth bug — failures are silently swallowed, so users get a generic 500
instead of a 401 and we can't see the failure in logs. Issue 2 is a naming drift that
CLAUDE.md line 15 explicitly prohibits; letting it land makes the convention meaningless.

## Skill to invoke
typescript-clean-code (for the rename + error class shape)
typescript-unit-testing (to cover the new 401 path)

## Prior findings (my review, verbatim)
> Code review found 2 issues:
> 1. src/auth/login.ts:45 — catch block catches Error but logs and continues. Auth failures
>    are silently ignored. Fix: re-throw as AuthenticationError with original error as cause,
>    so the route handler returns 401.
> 2. src/auth/types.ts:12 — `AuthResp` interface name is abbreviated. Project conventions
>    (CLAUDE.md line 15) require full names. Rename to `AuthenticationResponse` and update
>    all 3 import sites: login.ts:3, register.ts:5, middleware.ts:8.

## Specific actions
1. Fix issue 1 at src/auth/login.ts:45 per the recommendation (wrap + re-throw as
   AuthenticationError). Ensure src/auth/routes.ts returns 401.
2. Fix issue 2: rename AuthResp → AuthenticationResponse and update the 3 import sites.

## Knowledge sources to consult
- CLAUDE.md §Naming conventions (line 15 is the rule)
- _bmad-output/planning-artifacts/architecture.md §Error handling
- Story file: _bmad-output/implementation-artifacts/story-1-4.md (the AC you can't break)

## Success criteria
- Both issues fixed in-place.
- Existing story-1-4 tests still pass: `npm test -- auth`.
- New test covers the 401 path (≥1 negative-case assertion).
- Lint/typecheck clean.

## Report back with
- Confirmation each issue is resolved + diff summary.
- Test output (pass/fail counts).
- Anything deferred and why.
```

## Example 2 — Feedback to a story-developer (Round 1/2)

Scenario: developer reported "done" but unit tests for the new error path are missing and the log format doesn't match project conventions.

```
## Task
Round 1/2: finish story 2-3 — you reported done, but two gaps need closing before code review.

## Why this matters
- The retry-backoff feature is in the critical path for Kafka reconnects. A regression there
  means the service stops consuming with no alert. Tests on the new retry code aren't optional.
- The log format mismatch will break our Grafana dashboard (grafana.internal/d/kafka), which
  parses log lines by regex against the project's log schema.

## Skill to invoke
typescript-unit-testing (use fake timers for backoff)

## Prior findings (your last report)
> Implementation complete. 3 unit tests passing. Lint clean. Ready for review.

## Specific actions
1. Add unit tests for the retry path in src/kafka/consumer.ts:82-140:
   - first call succeeds → no retry invoked
   - transient failure → 3 retries with exponential backoff → success
   - permanent failure → exhausts retries, emits RetryExhaustedError
2. Update the log call at src/kafka/consumer.ts:95 to use
   logger.info({ event: 'kafka.retry', attempt, delayMs })
   instead of logger.info(`retry ${attempt}`) — schema is structured JSON only.

## Knowledge sources to consult
- docs/logging.md §Structured log events (the schema the dashboard parses)
- _bmad-output/planning-artifacts/architecture.md §Observability
- Story file: _bmad-output/implementation-artifacts/story-2-3.md §AC3

## Success criteria
- 3 new tests added and passing.
- Log line at 95 matches schema; `grep "logger.info(\`retry" src/kafka/consumer.ts` returns 0 hits.
- Story AC3 (test coverage) honestly checkable.

## Report back with
- Tests added (names + what they cover)
- Confirmation of the log change
- Full test output
```

## Example 3 — Escalation to tech-researcher

Scenario: developer stuck on a dependency-version incompatibility after 2 leader rounds. Leader spawns a researcher and points both agents at common ground.

```
## Task
Collaborate with story-developer (still alive in the team) to unblock story 3-1. Developer
has tried 2 approaches; both fail with the same root cause. Pair directly via SendMessage —
I (team-lead) will not relay.

## Why this matters
Story 3-1 is on the critical path for Epic 3 (payment integration). Blocking here blocks 6
downstream stories. A workaround that compromises security (disabling cert validation, etc.)
is not acceptable.

## Skill to invoke
bmad-bmm-technical-research

## Prior findings (developer's last 2 reports, verbatim)
> Round 1 attempt: upgraded node-fetch to v3 per leader suggestion. Failure: ERR_REQUIRE_ESM —
> codebase is CJS, v3 is ESM-only.
>
> Round 2 attempt: pinned node-fetch at v2.7.0 + @types/node-fetch. Failure: TLS handshake
> rejects the payment provider's cert chain. Provider's intermediate CA isn't in Node 18's
> default bundle.

## Specific actions (for you, the researcher)
1. Read the two failure transcripts in full (paths below).
2. Decide whether the right fix is (a) migrate the file to ESM, (b) switch to undici (CJS-
   compatible, modern TLS), or (c) extend the CA bundle via NODE_EXTRA_CA_CERTS.
3. Message the developer with your recommendation + reasoning. They'll attempt; you verify.

## Knowledge sources to consult
- package.json (module system, current deps)
- _bmad-output/planning-artifacts/architecture.md §External integrations
- Developer's transcripts: _bmad-output/implementation-artifacts/story-3-1-*.log
- Payment provider docs (if known)

## Success criteria
- Story 3-1 passes its AC (successful auth+charge against provider sandbox).
- TLS verification stays on.
- Approach documented in a short comment near the integration point.

## Report back with
- The decision (a/b/c or other) + 2-line rationale
- Verification that the developer's fix works
- Any project-context update worth saving (e.g., "we use undici for external HTTP now")
```
