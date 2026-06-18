# Flow: Phase 4 (epic / story pipeline)

Standard BMAD Phase 4 implementation. This file describes the **steps**; your chosen **mode** decides how each step is executed (leader-direct vs delegated).

## Pre-flight

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml`.
   - Missing → invoke `Skill: "bmad-help"` for next-action suggestions. Stop.
   - All epics/stories `done` → invoke `bmad-help`. Stop.
2. Read `_bmad-output/planning-artifacts/epics.md` and find the first incomplete epic + story.
3. Report progress to the user: _"Starting Epic {N}, Story {N-M}. {done} of {total} stories complete."_

## Status query (no implementation triggered)

If the user only asks about status, summarize `sprint-status.yaml` and stop. Do not enter the main loop. If `sprint-status.yaml` is missing, invoke `bmad-help`.

---

## Main loop — for each epic, in order

### A. Epic Start (epic status `backlog`)

1. **Retro action items from prior epic** — if `_bmad-output/implementation-artifacts/retrospective-epic-{N-1}.md` exists, read it and pull every CRITICAL or HIGH item. For each:
   - Try to verify/resolve it (run a docker compose up, pull an image, run a migration, hit a health endpoint). In team modes, you can dispatch this to the developer or tester; in main/hybrid, just do it.
   - Resolved → continue. Unresolvable → report to user with details and pause.
2. Invoke `Skill: "bmad-sprint-planning"` (leader does this directly in every mode — it's a planning decision, not coding).
3. Re-read `sprint-status.yaml`. If epic is still `backlog`, halt: _"Sprint planning did not advance epic status."_ Pause.
4. **In team modes (`team-persistent`, `team-respawn`, `hybrid` with epic-persistent agents):** spawn the epic team now. See your mode file for the spawn prompts.

### B. Story Loop

Determine the resume point from story status:

- `backlog` → Step 1
- `ready-for-dev` or `in-progress` → Step 3
- `review` → Step 4
- `done` → skip
- Anything else → unrecognized status, report to user, pause

#### Step 1: Create Story (delegated to `sm` or done by leader)

In `team-persistent`, `team-respawn`, `hybrid` (if you choose to delegate creation): send a Delegation Packet to the sm/story-creator naming `Skill: "bmad-create-story"`, args `<story_id>`. In `main` (or `hybrid` electing to do creation directly): invoke the skill yourself.

**Recon-first, then bake it into the creator's packet (the highest-leverage move).** Before delegating story creation, the leader does a short **scoping recon directly** — open the story's design contract AND the real target repo, and answer: what already exists that the story must NOT rebuild (prior stories often shipped half of it); what's the net-new delta; which design-doc claims drift from the installed code (Rule 31 — verify the loader/path/contract yourself); and any seam ruling the design leaves open. Then **pass that recon verbatim in the Delegation Packet's _Knowledge sources_ + _Prior findings_ slots, with the rulings pre-decided.** This session every story did this, and it was the single biggest driver of clean first-pass story files: the creator rendered the recon into the BMAD format instead of re-deriving it (and often caught a *further* drift the leader had missed — which the leader then re-verified per Rule 31). The recon costs the leader a few greps and reads; it saves a fix round-trip on the spec and a worse one in code. (Don't over-invest for a trivial story — but for anything touching real wiring, recon first.)

**If the story surfaces planning ambiguity** — unclear architecture, unclear approach, library/pattern choice the PRD doesn't pin down — the sm should report it back rather than guess. The leader then runs the memory-first check (`{MEMORY_SOURCES}` → `{KNOWLEDGE_PATHS}`); if no existing answer, spawn a one-shot planning-phase researcher per `references/escalation.md` to get a recommendation before finalizing the story. Do this _before_ moving to Step 2 — fixing ambiguity in the spec is much cheaper than fixing it in code.

After: re-read `sprint-status.yaml` to confirm the story file was created and status advanced.

#### Step 2: Validate Story (LEADER ONLY, every mode)

The leader reads the story file and validates:

- All ACs are concrete and testable.
- Tasks are ordered correctly and reference real files.
- Architecture / PRD alignment is explicit.
- No ambiguity that would force the developer to make scope decisions.
- **The story's design-doc claims hold against the REAL codebase (Rule 31).** When a story (or its creator's recon) flags a design-vs-reality drift — a file path the loader doesn't scan, a composition mechanism the repo doesn't actually use, a contract the installed code contradicts — **verify it yourself** (grep the loader, `diff` the artifacts, read the real module), don't take the agent's word. Rule to **build the reality**; **you (leader) own correcting the planning doc** afterward (it's not the dev's to edit). Catching this at validation is far cheaper than at the next story's seam.

Validation passes → Step 3. Validation fails → either fix the story directly (if the issue is a missing reference you can add) or send a Round 1 Delegation Packet back to the sm/story-creator with _Specific actions_ listing the problems. Up to 2 leader rounds → escalation ladder.

> **Why leader-only?** Story validation is a decision about whether the spec is good enough to implement. Sub-agents shouldn't be making that call — and they don't have the cross-epic context the leader does about what "good enough" means in this project.

#### Step 3: Develop Story

Send a Delegation Packet to the developer naming `Skill: "bmad-dev-story"`. The packet must include:

- Story id and story file path.
- _Why this matters_ — the user-facing or architectural reason for this story.
- _Knowledge sources_ — `{KNOWLEDGE_PATHS}` + the story file + relevant architecture sections.
- **Mandatory project skills** — list the project-mandated skills from SKILL.md § "Mandatory project-level skills" in the _Specific actions_ slot, BEFORE the `bmad-dev-story` instruction. At minimum: `typescript-clean-code` (always). Add `typescript-unit-testing` / `typescript-e2e-testing` when the story includes test work, and `design-system` for UI stories. Tell the developer to read each skill's `SKILL.md` and apply its patterns/checklists to all code.
- _Success criteria_ — every AC met, tests pass, lint clean, sprint-status advanced to `review`.
- _Report back with_ — task completion summary, test output, anything deferred.

In `main` mode the leader invokes `bmad-dev-story` directly.

After report: re-read `sprint-status.yaml` (should be `review`).

- Successful → Step 4.
- Manual task reported → review the developer's investigation. If you can suggest an automation, do (Round 1/2). Else halt for user.
- Blocked → escalation ladder. After collaborative escalation fails → invoke `Skill: "bmad-correct-course"` → halt for user.

#### Step 4: Code Review (LEADER ONLY, every mode)

The leader reviews the diff in this conversation. Use `Skill: "bmad-code-review"` if you want the structured workflow, or read the diff yourself. Check:

- Story ACs satisfied.
- Project conventions followed (consult `{KNOWLEDGE_PATHS}`).
- **typescript-clean-code patterns applied** — the leader reviews against the same `typescript-clean-code` skill the developer was told to follow. Load it yourself if you haven't already.
- Tests cover the new behavior.
- No regressions in touched files.
- No security or perf foot-guns.

Pass → Step 4.5. Issues → write your full review findings into the story file's **Review Notes** section first (file paths, line numbers, what's wrong, recommended fixes — verbatim, not summarized). Then send a fix-request Delegation Packet to the **developer** (not a separate reviewer):

- _Knowledge sources_ — story file path, point at the new Review Notes section ("read Review Notes first; that's the full review").
- _Specific actions_ — numbered, file path + line, what to change. Cross-reference the items in Review Notes.
- _Success criteria_ — every issue in Review Notes fixed, tests still pass.
- Mark "Round 1/2".

The detail lives in the story file, not the packet — keeps the leader's conversation context lean and gives the developer one canonical place to read.

Developer fixes → you re-review in conversation. Up to 2 leader rounds → escalation ladder.

> **Why leader-only?** The leader has the cleanest view of "what was wrong with this code and why it matters." Sub-agents reviewing each other re-derive that view from scratch and tend to either rubber-stamp or over-correct. The fix should come from the agent that wrote the code; the review should come from the leader.

#### Step 4.5: Functional Validation

Build, run, and test the implementation in its real runtime — catches the class of bugs unit tests with mocks cannot.

**Choose light or full** per the epic-aware policy:

- Epic has ≤3 stories → run **full** validation for every story.
- Epic has >3 stories → run **light** validation per story; defer the full suite to Epic Completion.

**Light** = build + bring the app up (locally or via Docker) + smoke-check the main cases the story changed. **Unit tests are NOT part of light** — they were already verified during code review. Skip slow E2E suites, exhaustive edge cases, and heavy multi-service infra spin-ups.

**Full** = light's runtime smoke, plus integration / E2E tests, full infrastructure verification, and cross-cutting checks per the project type. Read `references/functional-validation.md` for project-type detection and the per-type playbooks under `references/guides/`.

In team modes, send the tester a Delegation Packet specifying "light" or "full" mode and the story id. In main/hybrid (when validation is leader-direct), follow `references/functional-validation.md` yourself.

**Outcomes:**

- **PASS** → Step 5.
- **PARTIAL** → log warning, proceed to Step 5, include partial details in commit message.
- **FAIL** → tester's failure detail is already in the story file's QA Results section. Send a fix-request Delegation Packet to the developer with _Knowledge sources_ pointing at the QA Results section ("read the latest QA Results entry — full failure context is there") and _Specific actions_ naming the failing test/command. Re-run Steps 4 + 4.5 after fix. Escalation ladder if still failing.

**Infrastructure verification is non-optional.** If the story touches Docker / DB / queue / external API, the validator must hit the real thing or report PARTIAL. Mocked tests passing while infra is broken is exactly what this step exists to prevent.

**Disciplines that repeatedly catch real bugs here (see Critical Rules 23–25, 29–33):**
- **The developer runs the full e2e (`test:e2e:docker` or equivalent) ITSELF before reporting `review`** — when the environment supports it (verify the env claim, e.g. `docker info`, rather than trusting "no Docker"). **And the leader re-runs it independently** regardless — never trust a self-reported green. Unit-green ≠ boots: `Test.createTestingModule` mocks providers and won't surface a module that fails to boot when imported standalone (Rule 25), nor a service that's wired wrong on the real path.
- **Confirm at least one e2e drives the REAL entry point** (the pipeline / command / intake the app actually uses), not just isolated components seeded via repositories (Rule 24). An "isolated component passes" can hide a wiring defect that only the full path reveals — which then surfaces, more expensively, in the *next* story.
- **Re-run from a CLEAN invocation, via the ATOMIC e2e command (Rules 29–30).** Strip ambient state: a fresh shell, inherited env unset where it matters (`env -u NODE_OPTIONS …`), cold infra. A dev's pass that depends on a stray shell flag or a warm/seeded broker is not reproducible — if your clean run disagrees, the dev's pass was ambient and the fix is a *self-contained* test (a script that sets its own flags), not accepting the ambient pass. Use the atomic command (owns its own infra up/down); never hand-juggle `infra:up`/`down` or overlap Docker cycles — self-induced contention produces false failures. Run the FULL suite (a subset changes which suite cold-boots first). Honor any per-repo **skip-e2e** directive in the DECISION-LOG (unit + quality only for those).
- **A broken e2e harness / missing test infra is a PRE-EXISTING repo gap, not the story's failure (Rule 32).** Verify the breakage yourself, then rule to self-contain the new test (in-process stub + minimal `.env.test`, or enable the missing infra) so the AC's intent is met without reviving broken scaffolding; log the gap as retro tech-debt. Don't block the story on unrelated repo rot.
- **A SHARED-code change needs a full-suite blast-radius proof the leader runs himself (Rule 33).** If a story legitimately edits shared code (a shared util bug, missing component-test config), run the *whole* existing suite after the change — only a green full-suite proves backward-compatibility; require the change be minimal + a no-op for existing consumers.

#### Step 5: Commit (LEADER ONLY)

1. Re-read `sprint-status.yaml` to confirm the story is `review` → about to become `done`.
2. Run `git status` and `git diff` to see what's actually changed.
3. Compose the commit message: `feat(epic-{N}): implement story {N-M} - {title}`. Include validation result (PASS or PARTIAL details).
4. **Commit policy:**
   - `auto_progression: confirm-each` → ask user for approval → commit on yes.
   - `auto_progression: auto-commit` → commit directly. Still ask if `git status` shows anything unexpected (untracked files outside the story scope, accidental .env modifications, etc.).
5. Update **both** status fields to `done` (Rule 28): the `sprint-status.yaml` entry AND the story file's `Status:` header line (it's set by the creator/dev earlier and goes stale — a human reading the story file sees the header, not sprint-status).
6. Append this story's outcome to `DECISION-LOG.md` (Rule 28): the commit hash + test counts, every seam ruling you made at validation, and any latent bug the independent e2e caught. Keep it current on the fly, not at epic end.
7. Report: _"Story {N-M} complete. Moving to next story."_

### C. Epic Completion

After the last story in the epic is `done`:

1. **Run the full epic suite** (only if per-story validations were "light", i.e. epic had >3 stories): send the tester a "full epic" Delegation Packet, or run it yourself in main/hybrid. Outcome handling same as Step 4.5.
2. Invoke `Skill: "bmad-sprint-status"` for a status report (leader-direct).
3. Invoke `Skill: "bmad-retrospective"` for the completed epic (leader-direct).
4. Read the retro and surface CRITICAL/HIGH items to the user as _"items that must be resolved before Epic {N+1} starts."_ Epic Start step A will gate on them.
5. **In `team-persistent` and epic-persistent `hybrid`:** shut down the sm + developer + tester for this epic. Do NOT carry them into the next epic — fresh trio per epic.
6. Report: _"Epic {N} complete. Moving to Epic {N+1}."_ Continue.

---

## Resumability

The flow is fully resumable:

- Re-triggering reads `sprint-status.yaml` and picks up at the next incomplete step.
- Mode is re-asked at Step 0 in SKILL.md (the user may want to switch based on current conditions; mode itself isn't persisted between sessions).
- For team modes: if the prior session shut down the team cleanly, just spawn fresh; if the session crashed mid-epic, treat it as epic-start (re-spawn team) since the prior team's state is gone.

## Cleanup

When done or the user halts: shut down all sub-agents → `TeamDelete` (in team modes).
