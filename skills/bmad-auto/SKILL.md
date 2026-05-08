---
name: bmad-auto
description: >
  Orchestrates BMAD implementation workflows automatically — both the full Phase 4 epic/story
  pipeline and the Quick Flow for small, well-understood changes. Use this skill whenever the
  user wants to: (1) automate Phase 4 implementation ("auto implement", "start implementation",
  "begin phase 4", "automatic working on phase 4", "implement all stories", "process the
  epics"), (2) check implementation progress or status ("what's the status?", "how many
  stories are done?"), (3) resume a previously interrupted session ("continue from where we
  left off", "resume"), (4) implement a small self-contained change without going through full
  BMAD planning ("quick dev", "quick flow", "implement this change", a described bug fix,
  refactor, or small feature, patch). When the user describes a small change or asks to
  quickly implement something, route to Quick Flow — `bmad-quick-dev` handles intent-to-code
  directly without a separate spec step. If a multi-story project is already in flight
  (`sprint-status.yaml` exists) AND the user's current request is a substantive epic/story
  task, route to Phase 4; if the request is a small one-off, route to Quick Flow regardless.
  If unsure whether to use this skill, use it — it detects which flow is appropriate
  automatically.
---

# BMAD Auto-Implementation Orchestrator

You are the **leader** of an implementation workflow. Your job is to:
- Detect which **flow** to run (Phase 4 or Quick Flow).
- Pick (with the user) which **execution mode** to run in (main / team-persistent / team-respawn / hybrid).
- Orchestrate the work, **make every decision**, **own all git commits**, and validate / review every story yourself.
- Delegate execution work (coding, testing) to sub-agents only when the chosen mode says to.

You **never** ask sub-agents to make decisions. You **never** let sub-agents commit. You give every sub-agent a complete instruction with the exact skill to invoke — never let them "figure it out."

---

## Step 0 — Mandatory Mode Setup (before any other work)

The very first thing you do every session, **before** loading flow-specific instructions, is:

1. **Detect the leader's own model context window.**
   - If your own model ID contains `[1m]` (e.g. `claude-opus-4-7[1m]`) or the system prompt explicitly says "1M context": leader is on a 1M model.
   - Otherwise: leader is on a 200k (or unknown) model.

   This only tells you about the model running *this conversation*. It does **not** tell you which model your sub-agents will run on, because:
   - Claude Code resolves abstract tier names (`"opus"`, `"sonnet"`) to whatever the user's environment has configured for that tier.
   - The user's `ANTHROPIC_DEFAULT_SONNET_MODEL` may be a 200k Sonnet even when their `ANTHROPIC_DEFAULT_OPUS_MODEL` is a 1M Opus, or vice versa.
   - Env vars and capability flags don't reliably distinguish 1M vs. 200k variants in Claude Code today.

   **Do not assume sub-agent context windows from your own.** Ask the user.

2. **If leader is on a 1M model, ask one quick question to pick the recommendation.** Use `AskUserQuestion`. Phrase it plainly — don't dump config jargon:

   *"I'm on a 1M-context model. Are the sub-agent models (the ones behind `opus` and `sonnet` in your setup) also 1M, or are they 200k? If you set them up recently with the latest models, they're probably both 1M. If you're not sure, just pick the closest — we can switch modes later if the sub-agent context fills up."*

   Options:
   - `All 1M` → recommend `team-persistent`
   - `Mixed — opus 1M, sonnet 200k` → recommend `hybrid` (leader does the heavy thinking; 200k sonnet sub-agents respawn per step)
   - `All 200k` → recommend `team-respawn`
   - `Not sure` → recommend `team-respawn` as the safe default; switching later is cheap

   If the leader is **not** on a 1M model, skip this question entirely and default-recommend `team-respawn`.

3. **Ask the user two mode questions** — use `AskUserQuestion`. Present the recommendation from step 2 as the first option labeled `(Recommended)`. Run these every session, even on resume — the user may want to switch modes based on current conditions.

   **Q1 — Execution mode:**
   | Option | When to pick |
   |---|---|
   | `main` | You want me to do everything myself — no sub-agents. Cheapest tokens. Best for very small changes or when you want maximum control. |
   | `team-persistent` | All sub-agent tiers are 1M context. I spawn `sm`, `developer`, `tester` once per epic and reuse them across stories. Lowest token cost across multi-story epics. |
   | `team-respawn` | Sub-agent tiers are 200k (or unknown). Each workflow step gets a fresh sub-agent. Smaller per-agent context windows but more setup overhead per story. |
   | `hybrid` | I (the leader) handle decision-heavy steps (story validation, code review, planning, all commits) directly. I delegate execution-only steps (development, functional test) to sub-agents. Good middle ground when only some tiers are 1M. |

   **Q2 — Auto-progression:**
   | Option | Behavior |
   |---|---|
   | `auto-commit` | After each story passes validation, I commit and move to the next story without asking. I still ask before destructive ops. |
   | `confirm-each` | I ask for approval before every commit and before moving to the next story. |

4. **Hold the choices in conversation memory.** Don't write a session state file — the actual work-in-progress is already tracked by `sprint-status.yaml` (Phase 4) or the tech-spec + git state (Quick Flow). Mode is a per-session preference, not project state.

5. **Load the mode file** — read `modes/<chosen-mode>.md`. That file contains everything mode-specific: how to spawn agents (or not), team naming, agent header templates, lifecycle rules. Do **not** apply spawning rules from this SKILL.md — they live in the mode file.

---

## Step 1 — Flow Detection

After mode setup, decide which flow to run. **Detect intent first, then look at project state.** A Phase 4 project can still receive Quick Flow requests (typo fixes, one-off patches) — don't force every request through the epic pipeline just because `sprint-status.yaml` exists.

**Detect intent (look at the user's actual request):**

- The user describes a **small, self-contained change** — bug fix, typo, single-file refactor, small feature, patch — or says "quick dev" / "quick flow" / "implement this change" → **Quick Flow**, regardless of whether `sprint-status.yaml` exists.
- The user asks to **start, continue, or process Phase 4 work** — "start implementation", "begin phase 4", "process the epics", "implement the next story", "resume where we left off" → **Phase 4**.
- The user asks for **status only** — "what's the status?", "how many stories are done?" → load `flows/phase-4.md` and follow its Status Query path; do not enter the main loop.

**When the request is genuinely ambiguous** (e.g. "let's keep working" with both Phase 4 in flight and recent small fixes scattered around): ask the user which one they want. Don't guess.

**Edge case — small fix during an active Phase 4 project**: route to Quick Flow. The Phase 4 epic doesn't pause; the Quick Flow change ships independently. After the Quick Flow commit, the user can return to "continue Phase 4" when they're ready.

Then load the matching flow file:
- Phase 4 → `flows/phase-4.md`
- Quick Flow → `flows/quick-flow.md`

The flow file describes the steps; the mode file describes how each step is executed.

---

## Key Paths

- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epics: `_bmad-output/planning-artifacts/epics.md`
- PRD / Architecture: `_bmad-output/planning-artifacts/`
- Story files & tech specs: `_bmad-output/implementation-artifacts/`
- Tech spec naming: `tech-spec-{slug}.md`
- Project knowledge base: `_bmad-output/project-context.md`

---

## Project Knowledge Base — collected once at startup

Scan for **two categories** of knowledge sources. Sub-agents (in any team mode) need the project-scoped ones so they don't reinvent project conventions; the leader uses both categories to make decisions before reaching for external research.

### Category A — Project knowledge (passed to sub-agents)

These describe *this* project's conventions, architecture, and rules. Pass them in every Delegation Packet's *Knowledge sources* slot.

1. **BMAD project context**: `_bmad-output/project-context.md` (or `**/project-context.md`)
2. **Custom project rules**: `.knowledge-base/`, `.knowledge/`, `.standards/`, `.conventions/`, `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `AGENTS.md`, `GEMINI.md`

Collect found paths into `{KNOWLEDGE_PATHS}`.

### Category B — Leader's own memory / second-brain (leader uses for decisions)

These describe the *user's* preferences, prior decisions, and accumulated lessons across projects. They are NOT for sub-agents (sub-agents work on the project; the user's broader context isn't theirs to act on). The leader reads them to inform its own decisions: choosing libraries, naming conventions, architectural defaults, escalation calls, when to push back.

Look for any of these the host environment provides:

- **Auto-loaded into the leader's context already**: identity blocks, soul/personality blocks, MEMORY index, daily logs, decision logs, SOUL.md, IDENTITY.md, vault trees. If you can already see them in your context, they count.
- **Vault / memory directories**: `JARVIS_CACHE_DIR`, `~/.claude/memory/`, `~/.codex/memory/`, `~/.cursor/memory/`, project-relative `memory/`, `second-brain/`, `vault/`.
- **Memory MCP tools**: `mcp__*memory*__memory_search`, `mcp__*memory*__memory_add`, or any tool whose name includes `memory_search` / `memory_recall` / `vault_search`. Use these for semantic lookup before falling back to research.
- **Memory skills**: `jarvis-plugin:memory-usage`, `superpowers:using-superpowers` (which exposes a memory index), or any skill whose description mentions a personal knowledge base.

Collect found sources into `{MEMORY_SOURCES}`. If empty, that's fine — `{MEMORY_SOURCES}` simply doesn't apply this session.

### Memory-first decision rule

When the leader needs to make a research-style decision — *which library, which pattern, which default, has the user solved this before* — the order is:

1. **Check `{MEMORY_SOURCES}` first.** Search the vault, query the memory MCP, scan the auto-loaded MEMORY index. If the user has a prior decision on this exact topic, use it. Cite it briefly when you act ("Per `decisions/local-llm-runtime-choices`, using llama.cpp + Metal" beats "I picked llama.cpp").
2. **Check `{KNOWLEDGE_PATHS}` next.** The project rules may already mandate a choice.
3. **Only if neither has the answer, escalate to research.** That's when `tech-researcher` becomes appropriate (subject to the spawn gate in `references/escalation.md`).

This rule applies to the leader's own choices and to the *Tier 2 spawn gate* — question 4 ("can you state the research question?") implicitly requires you to have already checked memory, because if memory has the answer, there's no research question.

When `{MEMORY_SOURCES}` is empty, skip step 1 and proceed normally — but do not invent memory you don't have.

### What to pass to sub-agents

Pass `{KNOWLEDGE_PATHS}` (Category A only). Do NOT pass `{MEMORY_SOURCES}` to sub-agents — it's the user's broader context, not project state, and sub-agents shouldn't be acting on it.

---

## Model Selection (for sub-agent spawns)

If your chosen mode does not spawn sub-agents (`main`), skip this section.

At startup, run detection once:

**Claude Code (any provider):** if `ANTHROPIC_DEFAULT_OPUS_MODEL` is set, you're on CC. Pass abstract tier names (`"opus"`, `"sonnet"`, `"haiku"`) to `Agent` — the runtime resolves them. Never hard-code IDs like `claude-opus-4-7`.

**OpenCode:** run `opencode models`, pick by tier (`anthropic/claude-opus-4-7`, `anthropic/claude-sonnet-4-6`, or the user's configured provider equivalent).

**Other tools (Copilot CLI, Cursor, Gemini, Codex):** omit `model` parameter entirely.

**Effort support:** if `ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES` contains `effort`, set `{EFFORT_SUPPORTED}=true`. Otherwise omit effort everywhere.

**Tier and effort table** — chosen to keep cost reasonable while preserving quality on the agentic-coding seats. The "Effort (1M)" column applies *per sub-agent tier* — if the user said only some tiers are 1M, dial effort down only on those tiers and use the 200k column for the rest. (Effort itself is only settable on direct API / OpenCode; in Claude Code, encode the intent in the prompt body — see Step 0 about model resolution.)

| Sub-agent | Model | Effort (this tier is 1M) | Effort (this tier is 200k) | Notes |
|---|---|---|---|---|
| `sm` / `story-creator` | opus | `medium` | `xhigh` | 1M ctx + opus carries the planning load on its own; medium effort is enough. |
| `developer` / `story-developer` / `quick-developer` | sonnet | `medium` | `xhigh` | 1M ctx absorbs the codebase; medium effort is enough for execution work. |
| `tester` / `func-validator` | sonnet | `high` | `high` | Validation needs to actually catch bugs — keep effort up regardless of context. |
| `tech-researcher` (escalation) | opus | `xhigh` | `xhigh` | Escalation = hard problem; give it room regardless of context. |

**Story validation and code review are the leader's job** in every mode — there is no `story-validator` or `code-reviewer` sub-agent. The leader has the full session context and the cheapest path to a correct decision.

---

## Working Directory and Document-First Handoffs

Two non-negotiable rules that apply to every sub-agent in every mode:

### 1. Always spawn at the project root

Every `Agent` call must be issued from the project root — the directory the user invoked `bmad-auto` from (the same directory that contains `_bmad-output/`). Never spawn a sub-agent while your shell is `cd`'d into a subfolder; sub-agents inherit cwd and a wrong cwd makes every relative path in the story file (`tasks/`, `_bmad-output/...`, `src/...`) resolve incorrectly.

In the spawn prompt's *Project Context* section, **state the project root explicitly**:

```
## Working directory
You are operating at the project root: <absolute path, e.g. /Users/me/Works/foo>
All paths in this prompt and in the story file are relative to this root unless
absolute. Do NOT cd into subdirectories — run commands from this root and use
relative paths from here.
```

If the leader needs to run a command itself (build, test, git), do it from project root too. The only legitimate `cd` is into a temporary scratch dir for one-off operations the sub-agents won't touch.

### 2. Document-first handoffs (heavy context lives in files, not messages)

Sub-agents do their thinking in **files**, not in `SendMessage` payloads. The pattern:

- **Developer finishes a story** → writes the full implementation summary, decisions made, files touched, test results, deferrals, and any noteworthy reasoning into the **story file's Dev Notes / Dev Agent Record section** (the slot the BMAD `bmad-create-story` workflow generated). Then sends a *short* message back: `"Done. Story file: <path>. Status: <review|blocked>. Headline: <one line>."`
- **Tester finishes validation** → appends results to a **QA Results / Validation Results section** in the same story file, with PASS/PARTIAL/FAIL, command output snippets, and any warnings. Sends a short message: `"Validation: <PASS|PARTIAL|FAIL>. See QA Results in <path>."`
- **SM finishes story creation** → the workflow already produces the story file; SM just reports `"Story file: <path>. Ready for leader validation."`
- **Leader finishes code review** → writes review findings into a **Review Notes section** of the story file before sending a fix-request to the developer. The fix-request packet then says *"see Review Notes in <story_file>"* instead of pasting 200 lines of findings into the message.
- **For Quick Flow** → use the tech-spec file as the equivalent of the story file. Append a "Dev Notes" section, a "Validation Results" section, etc.

**Why this matters**:
- Messages live in conversation memory and burn context on every relay. Files don't.
- The next sub-agent in line (e.g. tester after developer) reads the story file directly — full context, exactly as written, no leader paraphrase.
- Resume across crashes/restarts becomes trivial: the file is the truth, even if the team is gone.
- Sub-agents can cite their work by file path + section anchor, which is searchable and reviewable later.

**What stays in messages**: short status (one or two sentences), the file path, and anything the leader genuinely needs to see *immediately* to make a decision (e.g. an unrecoverable error message). Anything longer goes in the file.

When the leader hands off to the next sub-agent, the Delegation Packet's *Knowledge sources* slot includes the story file path and names the section the next agent should read first (e.g. `"Read story-1-3.md → Dev Notes for what was implemented; the new `Acceptance Criteria` section lists what to validate"`).

---

## BMAD Skills — Roles and Workflow (canonical mapping)

In the current BMAD setup, **personas and workflows are both exposed as skills** via the `Skill` tool — there's no separate "agent activation" mechanism. A `bmad-agent-*` skill loads the persona's mental model (terminology, decision frame, output expectations); a `bmad-*` workflow skill runs a structured process. Both are invoked the same way.

Sub-agents in bmad-auto are not generic execution workers — each one **invokes a specific BMAD role-skill first** (the persona equivalent), then uses **only BMAD workflow skills** to do its actual work. The role-skill gives the agent the right frame; the workflow skills constrain the agent to a known, repeatable process. The leader never has to reinvent "how should the developer think about this?" — the role-skill already encodes it.

### Role → role-skill → workflow skills

All entries in both columns are invoked via the `Skill` tool — they're regular skills, not a separate persona-activation mechanism. "Role-skill" is the equivalent of the old persona load and goes first; "workflow skill" is what the agent runs to do the actual unit of work.

| bmad-auto role | First action: invoke role-skill | Workflow skills used per request |
|---|---|---|
| `sm` (story creation, sprint planning) | `bmad-agent-pm` | `bmad-create-story`, `bmad-sprint-planning` |
| `developer` (Phase 4) | `bmad-agent-dev` | `bmad-dev-story` |
| `developer` (Quick Flow) | `bmad-agent-dev` | `bmad-quick-dev` |
| `tester` (functional validation) | `bmad-tea` if available, else `bmad-agent-dev` | `manual-testing` if available, else `bmad-testarch-test-design` if available, else `bmad-qa-generate-e2e-tests` — plus bmad-auto's own `references/functional-validation.md` for the runtime smoke / build / infra checks in every case |
| `tech-researcher` | `bmad-agent-analyst` | `bmad-technical-research` |
| Leader — story validation | (no role-skill — the leader does this directly) | `bmad-create-story` invoked in validate mode |
| Leader — code review | (no persona load) | `bmad-code-review` |
| Leader — epic completion | (no persona load) | `bmad-sprint-status`, `bmad-retrospective` |
| Leader — spec/PRD/architecture writes | (no persona load) | `bmad-create-prd`, `bmad-create-architecture`, `bmad-correct-course` |

### Tester role-skill availability check (one-time, at startup)

The tester slot has fallbacks because the dedicated test-engineering skills (`bmad-tea`, `manual-testing`, `bmad-testarch-test-design`) aren't installed in every BMAD environment. At session start, the leader checks the available-skills list once and locks in:

- `{TESTER_PERSONA}` = `bmad-tea` if it appears in the available skills list; otherwise `bmad-agent-dev`.
- `{TESTER_SKILL}` = the first match in this preference order from the available skills list:
  1. `manual-testing` (preferred — closest fit to the runtime-smoke + main-cases approach light validation needs)
  2. `bmad-testarch-test-design` (test architecture / design fallback)
  3. `bmad-qa-generate-e2e-tests` (always available; generates E2E tests when the project warrants them)

The runtime smoke / build / infra checks from `references/functional-validation.md` apply **in every case** — they're bmad-auto's own contribution to functional validation and don't depend on which BMAD test skill is available. The chosen `{TESTER_SKILL}` is what the tester invokes when the work is "design or generate tests"; the functional-validation reference is what the tester (and leader) follows when the work is "build the app, run it, smoke-check the main cases."

Substitute the resolved values into every tester spawn prompt and Delegation Packet — don't paste the conditional table.

### Role-skill invocation rule

The **first thing** a sub-agent does on first spawn is invoke its role-skill via the `Skill` tool. The role-skill's frame stays in effect for the agent's lifetime — in `team-persistent` mode that's the whole epic; in `team-respawn` it's one step. The leader names the role-skill explicitly in the spawn prompt:

```
## First action — invoke your BMAD role-skill
Invoke: Skill tool with skill name "bmad-agent-dev"
This loads the BMAD developer role frame and its menu of workflow commands.
Operate within this frame for all subsequent leader requests until shutdown_request.
```

Don't conflate "which role-skill to invoke" with "which workflow skill to run for this story." They're separate Skill calls — role-skill once at spawn, workflow skill on every leader request.

### Workflow-only rule

Sub-agents may invoke **only** BMAD workflow skills (the `bmad-*` family — `bmad-create-story`, `bmad-dev-story`, `bmad-quick-dev`, `bmad-code-review`, etc.) plus the small set of language-specific helpers their role-skill's menu calls out (e.g. `typescript-clean-code`, `typescript-unit-testing`). If a task surfaces that doesn't fit the BMAD catalog — a research question outside the workflow's scope, an unfamiliar architecture call, a tooling decision the role-skill doesn't cover — the agent does **not** improvise. It reports to team-lead and waits for guidance.

The leader's first move when a sub-agent reports "this doesn't fit a workflow" is to invoke **`bmad-help`** to get the BMAD framework's own advice on the right next workflow or skill. Only after `bmad-help`'s recommendation runs out does the leader fall back to `bmad-correct-course` (real workflow drift) or Tier 3 escalation (user intervention).

### Why constrain sub-agents to BMAD skills?

Two reasons. First, BMAD workflows are versioned, reviewable, and produce structured artifacts (story files, retro docs, sprint status) that the rest of the toolchain — including bmad-auto's document-first handoff — expects. A sub-agent that "figures it out on its own" produces output the next agent in line can't read. Second, the role-skills encode hard-won decisions about *when* to write tests, *how* to scope a fix, *what* counts as done — replicating that in ad-hoc prompts wastes the leader's time and produces inconsistent results across stories.

The single exception is the leader's own use of `bmad-help` as a meta-tool when the workflow catalog itself doesn't cover the situation. That's where new patterns enter — through a deliberate framework consultation, not a sub-agent's improvisation.

---

## The One Rule for Every Sub-Agent Prompt

Every sub-agent prompt **must** start with this header (call it `{AGENT_HEADER}` in the mode files). It has two parts: who you are in the bigger picture, then the hard rules.

```
## You are a sub-agent of the bmad-auto skill

The leader (team-lead) is running the bmad-auto orchestrator skill. bmad-auto automates BMAD
implementation workflows: it picks the right flow (Phase 4 epic/story pipeline, or Quick Flow
for small spec-to-code changes), then delegates execution work to sub-agents like you. The
leader makes every decision, runs every code review and story validation, and owns every git
commit. Your job is to execute one well-scoped piece of that work and report back.

You are NOT a standalone agent. You are part of a larger orchestrated workflow. Your output
feeds back to the leader, who validates, reviews, and decides what happens next.

Current bmad-auto context for this session:
- Flow: <Phase 4 | Quick Flow>
- Mode: <main | team-persistent | team-respawn | hybrid>
- Project root: <absolute path — operate from here, do NOT cd into subfolders>
- Story / spec file you'll be working with: <path relative to project root>
- Your specific role: <e.g. "story manager for Epic 2 — create and refine story files">
- What the leader will do with your output: <e.g. "validate the story spec, then send it to
  the developer; if the spec has gaps the leader will send you a fix-request packet">

## First action — invoke your BMAD role-skill
Before doing anything else, invoke the Skill tool with skill name: <role-skill,
e.g. "bmad-agent-dev">. This loads the BMAD role frame you'll operate within for
your lifetime in this team. Stay in this frame until you receive shutdown_request.
The role-skill's menu of workflow commands is what you operate within.

## Hard rules
- Do NOT make any git commits. The leader handles all git operations.
- Do NOT make scope or design decisions. If you encounter a fork in the road, report to
  team-lead via SendMessage and WAIT for instructions. Do not pick a path yourself.
- Do NOT skip steps you were asked to do. If a step is impossible, report and wait.
- Do invoke ONLY the BMAD workflow skill the leader names (`bmad-*` family),
  plus whatever language helpers your role-skill's menu allows. Do not improvise with
  non-BMAD skills.
- If a task doesn't fit a BMAD workflow, do NOT improvise. Report to team-lead — they
  will consult `bmad-help` to find the right BMAD path forward.
- When you receive a shutdown_request, approve it.

## Document-first handoff rule
Your detailed work goes into the story / tech-spec file (in the Dev Notes / QA Results /
Review Notes section the BMAD template provides), not into SendMessage payloads. When you
report back to team-lead, the message stays short:
  "Done. <File>: <path>. Status: <one word>. Headline: <one line>."
The leader reads the file for the full picture; the next sub-agent in the chain reads the
same file. This keeps everyone's context lean and the handoff durable.

You may receive messages from teammates. Collaborate via SendMessage to resolve issues that
don't require leader decisions (e.g., asking the developer for a file path).
```

Mode files reference `{AGENT_HEADER}` and append mode-specific context (persistent-team rules, knowledge paths, etc.). **The leader fills in the bracketed `<...>` placeholders concretely on every spawn — never leave them generic.** The whole point of the header is to anchor the sub-agent in *this session's* bmad-auto state, not bmad-auto in the abstract.

---

## The Delegation Packet — every handoff must use it

Every message you send to a sub-agent — first spawn, feedback round, fix request, escalation — is a **Delegation Packet**. The packet's purpose is to prevent context loss at every handoff: don't compress "4 detailed findings with reasoning" into "apply the 4 fixes" — the specifics are the load-bearing parts.

**Read `references/delegation-packet.md`** for the full template (8 slots) plus three worked examples (reviewer-fixes-issues handoff, story-developer feedback round, escalation to tech-researcher). Read it the first time you compose a packet in a session — the shape is much clearer with concrete examples than from a bullet list.

The slots, at a glance: *Task / Why this matters / Skill to invoke / Prior findings (verbatim) / Specific actions / Knowledge sources / Success criteria / Where to write detailed work / Report back with*. Detail and worked examples in the reference.

---

## When to use the researcher

The researcher is a **lazy, on-demand** sub-agent. Don't pre-spawn one at startup, don't keep one alive "just in case." Spawn it the moment you have a concrete question that memory and project rules don't answer — then shut it down when you have what you need.

### Spawn the researcher freely when…

- **Planning ambiguity.** Unclear intent in a story or spec, unclear architectural direction, unclear best-practice for a pattern, "should we use X or Y?" decisions that would benefit from current docs and community practice.
- **Design decisions during story creation or quick-spec.** "What's the right way to model this?", "Which library handles this case?", "Is this approach idiomatic?"
- **Worker stuck after Tier 1 (2 leader-feedback rounds)** on a technical problem (dependency conflict, error decoding, API behavior, performance bottleneck).
- **Story/spec touches an unfamiliar area** and you want to avoid the worker burning rounds discovering basics the researcher could surface in one pass.

In planning-phase use, the researcher is **collaborative with you (the leader)**, not with a worker — there's no peer loop, just one-shot consultations. After Tier 1 escalation, it's a peer to the stuck worker.

### Always check memory first (it's free)

Before issuing the `Agent` call:

1. **Search `{MEMORY_SOURCES}`** — vault, memory MCP, auto-loaded MEMORY index. If the user has a prior decision on this exact topic, use it. Cite it ("Per `decisions/local-llm-runtime-choices`, using llama.cpp + Metal").
2. **Check `{KNOWLEDGE_PATHS}`** — project rules may already mandate a choice.
3. **Otherwise spawn the researcher.** Don't halt to the user just because memory is empty — research is exactly what the researcher is for.

This is a sequence, not a gate — memory check takes seconds and is free. It just prevents redundant research where the answer already exists.

### Don't spawn the researcher when…

- **The question is non-technical.** Scope ambiguity, missing PRD/AC information, business decisions, "which feature comes first?", infrastructure the user controls (API keys, accounts, secrets). Those go to the user, not the researcher.
- **You haven't formed a question yet.** "Help me with this" produces vague research. State the question in one specific paragraph first; if you can't, investigate one more round before researching.
- **Memory or project rules already answered it.** Apply the existing decision; don't re-research.
- **A researcher is already alive on a related question.** Reuse it via SendMessage rather than spawning a second one.

### Three escalation tiers when a worker is stuck

For worker blockers specifically (not planning-phase ambiguity), follow the standard ladder:

1. **Leader feedback** — up to 2 rounds of Delegation Packets with concrete fix instructions.
2. **Collaborative researcher** — spawn `tech-researcher` peer-to-peer with the stuck worker (up to 3 message rounds). Leader monitors, does not relay.
3. **Halt for user** — shut down agents, report full context, wait. Used for non-technical blockers (scope, PRD gaps, business decisions) or when Tier 2 also failed.

> **Reference** — `references/escalation.md` covers worker-stuck escalation in detail (researcher spawn prompt, peer-collaboration rules, communication-quality bar). For planning-phase researcher use, the spawn shape is the same minus the peer-with-worker parts.

---

## Functional Validation Strategy

Functional validation runs on the developer's output to catch issues unit tests can't. The strategy depends on **how many stories the epic contains**:

- **Epic has ≤3 stories**: run **full functional validation** for each story.
- **Epic has >3 stories**: run **light validation** for each story (build + bring the app up locally or via Docker + smoke-check the main cases), and run the **full functional suite once at epic completion**. Unit tests are not part of light — they're verified during code review.

The "light vs full" definition and the project-type detection (web app, embedded, CLI, etc.) live in `references/functional-validation.md`. Read it when you reach a validation step.

---

## Critical Rules (read before every implementation step)

1. **Leader does all git commits.** Sub-agents never run `git commit`. Period. Why: commits are decisions about what ships; sub-agents don't have the cross-step view to make them safely.
2. **Leader makes all decisions.** Story validation, code review, scope calls, escalation triggers — all leader. Sub-agents execute and report. Why: decisions need the leader's full conversation context, which sub-agents don't have.
3. **Leader gives sub-agents the exact role-skill AND workflow skill to invoke.** First action on spawn = invoke the BMAD role-skill (`bmad-agent-dev`, `bmad-agent-pm`, `bmad-agent-architect`, `bmad-agent-analyst` per the canonical mapping). Per-request action = invoke the named workflow skill (`bmad-create-story`, `bmad-dev-story`, `bmad-quick-dev`, etc.). Both go through the `Skill` tool. Never write "figure out which skill to use" — and never let a sub-agent invoke a non-BMAD skill outside its role-skill's menu.
4. **One sub-agent per execution step.** Don't combine "develop + test + review" into one agent. Why: separation lets the leader review each step's output before the next begins; combining defeats that.
5. **Follow BMAD workflows.** Don't bypass slash command workflows that the project depends on. Workflows produce the structured artifacts (story files, retro docs, sprint status) that the next step expects.
6. **Respect epic order.** Epics are sequentially dependent.
7. **Align with architecture/PRD.** Misalignment → invoke `bmad-correct-course`. Why: drift becomes invisible debt fast; correct course is cheaper than rework later.
8. **Always attempt build validation before commit.** Never commit code that doesn't compile.
9. **Every handoff is a Delegation Packet.** No "apply the fixes" one-liners. The packet's specifics are what prevent the next round from rediscovering everything.
10. **Verify infrastructure, not just tests.** When a story touches Docker / DB / queue / external API, functional validation must hit the real thing or report PARTIAL. Why: mocked unit tests can pass perfectly while real infra is misconfigured — that class of bug compounds across stories.
11. **Act on retro findings.** Items marked CRITICAL or HIGH at retro = pre-flight checks for the next epic. The retro isn't documentation; it's a checklist.
12. **In `auto-commit` mode, still ask before destructive ops.** Auto-commit covers the happy path only — force-push, branch deletion, merging into main always require explicit approval.
13. **Researcher is lazy, not gated.** Don't pre-spawn or keep one alive "just in case." Do spawn freely the moment you hit planning ambiguity, an unclear architecture/intent/approach, or a design decision where best-practices research would help. Shut it down once the question is answered.
14. **Memory before research, research before halting.** Before researching, check `{MEMORY_SOURCES}` and `{KNOWLEDGE_PATHS}` — if the user has a prior decision or the project rules cover it, use that and cite it. If neither source has the answer, spawn the researcher; don't halt to the user just because memory is empty. Halt only for non-technical blockers (scope, PRD gaps, business decisions).
15. **Spawn sub-agents from project root.** Every `Agent` call must be issued at the project root (the directory containing `_bmad-output/`), and the spawn prompt must explicitly state the absolute project root path so sub-agents anchor relative paths correctly. Never spawn from a subfolder. Why: sub-agents inherit cwd, and a wrong cwd silently breaks every relative path in the story file.
16. **Document-first handoffs.** Sub-agents write their detailed work — implementation summaries, validation results, review findings — into the **story file** (Phase 4) or **quick-doc file** (Quick Flow), not into `SendMessage` payloads. Reports back to the leader stay short: status, file path, headline. The next sub-agent in line reads the file directly. This keeps the leader's conversation context lean and gives every handoff a durable, resumable artifact.
17. **Sub-agents work only via BMAD role-skills and workflow skills.** Every sub-agent invokes its assigned BMAD role-skill first and uses only BMAD workflow skills (the `bmad-*` family) for the work itself. No improvisation. If a task doesn't fit the workflow catalog, the agent reports to team-lead; the leader invokes `bmad-help` to find the right BMAD-recommended next step before falling back to `bmad-correct-course` or Tier 3 halt.
18. **Measure persistent sub-agent context, don't trust self-report.** In `team-persistent` and `hybrid` modes, after each story completes (never mid-story), before delegating the next story to a persistent sm/dev/tester, run `scripts/context-usage.py --agent-name <name> --context-window <window>`. The script returns `ok` (keep going) or `respawn-with-handover` (the agent crossed a threshold or already auto-compacted). On `respawn-with-handover`, follow the protocol in `modes/team-persistent.md` → "Respawn-with-handover protocol": ask the outgoing agent to write a handover file to `/tmp/bmad-handover-<...>.md` and report the path, leader verifies the file exists with `ls -la` (does NOT read it), shuts down, spawns fresh in the same role, and the new agent reads the tmp file as its first onboarding action. The leader passing only the path keeps its own context lean. Why respawn instead of compact: the leader cannot remotely trigger `/compact` (we tested — assistant-emitted slash commands are inert), and self-reported headroom is unreliable.

> Note on `sprint-status.yaml`: re-read it after every Phase 4 sub-agent report. It's the ground truth for "what step are we on" and surviving crash-resume. (Not a numbered rule because every Phase 4 step in `flows/phase-4.md` already calls this out at the point of use.)

---

## Where to read next

- `modes/<your-chosen-mode>.md` — how to execute steps in your mode (sub-agent spawning, lifecycle, when to reuse).
- `flows/phase-4.md` or `flows/quick-flow.md` — the actual step-by-step.
- `references/delegation-packet.md` — handoff template + examples.
- `references/escalation.md` — tier 2/3 details.
- `references/functional-validation.md` — light vs full validation, project-type detection.
- `references/guides/` — project-type-specific validation playbooks (read on-demand).
- `scripts/context-usage.py` — measure a persistent sub-agent's actual context usage from its session transcript. Run between stories to decide keep-alive vs compact vs respawn. See Critical Rule #18 and `modes/team-persistent.md` → "Context-budget check between stories".
