## Task
Round 1/2: apply the 4 fixes you identified in your review of story 9-14 (Kafka producer options mapping). You already have full context on what's wrong and why — this handoff adds the project-standard references so the fixes land in a way that's consistent with our conventions.

## Why this matters
- **Finding 1 (weak assertions):** UT-001/002/003 currently only check `connect()` was called. That duplicates UT-004/005 and leaves the config-mapping contract untested — if `mapProducerOptions` starts emitting the wrong keys, these tests won't catch it. Our `CLAUDE.md` §Testing section is explicit that tests must assert on behavior, not just call sites.
- **Finding 2 (key-alias conflict):** `mapProducerOptions` writes `acks` while `mapSendOptions` writes `request.required.acks`. librdkafka treats these as aliases — if both are set on the same producer, the behavior is undefined per `docs/kafka-conventions.md`. This is a real correctness risk, not a style nit: ack semantics directly affect durability guarantees.
- **Finding 3 (public export of `mapSendOptions`):** Exporting an internal mapper widens the API surface with no justified advanced-user case. Once exported, removing it is a breaking change. Keep it internal until there's a concrete caller that needs it.
- **Finding 4 (AC4 headers invariant):** AC4 says `ServerSendOptions` must not accept a `headers` field. That invariant is currently enforced only by the type's current shape — a future contributor could add `headers` with no test or comment stopping them. A comment at the type definition makes the invariant survive refactors.

## Prior findings (your own report, verbatim)
> Key findings:
> 1. Weak assertions in UT-001/002/003 — tests only check connect() was called, don't verify config contents (redundant with UT-004/005).
> 2. Key-alias conflict risk — mapProducerOptions writes 'acks', mapSendOptions writes 'request.required.acks'; setting both could cause librdkafka issues.
> 3. mapSendOptions publicly exported — no justified advanced-user case; recommend keeping internal.
> 4. AC4 headers invariant undocumented — add a comment to ServerSendOptions preventing future headers field additions.
>
> All ACs met, lint/typecheck/15 tests pass. Happy path is correct and well-designed.

## Specific actions requested
1. **Finding 1 — strengthen UT-001/002/003 assertions.** Rewrite each test so it asserts on the actual config passed to `connect()` (use the mock call-args), not just that `connect()` was invoked. Each test should pin down the producer-config contract for its scenario (e.g., default options, custom `acks`, custom `compression`). If that makes any of them fully redundant with UT-004/005, delete the redundant one rather than keeping a weak duplicate — follow `CLAUDE.md` §Testing on assertion quality and no-redundant-tests.
2. **Finding 2 — resolve the `acks` / `request.required.acks` alias conflict.** Pick one canonical key per the rules in `docs/kafka-conventions.md` (librdkafka key naming) and make the other mapper either (a) not emit its variant, or (b) normalize into the canonical key before merge. Add a unit test that sets ack-related options via both `mapProducerOptions` and `mapSendOptions` and asserts only the canonical key is present on the outgoing config. The fix must not silently change ack semantics for existing callers.
3. **Finding 3 — un-export `mapSendOptions`.** Remove it from the module's public exports (index barrel + named export on the source file). Update any internal call sites to import from the private path. If a test currently imports it from the public entry, move that test import to the internal path too. If you find an external consumer in-repo that justifies the export, stop and report back instead of guessing.
4. **Finding 4 — document the AC4 headers invariant.** Add a comment block above the `ServerSendOptions` type definition stating: "Intentionally excludes `headers`. AC4 of story 9-14 requires headers to be set only via the producer-level path; do not add a `headers` field here without updating the story's AC and the send-path contract." Reference the story id so the trail is discoverable.

## Knowledge sources to consult
- `CLAUDE.md` §Testing — assertion quality rules (this is the basis for Finding 1); §Naming — for any renames the un-export in Finding 3 may require.
- `docs/kafka-conventions.md` — full file, but especially the librdkafka key-naming rules that determine the canonical choice in Finding 2.
- `_bmad-output/implementation-artifacts/story-9-14.md` — ACs (especially AC4 for Finding 4) and the test list UT-001..UT-005 for Finding 1.
- `_bmad-output/implementation-artifacts/tech-spec-kafka-options.md` — the original mapping design; confirm the canonical key choice in Finding 2 matches the spec's intent (and update the spec if the spec is what's wrong).

## Relevant skills
- `typescript-clean-code` — invoke for the un-export in Finding 3 and any type/comment changes in Finding 4.
- `typescript-unit-testing` — invoke for the assertion rewrites in Finding 1 and the new alias-conflict test in Finding 2. Follow its guidance on mock call-arg assertions and on removing redundant tests rather than keeping weak ones.
- `bmad-bmm-code-review` — not needed for the fix itself; a fresh reviewer will re-run this after you report back.

## Success criteria
- All 4 findings resolved in-place per the actions above.
- UT-001/002/003 now assert on config contents (or are removed as redundant, with UT-004/005 covering their cases).
- A new test exists for the alias-conflict scenario in Finding 2 and passes.
- `mapSendOptions` is no longer in the public export surface; `grep`-ing the barrel confirms it.
- `ServerSendOptions` has the AC4 invariant comment with story reference.
- Full suite still green: lint clean, typecheck clean, all tests pass (the prior 15 + any new/changed ones). Include the exact commands you ran.
- No behavioral regressions to the happy path you already validated.

## Report back with
- Per-finding confirmation (1–4): what changed, file paths + line ranges, and for Findings 1 & 2, the new/updated test names and what they assert.
- The canonical key you chose for Finding 2 and the one-line rationale tying it back to `docs/kafka-conventions.md`.
- Full output of the test run and lint/typecheck commands (pass/fail counts, not just "green").
- Anything you deferred or couldn't do, with the reason — don't silently skip. If Finding 3 surfaces an external consumer that blocks un-exporting, stop and report instead of forcing it.
