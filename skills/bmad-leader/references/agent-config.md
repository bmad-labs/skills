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
| `harness` | `claude-code`, `copilot-cli` or `opencode`; the harness the leader runs in |
| `agents[].name` | One of the 9 required roles: `leader`, `planner`, `builder`, `verifier`, `uat-runner`, `reviewer`, `research`, `retrospective`, `correct-course`; or one of the 3 optional `bmad-build` review lenses: `blind-hunter`, `edge-cases-hunter`, `verification-gap-finder` |
| `agents[].model` | Vendor model id, without a provider prefix |
| `agents[].effort` | `low`, `medium`, `high`, `xhigh`, `max` |
| `agents[].contextWindow` | Tokens, positive integer |

Valid means: JSON parses, every field above is present with an allowed value, every required role appears exactly once, each lens appears at most once, and no other name appears. A missing required role is invalid, not a fallback.

## Review lenses

`bmad-build` reviews through three lenses, each a fresh `bmad-code-review` subagent: Blind Hunter (any ten things to fix), Edge Cases Hunter (forgotten corner cases), Verification Gap Finder (is it covered by tests). The `reviewer` entry is the default for all three. A lens entry, when present, overrides `reviewer` for that lens only.

| Dispatch | Uses |
| --- | --- |
| Blind Hunter | `blind-hunter`, else `reviewer` |
| Edge Cases Hunter | `edge-cases-hunter`, else `reviewer` |
| Verification Gap Finder | `verification-gap-finder`, else `reviewer` |

A file written before the lenses existed stays valid; its three lenses use `reviewer`. Do not add lens entries to an existing file unless the user asks.

## Presets

`assets/leader-presets.json` holds 12 presets: 4 vendors x 3 tiers. Each preset lists the 9 required roles and the 3 lenses. Verification Gap Finder runs one model step lower than the other two lenses: checking test coverage needs less reasoning than hunting defects.

| Tier | Shape |
| --- | --- |
| `quality` | Strongest model for every role |
| `balanced` | Top model for leader, planner, verifier, reviewer; mid model builds and researches; small model runs UAT |
| `budget` | Mid model for leader, planner, reviewer; small model elsewhere |

| Vendor | Top | Mid | Small |
| --- | --- | --- | --- |
| anthropic | `claude-opus-5-5` (quality uses `claude-fable-5-1` for leader, planner, reviewer) | `claude-sonnet-5-5` | `claude-haiku-5-5` |
| openai | `gpt-6-astra` | `gpt-6.1-sol` | `gpt-6-luna` |
| deepseek | `deepseek-v4.1-flash` | `deepseek-v4.1-flash` | `deepseek-v4.1-flash`; tiers differ by effort only |
| google | `gemini-4-argon` | `gemini-3.8-flash` | `gemini-3.5-flash-lite` |

All three `anthropic-*` presets run `uat-runner` on `claude-sonnet-5-5`, whatever the tier.

`deepseek-v4.1-flash` is DeepSeek-V4.1-Flash-1017, the name gateways such as Vercel and Requesty use. The DeepSeek API itself names it `deepseek-flash` (legacy `deepseek-v4-flash` routes there too). If a direct DeepSeek API call rejects `deepseek-v4.1-flash`, set the model to `deepseek-flash` and `preset` to `custom`.

Model ids were checked on 2026-11-05 (`checked` in the preset file). If a dispatch fails with an unknown-model error, look up the current id with `context7-mcp` or the vendor docs, fix `.leader.json`, and set `preset` to `custom`.

## Harness mapping

**Claude Code** — the `Agent` tool takes a model alias, not an id. Pass `effort` explicitly on every dispatch; the tool does not set it unless asked.

| `model` in file | `Agent` `model` |
| --- | --- |
| `claude-fable-*` | `fable` |
| `claude-opus-*` | `opus` |
| `claude-sonnet-*` | `sonnet` |
| `claude-haiku-*` | `haiku` |

The `Agent` `name` allows no dots: write the Story id with a hyphen, `plan-1-1`, not `plan-1.1`. A lens session uses the lens name from this file and `s` before the Story: `review-blind-hunter-r1-s1-1`.

Claude Code dispatches only Anthropic models. A non-Anthropic preset under `harness: claude-code` is invalid: tell the user and offer an Anthropic preset or OpenCode.

**Copilot CLI** — models are the ids Copilot lists in `/model`, written with dots: `claude-sonnet-5-5` in the file is `claude-sonnet-5.5` in Copilot. Only models your Copilot plan offers can run; a preset model it does not list is invalid under `harness: copilot-cli`. Set per-agent models with `/subagents` or a custom agent's `model:` field. Effort is `--reasoning-effort` for the session; subagents follow the model and effort named in their instructions (Copilot CLI 1.0.85+), so name both in every brief.

**OpenCode** — model is `<vendor>/<model>`, for example `openai/gpt-6.1-sol`, `deepseek/deepseek-v4.1-flash`, `google/gemini-4-argon`. Set effort through the provider option (`reasoningEffort`) or a named variant.

Effort per vendor, when the vendor does not accept a value:

| Vendor | Accepts | Map |
| --- | --- | --- |
| anthropic | all five | as is |
| openai | all five | as is |
| deepseek | `low`, `high`, `max` | `medium`, `xhigh` to `high` |
| google | `low`, `medium`, `high` | `xhigh`, `max` to `high` |

## Leader entry

The leader cannot change its own model mid-session. At Activate, compare the `leader` entry with the running model. On a mismatch, say so in one line and tell the user to restart on the configured model (`/model` in Claude Code and Copilot CLI, `--model` in OpenCode). Do not block the build for it.

## Context window

`contextWindow` is a budget the leader keeps, not the model's limit; no harness enforces it. Every listed model supports about 1M tokens.

| Agent kind | Roles | Preset window | Rule |
| --- | --- | --- | --- |
| Persistent | leader, planner, builder, verifier | 1M | At about 70% used, start a fresh session with a handoff note. Record the switch in the report. |
| One-time, wide input | uat-runner, research, retrospective, correct-course | 1M | Reads many sources: screenshots and logs, web pages and docs, or a whole epic of plans and evidence. |
| One-time, narrow input | reviewer, the 3 lenses | 200K | Reads one Story's change. If the brief and its inputs would pass about 70% of the window, split the work, for example one review per file group. |

## Change the preset later

When the user asks to switch preset or change a role: show the old and new rows that differ, rewrite `.leader.json` after the user agrees, and use it from the next dispatch. A hand edit sets `preset` to `custom`. A leader fill of a missing field from the named preset keeps the `preset` value.
