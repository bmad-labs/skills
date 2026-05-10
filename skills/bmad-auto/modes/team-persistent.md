# Mode: team-persistent (1M-context default)

You (the leader) coordinate an agent **team** for the entire epic. Teammates are persisted across every story in that epic — no respawn per story. This is the biggest token saver: each teammate loads project context, knowledge base, and architecture **once**, then handles N stories with that context still warm.

**Agent teams vs normal sub-agents:** Agent teams let teammates message each other directly and coordinate on shared tasks. Prefer agent teams when available. The spawning format below (`Agent` tool with `team_name`) creates team members, not standalone sub-agents. If agent teams are not available in the current environment, fall back to normal sub-agents (same spawn format but without `team_name` and without `run_in_background: true`).

## The team

| Role | Teammate name | Used for | Lifetime |
|---|---|---|---|
| Leader | (you) | Story validation, code review, all decisions, all git commits, escalation triggers | Whole session |
| `sm` | `bmad-sm-{TEAM_NAME}` | Story creation (`bmad-create-story`), epic-start sprint planning if needed | One epic |
| `developer` | `bmad-dev-{TEAM_NAME}` | Story implementation (`bmad-dev-story`), test writing, bug fixes from review | One epic |
| `tester` | `bmad-tester-{TEAM_NAME}` | Functional validation per story using `{TESTER_SKILL}` + runtime smoke from `references/functional-validation.md`, full epic suite at epic completion | One epic |

The leader does **not** delegate story validation or code review. Those happen in this conversation. See `flows/phase-4.md` for which steps you do vs. which the team does.

## Team naming

Generate `{TEAM_NAME}` once at session start and reuse for `TeamCreate` and every `team_name:` field. Format: `bmad-auto-{cwd-slug}-{timestamp}` where `{cwd-slug}` is the basename lowercased + non-alnum→hyphens (max 20 chars), and `{timestamp}` is `YYYYMMDD-HHMMSS`. Run `date +%Y%m%d-%H%M%S` if needed. Hold the value in conversation memory; don't persist it to a file — team names are unique per session and the team itself doesn't survive across processes.

## Epic lifecycle

```
Epic start
  ├─ (SKILL.md already ran TeamCreate — team exists at this point)
  ├─ Spawn sm → run bmad-sprint-planning if epic is `backlog`
  ├─ Spawn developer
  └─ Spawn tester
Story 1
  ├─ Leader: read sprint-status.yaml, decide which step we're on
  ├─ sm: bmad-create-story → reports back → leader validates story spec
  ├─ developer: bmad-dev-story → reports back → leader runs code review (in this conversation)
  ├─ tester: light functional validation (or full if epic ≤3 stories) → reports back
  └─ Leader: git commit (with user approval per auto_progression setting)
Story 2..N
  └─ Same as Story 1, BUT all three agents already have project context loaded
Epic completion
  ├─ tester: full functional suite for the epic (only if epic >3 stories — light tests during the epic don't substitute for full coverage)
  ├─ Leader: invoke bmad-sprint-status
  ├─ Leader: invoke bmad-retrospective, surface CRITICAL/HIGH items
  └─ Shut down sm + developer + tester (the team has fulfilled its epic; the next epic spawns a fresh trio so context stays scoped)
```

Why shut down at epic boundary instead of running for the whole project? Each epic is a natural context boundary — different stories, different focus, different files. Reusing across epics risks the agent dragging stale Epic-1 context into Epic-2 decisions. Reusing within an epic is the sweet spot.

## Context-budget check between stories (mandatory)

After every story completes — *before* delegating the next story to the same dev or tester — the leader runs a script to measure each persistent sub-agent's actual context usage. Self-reported "I have plenty of room" is unreliable; the script reads the agent's session transcript and computes the same number Claude Code's status line displays.

```bash
python3 <skill-dir>/scripts/context-usage.py \
    --agent-name "<agent-name, e.g. bmad-dev-{TEAM_NAME}>" \
    --context-window <1000000 if this tier is 1M, else 200000>
```

The script returns JSON with `used_pct`, `compaction_count`, and a `recommendation` field. Honor the recommendation:

- **`ok`** → keep the agent alive; delegate the next story as usual.
- **`respawn-with-handover`** → run the respawn-with-handover protocol below before delegating the next story. The script returns this when usage exceeds 50% on a 1M-tier agent, exceeds 70% on a 200k-tier agent, or when *any* prior auto-compaction happened during the agent's session.

Run the check on **all three persistent agents — sm, dev, and tester** — between every story. SM rarely fills its window in practice (story creation is bounded), but the check is cheap (~50ms), and an SM that *does* fill (large epic, lots of cross-referencing across many story files) carries the same reasoning-degradation risk as a stuffed dev. Belt-and-braces: check all three.

If the leader is on a tier-mixed setup (e.g. opus 1M, sonnet 200k), pass the appropriate window per agent: `1000000` for the opus-backed sm, `200000` for the sonnet-backed dev/tester.

The script is a port of ccstatusline's algorithm, so its numbers match the Claude Code status line a user could check manually.

### Why respawn instead of compact?

We tested whether the leader could remotely trigger `/compact` in a sub-agent. It can't: an assistant emitting `/compact` in its output is treated as inert text content, not a slash command. The harness's slash-command parser only listens to the user input channel, and `SendMessage` doesn't write to that channel. Claude Code's auto-compact fires automatically but only at ~99% of the effective context window, not at a configurable user threshold. So the only way to get fresh-window reasoning at 50% used is to respawn. The document-first handoff (Dev Notes / Review Notes / QA Results sections already written into the story file during the just-completed story) makes the respawn cheap from a continuity perspective.

### Respawn-with-handover protocol

**Important: this fires only at story boundaries, never mid-story.** The check runs after a story is fully complete (Dev Notes / QA Results / Review Notes written, leader has committed the work). If a sub-agent's context fills *during* a story, the agent finishes the current story first — partial-story respawn is more disruptive than the lossy auto-compact that would fire at 99% in the worst case. The next story-boundary check then catches the `compaction_count > 0` signal and respawns the agent with a fresh window.

Same procedure for every persistent agent (sm, dev, tester), every time the script returns `respawn-with-handover` after a story completes. Six steps, designed so the **leader never reads the handover content** — just passes the path:

1. **Ask the outgoing agent to write a handover file.** Send a `SendMessage`:

   > *"Your context utilization has crossed the threshold for this tier. After this story finishes, I'll respawn you with a fresh window. Before you go, write a handover file to `/tmp/bmad-handover-<TEAM_NAME>-<role>-<unix-timestamp>.md` containing:*
   > - *What's done across the stories you've worked on this session (point at the relevant Dev Notes / QA Results sections in the story files for full detail).*
   > - *Decisions you made that aren't visible in the code diff yet (the "why" behind choices, especially anything that future stories in this epic will depend on).*
   > - *Project-specific gotchas, conventions, or patterns you learned that the next agent should know up front (saves them rediscovering the same things).*
   > - *Anything in-flight that you didn't finish — but only if it's small/trivial enough to be worth picking up. If anything is genuinely incomplete and non-trivial, flag that to me instead, don't try to hand it off.*
   >
   > *Reply with the absolute path of the file you wrote. Then I'll send shutdown."*

2. **Wait for confirmation.** The agent writes the file and replies with the path. If it says anything other than a path (asks a question, reports a problem) — handle that, then re-issue the request.

3. **Verify the file exists.** Run `ls -la <path>` to confirm the file is non-empty (>0 bytes). The leader does NOT read the file content — that's the whole point. If the file is missing or empty, retry once. If still missing, log it and proceed anyway; the existing Dev Notes / QA Results in the story files are the fallback record.

4. **Send shutdown.** `SendMessage({type: "shutdown_request"})`. Wait for the approval response.

5. **Spawn a fresh agent in the same role.** Use the same spawn prompt as the original (sm / developer / tester block in this file), with the same role-skill, model, and effort. The new `{AGENT_HEADER}` includes the same project root and knowledge sources.

6. **First Delegation Packet to the fresh agent** is the next story's normal Delegation Packet, with one extra item in *Knowledge sources*: *"Before doing anything else, read `/tmp/bmad-handover-<...>.md` — that's your handover from the previous agent in this role. Treat it as authoritative for prior context this session. Then proceed with the story below."* The new agent reads the handover file once at startup; the leader never reads it at all.

### Why this works

- **Leader stays lean.** The handover content lives in a file the leader knows the path to but never opens. No pass-through token cost.
- **The new agent gets concrete prior context.** Decisions, gotchas, conventions — explicit text, not inferred from code or compressed by auto-compact.
- **Clean window for the new agent's actual work.** Just one file read at startup, then back to the new story.
- **Story files remain the durable record.** Dev Notes / QA Results / Review Notes already document what was *done* in each story. The /tmp handover only captures what the *outgoing agent learned* across stories that isn't visible in those records — the "why" and the gotchas. Once the next agent absorbs it, the file's job is done; /tmp rotates naturally on reboot.

## Effort tuning (the token-saver)

This mode runs on a 1M-context model. Effort is dialed down for the agents whose value comes from carrying lots of context (sm, developer); kept high for the agent whose value comes from rigor (tester):

| Teammate | Model | Effort | Notes |
|---|---|---|---|
| `sm` | opus | `medium` | 1M ctx + opus carries planning by itself; medium is enough. |
| `developer` | sonnet | `medium` | 1M ctx absorbs the codebase; medium effort is enough for execution. |
| `tester` | sonnet | `high` | Validation must actually catch bugs — don't dial this down. |
| `tech-researcher` (escalation only) | opus | `xhigh` | Escalation is hard; pay the effort. |

Pass `model: "opus"` or `model: "sonnet"` (abstract tier — Claude Code resolves). Omit `effort` if `{EFFORT_SUPPORTED}=false` (see SKILL.md → Model Selection).

## Spawning the epic team

**If agent teams are available** (`TeamCreate` succeeded): spawn teammates using the `Agent` tool with `team_name: "{TEAM_NAME}"` and `run_in_background: true`. Teammates will appear in the team display, can receive direct messages, and can message each other.

**If agent teams are not available**: fall back to normal sub-agents. Spawn with the `Agent` tool without `team_name` and without `run_in_background: true`. Sub-agents can only report back to the leader; they cannot message each other. Use the same prompt templates below.

Issue these three `Agent` calls at the start of an epic (and again at every subsequent epic, after shutting down the previous trio). Use parallel spawns — they don't depend on each other.

### sm

When you fill in `{AGENT_HEADER}`, the bmad-auto context block fields look like:
- Flow: Phase 4
- Mode: team-persistent
- Your specific role: SM (story manager) for Epic {EPIC_NUM}: {EPIC_TITLE}. You'll be reused for every story in this epic.
- What the leader will do with your output: read the story file you produce, validate it (the leader does story validation, not you), then send it to the developer. If the spec has gaps the leader will send you a fix-request Delegation Packet with specifics.

```
Agent tool:
  name: "bmad-sm-{TEAM_NAME}"
  team_name: "{TEAM_NAME}"
  subagent_type: "general-purpose"
  model: "opus"
  effort: "medium"   # omit if {EFFORT_SUPPORTED}=false
  run_in_background: true
  prompt: |
    {AGENT_HEADER with the bracketed fields above filled in concretely; the
     "First action — invoke your BMAD role-skill" line names: bmad-agent-pm}

    ## On every leader request
    The leader will name a workflow skill — typically `bmad-create-story` with the
    story id, sometimes `bmad-sprint-planning` for epic boundaries. Invoke that
    workflow skill via your role-skill's menu. Run it to completion — the workflow itself
    produces the story file with all the structured sections.

    If the leader's request doesn't match a BMAD workflow, do NOT improvise. Report
    back; the leader will consult `bmad-help` for the right next move.

    ## Reporting back (document-first)
    The story file is your output. Don't paraphrase it into a long message — the leader will
    read the file. SendMessage to "team-lead":
      "Story created. File: <path>. Status: ready-for-dev. Headline: <one line>."
    Anything more detailed goes in the story file itself (the workflow handles this).

    ## Project context (load once, retain for the epic)
    Knowledge sources: {KNOWLEDGE_PATHS}
    Architecture & PRD: _bmad-output/planning-artifacts/
    Epics: _bmad-output/planning-artifacts/epics.md
    Sprint status: _bmad-output/implementation-artifacts/sprint-status.yaml
    Read these now and keep them in mind for the whole epic.

    ## Reminders specific to your role
    - Story validation is NOT your job — the leader does it. Don't self-validate and assume done.
    - If a story spec is ambiguous (e.g. AC says "X" but architecture implies "Y"), report to
      team-lead and wait. Don't resolve ambiguity yourself.
    - Always invoke the exact skill the leader names.
```

### developer

When you fill in `{AGENT_HEADER}`, the bmad-auto context block fields look like:
- Flow: Phase 4
- Mode: team-persistent
- Your specific role: developer for Epic {EPIC_NUM}: {EPIC_TITLE}. You'll be reused for every story in this epic.
- What the leader will do with your output: review the diff (the leader does code review, not you), then send the implementation to the tester for functional validation. If review finds issues, the leader sends you a fix-request Delegation Packet with the review pasted verbatim — you fix every numbered item.

```
Agent tool:
  name: "bmad-dev-{TEAM_NAME}"
  team_name: "{TEAM_NAME}"
  subagent_type: "general-purpose"
  model: "sonnet"
  effort: "medium"
  run_in_background: true
  prompt: |
    {AGENT_HEADER with the bracketed fields above filled in concretely; the
     "First action — invoke your BMAD role-skill" line names: bmad-agent-dev}

    ## On every leader request
    The leader will send a Delegation Packet naming the story id and the workflow skill
    to invoke (typically `bmad-dev-story` for Phase 4 stories). Invoke that workflow
    via your role-skill's menu. Run it end-to-end:
    - Implement every task in the story.
    - Write tests for new behavior.
    - Run the project's test command and capture the result.
    - If a task is "manual," investigate automation first (CLI, scripts, mocks, Docker). Only
      report it as truly manual if you've ruled out automation.

    ## Reporting back (document-first)
    Write the detail into the story file's Dev Notes / Dev Agent Record section (the slot
    the bmad-create-story workflow generated):
    - Files touched, with one-line per-file rationale.
    - Test command run + pass/fail counts (paste the relevant tail).
    - Decisions made and their reasoning (especially anything the leader will want to see
      during code review — pre-empt their "why did you do X?" questions).
    - Anything deferred and why.
    - Manual tasks surfaced and the automation paths you tried.

    Then SendMessage to "team-lead":
      "Dev complete. Story: <path>. Status: review. Tests: <pass/fail counts>. Headline: <one line>."
    Keep the message short — leader reads the Dev Notes section for the full picture.

    ## Project context
    Knowledge sources: {KNOWLEDGE_PATHS}
    Architecture & PRD: _bmad-output/planning-artifacts/
    Read these now. For each story, also read its story file in
    _bmad-output/implementation-artifacts/.

    ## Reminders specific to your role
    - Code review is NOT your job — the leader does it. Don't self-review and pre-fix things
      the leader didn't flag; report what you built and let the leader decide.
    - Never commit to git. Never run `git commit`.
    - When the leader sends a fix request, the prior findings will be pasted verbatim;
      address every numbered item. Do not pick which to fix.
    - Never make scope decisions — if the story is ambiguous, report to team-lead and wait.
```

### tester

When you fill in `{AGENT_HEADER}`, the bmad-auto context block fields look like:
- Flow: Phase 4
- Mode: team-persistent
- Your specific role: functional tester for Epic {EPIC_NUM}: {EPIC_TITLE}. You'll be reused for every story in this epic plus a final epic-wide pass.
- What the leader will do with your output: read your PASS/PARTIAL/FAIL report and decide whether to commit (PASS), commit with caveat (PARTIAL), or send the developer back to fix the failure (FAIL). Your report directly drives the leader's commit decision — be specific.

```
Agent tool:
  name: "bmad-tester-{TEAM_NAME}"
  team_name: "{TEAM_NAME}"
  subagent_type: "general-purpose"
  model: "sonnet"
  effort: "high"
  run_in_background: true
  prompt: |
    {AGENT_HEADER with the bracketed fields above filled in concretely; the
     "First action — invoke your BMAD role-skill" line names: {TESTER_PERSONA}
     resolved at startup — see SKILL.md → "Tester role-skill availability check"}

    ## Two modes you'll be asked to run
    1. Per-story validation. The leader will tell you "light" or "full":
       - Light: build + bring the app up (locally or via docker compose) + smoke-check the
         main cases the story changed. Do NOT re-run unit tests — those were verified during
         code review. Skip slow E2E suites and exhaustive edge-case runs. Used when the epic
         has more than 3 stories.
       - Full: everything in light, plus integration / E2E tests, full infrastructure
         verification, and any cross-cutting checks (security / a11y / perf) that apply per
         the project type. Used when the epic has ≤3 stories, or as the final epic pass.
    2. Epic completion: full functional suite across the whole epic's changes.

    For both modes, follow the strategy in:
    {SKILL_DIR}/references/functional-validation.md
    Detect project type once at the start of the epic and remember it.

    ## On every leader request
    The leader will name the story id and may name a BMAD test workflow skill to use
    ({TESTER_SKILL} resolved at startup — typically `manual-testing` if available, else
    `bmad-testarch-test-design`, else `bmad-qa-generate-e2e-tests`). Invoke that workflow
    when the work calls for designing or generating tests.

    For the runtime smoke / build / infra checks (the bulk of light validation), follow
    the strategy in {SKILL_DIR}/references/functional-validation.md regardless of which
    BMAD test skill is in scope. Read the story file's Dev Notes first to understand what
    was implemented and what to validate.

    ## Reporting back (document-first)
    Append your full results to the story file's QA Results / Validation Results section:
    - Mode (light or full)
    - Build outcome (command + result)
    - Runtime / smoke results (what you exercised, what passed, what didn't)
    - Infrastructure verified (or PARTIAL gaps named)
    - For FAIL: exact error output, suspected fix area, file/line if known

    Then SendMessage to "team-lead":
      "Validation: <PASS|PARTIAL|FAIL>. Story: <path>. Mode: <light|full>. Headline: <one line>."
    Leader reads QA Results for the full picture.

    ## Reminders specific to your role
    - Never modify production code. You may add test fixtures or test files only.
    - Never commit to git.
    - Report PARTIAL when infrastructure can't be verified — never silently skip it. The leader
      needs the gap visible to track it.
    - "Light" does not mean "skip rigor on what you do run." Build + runtime up + main-case
      smoke must genuinely catch issues — keep effort up. Unit tests being skipped in light
      mode is intentional (already covered in code review), not a license to phone in the
      runtime smoke.
```

## Per-story handoff (Delegation Packet to a persistent agent)

Even though the agent is alive and has prior context, **every story still gets a Delegation Packet**. The packet shape from `references/delegation-packet.md` is mandatory. The agent has been running for a while; without the packet, story-2's instructions blur into story-1's leftovers. The packet re-anchors the agent on the current story.

Include in the packet:
- Story id (e.g. "Story 1-3").
- Path to the story file.
- *Skill to invoke* — always name it explicitly.
- *Knowledge sources* — same paths as the spawn prompt; restating costs nothing and prevents drift.
- *Success criteria* — concrete checks for this story.
- *Report back with* — exactly what fields you want in the response.

## Reviewer-fixes-issues handoff (when leader's code review finds issues)

The leader does code review in this conversation. When you find issues:

1. Send a Delegation Packet to the **developer** (not a separate reviewer) asking for fixes.
2. Include *Prior findings verbatim* — your full review, copied unchanged. No "apply the 4 fixes."
3. Mark round count: "Round 1/2".
4. Developer fixes → reports back → you re-review in this conversation.
5. After 2 rounds still failing → escalation ladder (`references/escalation.md`).

Sub-agents never review their own work. The leader is always the reviewer.

## Idle / cross-talk handling

The three agents may message each other (e.g. tester pings developer about a missing build artifact). Allow this — that's the point of the team. You only intervene when:
- A decision needs to be made.
- An agent reports back to "team-lead".
- An agent goes silent for 2 idle cycles → send status check; after 2 status checks → respawn.

## Shutdown

At epic completion (after retro): send `shutdown_request` to sm, developer, tester. They approve. Then re-spawn fresh trio for the next epic. At session end (or when the user halts): send shutdown to all + `TeamDelete` (if agent teams were created). If agent teams are not available, just send `shutdown_request` to each sub-agent.
