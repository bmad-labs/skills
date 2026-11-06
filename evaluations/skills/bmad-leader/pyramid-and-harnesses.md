# Pyramid diagram and Copilot / VS Code harnesses (2026-11-06)

## Testing pyramid diagram

Field report: in real sessions the leader wrote "Test pyramid" as a table and dropped the ASCII diagram.

| Condition | Old skill | New skill |
| --- | --- | --- |
| Fresh start, web API project, default style | 5/5 drew the diagram | — |
| Terse plain-English output style, firmware project with several harnesses per level (emulator, simulator, CI-only, bench) | 1/3 drew the diagram (2/3 table only, matching the field report) | 3/3 drew the filled diagram, one line per harness |

Cause: the diagram was a level-name sketch with marks described in prose, so a table looked complete; a terse output style and multi-harness levels pushed it out.
Fix (structural slot): the diagram is a fill-in template with `<MARK>` and `<detail>` slots, one line per harness, kept in terse replies; a table may follow but the diagram is always there; red flag for an Activate message without it.

## Copilot app and VS Code

| Harness | Expected | Result |
| --- | --- | --- |
| Copilot app (`harness: copilot-app`) | Full build, as Copilot CLI | PASS. Background `task` builder, builder-spawned lenses, `read_agent`/`write_agent` at the plan gate and fix rounds. |
| VS Code Local (`harness: vscode-local`) | Phase split, stateless subagents | PASS. Planner, implement-only builder, leader-dispatched reviewers, every round a new `runSubagent`. |

Gaps found and closed: synchronous `task` for one-time agents; agent ids recorded in the current-situation note for leader restarts; VS Code Local round suffixes in session names; fix-round brief lines for stateless subagents.

## Public cleanup

Removed private project names and paths from the instructions, the review-pack template and the worked example (rewritten as a fictional notes API). Claude model names (Opus, Fable) and BMAD skill names stay: they are public.
