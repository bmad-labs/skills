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
<Exact skill name, e.g. "bmad-dev-story". Always name it. Never write
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
  - **Story file / tech-spec (always include for story-bound work)**: name the file
    AND the section the agent should read first. E.g. "story-1-3.md → Dev Notes for
    what was implemented; Acceptance Criteria for what to validate."
  - Project rules: CLAUDE.md, .cursorrules, docs/conventions.md
  - Architecture & PRD: _bmad-output/planning-artifacts/{specific-file}
  - References inside this skill (e.g. references/functional-validation.md)
Name sections or line ranges when you know them — "CLAUDE.md §Naming" beats "read CLAUDE.md".>

## Success criteria
<How the agent knows it's done. Concrete: "all 4 issues fixed, `npm test` passes,
no new issues in touched files, lint clean." Round number for retries ("Round 1/2").>

## Where to write your detailed work (document-first)
<The section in the story file / tech-spec to append to:
  - Developer work → Dev Notes / Dev Agent Record
  - Validation results → QA Results / Validation Results
  - Code review findings (when leader writes them before fix-request) → Review Notes
The agent puts the *detail* there, not in the SendMessage reply.>

## Report back with (short message)
<The SendMessage to "team-lead" stays compact. Usually:
  "<Step result>. File: <story or spec path>. Status: <one word>. Headline: <one line>."
Anything longer goes in the file, not the message. The leader reads the file.>
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

## Example 1 — Reviewer-fixes-issues handoff (document-first)

Scenario: leader's code review found 2 issues in the auth module. Leader has already written the full review into `story-1-4.md → Review Notes`. Now asking the developer (same agent that wrote the code) to apply the fixes.

```
## Task
Round 1/2: apply the 2 fixes I logged in story-1-4's Review Notes.

## Why this matters
Issue 1 is a real auth bug (401 vs 500 leak); issue 2 is a CLAUDE.md naming-convention
breach. Both are blocking the story from being shipped — see Review Notes for the full
reasoning, including the consequence chain on each.

## Skill to invoke
typescript-clean-code (for the rename + error class shape)
typescript-unit-testing (to cover the new 401 path)

## Specific actions
1. Read story-1-4.md → Review Notes (latest entry). It lists 2 numbered findings with
   file paths, line numbers, snippets, and recommended fixes.
2. Apply both fixes. Cross-reference each finding number when you commit your work to
   Dev Notes so I can match them up.

## Knowledge sources to consult
- _bmad-output/implementation-artifacts/story-1-4.md
  → Review Notes (the 2 findings — read first; this is the full review)
  → Acceptance Criteria (the bar you can't break)
  → Dev Notes (your prior implementation summary — for context)
- CLAUDE.md §Naming conventions (line 15 — issue 2 cites this)
- _bmad-output/planning-artifacts/architecture.md §Error handling

## Where to write your detailed work
Append to story-1-4.md → Dev Notes: list each finding number, what you changed, the diff
summary, the test you added for the 401 path, and the test command output.

## Success criteria
- Both findings in Review Notes resolved.
- Existing story-1-4 tests still pass: `npm test -- auth`.
- New test covers the 401 path (≥1 negative-case assertion).
- Lint/typecheck clean.

## Report back with (short message)
"Fixes applied. Story: story-1-4.md. Status: review. Tests: <pass/fail>. Headline: 401
path now covered, AuthResp renamed."
```

Notice: the packet does NOT paste the review findings inline. They live in the story file's Review Notes section. The packet just points at the file and tells the developer where to read and where to write back.

## Example 2 — Feedback to a story-developer (Round 1/2, document-first)

Scenario: developer reported "done" but unit tests for the new error path are missing and the log format doesn't match project conventions. Leader logged both gaps in `story-2-3.md → Review Notes` before sending this packet.

```
## Task
Round 1/2: close the 2 gaps I logged in story-2-3's Review Notes before code review.

## Why this matters
- The retry-backoff feature is on the critical path for Kafka reconnects. A regression
  there means the service stops consuming with no alert.
- The log format mismatch breaks the Grafana dashboard (grafana.internal/d/kafka) which
  parses log lines by regex against the project's log schema.

## Skill to invoke
typescript-unit-testing (use fake timers for backoff)

## Specific actions
1. Read story-2-3.md → Review Notes (latest entry). It names the 2 gaps with file paths,
   line numbers, and the missing test cases / log schema example.
2. Address both. Append your fix summary to Dev Notes when done.

## Knowledge sources to consult
- _bmad-output/implementation-artifacts/story-2-3.md
  → Review Notes (the 2 gaps — read first)
  → AC3 (test coverage AC, the bar to honestly check)
  → Dev Notes (your prior implementation — for context on retry path location)
- docs/logging.md §Structured log events (schema the dashboard parses)
- _bmad-output/planning-artifacts/architecture.md §Observability

## Where to write your detailed work
Append to story-2-3.md → Dev Notes: list each gap number, the test names you added,
the diff for the log line, and full test output.

## Success criteria
- 3 new tests added and passing (the cases listed in Review Notes).
- Log line at src/kafka/consumer.ts:95 matches schema; `grep "logger.info(\`retry"` finds 0 hits.
- AC3 honestly checkable.

## Report back with (short message)
"Gaps closed. Story: story-2-3.md. Status: review. Tests: <pass/fail>. Headline: retry
path covered, log schema fixed."
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
bmad-technical-research

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
