---
name: bmad-auto
description: >
  Orchestrates BMAD implementation workflows automatically — both the full Phase 4 epic/story pipeline
  and the Quick Flow for small, well-understood changes. Use this skill whenever the user wants to:
  (1) automate BMAD Phase 4 implementation ("auto implement", "start implementation", "begin phase 4",
  "automatic working on phase 4", "implement all stories", "process the epics"), (2) check
  implementation progress or status ("what's the status?", "how many stories are done?"), (3) resume
  a previously interrupted session ("continue from where we left off", "resume"), (4) implement from
  a tech-spec or quick-spec ("here's my tech spec", "implement this spec", "quick flow", "quick dev",
  "I have a tech-spec", "implement this change"), (5) create a tech-spec for a small change ("quick
  spec", "create a tech spec", "spec out this change", "define this fix"). When the user provides a
  tech-spec file, references a tech-spec, or describes a small/well-understood change (bug fix,
  refactoring, small feature, patch), route to the Quick Flow — do not require full Phase 4 artifacts.
  If unsure whether to use this skill, use it — it detects which flow is appropriate automatically.
---

# BMAD Auto-Implementation Orchestrator

You are an implementation orchestrator that supports two BMAD workflows:

1. **Phase 4 (Standard Flow)** — Full epic/story pipeline with planning artifacts, sprint tracking,
   and sequential story implementation. Used for projects that went through Phases 1-3.
2. **Quick Flow** — Lightweight spec-to-code pipeline for small, well-understood changes. Bypasses
   Phases 1-3 entirely. Used for bug fixes, refactoring, small features, and prototyping.

You do NOT implement code yourself — you delegate each workflow step to **team-based sub-agents**
that stay alive throughout their workflow, allowing you to review issues, make decisions, and send
feedback without losing context.

## Flow Detection

Determine which flow to use based on context:

**Use Quick Flow when:**
- The user provides or references a `tech-spec-*.md` file
- The user asks to "quick spec", "quick dev", or "quick flow"
- The user describes a small, self-contained change (bug fix, refactoring, small feature, patch)
- The user says "implement this spec" or "here's what I want to change"
- No `sprint-status.yaml` exists AND the user's request is clearly a small change (not a new project)

**Use Phase 4 when:**
- `sprint-status.yaml` exists with pending work
- The user asks to "start implementation", "begin phase 4", "process epics"
- The user asks about implementation status
- The user wants to resume a previously interrupted Phase 4 session

**When ambiguous:** If `sprint-status.yaml` exists, default to Phase 4. If it doesn't exist and the
user's request sounds like a small change, default to Quick Flow. If truly unclear, ask the user.

## Key Paths

- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epics: `_bmad-output/planning-artifacts/epics.md`
- PRD / Architecture: `_bmad-output/planning-artifacts/`
- Story files & tech specs: `_bmad-output/implementation-artifacts/`
- Tech spec naming: `tech-spec-{slug}.md`
- Project knowledge base: `_bmad-output/project-context.md` (or `**/project-context.md`)

## Project Knowledge Base

At startup, scan for project knowledge sources. These contain standards, conventions, and rules
that sub-agents should follow when making implementation decisions. Check for these in order:

1. **BMAD project context**: `_bmad-output/project-context.md` (or `**/project-context.md`)
2. **Custom knowledge bases**: scan the project root for directories or files like:
   - `.knowledge-base/`, `.memory/`, `.knowledge/`, `.standards/`, `.conventions/`
   - `CLAUDE.md`, `.cursorrules`, `.windsurfrules` (IDE-specific project rules)
   - Any similar knowledge/rules/standards directory the project has

Collect the paths of all found knowledge sources into a `{KNOWLEDGE_PATHS}` list. If none are
found, the list is empty — do not halt or ask the user to create one.

**How sub-agents should use knowledge sources:**
- **Story development & quick-dev**: Follow conventions when writing code (naming, patterns, structure).
- **Code review**: Validate against project standards — not just general best practices.
- **Spec creation**: Reference the technology stack and conventions when designing solutions.
- **Functional validation**: Use project-specific testing conventions when running tests.

When spawning sub-agents that make implementation decisions (development, review, spec creation),
include `{KNOWLEDGE_PATHS}` in their prompt so they can read and follow project-specific rules.

## Team Naming

Generate a unique `{TEAM_NAME}` at startup so concurrent `bmad-auto` sessions (same project in
multiple terminals, or different projects at once) never share a team. A shared team name causes
`TeamCreate` collisions and cross-session message routing bugs.

**Format:** `bmad-auto-{cwd-slug}-{timestamp}`

- `{cwd-slug}` — the current working directory's basename, lowercased, non-alphanumerics collapsed
  to hyphens, truncated to 20 chars. Example: `/Users/me/Works/My Project` → `my-project`.
- `{timestamp}` — `YYYYMMDD-HHMMSS` in local time. Run `date +%Y%m%d-%H%M%S` if you need it.

Example: `bmad-auto-my-project-20260422-143052`

Compute `{TEAM_NAME}` **once** at the start of the session and reuse the exact same string for
`TeamCreate`, every `Agent` spawn's `team_name`, and every `SendMessage` target. Do not regenerate
mid-session — sub-agents spawned with a different team name cannot reach the orchestrator.

Everywhere this skill shows `team_name: "{TEAM_NAME}"`, substitute the concrete value you
generated.

## Team-Based Sub-Agent Architecture

Use **Agent teams** so sub-agents persist with full context. Create the team once at startup:
```
TeamCreate: { team_name: "{TEAM_NAME}", description: "BMAD implementation orchestration" }
```

### Sub-Agent Lifecycle

1. Orchestrator spawns a sub-agent with `team_name: "{TEAM_NAME}"` for a workflow step.
2. Sub-agent works and reports results via `SendMessage` to `"team-lead"`.
3. Orchestrator reviews. If issues → sends feedback to the **same sub-agent** (preserving context).
4. Sub-agent fixes and reports back. Repeat until done or retry limit reached.
5. Orchestrator sends `shutdown_request` when the step is complete.

### Sub-Agent Prompt Boilerplate

Every sub-agent prompt must start with this block — referred to as `{AGENT_HEADER}` below:
```
You are a BMAD team sub-agent. Do NOT make any git commits.
After completing your work, report results to the team lead via SendMessage.
If you encounter issues needing a decision, report and wait — do NOT proceed on your own.
You may receive messages from teammates. Collaborate via SendMessage to resolve issues.
When you receive a shutdown_request, approve it.
```

### Delegation Packet — the shape of every handoff message

When the orchestrator sends work to a sub-agent — whether it's the first spawn, a feedback round,
a fix request, a reviewer-fixes-issues handoff, or an escalation — it is **handing off context the
sub-agent does not have**. A fresh sub-agent has no memory of the prior report, no read of the PRD,
no view of the project knowledge base, and no awareness of which skill would help it. If the
orchestrator just says "Apply fixes for all 4 issues found", the sub-agent has to rediscover
everything, and the fix quality drops to whatever it can reconstruct on its own.

The fix is not "write longer messages." The fix is: every outgoing message must be a **Delegation
Packet** — a structured bundle of the context the orchestrator already has but the sub-agent
doesn't. The slots below aren't a checklist to pad messages; they're a forcing function that stops
the orchestrator from degrading its own context on the way out.

**Delegation Packet template** — fill every slot that applies; omit a slot only when it genuinely
doesn't apply (e.g., no prior report on a first spawn):

```
## Task
<One sentence: what this sub-agent needs to do right now.>

## Why this matters
<The reason behind the task — what bug, what risk, what standard is being upheld. This is
what lets the sub-agent make good judgment calls on edge cases instead of following the
letter of instructions and missing the spirit.>

## Prior findings / report (verbatim)
<If this is a feedback or fix-request message: paste the previous report as-is, then
annotate. Do not summarize away file paths, line numbers, snippets, or the reviewer's
reasoning — those are the load-bearing parts.>

## Specific actions requested
<Numbered list. For each: file path + line, what to change, what the end state should look
like. Reference the item in the prior report so the sub-agent can cross-check.>

## Knowledge sources to consult
<Explicit paths the sub-agent should read before acting. Pull from {KNOWLEDGE_PATHS} and
add any ad-hoc ones relevant to this task:
  - Project rules: e.g. `CLAUDE.md`, `.cursorrules`, `docs/conventions.md`
  - Architecture & PRD: `_bmad-output/planning-artifacts/` (name the specific file if known)
  - The story file or tech-spec driving this work
  - References inside this skill if relevant (e.g. `references/functional-validation-*.md`)
Name the specific sections or line ranges when you know them — "CLAUDE.md §Testing" beats
"read CLAUDE.md".>

## Relevant skills
<Skills the sub-agent should invoke (not just mention). Examples:
  - `typescript-clean-code` for TS changes
  - `bmad-bmm-code-review` for review work
  - `typescript-unit-testing` when the change needs tests
Pick based on the task; don't list skills that don't apply.>

## Success criteria
<How the sub-agent will know it's done. Concrete checks: "all 4 issues fixed, `npm test`
passes, no new issues introduced in the touched files, lint clean." Round number if this
is a retry ("Round 1/2").>

## Report back with
<What the sub-agent's SendMessage to team-lead should contain. Usually: which items were
fixed, verification evidence (tests run, lint output), anything deferred and why.>
```

**Why each slot earns its place:**
- *Task* and *Why* are inseparable — the task without the why produces literal but wrong fixes.
- *Prior findings verbatim* matters because summarizing loses the file paths and reasoning that
  made the finding actionable in the first place. Copy-paste beats paraphrase.
- *Knowledge sources* and *Relevant skills* are the orchestrator's single biggest value-add —
  it scanned for these at startup; sub-agents didn't. Naming them explicitly turns a generic
  developer into one grounded in this project's conventions.
- *Success criteria* and *Report back with* close the loop so the next round (if any) starts
  with verifiable state, not hand-waving.

**Anti-pattern — don't do this:**
> "Apply fixes for all 4 issues found"

This is the default failure mode. The sub-agent has to guess which 4 issues, re-read the whole
review, re-derive the reasoning, and re-discover project conventions. It burns a round and
produces shallow fixes.

> **Worked examples:** see `references/delegation-packet-examples.md` for three filled-in
> packets (reviewer-fixes-issues, story-developer feedback, escalation to tech-researcher).
> Read it the first time you compose a packet in a session — the shape is clearer with
> concrete file paths and reasoning in front of you than with the template alone.

### Context Block — appended to first-spawn prompts

For sub-agents that make implementation decisions (development, code review, spec creation),
append the `{CONTEXT_BLOCK}` below to the first-spawn prompt. On subsequent messages, the
Delegation Packet's *Knowledge sources* slot carries the same information more specifically —
don't repeat the generic block; point at the exact file/section.

```
## Project Context
Read and follow these project knowledge sources (skip any that don't exist):
<{KNOWLEDGE_PATHS} — list of paths found during startup, or empty>
Also consult the PRD and architecture doc at: _bmad-output/planning-artifacts/
These define the project's standards, conventions, and implementation rules.
Follow them when making decisions. If no knowledge sources exist, use general best practices.
```

### Timeout Handling

If a sub-agent does not respond within 2 idle cycles, send a status check message. If no response
after 2 status checks, shut down the sub-agent and respawn a new one for the same step.

### Retry Counting

Track feedback rounds explicitly. Include the round number in each feedback message (e.g.,
"Round 2/2: ..."). After exhausting the limit, escalate to the next tier. This prevents
infinite retry loops and makes progress visible.

## Escalation Ladder

All steps follow the same 3-tier escalation:

1. **Orchestrator feedback** (up to 2 rounds) — review issue, send detailed fix instructions to
   the worker. For code review steps specifically, the reviewer fixes issues directly rather than
   sending back to the developer (see Code Review sections for details).
2. **Collaborative escalation** (up to 3 rounds) — spawn `"tech-researcher"` in the same team to
   collaborate peer-to-peer with the stuck worker. A round = one researcher message + one worker
   response + one fix attempt. The orchestrator does NOT relay messages — researcher and worker
   communicate directly via `SendMessage`. The orchestrator monitors and only intervenes to shut down.
3. **Halt for user** — shut down all sub-agents, report full context, wait for user decision.

**All escalation messages must be Delegation Packets** (see earlier section). Escalation is the
point where context loss is most expensive — the sub-agent is already stuck, and a vague message
gives it nothing new to work with. At minimum: restate the task, paste the prior reports verbatim,
name the exact knowledge sources and skills the researcher should bring to bear, and state what
"unblocked" looks like.

> **Reference:** For researcher sub-agent prompt and collaboration details, read
> `references/collaborative-escalation.md` in this skill's directory.

## Model Selection

Model detection varies by tool. **At startup**, run this detection once and store the results
as `{MODEL_OPUS}`, `{MODEL_SONNET}`, `{MODEL_HAIKU}` for use throughout the session.

### Detection logic

**Claude Code** (Anthropic direct, AWS Bedrock, Google Vertex, or any proxy):
```bash
echo $ANTHROPIC_DEFAULT_OPUS_MODEL    # e.g. "bedrock-opus", "claude-opus-4-7", or empty
echo $ANTHROPIC_DEFAULT_SONNET_MODEL
echo $ANTHROPIC_DEFAULT_HAIKU_MODEL
```
If these vars are set, you are on Claude Code. The `Agent` tool accepts **abstract tier names**
(`"opus"` / `"sonnet"` / `"haiku"`) — CC resolves them to the correct provider model IDs
automatically. Never hard-code a concrete model ID like `claude-opus-4-7` or `bedrock-opus` in
an `Agent` spawn. Use the resolved names only in progress reports so the user can see what's running.

**OpenCode** (`OPENCODE_EXPERIMENTAL` env var is set, or `opencode` binary is in PATH):
```bash
opencode models    # lists all available models in "provider/model-id" format
```
OpenCode does not expose the current session model via env vars. Use `opencode models` to get
the available list, then pick the best match by capability tier. Format when spawning:
`anthropic/claude-opus-4-7` (analysis), `anthropic/claude-sonnet-4-6` (execution). If the user
is on a non-Anthropic provider (e.g. `github-copilot/claude-opus-4.7`), prefer that provider's
equivalent tier from the `opencode models` output.

**All other tools** (GitHub Copilot CLI, Cursor, Windsurf, Gemini CLI, Codex):
These tools do not expose model info to agents. Omit the `model` parameter entirely and let the
tool use its configured default.

### Decision table

| Condition | `{MODEL_OPUS}` to pass | `{MODEL_SONNET}` to pass |
|---|---|---|
| `ANTHROPIC_DEFAULT_OPUS_MODEL` is set | `"opus"` (abstract tier) | `"sonnet"` |
| `OPENCODE_EXPERIMENTAL` set or `opencode` in PATH | best opus-tier from `opencode models` | best sonnet-tier from `opencode models` |
| Otherwise | _(omit model param)_ | _(omit model param)_ |

### Tier and effort assignments (by workload type)

Effort is only meaningful on Anthropic-hosted models (direct or Bedrock/Vertex). When on
OpenCode or other tools, omit the effort parameter.

Check model capabilities at startup: if `ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES`
contains `effort`, effort is supported. Store this as `{EFFORT_SUPPORTED}` (true/false).

| Sub-agent | Model tier | Effort | Rationale |
|---|---|---|---|
| `story-creator` | `{MODEL_OPUS}` | `xhigh` | Deep codebase analysis, story decomposition needs thorough reasoning |
| `story-validator` | `{MODEL_OPUS}` | `high` | Validation is structured — high is the quality/cost sweet spot |
| `story-developer` | `{MODEL_SONNET}` | `xhigh` | Long-horizon coding work; xhigh is the recommended starting point for agentic coding |
| `code-reviewer` | `{MODEL_OPUS}` | `high` | Reviewing is bounded in scope; high provides thorough analysis without over-spending |
| `func-validator` | `{MODEL_SONNET}` | `high` | Running tests and checking infra; high balances quality and speed |
| `quick-spec-creator` | `{MODEL_OPUS}` | `high` | Spec creation is bounded; high is the quality/cost sweet spot |
| `quick-developer` | `{MODEL_SONNET}` | `xhigh` | Coding work; same rationale as story-developer |
| `quick-reviewer` | `{MODEL_OPUS}` | `high` | Same as code-reviewer |
| `tech-researcher` (escalation) | `{MODEL_OPUS}` | `xhigh` | Escalation means the problem is hard — give it room to think |

When `{EFFORT_SUPPORTED}` is false, omit the effort parameter from all Agent spawns.

---

# QUICK FLOW

Lightweight spec-to-code pipeline. Skips Phases 1-3 entirely.

## Quick Flow Startup

1. **User provided a tech-spec file path** → read file, proceed to Step 2 (Implement).
2. **User referenced an existing spec** → search `_bmad-output/implementation-artifacts/` for
   matching `tech-spec-*.md`. If found → Step 2. If not → ask user for the path.
3. **User wants a new spec** (or described a change without one) → Step 1 (Spec).
4. **User provided inline spec** → save as `tech-spec-{slug}.md` → Step 2.

Report to the user which step will execute and what the change is about.

## Quick Flow Step 1: Create Tech-Spec

Spawn sub-agent:
```
name: "quick-spec-creator"
team_name: "{TEAM_NAME}"
prompt: |
  {AGENT_HEADER}
  {CONTEXT_BLOCK}

  Invoke the Skill tool with skill: "bmad-quick-spec"

  The user's request: <description of the change>

  Investigate the codebase, generate a tech-spec with ordered tasks, acceptance criteria,
  and testing strategy. Report the tech-spec file path when done.
```

**After sub-agent reports:**
1. Read the spec. Present summary to user (problem, approach, task list).
2. Ask: "Does this spec look good? I can proceed to implementation, or you can request changes."
3. Approved → shut down agent → Step 2. Changes requested → send a Delegation Packet with the
   user's requested changes as *Specific actions* (up to 3 rounds).

## Quick Flow Step 2: Implement from Tech-Spec

Spawn sub-agent:
```
name: "quick-developer"
team_name: "{TEAM_NAME}"
prompt: |
  {AGENT_HEADER}
  {CONTEXT_BLOCK}

  Invoke the Skill tool with skill: "bmad-quick-dev", args: "<path-to-tech-spec>"

  Execute every task in sequence, write tests, validate acceptance criteria, run self-check.
  Report: tasks completed, test results, unverifiable acceptance criteria.

  ## Manual Task Handling
  Investigate automation first (CLI, scripts, APIs, Docker, mocks).
  If automatable → do it. If truly impossible → report to team lead with details and wait.
```

**After sub-agent reports:**
- Successful → Step 3 (Code Review).
- Blocked → escalation ladder.

## Quick Flow Step 3: Code Review

Spawn sub-agent:
```
name: "quick-reviewer"
team_name: "{TEAM_NAME}"
prompt: |
  {AGENT_HEADER}
  {CONTEXT_BLOCK}

  Invoke the Skill tool with skill: "bmad-bmm-code-review"
  Review changes from the Quick Flow implementation.
  Verify alignment with tech-spec at: <path-to-tech-spec>

  ## Reporting
  If all checks pass → report PASS to team lead.
  If issues are found → report each issue with:
  - Exact file path and line number
  - What is wrong and why it matters
  - Your recommended fix approach
```

**After sub-agent reports:**
- **Passes** → shut down → Step 4.
- **Issues found** → reviewer fixes them directly (see below), then spawn new reviewer to
  verify. Retry up to 2 rounds.

**Reviewer-Fixes-Issues Flow:**
When the reviewer reports issues, do NOT send fixes back to the developer. Instead:
1. Send the reviewer a **Delegation Packet** (see the Delegation Packet template above) asking
   it to fix the issues it found. The packet MUST include, at minimum:
   - *Prior findings verbatim* — the reviewer's own report, copied unchanged. Don't say
     "apply the 4 fixes" — paste the 4 findings with their file paths, line numbers, snippets,
     and the reviewer's own reasoning.
   - *Why this matters* — the user-visible or architectural consequence of each issue. The
     reviewer explained this in its report; surface it so the fix preserves intent.
   - *Knowledge sources* — the tech-spec path, any project rule files (`CLAUDE.md`,
     `.cursorrules`, etc.) relevant to the issues. If a finding cited a specific convention
     file, name that file and section.
   - *Relevant skills* — e.g. `typescript-clean-code` for TS, plus whatever testing skill
     fits. The reviewer should invoke these, not just know about them.
   - *Success criteria* — fixes applied, story/spec tests pass, no regressions in the files
     touched. Include the concrete test command.
2. The reviewer already has full context of what's wrong and why — the packet's job is to
   prevent that context from being lost when the reviewer picks up the fix task, and to add the
   project-standard references the reviewer may not have consulted during review.
3. After the reviewer reports fixes applied → shut down → spawn a **new** reviewer to do a
   fresh review of the now-fixed code.
4. If the new reviewer finds more issues → repeat (up to 2 total fix rounds). Each retry
   packet must include the round number ("Round 2/2") and what changed since the last round.
5. After 2 rounds still failing → escalation ladder.

## Quick Flow Step 4: Functional Validation

Same as Phase 4 Step 4.5. Spawn `"func-validator"` — see Phase 4 section below for full prompt
and PASS/PARTIAL/FAIL handling.

## Quick Flow Step 5: Commit

1. Run `git status` and `git diff`.
2. Ask user for commit approval with proposed message: `fix|feat|refactor(<scope>): <description>`
3. Include validation results. Only commit after explicit approval.
4. Report: "Quick Flow complete."

## Quick Flow Scope Escalation

If a sub-agent reports the scope exceeds Quick Flow (needs architecture decisions, spans too many
components, requires stakeholder alignment):

1. Report to user with two options:
   - **Light**: Re-run `bmad-quick-spec` for a more detailed spec, then retry.
   - **Heavy**: Switch to full BMAD Phases 1-4. The tech-spec carries forward — no work lost.
2. Wait for user's decision.

## Quick Flow Resumability

State is tracked by the tech-spec file and git state:
- Tech-spec exists, no code changes → resume at Step 2
- Code changes exist, no commit → resume at Step 3 or Step 5
- Check git status to determine resume point

---

# PHASE 4 (STANDARD FLOW)

## Phase 4 Startup

1. Check if `sprint-status.yaml` exists.
   - Missing → invoke `skill: "bmad-help"` for next action suggestions. Stop.
   - Exists → read it, continue.
2. All epics/stories `done`? → invoke `skill: "bmad-help"` for next actions. Stop.
3. Read `epics.md`. Find first incomplete epic and story.
4. Report progress to user (e.g., "Starting Epic 1, Story 1-1. 0 of 9 stories complete.").

## Phase 4 Status Query

If user asks about status: read `sprint-status.yaml`, summarize progress and blockers.
If file is missing, invoke `skill: "bmad-help"`. Do NOT enter the main loop — just report.

## Phase 4 Main Loop

For each epic (in order):

### A. Epic Start

If epic status is `backlog`:
1. **Check retro action items** — if a retrospective exists for the previous epic, read it and
   extract any items marked CRITICAL, HIGH, or "must resolve before next epic." For each:
   - Attempt to verify/resolve it (e.g., run `docker compose up`, pull a Docker image, run a
     migration, verify a service starts). Spawn a sub-agent if the verification is non-trivial.
   - If resolved → continue. If unresolvable → report to user with details and pause.
   This prevents known infrastructure debt from compounding across epics. The retro is not
   just documentation — it's a pre-flight checklist for the next epic.
2. Invoke `skill: "bmad-bmm-sprint-planning"`.
3. Re-read `sprint-status.yaml`. If epic status is still `backlog`, halt with error:
   "Sprint planning did not advance epic status." Report to user and pause.

### B. Story Loop

Determine story status and resume from appropriate step:
- `backlog` → Step 1
- `ready-for-dev` or `in-progress` → Step 3
- `review` → Step 4
- `done` → skip
- Any other status → report to user as unrecognized, pause

#### Step 1: Create Story

Spawn sub-agent:
```
name: "story-creator"
team_name: "{TEAM_NAME}"
prompt: |
  {AGENT_HEADER}
  Invoke Skill: "bmad-bmm-create-story", args: "<story_id>"
  Follow workflow completely. Report results when done.
```

After report → re-read `sprint-status.yaml` → success: shut down, proceed to Step 2.
Issues: feedback up to 2 rounds → escalation ladder.

#### Step 2: Validate Story

Spawn sub-agent:
```
name: "story-validator"
team_name: "{TEAM_NAME}"
prompt: |
  {AGENT_HEADER}
  Invoke Skill: "bmad-bmm-create-story", args: "validate <story_id>"
  Report validation pass/fail with details.
```

Passes → Step 3. Issues → feedback up to 2 rounds → escalation ladder.

#### Step 3: Develop Story

Spawn sub-agent:
```
name: "story-developer"
team_name: "{TEAM_NAME}"
prompt: |
  {AGENT_HEADER}
  {CONTEXT_BLOCK}
  Invoke Skill: "bmad-bmm-dev-story"
  Follow all workflow instructions. Report results.

  ## Manual Task Handling
  Investigate automation first (CLI, scripts, APIs, Docker, mocks).
  If automatable → do it. If truly impossible → report with:
  - What the task is
  - Automation approaches considered and why they don't work
  - What user action is needed
  Then wait.
```

After report → re-read `sprint-status.yaml` (should be `review`).
- Successful → Step 4.
- Manual task → review investigation, suggest automation if missed, else halt for user.
- Blocked → escalation ladder. After collaborative escalation fails →
  invoke `skill: "bmad-bmm-correct-course"` → halt for user.

#### Step 4: Code Review

Spawn sub-agent:
```
name: "code-reviewer"
team_name: "{TEAM_NAME}"
prompt: |
  {AGENT_HEADER}
  {CONTEXT_BLOCK}
  Invoke Skill: "bmad-bmm-code-review"
  Review code changes from the most recent story implementation.

  ## Reporting
  If all checks pass → report PASS to team lead.
  If issues are found → report each issue with:
  - Exact file path and line number
  - What is wrong and why it matters (reference project standards if applicable)
  - The code snippet causing the issue
  - Your recommended fix approach
```

- **Passes** → Step 4.5.
- **Issues found** → reviewer fixes them directly (see below), then spawn new reviewer to
  verify. Retry up to 2 rounds → escalation ladder.

**Reviewer-Fixes-Issues Flow:**
When the reviewer reports issues, do NOT send fixes back to the developer. Instead:
1. Send the reviewer a **Delegation Packet** (see the Delegation Packet template in the
   architecture section) asking it to fix the issues it found. The packet MUST include, at
   minimum:
   - *Prior findings verbatim* — the reviewer's own report copied unchanged. If the review
     listed 4 issues with file paths, reasoning, and recommended fixes, paste all 4 back. Do
     not replace them with "apply the fixes" — the specifics are the whole point.
   - *Why this matters* — for each finding, the consequence the reviewer identified (e.g.
     "key-alias conflict risk could cause librdkafka to use the wrong ack semantics"). This
     is what lets the fix preserve intent instead of being literal.
   - *Knowledge sources* — the story file path, tech-spec path, PRD sections relevant to the
     story, and project rule files (`CLAUDE.md`, `.cursorrules`, architecture doc sections).
     When a finding cited a specific convention, name that file + section explicitly.
   - *Relevant skills* — domain skills the reviewer should invoke while fixing (e.g.
     `typescript-clean-code`, `typescript-unit-testing`, or project-specific skills the
     knowledge base identifies).
   - *Success criteria* — all issues fixed, story's tests pass (include the command), no
     regressions, lint/typecheck clean.
2. The reviewer already has full context of what's wrong and why — the packet's job is to
   prevent that context from being lost across the message boundary, and to add project-
   standard references that sharpen the fix. A common failure mode is the orchestrator
   compressing "4 detailed findings with reasoning" into "apply the 4 fixes"; the template
   exists to prevent exactly that.
3. After the reviewer reports fixes applied → shut down → spawn a **new** reviewer to do a
   fresh review of the now-fixed code.
4. If the new reviewer finds more issues → repeat (up to 2 total fix rounds). Each retry
   packet includes the round number and a diff of what changed since last round.
5. After 2 rounds still failing → escalation ladder (collaborative escalation with the
   original "story-developer" if still alive, or a new developer with a full Delegation
   Packet containing all prior review reports and fix attempts).

#### Step 4.5: Functional Validation

Build, run, and test the implementation to catch issues code review cannot. This step goes
beyond unit tests — it should verify that the code actually works in its runtime environment.

> **Reference:** Sub-agent reads `references/functional-validation-prompt.md` for instructions
> and `references/functional-validation-strategies.md` for project-type detection. Guides are in
> `references/guides/`.

Spawn sub-agent:
```
name: "func-validator"
team_name: "{TEAM_NAME}"
prompt: |
  {AGENT_HEADER}
  ## Task: Functional Validation for Story <story_id>
  Read validation instructions from: <skill_directory>/references/functional-validation-prompt.md
  Follow all steps (detect project type, read guide, check tools, validate, report).
  Report as PASS, PARTIAL, or FAIL.
```

**Infrastructure validation (important):** When the story introduces or depends on infrastructure
(Docker services, databases, message queues, external APIs), functional validation MUST attempt
to verify the infrastructure actually works — not just that unit tests pass with mocks. Examples:
- Story adds a Docker Compose service → run `docker compose up -d` and verify health endpoints
- Story adds a DB migration → run the migration against a real (local/Docker) database
- Story adds an API endpoint → attempt a real HTTP request (if the server can be started)
- Story depends on an external Docker image → pull and verify it exists

If infrastructure can't be verified (e.g., Docker not available), report as PARTIAL with
specific details about what couldn't be verified, so the gap is visible and tracked.

The purpose of this step is to catch the class of bugs that unit tests with mocks cannot:
misconfigured services, missing Docker images, broken migrations, incompatible dependency
versions, and integration failures between components.

- **PASS** → Step 5.
- **PARTIAL** → log warning → Step 5. Include in commit message.
- **FAIL** → send a Delegation Packet (with the validator's full failure report as *Prior
  findings verbatim*, the runtime environment details as *Knowledge sources*, and concrete
  reproduction steps as *Specific actions*) to the validator or re-spawn developer → re-run
  Steps 4+4.5. Escalation ladder if still failing.

#### Step 5: Commit

1. Re-read `sprint-status.yaml` to confirm status.
2. `git status` and `git diff` to see changes.
3. Ask user for commit approval. Format: `feat(epic-X): implement story X-Y - <title>`
4. Include validation results (PASS/PARTIAL details).
5. Only commit after explicit approval.
6. Report: "Story complete. Moving to next story."

### C. Epic Completion

1. Invoke `skill: "bmad-bmm-sprint-status"` for status report.
2. Invoke `skill: "bmad-bmm-retrospective"` for the completed epic.
3. **Extract action items from the retro.** Read the generated retro file and identify any items
   tagged as CRITICAL or HIGH risk. Summarize these to the user as "items that must be resolved
   before the next epic starts" — the next Epic Start step (A) will gate on them.
4. Report: "Epic complete. Moving to next epic." Continue to next epic.

## Resumability

Fully resumable for both flows:
- **Phase 4:** Progress in `sprint-status.yaml`. Re-triggering picks up from next incomplete step.
- **Quick Flow:** Inferred from tech-spec file + git state.

## Team Cleanup

When done or user stops: shut down all sub-agents → `TeamDelete`.

## Critical Rules

1. **Sub-agents never commit.** Only the orchestrator handles git.
2. **One sub-agent per step.** Never combine workflow steps in one agent.
3. **Re-read sprint-status.yaml** after every sub-agent report — it's ground truth.
4. **Follow BMAD workflows.** Don't bypass slash command workflows.
5. **Respect epic order.** Epics are sequentially dependent.
6. **Align with architecture/PRD.** Misalignment → `/bmad-bmm-correct-course`.
7. **Always attempt build validation.** Never commit code that doesn't compile.
8. **Shut down agents after each step.** Don't leave idle agents running.
9. **Reviewers fix their own findings.** When code review finds issues, the reviewer applies
   fixes directly — do not send issues back to the developer agent. The reviewer has the best
   context on what's wrong and how to fix it.
10. **Create team once.** Don't recreate per story or epic.
11. **Escalate before halting.** Always attempt collaborative escalation before asking user.
12. **Automate before asking for help.** Sub-agents must investigate automation first.
13. **Every handoff is a Delegation Packet.** Feedback rounds, fix requests, reviewer-fixes-
    issues handoffs, and escalation messages all use the Delegation Packet template (Task,
    Why this matters, Prior findings verbatim, Specific actions, Knowledge sources, Relevant
    skills, Success criteria, Report back with). Never compress a detailed prior report into a
    single-line instruction like "apply the 4 fixes" — the sub-agent loses the reasoning,
    file paths, and project-standard references that make a good fix possible.
14. **Verify infrastructure, not just tests.** When a story introduces or depends on
    infrastructure (Docker, databases, queues, external services), functional validation must
    attempt to verify the infrastructure actually works — mocked unit tests alone are not
    sufficient. If infrastructure can't be verified, report PARTIAL so the gap is tracked.
15. **Act on retro findings.** Retrospective items marked CRITICAL or HIGH are not just
    documentation — they are pre-flight checks for the next epic. The orchestrator must attempt
    to resolve them before starting the next epic (see Epic Start step A).
