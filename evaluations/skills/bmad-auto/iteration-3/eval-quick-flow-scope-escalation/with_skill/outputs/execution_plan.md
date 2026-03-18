# Execution Plan: Quick Flow Scope Escalation

## Scenario

The `quick-developer` sub-agent (running Quick Flow Step 2) has reported back that
the rate limiting change is far larger than expected -- it needs API gateway changes,
a new shared Redis cluster config, and updates to 12 microservices. The sub-agent
recommends proper architecture planning first.

---

## 1. Flow Detected: Quick Flow (already in progress)

**Why Quick Flow:** The session is already mid-execution in Quick Flow. The rate
limiting change was originally routed through Quick Flow (likely because the user
described it as a small/well-understood change, or provided a tech-spec). The
orchestrator had already completed Quick Flow Step 1 (tech-spec creation) and spawned
the `quick-developer` sub-agent for Step 2 (implementation).

The sub-agent's report is not a normal completion -- it is a **scope escalation
signal**, which triggers the "Quick Flow Scope Escalation" section of the skill
(lines 247-254 of SKILL.md).

---

## 2. How the Scope Escalation Is Handled

The skill defines a specific protocol at **"Quick Flow Scope Escalation"** (SKILL.md
lines 247-254). The orchestrator recognizes that the sub-agent's report matches the
escalation criteria:

> "If a sub-agent reports the scope exceeds Quick Flow (needs architecture decisions,
> spans too many components, requires stakeholder alignment)"

The report hits all three triggers:
- **Needs architecture decisions** -- new shared Redis cluster config, API gateway changes
- **Spans too many components** -- 12 microservices affected
- **Requires stakeholder alignment** -- the sub-agent itself recommends "proper architecture planning"

### Orchestrator Actions (in sequence):

**Action 1: Shut down the `quick-developer` sub-agent**
- Tool: `SendMessage` to `quick-developer` with `shutdown_request`
- The developer's work is done for now; it cannot proceed.

**Action 2: Report findings to the user**
- The orchestrator surfaces the sub-agent's full report to the user, explaining:
  - What the sub-agent found (API gateway, Redis cluster, 12 microservices)
  - Why this exceeds Quick Flow scope
  - That the sub-agent recommends architecture planning

---

## 3. Options Presented to the User

Per the skill, the orchestrator presents exactly **two options**:

### Option A: Light -- Re-run `bmad-quick-spec` for a more detailed spec, then retry

- This means: spawn a new `quick-spec-creator` sub-agent to invoke `bmad-quick-spec`
  again, but with the expanded understanding of scope.
- The new spec would account for API gateway changes, Redis cluster config, and the
  12 microservice updates.
- After the spec is approved, Quick Flow Step 2 would be re-attempted with the
  revised, more detailed tech-spec.
- **Best for:** When the user believes this can still be handled as a single
  (larger) implementation pass without full BMAD planning phases.

### Option B: Heavy -- Switch to full BMAD Phases 1-4

- This means: transition to the full Phase 4 pipeline, which includes proper
  architecture planning, epic/story breakdown, sprint planning, and sequential
  story implementation.
- The existing tech-spec carries forward -- it becomes input to the Phase 1-3
  planning artifacts. No work is lost.
- **Best for:** When the user agrees with the sub-agent that this needs proper
  architecture planning, stakeholder alignment, and structured epic/story breakdown.

The orchestrator then **waits for the user's decision**. It does NOT proceed
autonomously.

---

## 4. Whether Existing Work Is Preserved

**Yes, all existing work is preserved.** Specifically:

- **The tech-spec file** (`tech-spec-{slug}.md`) remains on disk in
  `_bmad-output/implementation-artifacts/`. It is not deleted or modified.
- **Any code changes** the `quick-developer` may have started are preserved in
  the working tree (uncommitted, since sub-agents never commit).
- **If Option A (Light) is chosen:** The existing tech-spec is either revised or
  replaced by a new, more detailed one. The user reviews before proceeding.
- **If Option B (Heavy) is chosen:** The skill explicitly states "The tech-spec
  carries forward -- no work lost." It feeds into the Phase 1-4 planning as
  context and prior analysis.

---

## 5. Complete Sequence of Actions

### What already happened (prior to this moment):
1. User described the rate limiting change (or provided a spec)
2. Orchestrator detected Quick Flow (small/well-understood change)
3. Orchestrator created team: `TeamCreate { team_name: "bmad-auto" }`
4. Orchestrator scanned for project knowledge sources (`{KNOWLEDGE_PATHS}`)
5. (If no spec existed) Quick Flow Step 1: Spawned `quick-spec-creator`, tech-spec
   was created and approved
6. Quick Flow Step 2: Spawned `quick-developer` with `bmad-quick-dev` skill and
   the tech-spec path

### What happens now (this execution plan):

| # | Action | Tool/Method | Details |
|---|--------|-------------|---------|
| 1 | Receive sub-agent report | `SendMessage` from `quick-developer` to `team-lead` | Report says scope exceeds Quick Flow: API gateway, Redis cluster, 12 microservices, recommends architecture planning |
| 2 | Recognize scope escalation | Orchestrator logic | Matches escalation criteria: architecture decisions needed, too many components, stakeholder alignment |
| 3 | Shut down `quick-developer` | `SendMessage` with `shutdown_request` to `quick-developer` | Sub-agent approves shutdown per `{AGENT_HEADER}` instructions |
| 4 | Report to user | Direct output | Present the sub-agent's findings: what was discovered, why it exceeds Quick Flow, the sub-agent's recommendation |
| 5 | Present two options | Direct output | **Light**: Re-run `bmad-quick-spec` for a more detailed spec, then retry Quick Flow. **Heavy**: Switch to full BMAD Phases 1-4; tech-spec carries forward, no work lost. |
| 6 | Wait for user decision | Pause | Do NOT proceed until user chooses Option A or B |

### If user chooses Option A (Light):

| # | Action | Tool/Method | Details |
|---|--------|-------------|---------|
| 7a | Spawn `quick-spec-creator` | Sub-agent with `bmad-quick-spec` skill | New spec incorporates expanded scope (API gateway, Redis, 12 services) |
| 8a | Review and present spec | Read spec, summarize to user | Ask user to approve or request changes (up to 3 rounds) |
| 9a | On approval, shut down spec creator | `shutdown_request` | |
| 10a | Spawn `quick-developer` | Sub-agent with `bmad-quick-dev` skill | Execute revised tech-spec |
| 11a | Continue Quick Flow Steps 2-5 | Normal Quick Flow | Implementation, code review, functional validation, commit |

### If user chooses Option B (Heavy):

| # | Action | Tool/Method | Details |
|---|--------|-------------|---------|
| 7b | Transition to Phase 4 | Orchestrator switches flow | Tech-spec file preserved as input context |
| 8b | Check `sprint-status.yaml` | Read file | If missing, invoke `bmad-help` for guidance on starting Phases 1-3 |
| 9b | Run full BMAD Phases 1-3 first | Various BMAD skills | PRD, architecture doc, epic/story breakdown, sprint planning |
| 10b | Enter Phase 4 Main Loop | Standard Flow | Epic start, story loop (create, validate, develop, review, validate, commit) |

---

## Key Observations

1. **The skill handles this gracefully.** Scope escalation is an explicit, documented
   path -- not an error condition. The orchestrator does not panic or retry blindly.

2. **User agency is preserved.** The orchestrator presents options and waits. It does
   not unilaterally decide to switch flows.

3. **No work is lost.** The tech-spec and any partial code changes survive the
   transition regardless of which option the user chooses.

4. **The escalation is distinct from the retry escalation ladder.** The scope
   escalation (Quick Flow too small) is a separate mechanism from the
   troubleshooting escalation ladder (orchestrator feedback -> collaborative
   escalation -> halt for user). The sub-agent is not "stuck" -- it is reporting
   that the problem itself is too large for the current workflow.
