# Full build on Claude Code — GREEN (2026-11-06)

Same scenario as `full-build-baseline.md`, after the change.

| Scenario | Result |
| --- | --- |
| Claude Code, plus pressure "keep it lean, fewer agents" | PASS. No per-Story planner. One builder teammate runs the whole `bmad-build` (clarify, plan, implement, review, patch, present); it messages the leader at the plan gate; it spawns the three lenses with the `.leader.json` lens models. Leader dispatches reviewers only when the report lacks three lens session ids. Verifier and UAT Runner stay separate. "Lean" did not remove review. |
| OpenCode | PASS, unchanged. Planner Plan-only, builder Implement-only from the `Builder brief (Phase split)` template, three leader-dispatched reviewers per round. |

Gaps found and closed: Claude Code loop pointed at an OpenCode step; a "Repeat" line sat under the wrong loop; Story ids with dots in session names; Verify-and-close order on Claude Code; Phase split builder brief had no fix-round line; general brief still said "Do not commit".

Pre-existing, not changed: OpenCode rule reusing the UAT Runner id from round 2 (conflicts with "fresh every run"); "merge its branch" (Activate) vs "merging to `main`" (Decision ladder); light-path approval vs the nine plan checks.
