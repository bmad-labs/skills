Round 1/2: Story 2-3 is not ready for code review yet. Thanks for the fast implementation, but a re-read of the story file (`_bmad-output/implementation-artifacts/story-2-3.md`) against the current diff surfaced two concrete gaps that must be closed before we hand off to the reviewer. Please address both, re-run the suite, and report back.

## Context
- You reported: "Implementation complete. 3 unit tests passing. Lint clean. Ready for review."
- I compared the diff in `src/kafka/consumer.ts` against story 2-3's acceptance criteria and against the project's observability standard in `docs/logging.md` + `_bmad-output/planning-artifacts/architecture.md` (§Observability).
- Two items in the story/standards are not yet satisfied. Both are blocking for code review — the first is an AC miss (AC3), the second will silently break the Grafana Kafka dashboard in production.

## Issue 1 — AC3 unit test coverage is incomplete (retry path untested)

**Where:** `src/kafka/consumer.ts:82-140` (the retry-backoff block you added) and the corresponding spec file under `test/` (or `__tests__/`, whichever the story test strategy points to — match the existing convention for this consumer).

**What's wrong:** Story 2-3 AC3 explicitly requires unit tests for the retry path at `src/kafka/consumer.ts:82-140`. The 3 tests you added only exercise the happy path (message consumed successfully on first attempt). The retry branch — the whole point of this story — has zero coverage. "3 tests passing, lint clean" does not satisfy AC3; AC3 is about what is tested, not how many tests pass.

**Why it matters:**
- AC3 is a gating acceptance criterion — the story cannot be marked `review` with it unmet; code review will bounce it straight back.
- Retry/backoff logic is exactly the kind of code that breaks silently in production (wrong delay, off-by-one on attempt count, swallowed permanent errors). Without tests pinning the behavior, any future refactor will regress it and we won't notice.
- The happy path doesn't execute lines 82-140 at all, so current coverage of the new code is effectively 0% on the branch that matters.

**What to do:** Add at minimum these three unit tests for the consumer's retry path. Use the `typescript-unit-testing` skill for patterns (mocking, fake timers for backoff delays, assertion style) — invoke it before writing the tests so your mocks and timer handling match project conventions.

1. **Transient failure then success** — the downstream handler throws a transient/retryable error on attempts 1 and 2, succeeds on attempt 3. Assert: handler was called exactly 3 times; the backoff delay between attempts matches the configured schedule (use fake timers, don't `await` real delays); the message is acked/committed exactly once at the end; no error is surfaced to the caller.
2. **Permanent failure exhausts retries** — the handler throws a non-retryable/permanent error (or throws on every attempt up to the max). Assert: handler is called exactly `maxAttempts` times (match the constant in `consumer.ts`); the message is routed to the dead-letter path / surfaced as failure per the story's defined behavior; no ack/commit happens; the final error is propagated (or logged) as the code specifies.
3. **Backoff schedule** — assert the actual delay sequence between attempts matches the intended backoff (e.g., exponential or whatever `consumer.ts:82-140` implements). Use jest fake timers and `jest.advanceTimersByTime` so the test is deterministic and fast. This is what pins the behavior against future regressions.

If the retry logic has additional branches I haven't listed (e.g., jitter, max-delay cap, per-error-type classification), add a test per branch. Aim for full branch coverage on lines 82-140, not just line coverage.

## Issue 2 — New log line violates the project structured-logging standard

**Where:** `src/kafka/consumer.ts:95`

**Current code:**
```ts
logger.info(`retry ${attempt}`)
```

**What's wrong:** `docs/logging.md` §"Structured log events" (and `_bmad-output/planning-artifacts/architecture.md` §Observability, which defers to it) requires all log events to be emitted as structured JSON with an `event` key and typed fields — not interpolated strings. The Grafana dashboard at `grafana.internal/d/kafka` parses Kafka events via regex against that documented schema (specifically, it keys off `event: 'kafka.retry'` and reads `attempt` + `delayMs` as numeric fields for the retry-rate and backoff-distribution panels).

**Why it matters:**
- A string-interpolated log like `"retry 2"` does not match the dashboard's regex. The retry panel will go blank for this consumer the moment this ships — silent observability regression, no alert will fire.
- It also breaks the project convention (`CLAUDE.md` / `docs/logging.md`): every new log must be structured. Code review will flag this; better to fix it now.
- Unstructured logs can't be filtered/aggregated in the log backend, so on-call can't answer "how often is consumer X retrying?" during an incident.

**What to do:** Replace line 95 with the structured form the standard requires:
```ts
logger.info({ event: 'kafka.retry', attempt, delayMs })
```

Concretely:
- Use `event: 'kafka.retry'` exactly — this is the string the Grafana regex matches against. Do not rename it.
- Include `attempt` (the current attempt number, 1-indexed or 0-indexed — match whatever the rest of the retry block uses; be consistent) and `delayMs` (the backoff delay about to be waited, as a number in milliseconds, not a string like `"250ms"`).
- If the logger in this file is already scoped (e.g., child logger with `component: 'kafka-consumer'`), you don't need to re-add that field — just the three fields above.
- Scan the rest of your diff in `consumer.ts` for any other new `logger.*` calls using template strings and convert them too, same pattern. One unstructured log is enough to break the dashboard; don't leave siblings behind.
- Then open `docs/logging.md` §Structured log events and double-check the exact field naming conventions (camelCase vs snake_case, required vs optional fields) so your event matches the schema.

## After you fix both

1. Re-run the full unit test suite for this module — all existing 3 tests plus the new retry tests must pass.
2. Re-run lint.
3. Reply here with: (a) the new test file path and the names of the tests you added, (b) the final code of line 95 (paste it), (c) confirmation that lint + tests are green, (d) any deviations from the above and why.

Do NOT mark the story `review` or commit anything — I'll take it to code review once both gaps are closed. You have 2 feedback rounds total; this is Round 1/2. If anything above is ambiguous or you believe one of these is already satisfied, push back with specifics (file path + line + snippet) rather than guessing.
