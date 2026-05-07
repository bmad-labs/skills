# Flow: Quick Flow (intent-to-code)

Lightweight pipeline for small, well-understood changes. Skips Phases 1-3 entirely — no PRD, no architecture, no epics. The user's described intent is the starting artifact; `bmad-quick-dev` turns intent directly into working code.

## When this flow runs

- User asks to "quick dev" or "quick flow".
- User describes a small self-contained change (bug fix, small feature, refactor, patch).
- User provides an inline change description.
- User references an existing change description / note they've written.

> **Note:** the standalone "quick spec" step that used to live here is gone — the BMAD framework no longer ships a separate spec-creator workflow. `bmad-quick-dev` handles spec-shaping internally as part of its workflow. If a change genuinely needs a written spec first (because it's big enough to warrant one), that's a signal to switch to Phase 4 (PRD → architecture → epics → stories), not to add a spec step here.

## Pre-flight

1. Read the user's change description. If it's vague (e.g. "fix the login thing"), ask one clarifying question to make the intent concrete before spawning anything.
2. Check `{MEMORY_SOURCES}` and `{KNOWLEDGE_PATHS}` for prior decisions that affect the change. Cite anything relevant in the developer's Delegation Packet.
3. **If the change surfaces real design ambiguity** (multiple plausible approaches, unclear library/pattern choice), spawn a one-shot planning-phase researcher per `references/escalation.md` *before* delegating to the developer. A 5-minute consultation here saves hours of rework. Memory check first; researcher only if memory is empty.
4. Tell the user the one-sentence summary of the change you're about to implement, and the approach you'll take. Confirm before proceeding.

---

## Step 1: Implement

Send a Delegation Packet (or invoke directly in `main` mode) for `Skill: "bmad-quick-dev"`. The packet includes:

- The user's change description (verbatim).
- *Why this matters* — the user-visible problem the change solves.
- *Knowledge sources* — `{KNOWLEDGE_PATHS}` + any related prior decisions surfaced from `{MEMORY_SOURCES}` + relevant existing files.
- *Specific actions* — "Use `bmad-quick-dev` end-to-end: shape the implementation plan, write the code, write tests for new behavior, run self-check."
- *Where to write detailed work* — append a Dev Notes section to a new file at `_bmad-output/implementation-artifacts/quick-{slug}.md` with the implementation summary, files touched, decisions made, test results.
- *Manual task handling* — investigate automation first; only report a task as truly manual after exhausting automation options.
- *Success criteria* — change implemented, tests pass, no regressions in touched files.
- *Report back with* — short message: `"Done. Quick-doc: <path>. Status: review. Tests: <pass/fail>. Headline: <one line>."`

In `main` mode the leader runs `bmad-quick-dev` directly and writes its own Dev Notes to the same `quick-{slug}.md` file.

After report:
- Successful → Step 2.
- Blocked → escalation ladder (`references/escalation.md`).
- Manual task surfaced → review investigation, suggest automation if missed; else halt for user.

---

## Step 2: Code Review (LEADER ONLY)

The leader reads the diff and verifies the change does what the user described and meets the project's standards. Use `Skill: "bmad-code-review"` if you want the structured workflow.

Pass → Step 3. Issues → write your full review findings into `quick-{slug}.md` → **Review Notes** section, then send a fix-request Delegation Packet back to the same developer (same agent in team-persistent/hybrid; respawn quick-developer in team-respawn). The packet's *Knowledge sources* points at the new Review Notes section; *Specific actions* lists the numbered fixes. Up to 2 leader rounds → escalation ladder.

> Same rule as Phase 4: the leader reviews, the developer fixes. No separate `quick-reviewer` sub-agent.

---

## Step 3: Functional Validation

Same logic as Phase 4 Step 4.5, but a single change usually means **full** validation by default — there's no "epic with >3 stories" trade-off in Quick Flow. Read `references/functional-validation.md` for project-type detection.

In team modes, delegate to the tester. In main/hybrid, the leader runs validation. Tester appends results to the QA Results section of `quick-{slug}.md`.

PASS → Step 4. PARTIAL → log warning, proceed to Step 4. FAIL → fix-request Delegation Packet → re-run Steps 2-3. Escalation if still failing.

---

## Step 4: Commit (LEADER ONLY)

1. `git status` and `git diff`.
2. Compose commit message: `fix|feat|refactor(<scope>): <description>` — match the change type.
3. Include validation result.
4. **Commit policy:**
   - `auto_progression: confirm-each` → ask user → commit on yes.
   - `auto_progression: auto-commit` → commit directly. Still ask if `git status` shows files outside the change's scope.
5. Report: *"Quick Flow complete."*

---

## Scope Escalation (when the change exceeds Quick Flow)

If a sub-agent (or the leader) reports the change is bigger than Quick Flow can handle — needs architecture decisions, spans many components, requires stakeholder alignment — switch to full BMAD Phases 1-4. The `quick-{slug}.md` document carries forward as input to Phase 1 (problem framing) — no work lost.

This is a one-way switch: don't try to "make Quick Flow bigger." If the change is too big, it's too big. Switch.

Wait for the user to confirm before switching. Don't make this call yourself.

---

## Resumability

State is inferred from the `quick-{slug}.md` document + git state:
- Document exists, no code changes → resume at Step 1 (developer didn't finish or didn't start).
- Code changes exist, no commit → resume at Step 2 or Step 3.
- Code committed → flow done.

Use `git status` and the document's most recent section (Dev Notes / Review Notes / QA Results) to decide which step is next.
