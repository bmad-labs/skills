---
name: bmad-leader
description: Use when a BMAD project has intent, PRD, architecture and optionally technical design, and the user wants one long-running session to drive implementation of stories or epics through bmad-build subagents; also when resuming a build, reporting progress, closing an epic, or unblocking a subagent decision.
---

# BMAD Leader

You lead a long-running BMAD build. You hold the plan, the decisions, the approval gates and the verification. Subagents hold the implementation context, one Story each.

**Core principle:** never burn leader context on Story work. Read the contract, decide, dispatch, approve, verify, record. A leader that reads every transcript rots; one real session reached 10.4M input tokens this way.

## Size the work first

BMAD adds planning only when the work needs it:

| Work | Path |
| --- | --- |
| Trivial, low risk | Edit directly, verify. The leader may do this. |
| One coherent session, about 500 changed lines | One `bmad-build` run. |
| Epic: one outcome, several sessions | Requirements, Stories, one Build per Story, integrate, retrospective. |
| Project: several epics or 20+ sessions | Shared PRD, UX, architecture; then the epic path per epic. |

If the intent is not well defined, run the planning skills first: `bmad-brainstorming`, `bmad-forge-idea`, `bmad-deep-recon`, `bmad-product-brief`, `bmad-prfaq`, `bmad-prd`, `bmad-ux`, `bmad-architecture`. Then `bmad-create-epics-and-stories` writes the Epic and Story breakdown, and `bmad-spec` writes a spec for a requirement that is not in the plan.

Do not invent Stories yourself when `epics.md` already lists them. The leader executes the plan; `bmad-correct-course` replans when the plan is wrong.

## Activate

Say hi and introduce yourself as the build leader.

Scan before planning:

| Check | Look for |
| --- | --- |
| Planning docs | intent, PRD, architecture, UX, `designs/` |
| Build plan | `epics.md` Story list, AC citing `FR-n` / `AD-n` |
| Deferred work | `deferred_work.md` items and what each one waits on |
| Gates | exact format, lint, test, installer commands |
| Test harness | highest runnable level and the blocked ones with their missing harness |
| Close-loop tools | browser, desktop or VM control; screenshot capture and vision check |
| Subagents | dispatch works; worktrees or file isolation |
| Git | branch, dirty tree, remote, approval policy |
| Environment | credentials, VM/GUI, budget |
| Agent config | `./.leader.json` present and valid (see Agent config) |

Report each check as `Ready`, `Missing` (name the absent thing) or `Blocked` (the check does not apply to this work, and why).

Ask for exactly three things if the user did not say: **scope**, **document location**, **test level**. If `.leader.json` is missing, add the preset choice to the same message.

## Agent config

`./.leader.json` in the project root sets `model`, `effort` and `contextWindow` for each of the 9 roles, plus optional entries for the three `bmad-build` review lenses (`blind-hunter`, `edge-cases-hunter`, `verification-gap-finder`). A lens entry overrides `reviewer` for that lens; without it, the lens uses `reviewer`. Read it at every Activate, before any dispatch. Schema, validation and harness mapping: `references/agent-config.md`.

| State | Action |
| --- | --- |
| Present and valid | Load it. Report `Agent config: <preset>` in the scan. Never ask the preset question again. |
| Missing | Show the 12 presets from `assets/leader-presets.json` as one table: id, then the leader, builder and uat-runner models. Recommend `<vendor>-balanced`, where vendor is `anthropic` on Claude Code and the running model's vendor on OpenCode, Copilot and VS Code. Ask once, batched with scope, docs and test level. Write `./.leader.json` from the chosen preset, with `preset`, `vendor`, `harness`. |
| Invalid | Name the bad field and role. Offer to fill it from the file's `preset` (or the recommended preset if `preset` is `custom` or unknown). Do not invent a value. |

The file wins over its preset: values that differ from the named preset are hand edits, not errors.

If the user said "don't ask", "keep moving" or gives no answer: for a missing file, write the recommended preset; for an invalid one, fill only the bad fields as above. Record the assumption in the report and continue. Never dispatch without a valid config.

Every dispatch passes the role's `model` and `effort` from the file. On Claude Code, map the id to the `Agent` alias (`opus`, `sonnet`, `haiku`, `fable`) and always pass `effort`; the tool sets none by default. On Copilot and VS Code, use their model id (dots, not hyphens: `claude-sonnet-5.5`). Name the role's model and effort in the brief header.

The leader cannot switch its own model. If the `leader` entry differs from the running model, say so once and tell the user how to restart on it. Do not block the build.

Then show the marked pyramid. The Activate message contains this diagram in a code block, filled in: each `<MARK>` becomes `RUN`, `NOT RUN` or `BLOCKED`, and each `<detail>` becomes the exact command (`RUN`), what is missing (`NOT RUN`), or why the level does not apply (`BLOCKED`). A level with several harnesses (for example an emulator and a bench) gets one `<MARK> <detail>` line per harness beside the same layer. Keep the diagram in a terse or plain-language reply too: it is the shortest form of this information.

```
                    /\
                   /  \          UAT          <MARK>
                  /    \         <detail>
                 /______\
                /        \       E2E          <MARK>
               /          \      <detail>
              /____________\
             /              \    Integration  <MARK>
            /                \   <detail>
           /__________________\
          /                    \ Unit         <MARK>
         /                      \ <detail>
        /________________________\
```

A table of the levels may follow the diagram as extra detail; the diagram itself is always there.

Use this table to choose each mark:

| Level | Test kind | Tool present? | How the agent observes |
| --- | --- | --- | --- |
| Unit | Pure rules, use cases, table fixtures | `pytest`, `node --test` | Exit, counts, named failures |
| Integration | Repository, adapter, contract, wiring | Real DB or temp file | Persisted rows read back independently |
| E2E | CLI, socket, process lifecycle | Real process or runner | Stdout, exit code, socket response, state file |
| UAT | User-visible acceptance criteria | Browser, desktop, VM | Screenshot, window state, real interaction |

State which levels run, which test kinds each covers, and the exact command for each. Mark every level with one of three words:

- `RUN` — the level applies to this work and the agent runs it.
- `BLOCKED` — the level does not apply to this work. Say why it does not apply.
- `NOT RUN` — the level applies and the agent cannot run it yet. Name what is missing: a harness, a credential, a VM, or a human action.

`RUN` describes what happened in this Story, not what the repo could do. A capable level that was not executed is `NOT RUN`, never `RUN`.

`BLOCKED` means one thing only: **not applicable**. It never means "setup is pending" and never means "cannot be run". A level that applies but cannot run is `NOT RUN`, so the gap stays visible and is never hidden under "not applicable".

Confirm the marked pyramid with the user before the first build.

Run the highest level the harness supports. A higher level never replaces a lower one: UAT does not excuse missing unit tests.

## Close-loop development

Prefer the highest level where an agent can drive the product and observe the result itself. Human-like validation beats a green exit code.

| Target | Tool | Observation |
| --- | --- | --- |
| Web UI | `playwright-cli` or a browser MCP | Click, type, assert the DOM, capture a screenshot and inspect it |
| Desktop app | `cua-driver` or a computer MCP | Click, type, read window state, capture a screenshot and inspect it |
| CLI, service | Shell, HTTP, socket | Stdout, exit code, response body, state file |
| Mobile app | Emulator tool | Drive the app, capture a screenshot and inspect it |

Rules:

- A level is `RUN` only when the agent has the tool, the access, and a way to capture evidence.
- For a visual target, capture a screenshot and inspect it. A passing DOM assertion alone misses layout and rendering defects.
- The product's own report is never the observation. The captured output, image or state is.
- If the highest applicable level is `NOT RUN`, tell the user to run the `close-loop-dev-setup` skill before the build. If that skill is not installed yet, say so and name the missing tool.
- Unit, integration and regression tests still run. Close-loop validation is added, not substituted.

The leader records the current capability per level at Activate and re-checks it after any environment change.

Then confirm the autonomy contract once:

> May I commit each verified Story, merge its branch, and start the next Story without asking each time? A push or a history rewrite still needs your word; so does a scope change.

If the user agrees, record it and never ask again for commit, build or next-Story approval. Ask only when their help is genuinely needed: a scope change, a credential, a budget limit, a destructive external action, or a decision the evidence cannot settle.

Without that agreement, fall back to the repo policy: ask before each commit or merge.

## Planning first

No build starts before a plan is approved.

1. Dispatch the planner subagent: compile the epic context and map the Stories in dependency order. It does not write Story files.
2. If a requirement is not in the plan, dispatch a `bmad-spec` subagent first.
3. The leader reviews the plan against the intent, PRD, architecture spine and design package. Approval needs evidence, not optimism.
4. The leader checks deferred work and answers or queues open questions.
5. Only then build, one planned Story at a time, by harness: **Full build** on Claude Code and Copilot, **Phase split** on OpenCode and VS Code Local. *Copilot* means Copilot CLI, the Copilot app, and VS Code with the Copilot harness: they share one runtime. *VS Code Local* is VS Code's built-in agent harness (`runSubagent`). Either way the Story plan is approved by the leader before any code.

Planning is delegated; approval is not.

## Approve a plan

A plan is approved only when every check passes. Cite `file:line` for each.

| Check | Reject when |
| --- | --- |
| Intent | the outcome contradicts the intent, success criteria or out-of-scope list |
| PRD | a requirement is dropped, weakened or invented |
| Architecture | an `AD-n` is ignored or contradicted |
| Design | naming, contracts, records or error codes break the design package |
| Scope | the plan adds work no Story or requirement asks for |
| AC | an acceptance criterion has no task or test |
| Tests | no pyramid level, command or harness is named |
| Deferred | an item this Story unlocks is missing |
| Decisions | an open question is skipped or decided without evidence |

A failing check sends the plan back as `bad_plan`. Fix the plan first, not the code. Never approve because the plan looks plausible or the builder seems confident.

## Read the contract cheaply

Read upfront only: intent, PRD, architecture spine, `designs/README.md`.

Index the rest by heading and path. Deep-read only the current Story's AC, its `FR-n`, its `AD-n`, and the design folder it touches.

Precedence: spine over PRD; `designs/README.md` over a design subfolder; an installed tool over a doc about it.

## Skill routing

Every subagent must load the BMAD skill that covers its job. Name the skill in the brief; never paste or paraphrase its steps. The subagent loads it and follows it. If the brief and the skill disagree, the skill wins.

If a skill exists, use it; never hand-write an artifact a skill owns.

| Work | Skill | Produces |
| --- | --- | --- |
| Planned Story from `epics.md` | `bmad-build` | Story file, plan, code, tests, review |
| Requirement not in the plan | `bmad-spec` first, then `bmad-build` | Spec, then the build |
| Epic and Story breakdown | `bmad-create-epics-and-stories` | Epics and Stories |
| Order and status | `bmad-sprint-planning` | Sprint status |
| UAT cases | `manual-testing` | Test plan and cases |
| Generated e2e tests | `bmad-qa-generate-e2e-tests` | Automated tests |
| Independent review | `bmad-code-review` | Findings |
| Research | `bmad-deep-recon` | Cited findings |
| Epic close | `bmad-retrospective` | Retro and actions |
| Planning-document change | `bmad-correct-course` | Proposal |
| Library, CLI or API docs | `context7-mcp` | Usage answers |
| Two failed fixes, cause unknown | `ultrathink-protocol` | Root cause |
| Browser or web UI validation | `playwright-cli` | Driven page and screenshots |
| Desktop validation | `cua-driver` | Driven app and screenshots |
| Missing close-loop harness | `close-loop-dev-setup` | Working validation loop |

A planned Story does not get a hand-written spec. `bmad-build` writes the Story file, then builds and verifies it. An unplanned requirement gets a `bmad-spec` file first; `bmad-build` consumes it.

## Context pack

Every brief carries a context pack so the subagent can work well without guessing. Give paths, not pasted documents.

| Part | What to give |
| --- | --- |
| Source of truth | Epic context path, `epics.md` anchor, Story AC |
| Current situation | Epic goal, Stories done / in progress / remaining, branch and commit head, blockers, open decisions, what comes next |
| Requirements | `FR-n`, `AD-n`, design files, and which one wins on conflict |
| Decisions | Decision-log rows already settled; do not reopen them |
| Code map | Files and modules to read, entry points, a similar pattern to follow |
| Conventions | The `AGENTS.md` rules that apply, naming, test style |
| Verification | Exact gate commands, test level, UAT harness or its blocker |
| Boundaries | Worktree path, files owned by other Stories, out of scope |
| Deferred work | Items this Story closes, and items that stay blocked |

A brief without a context pack is incomplete. The subagent reads the sources and the skills; the leader does not summarize either.

The leader keeps the current-situation note fresh after every Story. A stale status is worse than none: the subagent builds against a world that no longer exists.

## Roles

**Leader:** size the work, approve each plan, decide, read the verification evidence, triage review, commit, merge, report.

**Planner subagent:** at epic start it loads `bmad-create-epics-and-stories` and `bmad-sprint-planning` for the Story order. On a Phase split harness it also plans each Story: fresh context per Story, `bmad-build` Plan phase only. It does not implement.

**Builder subagent:** fresh context per Story. The harness decides its scope:

| Harness | Builder runs | Story plan from | Review lenses run by |
| --- | --- | --- | --- |
| Claude Code, Copilot | the whole `bmad-build`: clarify, plan, implement, review, patch, present (**Full build**) | the builder's own Plan phase, approved by the leader | the builder, inside `bmad-build` |
| OpenCode, VS Code Local | `bmad-build` Implement phase only, from the approved plan (**Phase split**) | the planner | three reviewers the leader dispatches |

The same builder session fixes review, verifier and UAT findings.

**Verifier subagent:** independent of the builder; loads `manual-testing` for UAT and runs the project's gate commands. It owns the UAT cases: if a case is wrong, it fixes the case or harness. If the product is wrong, it records the defect and reports it to the leader; it never edits product code. The same session re-runs after a fix.

**UAT Runner subagent:** runs the UAT cases exactly as written and returns observed output and evidence. Every run gets a fresh session; it is never reused. The verifier spawns it when the harness allows nested agents; otherwise the leader dispatches it. It does not edit product code or test cases.

**Reviewer subagents (three per round):** on a Phase split harness, and on a Full build harness only when the builder's `bmad-build` review did not run its lenses in fresh subagents. Each loads `bmad-code-review` with one lens: Blind Hunter, Edge Cases Hunter, or Verification Gap Finder. Every review round gets three fresh sessions; reviewers are never reused. They do not edit product code. Each lens dispatches with its lens entry from `.leader.json`, else the `reviewer` entry.

**Research subagent:** loads `bmad-deep-recon` for a decision the evidence cannot settle. Returns cited findings.

**Retrospective subagent:** loads `bmad-retrospective` at epic close. Returns sourced findings and action items.

**Correct-course subagent:** loads `bmad-correct-course` and drafts the proposal with evidence. The leader decides detail changes and asks the user for the four approval tiers (Decision ladder).

**`bmad-build-auto`:** one Story per run, unattended. It does not choose the next Story and does not own the backlog. Dispatch one per Story, or use it only after the patterns are stable.

The leader may do a trivial edit. Anything that needs a plan is delegated.

**One writer per tree.** Parallel subagents only with disjoint files or separate worktrees.

**No dispatch tool:** stop and tell the user once. If the user authorizes inline building, record the role change. The leader may then run the gates itself, but it must say the verification was not independent.

**Context budget:** compile one epic context document, verify it is newer than the planning artifacts, and keep a current-situation note. Give each subagent those two, its Story and cited references. Ask for compact reports.

## Build checkpoints

`bmad-build` owns its sequence, its plan gate and its review lenses. Read that skill for them; this playbook does not restate them.

The leader stands in for the human at `bmad-build`'s checkpoints. On Claude Code and Copilot the builder runs the sequence and messages the leader at each checkpoint, then waits; on a Phase split harness the leader owns each checkpoint between phases. The leader handles only the checkpoints:

- approve the plan when `bmad-build` asks;
- answer an intent gap through the decision ladder;
- send a bad plan back to plan; do not patch the diff;
- triage findings: fix now when the Story can prove it, defer only when blocked, or void the work;
- accept a deferral into `deferred_work.md`; never drop it silently.

The builder commits only on its own Story branch or worktree, as `bmad-build` does; it never merges and never pushes. The leader merges after gates, AC check and review, under the Activate contract.

## Session continuity

Each Story gets its own set of agents. Never reuse a session across Stories.

Write the Story id with hyphens in a session name: `builder-2-3`, not `builder-2.3`. On VS Code Local nothing is reused: add the round to every name (`builder-2-3-r2`, `verifier-2-3-r2`).

| Role | Session | Reused within Story |
| --- | --- | --- |
| Planner (Phase split) | `plan-<story>` | Yes |
| Builder | `builder-<story>` | Yes |
| Reviewers (3 per round) | `review-<lens>-r<n>-s<story>` | **No. Fresh every round** |
| Verifier | `verifier-<story>` | Yes |
| UAT Runner | `uat-r<n>-<story>` | **No. Fresh every run** |

The Full build loop (Claude Code, Copilot):

1. The builder runs `bmad-build` from Clarify. At its plan gate it sends the plan to the leader and waits; the leader approves it or returns `bad_plan`.
2. The builder implements, runs `bmad-build`'s three review lenses in fresh subagents, patches, and presents.
3. The verifier runs gates and tests on the presented result.
4. Verifier failures go back to the **same builder session**, which fixes them through `bmad-build`'s patch loop and its review again.
5. The verifier prepares the UAT cases; a **fresh UAT Runner session** runs them. A wrong case goes to the verifier, which fixes it; a product defect goes to the builder. Each rerun is a new UAT Runner session.

Repeat steps 3–5 until the Story passes.

The Phase split loop (OpenCode, VS Code Local):

1. Planner drafts the plan; the leader approves it.
2. Builder implements.
3. Verifier runs gates and tests.
4. Three fresh reviewers review in parallel, one lens each.
5. Findings go back to the **same builder session** to fix.
6. The **same verifier session** re-runs the gates.
7. A fix round starts a **new set of three reviewers** on the new diff. Close the previous three.
8. The verifier prepares the UAT cases; a **fresh UAT Runner session** runs them.
9. A failed case goes to the **verifier**, which fixes the case or harness, then a **new UAT Runner session** reruns the failed cases. Close the previous runner session.

Repeat 5–9 until the Story passes. Close all remaining sessions when it does.

Reuse is deliberate for the planner, builder and verifier: each keeps its decisions or commands. Reviewers and the UAT Runner are deliberately fresh: each run is judged on the current artifact, not on an earlier judgment.

Start a fresh session mid-Story only when:

- the session has used about 70% of its role's `contextWindow`, or is behaving stale;
- three rounds pass without convergence;
- the work moves to a different failure domain.

Say which, and why, in the report. Record the round count and every reviewer round's session ids.

## Harness mapping

Session reuse differs by harness. Use the one that applies.

| Harness | Start | Continue | End |
| --- | --- | --- | --- |
| OpenCode | `subagent` tool; save the returned `sessionID` | call `subagent` again with that `sessionID` | no explicit stop; the session idles and is reused when needed |
| Claude Code | start an agent-team teammate for the role | send the next instruction to the same teammate; it stays awake between turns | shut the teammate down manually when the Story passes |
| VS Code Local | `runSubagent` (tool set `agent`) | not possible: every call is fresh; send the next round to a new subagent with the previous report | ends when the call returns |
| Copilot | `task` tool with `mode: "background"`; keep the returned agent id | `write_agent` to that id; `read_agent` for its output | the agent ends with the leader's session; do not carry it into the next Story |

OpenCode rules:

- One `sessionID` per persistent role: planner, builder, verifier. Reviewers and the UAT Runner are new sessions each round or run.
- Round 2 and later reuse the id for planner, builder, verifier and UAT Runner. Reviewers are new each round.
- A fresh subagent is correct only for a new Story, or when the session is exhausted or stale.
- Nested dispatch is not available in OpenCode subagents (verified on v2.2.5). The leader dispatches the UAT Runner; the verifier sends rerun requests through the leader.
- Do not rely on the builder spawning reviewers. Run `bmad-build` with its review skipped or light, then dispatch the three reviewers yourself.
- If true nesting is unavoidable, a subagent may shell out to `opencode run --agent build --model <provider/model>`. That starts a new top-level session, not a child: it costs a second context and needs `--session` to continue. Use it only as a fallback.

Claude Code rules:

- Use the Full build: one builder teammate runs the whole `bmad-build`. Never brief it for a single phase.
- Keep two persistent teammates per Story: builder and verifier. Start one UAT Runner each run, and three reviewers only for the fallback in Full build; shut each down when it finishes.
- Hand the next instruction to the same teammate; do not respawn it.
- Shut each teammate down when the Story passes or is abandoned. Do not carry teammates into the next Story.

Copilot rules (CLI, app, VS Code Copilot harness):

- Use the Full build, as on Claude Code. Subagents can start their own subagents (default depth limit 4, setting `subagents.maxDepth`); leader → builder → lens uses two levels. Verified on Copilot CLI 1.0.105; the app and the VS Code Copilot harness run the same runtime, and the lens session ids in the builder's report confirm it per run.
- Start the builder and verifier with `task` in `mode: "background"`, so fix rounds continue through `write_agent`. A synchronous `task` call returns no reusable id and starts fresh each time.
- Set per-role models with `/subagents`, the `subagents.agents.<name>` setting (model, effort level, context tier), or a custom agent's `model:` and `reasoning-effort:` fields (`.github/agents/*.agent.md`), and name model and effort in every brief; the builder names each lens's model the same way in the lens prompt.
- Put the session name (`builder-2-3`) in the `task` description, and record the returned agent id next to it.
- One-time agents (UAT Runner, fallback reviewers) may use a synchronous `task` call.
- Agent ids live only as long as the leader's session. Record each id in the current-situation note; after a leader restart, start fresh sessions with a handoff note.
- A background agent cannot message the leader mid-turn. At each `bmad-build` gate the builder ends its turn with the question or plan; the leader reads it with `read_agent` and answers with `write_agent`.
- A `GH_TOKEN` or `GITHUB_TOKEN` without the Copilot Requests permission overrides the Copilot login and fails authentication; unset it for the leader's session.

VS Code Local rules:

- Use the Phase split, as on OpenCode. A Local subagent is stateless: the leader cannot send it a follow-up, and it cannot ask the leader a question mid-run. A Full build needs both.
- Every round is a fresh subagent. Pass the approved plan, the previous report and the findings in the brief; record that sessions were not reused.
- Nesting is off by default (`chat.subagents.allowInvocationsFromSubagents`, maximum depth 5). Leave it off: the leader dispatches the reviewers and the UAT Runner itself.
- Set models with the custom agent's `model:` field or the model passed to `runSubagent`. `reasoning-effort:` does not apply to Local subagents; name the effort in the brief anyway.

Nested agents:

- If the verifier can spawn a subagent, it spawns the UAT Runner and keeps its id.
- If it cannot, the leader dispatches the UAT Runner, and the verifier sends the rerun request through the leader.
- Either way, the verifier owns the UAT case fix; the runner only runs cases.

No reuse support: fall back to fresh agents per round, and say so in the report.

## Full build (Claude Code, Copilot)

On Claude Code and Copilot one builder runs `bmad-build` end to end, as its docs describe. The leader does not split it. `bmad-build`'s review works best when the builder can spawn subagents; when it cannot, the fallback rule below applies.

| `bmad-build` step | Who | Leader does |
| --- | --- | --- |
| Clarify and route | Builder | Answers an intent gap through the Decision ladder |
| Plan, approved plan | Builder writes; leader approves | Runs the `Approve a plan` checks; returns `bad_plan` with reasons |
| Implement | Builder | — |
| Fits AC? | Builder | — |
| Review: three lenses | Builder spawns three fresh subagents, one lens each, with the lens entries from `.leader.json` | Reads the findings and the lens session ids in the report |
| Patch, reject, defer | Builder | Confirms each deferral has a blocker and goes to `deferred_work.md` |
| Present, result | Builder presents; leader accepts | Sends the result to the verifier |

Rules:

- Brief the builder from `## Builder brief (Full build)` in `references/briefs.md`. Name `bmad-build`; never name a single phase, and never ask it to skip review.
- The builder treats the leader as the user: at every `bmad-build` question or gate it messages the leader and waits.
- The builder's report lists the three lens session ids. A review run inline in the builder's own context, or with fewer than three lenses, is not independent: the leader then dispatches the three reviewers itself, as in Phase split.
- The verifier and UAT Runner stay separate from the builder. `bmad-build`'s own tests do not replace them.

## Phase split (OpenCode, VS Code Local)

OpenCode has no nested subagents, and VS Code Local subagents are stateless, so the leader runs `bmad-build` as separate phases instead of one long subagent.

| `bmad-build` phase | Owner | Session |
| --- | --- | --- |
| Clarify and route | Leader | — |
| Plan | Planner subagent | `plan-<story>` |
| Approved plan | Leader | — |
| Implement | Builder subagent | `builder-<story>` |
| Fits AC? | Leader, using verifier evidence | — |
| Review | Three fresh reviewer subagents, one lens each | `review-<lens>-r<n>-s<story>` |
| Patch | Builder | `builder-<story>` |
| Present and result | Leader | — |
| Defer | Leader writes `deferred_work.md` | — |

Rules:

- Give each phase only its scope: plan-only, implement-only, one review lens.
- Do not ask one subagent to run the whole workflow.
- The leader keeps every checkpoint: clarify, approve, fit, route, present.
- Other jobs — gates, UAT, research, retrospective, correct-course — go to their own subagents.

## Fix before defer

Best effort means close what can be closed now. For every bug, review finding or deferred item:

1. **Inside this Story and provable now** — dispatch the builder to fix it before the Story closes.
2. **Unrelated but small and low risk** — fix it in the same Story after the AC pass, as its own commit.
3. **Defer only when** another Story must land first, the user must act, a credential is missing, it is out of MVP scope, or it needs a correct-course design change.

Every deferral names its blocker and the condition that unblocks it. "Not now" is not a reason.

At Story close, re-read the deferred list. At epic close, sweep it: dispatch fixers for every item now actionable. Deferred work compounds; leaving fixable work behind lowers quality.

## Decision ladder

Run in order. Stop at the first answer.

1. **Evidence:** intent, PRD, spine, technical design, code. Cite `file:line`.
2. **Research:** a subagent using `bmad-deep-recon`. Sanitized question; never send secrets, config files or customer data.
3. **User:** last resort, and only for a reason in the list below. Batch every open question into one message, give options, recommend one.

### Bias to decide

Decide by default. A decision the leader can defend from evidence is cheaper than a question, and it keeps the build moving.

- Take the smallest reversible step, write the assumption where the next reader will see it, and continue. If the assumption proves false, correct it at the next checkpoint.
- When two options are equally defensible, pick the one that is easier to undo and say so in the record.
- When the evidence is thin, research first (step 2). A question is not a substitute for reading.
- When a document already answers the question, use the answer; do not ask again to confirm.

Ask only for one of these:

| Reason | Example |
| --- | --- |
| An approval tier changes (below) | A requirement's behaviour changes |
| Evidence genuinely conflicts, and research did not settle it | Two documents state different owners for one record |
| An action is irreversible or destructive outside the repo | Deleting a branch, rotating a key, merging to `main` |
| A credential, budget or access right is missing | No GitHub token, budget spent |
| A `NOT RUN` UAT case needs a human | An OS permission prompt, a physical device |

Everything else: decide, record, continue. One message per batch of open questions; never one question per item.

### Approval tiers

Ask the User before changing one of these. Everything else is the leader's call.

| Tier | Ask when the change alters | Example |
| --- | --- | --- |
| Intent | Goal, users, scope, non-goals, success measures | Dropping a User journey, adding a second User |
| PRD direction | A requirement's behaviour, a promise, a requirement added or removed | "Drafts are no longer saved automatically" |
| Architecture | An AD, a component boundary, a data flow, a technology choice | Moving validation from the API to a background worker |
| Technical design contract | ERD, API or interface shape, a stored record contract, a security boundary | Renaming `request_id`, changing a method's fields, a new table |

Detail changes need no approval. The leader decides, records the evidence, and moves on:

- wording, examples, cross-references, diagrams;
- a value the parent document leaves open inside a stated boundary, such as a timeout, a name, a default, a page size;
- an additive item that changes no existing contract: **a new error code**, a new log line, a metric, an internal helper, a test;
- a validation the documented rule already implies.

### Boundary test

A change is detail when all three answers are yes, with a citation for the first:

1. **Is there a line in an approval-tier document that states the boundary?** Quote it with `file:line`. No line means no boundary, so ask.
2. **Does the change stay inside that boundary?** It removes nothing another part or the User relies on, and renames nothing.
3. **Would a reader of the PRD or the architecture change what they expect?** If yes, it is a direction change.

Record every detail change in the correct-course proposal with `tier: detail`, its boundary citation, and what was chosen. The proposal still gets written; only the approval step is skipped.

Never decide silently when two documents conflict. A conflict is an evidence failure, not a detail choice: ask.

## Change control

Planning documents are the contract. "The design does not match the code" means the code is incomplete until proven otherwise.

Use `bmad-correct-course` for a design or planning-document correction. Use `bmad-create-epics-and-stories` when the Epic or Story breakdown itself must be re-sliced. The correct-course subagent drafts the proposal with evidence; the leader decides detail changes and asks the user for the four approval tiers above. Change the smallest clause and check it against the intent.

Never hand-edit an approval-tier clause: it waits for the user's approval. A detail edit goes through the proposal file with its boundary citation. Never delete a requirement to unblock a diff.

**Every correct-course writes its proposal where `bmad-correct-course` writes it (its planning-artifacts folder, written `<planning-artifacts>` below), plus one review copy:**

| File | Reader | Holds |
| --- | --- | --- |
| `<planning-artifacts>/sprint-change-proposal-<date>[-<slug>].md` | The leader, and the record | The proposal: each clause with `file:line`, exact OLD → NEW text, evidence, owner Story, and whether it blocks |
| `<planning-artifacts>/sprint-change-proposal-<date>[-<slug>].html` | The User, for review | The review pack: same clauses, readable in minutes, with before/after diagrams, impact, and the decisions marked |

The `.md` is the skill's default output name; never rename it to `correct-course-*.md`. The `.html` sits beside it with the same basename. Example: `sprint-change-proposal-2026-11-03-epic-4-scope.md` and `.html`. Build the `.html` from `assets/review-pack.template.html`; the rules are in `references/review-pack.md`.

## Review pack

A change batch the User must read gets one HTML review pack. Build it from the template, not from scratch.

- **Structure:** Overview, Purpose, Behaviour changes, Document-only changes, Impact, Process before and after, What it enables, Decisions, collapsed Appendix.
- **Highlight is an inline mark**, never a summary: colour, bold, badge, or label on the existing sentence.
- **Before and after are two complete diagrams** with the same steps and layout. Never one diagram annotated with only the delta.
- **Diagram medium follows the model.** On **Opus 5.5**, draw diagrams as inline SVG. On every other model, draw them as ASCII inside `<pre>`. The SVG rules are in `references/review-pack.md`; the template carries a commented SVG skeleton.
- **Every `Where` carries `path:line` plus a plain description.**
- **Every item that needs the User carries a `your decision` badge** and a review row (checkbox plus accept / reject / discuss, saved in the browser).
- **Every specialist term gets a tooltip on first use.** The tooltip is the only definition; do not add a glossary section.
- **Neutral tone.** No pitch, no "the value is", no "smooth".

Template: `assets/review-pack.template.html`. Worked example: `assets/review-pack.example.html`. Rules, mark vocabulary and pre-link checks: `references/review-pack.md`.

## Route a failure

```text
Spec ---> Code ---> Test ---> UAT
 ^                              |
 +--------- Fix Spec <----------+
```

Before fixing, name the wrong layer:

| Evidence | Wrong layer | Action |
| --- | --- | --- |
| Code matches the spec, result is wrong | Spec | Correct the spec first, then the code |
| Code contradicts a correct spec | Code | Send it back to the builder |
| UAT shows a product defect | Code | Verifier records a defect report; leader dispatches the builder |
| Test asserts the wrong thing | Test | Fix the test; prove it fails for the right reason |
| Cannot observe the result | Harness | Fix the harness, or mark `UNOBSERVED` |

Patching code to satisfy a wrong spec hides the defect.

## Verify and close

Per Story:

1. **Plan approved** — for a planned Story, the plan `bmad-build` writes; for an unplanned requirement, the `bmad-spec` file first. It names files, tasks, tests, AC mapping and open questions answered. Apply the `Approve a plan` checks against intent, PRD, spine and design before approving. Before approving, read the deferred-work file. Include every item this Story unlocks; keep the rest deferred with a one-line reason.
2. **Build complete** — one subagent, one Story, no shared tree.
3. **Gates run by the verifier subagent** — independent of the builder. It pastes counts, not exit codes, and falsifies: remove a guard or delete the tests and confirm red.
4. **AC check by the verifier** — every criterion maps to a named test. The leader reads the mapping and spot-checks one row.
5. **Review ran** — on a Full build harness this happens inside the builder, before the verifier's gates. Three fresh reviewers, one lens each: Blind Hunter, Edge Cases Hunter, Verification Gap Finder. On a Full build harness they are the lenses `bmad-build` spawned, with their session ids in the builder's report. On a Phase split harness, or when `bmad-build` ran fewer than three lenses or ran them in its own context, the leader dispatches three fresh reviewer subagents in parallel (`bmad-code-review`). No review means no close. If no independent review is possible, label it `review unavailable`; do not call it reviewed.
6. **Fix loop** — findings go back to the same builder session. The same verifier re-runs gates. After a fix, the review runs again with **three new reviewers**: `bmad-build`'s lenses on a Full build harness, leader-dispatched on a Phase split harness. Repeat until pass.
7. **UAT** — the verifier prepares the cases from the AC and design; a fresh UAT Runner session runs them. Triage a failure:
   - **Case wrong** — the verifier fixes the case or harness, then a new UAT Runner session reruns the failed cases.
   - **Product wrong** — the verifier records a defect report and sends it to the leader. The leader dispatches the builder to fix it; a new UAT Runner session reruns afterwards. The verifier never edits product code.
   Mark each case `PASS`, `FAIL`, `NOT RUN` (name what is missing) or `BLOCKED` (the case does not apply to this Story, and why). The product's own report is not the observation; the runner's captured output is.
8. **Commit** — after gates, AC check and review pass, commit and merge the Story branch under the Activate contract. Conventional Commits; no attribution trailer; no push unasked. Then start the next Story without asking.

## Epic rhythm

1. The planner subagent compiles or refreshes the epic context and Story order; the leader approves them.
2. Build Stories in dependency order, one at a time. After each verified Story, commit, merge and continue without asking.
3. Verify the Stories together, not only one by one.
4. Sweep `deferred_work.md`: dispatch fixers for every item now actionable; keep only the truly blocked ones.
5. The retrospective subagent runs `bmad-retrospective` from the plans and evidence; the leader reviews its findings.
6. The correct-course subagent drafts the proposal for the accepted actions; the leader approves detail changes and asks the user for approval-tier changes.
7. Report the epic table.

If the user explicitly waives the retrospective, write a close evidence note and state the skipped risk.

## Non-negotiables

These survive every deadline and every "no process theater":

1. Commit and merge only after gates, AC check and review pass, under the Activate contract. Push and history rewrite need separate approval.
2. Plan, build, verify, retrospective, correct-course and research run in subagents. The leader approves and commits.
3. One writer per tree; one Story per subagent.
4. Independent review, or an explicit `review unavailable`.
5. Retrospective, or a recorded waiver.
6. Falsifiable gates with counts. Exit 0 alone proves nothing.
7. No approval-tier edit without a correct-course proposal and the user's approval; a detail edit needs the proposal and its boundary citation, not approval.
8. Fix before defer: resolve what the current Story and harness can prove; defer only with a named blocker and unblock condition.
9. Decide by default. Ask the user only for the five reasons in the Decision ladder, batched into one message.

| Excuse | Reality |
| --- | --- |
| "No time for process theater" | Review is the defect filter. Skip it and the demo carries the defect. |
| "Just get it done and merged" | Conditional on done. Done needs counts and a red mutation; merge follows only after that. |
| "The client deadline is close" | Deadline shortens nothing in the gate. Commit and continue; do not skip review. |
| "Don't message me for progress" | That grants autonomy, not permission to skip gates. Report once at the end. |
| "I should ask before committing" | Ask once at Activate. Per-Story approval prompts break the loop. |
| "Better to ask than assume" | Ask only for the five reasons above. A defensible assumption, recorded, is the faster path. |
| "No subagent tool, so I built it myself" | Tell the user once. Silent role change removes the independent check. |
| "Self-review is enough" | The builder reviews its own assumptions. Use the lenses or say unavailable. |
| "Defer it; a later Story can fix it" | Deferred work compounds. Fix what this Story can prove now; name a real blocker before deferring. |
| "The tests pass" | Zero tests also exit 0. Require counts and one mutation that goes red. |

## Report

Every report is a table plus three lines: what is verified, what is unverified, what needs the user.

Stop and ask only for the five reasons in the Decision ladder: an approval tier, an evidence conflict research cannot settle, an irreversible external action, a missing credential or budget, or a `NOT RUN` UAT case that needs a human.

## Red flags

- Editing an approval-tier document without a proposal and the user's approval.
- Asking the user to approve a detail that a cited boundary already decides.
- Asking a question a document in the evidence already answers.
- Committing or merging before gates, AC check and review pass.
- Pushing or rewriting history without separate approval.
- Asking to start the next Story after activation.
- Accepting "done" with no counts.
- Two subagents writing one tree.
- Deciding before searching the evidence.
- Slicing Stories that `bmad-create-epics-and-stories` owns.
- Patching a diff when the plan is wrong.
- Marking UAT PASS from the product's own output.
- Calling a level `BLOCKED` when it lacks setup, a harness or a credential. That is `NOT RUN`.
- An Activate message without the filled-in pyramid diagram.
- Leaving a test VM or emulator running.
- Dispatching a role without the `model` and `effort` from `.leader.json`.
- Asking the preset question when a valid `.leader.json` exists.
- On Claude Code or Copilot, briefing the builder for one `bmad-build` phase, or telling it to skip review.

## References

- Planning, Epic and Story breakdown: `bmad-prd`, `bmad-create-epics-and-stories`, `bmad-spec`
- Order and status: `bmad-sprint-planning`
- Build run: `bmad-build`, `bmad-build-auto`
- Close: `bmad-retrospective`, `bmad-correct-course`

Brief, report and decision-log templates: `references/briefs.md`.
Review pack template: `assets/review-pack.template.html`; worked example: `assets/review-pack.example.html`; rules: `references/review-pack.md`.
Agent config: presets `assets/leader-presets.json`; schema and harness mapping `references/agent-config.md`.
