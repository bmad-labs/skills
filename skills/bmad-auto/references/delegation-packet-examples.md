# Delegation Packet Examples

Worked examples of the Delegation Packet template (defined in `SKILL.md` → Delegation Packet
section). Read these when you're about to compose a feedback, fix-request, or escalation message
and want to see the shape in context.

The examples below are deliberately specific — real file paths, real reasoning, real skill
invocations — because the point of the template is to surface concreteness the orchestrator
already has but would otherwise compress away.

---

## Example 1 — Reviewer-fixes-issues handoff (after code review)

Scenario: code-reviewer reported 2 issues in the authentication module. The orchestrator is
now asking the reviewer to apply the fixes directly.

```
## Task
Round 1/2: apply the 2 fixes you identified in your review of story 1-4 (authentication module).

## Why this matters
Issue 1 is a real auth bug — failures are silently swallowed, so users get a generic 500
instead of a 401 and we can't see the failure in logs. Issue 2 is a naming drift that
`CLAUDE.md` line 15 explicitly prohibits; letting it land makes the convention meaningless.

## Prior findings (your own report, verbatim)
> Code review found 2 issues in the authentication module:
> 1. `src/auth/login.ts:45` — catch block catches `Error` but logs and continues. Auth
>    failures are silently ignored. Fix: re-throw as `AuthenticationError` with original
>    error as cause, so the route handler returns 401.
> 2. `src/auth/types.ts:12` — `AuthResp` interface name is abbreviated. Project
>    conventions (per `CLAUDE.md` line 15) require full names. Rename to
>    `AuthenticationResponse` and update all 3 import sites: `login.ts:3`, `register.ts:5`,
>    `middleware.ts:8`.

## Specific actions
1. Fix issue 1 at `src/auth/login.ts:45` per your own recommendation (wrap + re-throw
   as `AuthenticationError`). Ensure route handler at `src/auth/routes.ts` returns 401.
2. Fix issue 2: rename `AuthResp` → `AuthenticationResponse` and update the 3 import
   sites you listed.

## Knowledge sources to consult
- `CLAUDE.md` §Naming conventions (line 15 is the rule you cited)
- `_bmad-output/planning-artifacts/architecture.md` §Error handling
- Story file: `_bmad-output/implementation-artifacts/story-1-4.md` (the AC you're not
  allowed to break)

## Relevant skills
- `typescript-clean-code` — for the rename + error class design
- `typescript-unit-testing` — to cover the new `AuthenticationError` path

## Success criteria
- Both issues fixed in-place.
- Story 1-4's existing tests still pass: `npm test -- auth`.
- A new test covers the 401 path (at least one negative-case assertion).
- Lint/typecheck clean.

## Report back with
- Confirmation each issue is resolved, with the diff summary.
- Test output (pass/fail counts).
- Any deferred items and why.
```

---

## Example 2 — Feedback to a story-developer (Round 1/2)

Scenario: story-developer reported "done" but the orchestrator noticed unit tests for the new
error path are missing, and the log format doesn't match project conventions.

```
## Task
Round 1/2: finish story 2-3 — you reported done but two gaps need closing before code review.

## Why this matters
- The `retry-backoff` feature is in the critical path for Kafka reconnects; a regression
  there means the service stops consuming with no alert. Tests on the new retry code aren't
  optional for this story.
- The log format mismatch will break our Grafana dashboard (`grafana.internal/d/kafka`),
  which parses log lines by regex against the project's log schema.

## Prior findings (from your last report)
> Implementation complete. 3 unit tests passing. Lint clean. Ready for review.

## Specific actions
1. Add unit tests for the retry path in `src/kafka/consumer.ts:82-140`:
   - Case: first call succeeds → no retry invoked
   - Case: transient failure → 3 retries with exponential backoff → success
   - Case: permanent failure → exhausts retries, emits `RetryExhaustedError`
2. Update the log call at `src/kafka/consumer.ts:95` to use
   `logger.info({ event: 'kafka.retry', attempt, delayMs })` instead of
   `logger.info(\`retry ${attempt}\`)` — project log schema is structured JSON only.

## Knowledge sources to consult
- `docs/logging.md` §Structured log events (the schema the dashboard parses)
- `_bmad-output/planning-artifacts/architecture.md` §Observability
- Story file: `_bmad-output/implementation-artifacts/story-2-3.md` §AC3 (test coverage
  expectation is explicit there)

## Relevant skills
- `typescript-unit-testing` — for the retry-path tests (use fake timers for backoff)

## Success criteria
- 3 new tests added and passing.
- Log line at line 95 matches schema; grep `logger.info(\`retry` returns 0 hits in the file.
- Story AC3 (test coverage) can be checked off honestly.

## Report back with
- Which tests were added (names + what they cover)
- Confirmation of the log change
- Full test output
```

---

## Example 3 — Escalation to tech-researcher

Scenario: story-developer got stuck on a dependency-version incompatibility after 2 rounds of
orchestrator feedback. Orchestrator is spawning a researcher and pointing both agents at
common ground.

```
## Task
Collaborate with `story-developer` (still alive in the team) to unblock story 3-1. The
developer has tried 2 approaches; both fail with the same root cause (see below). Pair with
them directly via SendMessage — I (team-lead) won't relay.

## Why this matters
Story 3-1 is on the critical path for Epic 3 (payment integration). Blocking here blocks 6
downstream stories. A workaround that compromises security (disabling cert validation, etc.)
is not acceptable — this must be a correct fix.

## Prior findings (developer's last 2 reports, verbatim)
> Round 1 attempt: upgraded `node-fetch` to v3 per suggestion. Failure:
> `ERR_REQUIRE_ESM` — our codebase is CJS and v3 is ESM-only.
>
> Round 2 attempt: pinned `node-fetch` at v2.7.0 and added `@types/node-fetch`. Failure:
> TLS handshake rejects the payment provider's cert chain. The provider's intermediate CA
> isn't in Node 18's default bundle.

## Specific actions (for you, the researcher)
1. Read the two failure transcripts in full (paths below).
2. Decide whether the right fix is (a) migrate the file to ESM, (b) switch to `undici`
   (CJS-compatible, modern TLS), or (c) extend the CA bundle via `NODE_EXTRA_CA_CERTS`.
3. Message the developer directly with your recommendation + reasoning. They'll attempt
   the fix; you verify.

## Knowledge sources to consult
- `package.json` — module system, current deps
- `_bmad-output/planning-artifacts/architecture.md` §External integrations
- Developer's transcripts: `_bmad-output/implementation-artifacts/story-3-1-*.log`
- Payment provider docs: <if known, link here>

## Relevant skills
- `claude-api` or similar if provider has an SDK you should check first
- `typescript-clean-code` for the resulting code shape

## Success criteria
- Story 3-1 passes its AC (successful auth+charge against provider sandbox).
- No security compromises (TLS verification stays on).
- Approach documented in a short comment near the integration point so reviewers understand
  why this specific dependency/config was chosen.

## Report back with
- The decision (a/b/c or other) + 2-line rationale
- Verification that the developer's fix works
- Any project-context update worth saving (e.g., "we use undici for external HTTP now")
```

---

## When to trim

The template has 8 slots. In practice:

- **First spawn of a sub-agent:** *Prior findings verbatim* is empty; everything else applies.
- **Accept/approve hand-off (no rework):** no Delegation Packet needed — just shut down.
- **Simple retry on a flaky step:** *Why this matters* and *Prior findings* may collapse to a
  single paragraph; keep *Knowledge sources*, *Success criteria*, and *Report back with*.
- **Escalation:** all slots mandatory, plus the round count and what's already been tried.

When in doubt, over-include. The cost of an extra 30 lines of context is trivial compared to a
wasted retry round or a shallow fix that has to be re-reviewed.
