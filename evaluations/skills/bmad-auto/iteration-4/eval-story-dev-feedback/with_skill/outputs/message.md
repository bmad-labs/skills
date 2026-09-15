## Task
Round 1/2: close two gaps on story 2-3 (Kafka consumer retry-backoff) before it advances to code review. You reported "ready for review," but AC3 test coverage and the project log schema aren't met yet.

## Why this matters
- **AC3 — retry-path test coverage:** The retry-backoff logic in `src/kafka/consumer.ts:82-140` is on the critical path for Kafka reconnects. If it regresses, the service stops consuming with no alert. AC3 explicitly requires tests for the retry path, not just the happy path. The 3 tests you have only exercise the success case — the transient-failure and permanent-failure branches are untested, so AC3 cannot be honestly checked off and a reviewer cannot verify the feature works under the conditions it was built for.
- **Structured logging contract:** The new log at `src/kafka/consumer.ts:95` emits an interpolated string (`logger.info(\`retry ${attempt}\`)`). Our Grafana dashboard at `grafana.internal/d/kafka` parses Kafka events by regex against the structured-JSON schema defined in `docs/logging.md` §Structured log events. An unstructured string won't match — the dashboard's retry panel will silently go blank, and on-call loses visibility into retry behavior exactly when it matters most (incidents). `_bmad-output/planning-artifacts/architecture.md` §Observability calls this out as a cross-cutting requirement for all new log events.

## Prior findings / report (verbatim)
> Report: Implementation complete. 3 unit tests passing. Lint clean. Ready for review.

Annotation: the 3 passing tests cover only the happy path. On re-reading the story file and diff, two gaps surfaced that block review — detailed below.

## Specific actions requested
1. **Add retry-path unit tests** for `src/kafka/consumer.ts:82-140` (closes AC3). At minimum:
   - Case A — happy path stays green: first call succeeds → retry is never invoked. (You likely already have this; keep it.)
   - Case B — transient failure: first N-1 attempts throw a retryable error, Nth succeeds → assert exponential backoff delays were applied (use fake timers), assert final result is the success value, assert exactly N attempts were made.
   - Case C — permanent failure: all attempts throw a retryable error → assert retries are exhausted, `RetryExhaustedError` (or the equivalent error type used in the implementation) is emitted, and the original error is preserved as `cause`.
   - Use fake timers (`jest.useFakeTimers()` or equivalent) so the backoff delays don't make the suite slow or flaky.
2. **Fix the log call** at `src/kafka/consumer.ts:95`. Replace:
   ```ts
   logger.info(`retry ${attempt}`)
   ```
   with the structured form required by the schema:
   ```ts
   logger.info({ event: 'kafka.retry', attempt, delayMs })
   ```
   Use the actual `delayMs` value the backoff calculator produced for this attempt (don't hardcode). Confirm no other call sites in `consumer.ts` use the interpolated-string pattern — grep the file and convert any stragglers so this doesn't recur.

## Knowledge sources to consult
- `docs/logging.md` §Structured log events — the exact schema the Grafana dashboard parses. Match field names (`event`, `attempt`, `delayMs`) verbatim; the regex is strict.
- `_bmad-output/planning-artifacts/architecture.md` §Observability — explains the contract between log events and dashboards, and why structured JSON is mandatory project-wide.
- `_bmad-output/implementation-artifacts/story-2-3.md` §AC3 — the acceptance criterion you're closing out. Re-read it before writing tests so the test names map back to the AC language.
- `CLAUDE.md` — general project conventions (naming, test layout) to follow while adding the new tests.

## Relevant skills
- `typescript-unit-testing` — invoke this for the retry-path tests. Use its guidance on fake timers, error-path assertions, and mock setup for the Kafka client. Tests should live alongside the existing consumer tests and follow the project's describe/it naming.
- `typescript-clean-code` — invoke for the log-call change and any small refactors around it (e.g., extracting a `delayMs` local if it's currently inlined). Keep the change minimal and focused; don't rewrite surrounding code.

## Success criteria
- Three new/updated tests covering happy path, transient failure, and permanent failure, all passing. Test names reference the retry behavior clearly (e.g., `it('retries with exponential backoff on transient failure')`).
- `grep -n "logger.info(\`retry" src/kafka/consumer.ts` returns 0 matches. The replacement log line uses the exact field names from `docs/logging.md` §Structured log events.
- Full test suite passes (run the project's standard command, e.g. `npm test` — include the output).
- Lint and typecheck remain clean.
- Story 2-3 AC3 can now be checked off honestly with a pointer to the new tests.
- No behavior change to the retry logic itself — this round is tests + log format only, not a rewrite.

## Report back with
- Names of the tests added (or updated) and a one-line description of what each asserts.
- The exact new log line as it appears in `src/kafka/consumer.ts:95`.
- Full test-run output (pass/fail counts, and the names of the 3 new tests in the output).
- Lint/typecheck output (or confirmation both are clean).
- Anything you chose not to change and why (e.g., if you found additional log calls but scoped them out — flag them so I can decide).
