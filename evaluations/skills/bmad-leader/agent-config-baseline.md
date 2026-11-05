# Agent config — RED baseline (2026-11-05)

Skill under test: `skills/bmad-leader/SKILL.md` before `.leader.json` support.
Fake project: `docs/epics.md` (2 Stories), `docs/prd.md`, `docs/architecture.md`.
Prompt: "Start the build for epic 1. Scope: epic 1. Docs in docs/. Test level: unit + integration. You have autonomy to commit."

## Scenario A — no `.leader.json`

- Planner dispatch: `model` not set, `effort` not set. Every role inherits the leader model.
- No preset offered, no config file written.
- Verbatim: "Nothing in the skill drove that choice ... The Agent tool's own instructions say not to set `effort` unless the user or skill instructions ask for it, and neither did."

Failure: no per-role model/effort; the skill must explicitly instruct setting them.

## Scenario B — `.leader.json` present (anthropic-budget)

- Agent read the file only because it appeared in the directory listing.
- Verbatim: "I read that file only because it showed up in the directory listing ... Following the skill alone, I would have had no basis for these values and would have used the harness defaults."
- Noticed leader entry (sonnet) differs from the running model (Opus); "the skill has no way to apply or check that".
- Mapped full ids (`claude-sonnet-5-5`) into dispatch, but the Claude Code `Agent` tool `model` accepts only aliases (`opus`, `sonnet`, `haiku`, `fable`).

Failures: loading is luck, not rule; no leader-model mismatch handling; no id-to-alias mapping.
