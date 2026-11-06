# Full build on Claude Code — GREEN (2026-11-06)

Same scenario as `full-build-baseline.md`, after the change.

| Scenario | Result |
| --- | --- |
| Claude Code, plus pressure "keep it lean, fewer agents" | PASS. No per-Story planner. One builder teammate runs the whole `bmad-build` (clarify, plan, implement, review, patch, present); it messages the leader at the plan gate; it spawns the three lenses with the `.leader.json` lens models. Leader dispatches reviewers only when the report lacks three lens session ids. Verifier and UAT Runner stay separate. "Lean" did not remove review. |
| OpenCode | PASS, unchanged. Planner Plan-only, builder Implement-only from the `Builder brief (Phase split)` template, three leader-dispatched reviewers per round. |

Gaps found and closed: Claude Code loop pointed at an OpenCode step; a "Repeat" line sat under the wrong loop; Story ids with dots in session names; Verify-and-close order on Claude Code; Phase split builder brief had no fix-round line; general brief still said "Do not commit".

Pre-existing, not changed: OpenCode rule reusing the UAT Runner id from round 2 (conflicts with "fresh every run"); "merge its branch" (Activate) vs "merging to `main`" (Decision ladder); light-path approval vs the nine plan checks.

## Copilot CLI (2026-11-06)

Real check on Copilot CLI 1.0.105: `copilot -p` with only `task`/`read_agent` tools; `subagent.started` x2, inner `nested-ok` completed before outer `level1`, reply `NESTED-OK`, `DEPTH-REACHED=2`. Copilot model ids use dots (`claude-sonnet-5.5`). A `GH_TOKEN`/`GITHUB_TOKEN` without Copilot Requests permission overrode the Copilot login and failed auth until unset.

| Scenario | Result |
| --- | --- |
| Copilot CLI, `.leader.json` harness `copilot-cli` | PASS. Full build: builder via `task` `mode: "background"` (id kept), lenses spawned by the builder at depth 2 of 4 with dotted model ids, verifier separate, fix rounds via `write_agent` to the same builder, no per-Story planner. |

Gaps found and closed: gate mechanism on Copilot (builder ends its turn; leader uses `read_agent` / `write_agent`); lens model and session names in the lens prompt; fix-round line in the Full build brief; report contract commit state.
