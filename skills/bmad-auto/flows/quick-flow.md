# Flow: Quick Flow (spec-to-code)

Lightweight pipeline for small, well-understood changes. Skips Phases 1-3 entirely — no PRD, no architecture, no epics. The tech-spec is the only planning artifact.

## When this flow runs

- User provides or references a `tech-spec-*.md` file.
- User asks to "quick spec", "quick dev", or "quick flow".
- User describes a small self-contained change (bug fix, small feature, refactor, patch).
- User provides an inline spec.

## Pre-flight (decide which step to enter at)

1. **User provided a tech-spec file path** → read file, jump to Step 2.
2. **User referenced an existing spec** → search `_bmad-output/implementation-artifacts/` for a matching `tech-spec-*.md`. Found → Step 2. Not found → ask the user for the path.
3. **User wants a new spec** (or described a change without one) → Step 1.
4. **User provided an inline spec text** → save it as `_bmad-output/implementation-artifacts/tech-spec-{slug}.md` → Step 2.

Tell the user which step you'll enter and a one-sentence summary of the change.

---

## Step 1: Create Tech-Spec

Invoke (or delegate) `Skill: "bmad-quick-spec"` with the user's change description.

**If spec creation surfaces design ambiguity** — multiple plausible approaches, an unclear library/pattern choice, an architectural tension — pause and resolve it before finalizing the spec. Run the memory-first check (`{MEMORY_SOURCES}` → `{KNOWLEDGE_PATHS}`); if no existing answer, spawn a one-shot planning-phase researcher per `references/escalation.md`. A 5-minute research consultation here saves hours of rework if the chosen approach turns out wrong.

- `main` mode: leader runs the skill in this conversation.
- `team-respawn` mode: spawn a `quick-spec-creator` sub-agent. See `modes/team-respawn.md` for the spawn skeleton; the Delegation Packet's *Skill to invoke* is `bmad-quick-spec`.
- `team-persistent` / `hybrid`: spawn the developer (already alive) and let it run `bmad-quick-spec` since it's a one-off task — or do it yourself. For Quick Flow with a single tech-spec, hybrid usually means leader-direct (cheaper than spinning up a team for one change).

After the spec is generated:
1. **Leader reads the spec** and presents a summary to the user: problem, approach, task list, acceptance criteria.
2. Ask: *"Does this spec look good? I can proceed to implementation, or you can request changes."*
3. **Approved** → Step 2.
4. **Changes requested** → if the spec is leader-generated, just edit it. If a sub-agent generated it, send a Round 1 Delegation Packet with the user's requested changes as *Specific actions* (up to 3 rounds before halting).

The leader always validates the spec before implementation starts. There is no `quick-spec-validator` sub-agent.

---

## Step 2: Implement from Tech-Spec

Send a Delegation Packet (or invoke directly in `main` mode) for `Skill: "bmad-quick-dev"` with args `<path-to-tech-spec>`. The packet must include:

- Tech-spec path.
- *Why this matters* — the user-visible problem the change solves.
- *Knowledge sources* — `{KNOWLEDGE_PATHS}` + tech-spec.
- *Specific actions* — "Execute every task in the spec in order; write tests for new behavior; verify each AC; run self-check."
- *Manual task handling* — investigate automation first; only report a task as truly manual after exhausting automation options.
- *Success criteria* — every task done, every AC verifiable, tests pass.
- *Report back with* — task completion list, test output, any AC that couldn't be verified and why.

After report:
- Successful → Step 3.
- Blocked → escalation ladder (`references/escalation.md`).
- Manual task surfaced → review investigation, suggest automation if missed; else halt for user.

---

## Step 3: Code Review (LEADER ONLY)

The leader reads the diff and verifies alignment with the tech-spec. Use `Skill: "bmad-bmm-code-review"` if you want the structured workflow.

Pass → Step 4. Issues → fix-request Delegation Packet back to the same developer (it's the same agent in team-persistent/hybrid; respawn quick-developer in team-respawn) with *Prior findings verbatim* — your review, full text. Up to 2 leader rounds → escalation ladder.

> Same rule as Phase 4: the leader reviews, the developer fixes. No separate `quick-reviewer` sub-agent.

---

## Step 4: Functional Validation

Same logic as Phase 4 Step 4.5, but a single change usually means **full** validation by default — there's no "epic with >3 stories" trade-off in Quick Flow. Read `references/functional-validation.md` for project-type detection.

In team modes, delegate to a tester or func-validator. In main/hybrid, the leader runs validation.

PASS → Step 5. PARTIAL → log warning, proceed to Step 5. FAIL → fix-request Delegation Packet → re-run Steps 3-4. Escalation if still failing.

---

## Step 5: Commit (LEADER ONLY)

1. `git status` and `git diff`.
2. Compose commit message: `fix|feat|refactor(<scope>): <description>` — match the change type.
3. Include validation result.
4. **Commit policy:**
   - `auto_progression: confirm-each` → ask user → commit on yes.
   - `auto_progression: auto-commit` → commit directly. Still ask if `git status` shows files outside the spec's scope.
5. Report: *"Quick Flow complete."*

---

## Scope Escalation (when the spec exceeds Quick Flow)

If a sub-agent (or the leader) reports the change is bigger than Quick Flow can handle — needs architecture decisions, spans many components, requires stakeholder alignment — present the user with two options:

- **Light**: re-run `bmad-quick-spec` for a more detailed spec, then retry.
- **Heavy**: switch to full BMAD Phases 1-4. The tech-spec carries forward — no work lost.

Wait for the user to choose. Don't make this call yourself.

---

## Resumability

State is inferred from the tech-spec file + git state:
- Tech-spec exists, no code changes → resume at Step 2.
- Code changes exist, no commit → resume at Step 3 or Step 4.
- Code committed → flow done.

Use `git status` and the tech-spec timestamp to decide.
