# Agent config (`.leader.json`)

The project-root file `.leader.json` fixes the model, effort and context window for every role. The leader writes it once from a preset and reads it on every later run. Commit it; the team shares it.

## Schema

```json
{
  "version": 1,
  "preset": "anthropic-balanced",
  "vendor": "anthropic",
  "harness": "claude-code",
  "agents": [
    { "name": "leader", "model": "claude-opus-5-5", "effort": "high", "contextWindow": 1000000 },
    { "name": "builder", "model": "claude-sonnet-5-5", "effort": "high", "contextWindow": 1000000 }
  ]
}
```

| Field | Rule |
| --- | --- |
| `version` | `1` |
| `preset` | The preset id it came from, or `custom` after a hand edit |
| `vendor` | `anthropic`, `openai`, `deepseek`, `google` |
| `harness` | `claude-code` or `opencode`; the harness the leader runs in |
| `agents[].name` | One of the 9 roles: `leader`, `planner`, `builder`, `verifier`, `uat-runner`, `reviewer`, `research`, `retrospective`, `correct-course` |
| `agents[].model` | Vendor model id, without a provider prefix |
| `agents[].effort` | `low`, `medium`, `high`, `xhigh`, `max` |
| `agents[].contextWindow` | Tokens, positive integer |

Valid means: JSON parses, every field above is present with an allowed value, every role appears exactly once. A missing role is invalid, not a fallback.

## Presets

`assets/leader-presets.json` holds 12 presets: 4 vendors x 3 tiers. Each preset lists all 9 roles.

| Tier | Shape |
| --- | --- |
| `quality` | Strongest model for every role |
| `balanced` | Top model for leader, planner, verifier, reviewer; mid model builds and researches; small model runs UAT |
| `budget` | Mid model for leader, planner, reviewer; small model elsewhere |

| Vendor | Top | Mid | Small |
| --- | --- | --- | --- |
| anthropic | `claude-opus-5-5` (quality uses `claude-fable-5-1` for leader, planner, reviewer) | `claude-sonnet-5-5` | `claude-haiku-5-5` |
| openai | `gpt-6-astra` | `gpt-6.1-sol` | `gpt-6-luna` |
| deepseek | `deepseek-flash` (V4.1) | `deepseek-flash` (V4.1) | `deepseek-flash` (V4.1); tiers differ by effort only |
| google | `gemini-4-argon` | `gemini-3.8-flash` | `gemini-3.5-flash-lite` |

Model ids were checked on 2026-11-05 (`checked` in the preset file). If a dispatch fails with an unknown-model error, look up the current id with `context7-mcp` or the vendor docs, fix `.leader.json`, and set `preset` to `custom`.

## Harness mapping

**Claude Code** — the `Agent` tool takes a model alias, not an id. Pass `effort` explicitly on every dispatch; the tool does not set it unless asked.

| `model` in file | `Agent` `model` |
| --- | --- |
| `claude-fable-*` | `fable` |
| `claude-opus-*` | `opus` |
| `claude-sonnet-*` | `sonnet` |
| `claude-haiku-*` | `haiku` |

The `Agent` `name` allows no dots: write session names as `plan-1-1`, not `plan-1.1`.

Claude Code dispatches only Anthropic models. A non-Anthropic preset under `harness: claude-code` is invalid: tell the user and offer an Anthropic preset or OpenCode.

**OpenCode** — model is `<vendor>/<model>`, for example `openai/gpt-6.1-sol`, `deepseek/deepseek-flash`, `google/gemini-4-argon`. Set effort through the provider option (`reasoningEffort`) or a named variant.

Effort per vendor, when the vendor does not accept a value:

| Vendor | Accepts | Map |
| --- | --- | --- |
| anthropic | all five | as is |
| openai | all five | as is |
| deepseek | `low`, `high`, `max` | `medium`, `xhigh` to `high` |
| google | `low`, `medium`, `high` | `xhigh`, `max` to `high` |

## Leader entry

The leader cannot change its own model mid-session. At Activate, compare the `leader` entry with the running model. On a mismatch, say so in one line and tell the user to restart on the configured model (`/model` in Claude Code, `--model` in OpenCode). Do not block the build for it.

## Context window

`contextWindow` drives the "out of context" rule in Session continuity. A persistent session (planner, builder, verifier) that has used about 70% of its role's window gets a fresh session with a handoff note. Record the switch in the report.

## Change the preset later

When the user asks to switch preset or change a role: show the old and new rows that differ, rewrite `.leader.json` after the user agrees, and use it from the next dispatch. A hand edit sets `preset` to `custom`. A leader fill of a missing field from the named preset keeps the `preset` value.
