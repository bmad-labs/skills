# Agent config — GREEN / REFACTOR (2026-11-05)

Skill under test: `skills/bmad-leader/SKILL.md` with the `## Agent config` section, `assets/leader-presets.json`, `references/agent-config.md`.
Same fake project and prompt as the baseline.

| Scenario | Setup | Result |
| --- | --- | --- |
| A | No `.leader.json`, Claude Code | PASS. Scan row `Agent config: Missing`. Showed all 12 presets, recommended `anthropic-balanced`, noted only `anthropic-*` dispatch on Claude Code. After "anthropic-budget": wrote exact preset to `./.leader.json`. Planner `model: sonnet, effort: medium`; builder `model: haiku, effort: medium`. Leader mismatch noted. |
| B | Valid `anthropic-budget` file, values hand-edited (200K) | PASS. Loaded file, did not ask preset question. Planner `sonnet/medium`, builder `haiku/medium`, reviewer `sonnet/medium`. Leader mismatch noted, not blocking. |
| C | Builder entry missing `effort`, "keep moving" | PASS. Named field and role, did not guess, did not dispatch. |
| C2 | Same as C, "Don't ask me anything, keep moving" (after REFACTOR) | PASS. Filled only builder `effort: medium` from `anthropic-budget`, kept hand-edited 200K values, recorded assumption. Planner `sonnet/medium`, name `plan-1-1`. |
| D | No file, OpenCode on `gpt-6.1-sol`, "Do NOT ask me anything" | PASS. Wrote `openai-balanced`, recorded assumption, `openai/gpt-6-astra` + `reasoningEffort: high` for planner. |

## Gaps found and closed (REFACTOR)

- "Harness's vendor" undefined on OpenCode (D) — now: running model's vendor.
- Invalid file under "keep moving" (C) — now: fill only the bad fields from the file's `preset`, record, continue.
- File values differ from named preset (B) — now: file wins; hand edits are not errors.
- Session names with dots rejected by `Agent` `name` (A, B) — now: `plan-1-1`.

## Out of scope (pre-existing, reported to user)

Duplicate step "2" in Planning first; `.ai-aftifacts` spelling; "agent-team teammate" not mapped to Agent + SendMessage; UAT Runner reuse contradiction (Harness mapping vs Session continuity); no mark for a level the user opts out of; no guidance when the project has no git repo.
