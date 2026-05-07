# Mode: team-respawn (200k-context default)

You (the leader) spawn a **fresh sub-agent per workflow step** and shut it down when the step is complete. This is the legacy behavior — appropriate when the model has only 200k context and reusing an agent across stories would risk context overflow.

## Why per-step respawn (not per-story persistence) on 200k

A 200k window fills quickly: project context + PRD + architecture + story file + code being written = often >150k tokens. Carrying that across stories means each new story starts with a near-full window and crowds out the actual work. Respawning gets you a clean slate per step at the cost of paying onboarding tokens each time. On 1M models this trade flips — see `team-persistent.md`.

## Sub-agents (created per step, then shut down)

| Step | Sub-agent name | Used for |
|---|---|---|
| Story create | `story-creator` | `bmad-bmm-create-story` |
| Story develop | `story-developer` | `bmad-bmm-dev-story` |
| Functional validate | `func-validator` | Per-story functional validation |
| Quick spec | `quick-spec-creator` | `bmad-quick-spec` |
| Quick develop | `quick-developer` | `bmad-quick-dev` |
| Escalation only | `tech-researcher` | `bmad-bmm-technical-research` |

**Story validation and code review are NOT in this list.** The leader does both in this conversation, in every mode. Do not spawn `story-validator` or `code-reviewer` sub-agents.

## Team naming

Same as `team-persistent.md`: generate `{TEAM_NAME}` once at session start (hold in conversation memory, not a file) and reuse for every spawn.

## Effort tuning

Use the 200k-context column from SKILL.md:

| Sub-agent | Model | Effort |
|---|---|---|
| `story-creator` / `quick-spec-creator` | opus | `xhigh` |
| `story-developer` / `quick-developer` | sonnet | `xhigh` |
| `func-validator` | sonnet | `high` |
| `tech-researcher` | opus | `xhigh` |

Pass abstract tier names (`"opus"`, `"sonnet"`); omit `effort` if `{EFFORT_SUPPORTED}=false`.

## Spawning a step sub-agent

For every step, the spawn prompt has this skeleton. **Fill in the four bracketed fields in `{AGENT_HEADER}` concretely** — never leave them as placeholders. The bmad-auto context block (in SKILL.md) is what tells the sub-agent it's part of an orchestrated workflow, not a standalone agent.

Per-role context-block values:

| Sub-agent | Specific role | What leader does with output |
|---|---|---|
| `story-creator` | Story manager creating one specific story (id + epic). Fresh-spawn per story. | Reads the story file, validates it (leader job), then sends to developer. |
| `story-developer` | Developer implementing one specific story. Fresh-spawn per story. | Reviews the diff (leader job), then sends to func-validator. Fix requests come back as Delegation Packets. |
| `func-validator` | Functional tester for one story (light or full per epic-aware policy). Fresh-spawn per story. | Reads PASS/PARTIAL/FAIL and decides commit / commit-with-caveat / fix-cycle. |
| `quick-spec-creator` | Spec author for a single quick-flow change. One-shot. | Reads the spec, validates it, then sends to quick-developer. |
| `quick-developer` | Developer implementing one quick-flow change. One-shot. | Reviews + sends to func-validator. Fix requests come back as packets. |
| `tech-researcher` | Researcher unblocking a stuck worker via peer collaboration. | See `references/escalation.md`. |

Spawn skeleton:

```
{AGENT_HEADER with Flow, Mode (team-respawn), specific role, and what-leader-does-with-output filled in per the table above}

## Task
<Single sentence: what this sub-agent does in this step.>

## Skill to invoke
<Exact skill name and args.>

## Project Context
Knowledge sources: {KNOWLEDGE_PATHS}
Architecture & PRD: _bmad-output/planning-artifacts/
Story file (if applicable): _bmad-output/implementation-artifacts/<story>.md
Read these before acting.

## Manual task handling (developer & quick-developer only)
Investigate automation first (CLI, scripts, APIs, Docker, mocks). If automatable → do it.
If truly impossible → report to team-lead with: what the task is, automation approaches
considered and why each fails, what user action is needed. Then wait.

## Reporting
Report via SendMessage to "team-lead" with:
<Step-specific report shape — see flow file for details.>
```

The `{AGENT_HEADER}` and Delegation Packet shape come from SKILL.md. Don't redefine them here.

## Per-step lifecycle

1. Spawn sub-agent with the prompt above (first message = the Delegation Packet).
2. Wait for `SendMessage` report to "team-lead".
3. Leader reviews:
   - **Success** → send `shutdown_request` → proceed to next step.
   - **Issue** → send a Round 1/2 Delegation Packet with `Prior findings verbatim` + `Specific actions`. Up to 2 leader rounds.
   - **Stuck after 2 rounds** → escalation ladder (`references/escalation.md`).
4. Shut down agent before moving on. Don't leave idle agents running — they hold context budget you'll want for the next step.

## Reviewer-fixes-issues handoff (after leader code review finds issues)

The leader does code review in this conversation. If issues are found:

1. Re-spawn the **`story-developer`** (it was shut down after Step 3) with a fresh prompt:
   - First message is the fix-request Delegation Packet.
   - Include *Prior findings verbatim* (your review report, full text).
   - Include *Specific actions* with file paths and line numbers.
   - Mark "Round 1/2".
2. Developer fixes → reports back → you re-review in this conversation → shut down developer.
3. After 2 rounds still failing → escalation ladder.

We do not spawn a separate `code-reviewer` sub-agent. The leader reviews; the developer fixes.

## Functional validation in this mode

`func-validator` is spawned per story. The leader tells it "light" or "full" in the Delegation Packet, per the policy in `references/functional-validation.md`. At epic completion, spawn one more `func-validator` for the full epic suite if the per-story runs were light.

## Idle / cross-talk

In this mode, only one sub-agent is alive at a time (with rare exceptions during escalation). Cross-talk is minimal. Idle handling: 2 cycles silent → status check; 2 status checks unanswered → shut down + respawn.

## Shutdown discipline

- After every step: `shutdown_request` to the step's sub-agent.
- Never accumulate idle agents.
- At session end: shut down anything alive + `TeamDelete`.
