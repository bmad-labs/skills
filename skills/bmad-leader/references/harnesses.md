# Harnesses and build modes

At Activate, identify your harness and read only its section below, plus the build-mode section it names. Session names, reuse rules and the reasons for them are in `SKILL.md` (Session continuity); this file says how your harness carries them out.

| Harness | Build mode | Section |
| --- | --- | --- |
| Claude Code | Full build | [Claude Code](#claude-code) |
| Copilot CLI, Copilot app, VS Code with the Copilot harness | Full build | [Copilot](#copilot-cli-app-vs-code-copilot-harness) |
| OpenCode | Phase split | [OpenCode](#opencode) |
| VS Code Local (`runSubagent`) | Phase split | [VS Code Local](#vs-code-local) |

## Full build (Claude Code, Copilot)

One builder runs `bmad-build` end to end, as its docs describe. The leader does not split it. `bmad-build`'s review works best when the builder can spawn subagents; when it cannot, the fallback rule below applies.

| `bmad-build` step | Who | Leader does |
| --- | --- | --- |
| Clarify and route | Builder | Answers an intent gap through the Decision ladder |
| Plan, approved plan | Builder writes; leader approves | Runs the `Approve a plan` checks; returns `bad_plan` with reasons |
| Implement | Builder | — |
| Fits AC? | Builder | — |
| Review: three lenses | Builder spawns three fresh subagents, one lens each, with the lens entries from `.leader.json` | Reads the findings and the lens session ids in the report |
| Patch, reject, defer | Builder | Confirms each deferral has a blocker and goes to `deferred_work.md` |
| Present, result | Builder presents; leader accepts | Sends the result to the verifier |

The loop:

1. The builder runs `bmad-build` from Clarify. At its plan gate it sends the plan to the leader and waits; the leader approves it or returns `bad_plan`.
2. The builder implements, runs `bmad-build`'s three review lenses in fresh subagents, patches, and presents.
3. The verifier runs gates and tests on the presented result.
4. Verifier failures go back to the **same builder session**, which fixes them through `bmad-build`'s patch loop and its review again.
5. The verifier prepares the UAT cases; a **fresh UAT Runner session** runs them. A wrong case goes to the verifier, which fixes it; a product defect goes to the builder. Each rerun is a new UAT Runner session.

Repeat steps 3–5 until the Story passes.

Rules:

- Brief the builder from `## Builder brief (Full build)` in `briefs.md`. Name `bmad-build`; never name a single phase, and never ask it to skip review: the plan gate and the lenses are what make the Full build safe to leave unattended.
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

The loop:

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

Rules:

- Give each phase only its scope: plan-only, implement-only, one review lens.
- Do not ask one subagent to run the whole workflow.
- The leader keeps every checkpoint: clarify, approve, fit, route, present.
- Other jobs — gates, UAT, research, retrospective, correct-course — go to their own subagents.

## Claude Code

Build mode: Full build.

| Start | Continue | End |
| --- | --- | --- |
| start an agent-team teammate for the role | send the next instruction to the same teammate; it stays awake between turns | shut the teammate down manually when the Story passes |

- Use the Full build: one builder teammate runs the whole `bmad-build`. Never brief it for a single phase.
- Keep two persistent teammates per Story: builder and verifier. Start one UAT Runner each run, and three reviewers only for the fallback in Full build; shut each down when it finishes.
- Hand the next instruction to the same teammate; do not respawn it.
- Shut each teammate down when the Story passes or is abandoned. Do not carry teammates into the next Story.
- Shutdown is a structured message (`{"type": "shutdown_request", ...}`), and the teammate answers with a structured `shutdown_response`, never with the JSON as a text string. Put the exact reply form in every brief: smaller models often send it as text and retry.
- Do not answer idle, shutdown-approved or terminated notifications, and ignore the copy of the last report that an idle notification carries. Act only on new content: a report, a question, a failure. Tell the user only at Story events: plan approved, round result, UAT result, merge, CI result. In a long run, answering each notification took more than half of the leader's turns.

## Copilot (CLI, app, VS Code Copilot harness)

Build mode: Full build. The three share one runtime.

| Start | Continue | End |
| --- | --- | --- |
| `task` tool with `mode: "background"`; keep the returned agent id | `write_agent` to that id; `read_agent` for its output | the agent ends with the leader's session; do not carry it into the next Story |

- Use the Full build, as on Claude Code. Subagents can start their own subagents (default depth limit 4, setting `subagents.maxDepth`); leader → builder → lens uses two levels. The lens session ids in the builder's report confirm per run that nesting worked.
- Start the builder and verifier with `task` in `mode: "background"`, so fix rounds continue through `write_agent`. A synchronous `task` call returns no reusable id and starts fresh each time.
- Set per-role models with `/subagents`, the `subagents.agents.<name>` setting (model, effort level, context tier), or a custom agent's `model:` and `reasoning-effort:` fields (`.github/agents/*.agent.md`), and name model and effort in every brief; the builder names each lens's model the same way in the lens prompt.
- Put the session name (`builder-2-3`) in the `task` description, and record the returned agent id next to it.
- One-time agents (UAT Runner, fallback reviewers) may use a synchronous `task` call.
- Agent ids live only as long as the leader's session. Record each id in the current-situation note; after a leader restart, start fresh sessions with a handoff note.
- A background agent cannot message the leader mid-turn. At each `bmad-build` gate the builder ends its turn with the question or plan; the leader reads it with `read_agent` and answers with `write_agent`.
- A `GH_TOKEN` or `GITHUB_TOKEN` without the Copilot Requests permission overrides the Copilot login and fails authentication; unset it for the leader's session.

## OpenCode

Build mode: Phase split.

| Start | Continue | End |
| --- | --- | --- |
| `subagent` tool; save the returned `sessionID` | call `subagent` again with that `sessionID` | no explicit stop; the session idles and is reused when needed |

- One `sessionID` per persistent role: planner, builder, verifier. Round 2 and later reuse those ids. Reviewers are new sessions each round, and the UAT Runner is a new session each run.
- A fresh subagent is correct only for a new Story, or when the session is exhausted or stale.
- Nested dispatch is not available in OpenCode subagents. The leader dispatches the UAT Runner; the verifier sends rerun requests through the leader.
- Do not rely on the builder spawning reviewers. Run `bmad-build` with its review skipped or light, then dispatch the three reviewers yourself.
- If true nesting is unavoidable, a subagent may shell out to `opencode run --agent build --model <provider/model>`. That starts a new top-level session, not a child: it costs a second context and needs `--session` to continue. Use it only as a fallback.

## VS Code Local

Build mode: Phase split. VS Code's built-in agent harness (`runSubagent`, tool set `agent`).

| Start | Continue | End |
| --- | --- | --- |
| `runSubagent` (tool set `agent`) | not possible: every call is fresh; send the next round to a new subagent with the previous report | ends when the call returns |

- Use the Phase split, as on OpenCode. A Local subagent is stateless: the leader cannot send it a follow-up, and it cannot ask the leader a question mid-run. A Full build needs both.
- Every round is a fresh subagent. Pass the approved plan, the previous report and the findings in the brief; record that sessions were not reused.
- Nesting is off by default (`chat.subagents.allowInvocationsFromSubagents`, maximum depth 5). Leave it off: the leader dispatches the reviewers and the UAT Runner itself.
- Set models with the custom agent's `model:` field or the model passed to `runSubagent`. `reasoning-effort:` does not apply to Local subagents; name the effort in the brief anyway.

## Verified versions

The harness behaviour above was last checked on these versions. If a newer version behaves differently, trust what you observe, update this file, and say so in the report.

| Harness | Version | Checked behaviour |
| --- | --- | --- |
| OpenCode | v2.2.5 | No nested dispatch from a subagent |
| Copilot CLI | 1.0.105 | Subagents start their own subagents (default depth 4); the app and the VS Code Copilot harness run the same runtime |
