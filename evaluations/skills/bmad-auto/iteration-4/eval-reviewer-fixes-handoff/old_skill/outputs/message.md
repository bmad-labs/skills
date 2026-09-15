Round 1/2: Reviewer-Fixes-Issues — please apply the fixes for the 4 issues you identified on story 9-14 directly to the codebase.

## Context
- Story: `_bmad-output/implementation-artifacts/story-9-14.md` (Kafka producer options mapping).
- Tech spec: `_bmad-output/implementation-artifacts/tech-spec-kafka-options.md`.
- Project knowledge sources (read and follow these — they govern the fixes):
  - `CLAUDE.md` §Testing (assertion-quality rules — covers issue #1) and §Naming.
  - `docs/kafka-conventions.md` (librdkafka key-naming rules — covers issue #2).
- Relevant skills available to you for the fixes: `typescript-clean-code`, `typescript-unit-testing`, `bmad-bmm-code-review`.
- All ACs currently pass, lint/typecheck are green, 15 tests pass. Do NOT regress that baseline.
- You identified these problems, so you have the best context to fix them correctly — apply the fixes directly, do not hand back to the developer.
- Do NOT make any git commits. I handle all git. When done, SendMessage to `team-lead` with a summary of each fix and the test results, then wait for shutdown_request.

## Issues to fix

### Issue 1 — Weak assertions in UT-001 / UT-002 / UT-003
**Acknowledged finding:** Tests only assert that `connect()` was called; they do not verify the config object contents that `mapProducerOptions` produced. This makes them redundant with UT-004/UT-005 and means a regression in the mapping logic would not fail these tests.

**Why it matters:** Per `CLAUDE.md` §Testing, assertions must verify behavior, not just interaction. An assertion that only checks "a method was called" gives false confidence — the mapping could produce wrong values and these tests would still pass.

**Fix:**
- For UT-001, UT-002, UT-003: change the assertion so it captures the config argument passed to the producer constructor/`connect()` and asserts on the mapped fields specifically relevant to each test's scenario (the one input-shape that test exercises).
- Each of the three tests should assert on a *different* mapped field or combination, so they stop being redundant with each other and with UT-004/UT-005. If after rewriting two of them still overlap with UT-004/UT-005, delete the duplicates rather than keep dead tests.
- Use `expect.objectContaining({...})` against the captured config (e.g., via `jest.fn()` mock capturing the first call's args, or `@golevelup/ts-jest` `createMock` + `.mock.calls[0][0]`) — do NOT just assert `connect` was called.
- Consult the `typescript-unit-testing` skill's assertion-quality guidance before rewriting.

### Issue 2 — Key-alias conflict risk between `mapProducerOptions` and `mapSendOptions`
**Acknowledged finding:** `mapProducerOptions` writes the key `acks`, while `mapSendOptions` writes `request.required.acks`. librdkafka treats these as aliases of the same setting; if both are set on the same client/send path, librdkafka's behavior is order-dependent and can warn or fail.

**Why it matters:** Per `docs/kafka-conventions.md`, the project's rule is to use one canonical key per librdkafka setting. Letting two functions each own a different alias of the same setting is a latent bug — it only manifests when a caller sets both, which is exactly what consumers of this API will eventually do.

**Fix:**
- Pick one canonical key for the acks setting (follow whichever form `docs/kafka-conventions.md` specifies as canonical; if both are listed, prefer the one already used in the rest of the codebase — search for existing usages to confirm).
- Update `mapProducerOptions` and `mapSendOptions` so only one of them writes this setting, OR so both write the same canonical key (last-writer-wins becomes deterministic instead of alias-conflict).
- Add a unit test that sets acks via both producer options and send options simultaneously and asserts the resulting effective config has exactly one acks-equivalent key with the expected value.
- Add an inline comment above the chosen key referencing `docs/kafka-conventions.md` so future contributors don't reintroduce the alias.

### Issue 3 — `mapSendOptions` is publicly exported with no justified advanced-user case
**Acknowledged finding:** `mapSendOptions` is exported from the module but there is no documented advanced-user scenario requiring external access. Per clean-code principles (and the `typescript-clean-code` skill), internal helpers should stay internal to minimize API surface.

**Why it matters:** Every public export is a commitment. Exporting `mapSendOptions` makes its signature part of the package's semver contract, constrains refactoring, and invites misuse. AC4 does not require it to be public.

**Fix:**
- Remove `mapSendOptions` from the module's public exports (drop it from `export { ... }` / `export function`, keep it as a non-exported `function mapSendOptions(...)` or `const`).
- Check the package's `index.ts` / barrel file and remove the re-export there too if present.
- Run `grep -r "mapSendOptions" src test` to confirm no external caller depends on it. If a test imports it, update the test to exercise it via the public API that uses it internally, or move the test to live alongside the internal function.
- If for some reason an external caller genuinely needs it, stop and report back — do not re-export without justification.

### Issue 4 — AC4 headers-invariant is undocumented
**Acknowledged finding:** AC4 requires `ServerSendOptions` to NOT include a `headers` field (headers flow through a different path). This invariant is enforced only by the current shape of the type — there is no comment explaining why, so a future contributor could add `headers?: Record<string, string>` to `ServerSendOptions` and silently violate AC4.

**Why it matters:** AC invariants encoded only in type shape rot fast. A one-line comment is cheap insurance.

**Fix:**
- Add a comment directly above the `ServerSendOptions` interface/type declaration explaining: (a) that `headers` is intentionally excluded, (b) why (headers are set via the dedicated headers path, not send options — reference the tech spec section/AC if applicable), and (c) a "do not add `headers` here" warning for future contributors. Reference `tech-spec-kafka-options.md` AC4.
- If the project has a lint rule or type-level guard mechanism already used elsewhere for similar invariants, apply it here too. Otherwise the comment is sufficient for this round.

## After applying the fixes
1. Run the story's full test suite (the 15 existing tests plus your new ones from issues 1 and 2). All must pass.
2. Run lint and typecheck. Both must stay green.
3. SendMessage to `team-lead` with:
   - Per-issue: what you changed, exact file paths and line ranges touched.
   - Test results: counts (before vs after), any new tests added, pass/fail status.
   - Lint/typecheck status.
   - Anything you could not fix and why (if any).
4. Wait for shutdown_request. Do NOT commit.
