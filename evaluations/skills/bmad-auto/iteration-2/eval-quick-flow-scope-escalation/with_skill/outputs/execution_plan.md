# Execution Plan: Quick Flow Scope Escalation — Rate Limiting Change

## Scenario

The orchestrator is in **Quick Flow Step 2 (Implement)** when the "quick-developer" sub-agent
reports back that the rate limiting change is much larger than expected. It requires:
- Changes to the API gateway
- A new shared Redis cluster config
- Updates to 12 microservices

The sub-agent recommends proper architecture planning first.

## Relevant SKILL.md Section

This scenario triggers the **Quick Flow Scope Escalation** logic (lines 395-405 of SKILL.md):

> If during Quick Flow Step 1 (spec creation) or Step 2 (implementation), the sub-agent reports
> that the scope exceeds what Quick Flow can handle (e.g., requires architectural decisions,
> spans too many components, needs stakeholder alignment):
>
> 1. Report the escalation recommendation to the user.
> 2. Offer options:
>    - **Light escalation**: Run `bmad-quick-spec` first to create a more detailed spec, then retry
>    - **Heavy escalation**: Switch to the full BMAD flow (Phases 1-4). The tech-spec carries
>      forward as input to the PRD process — no work is lost.
> 3. Wait for the user's decision before proceeding.

## Step-by-Step Execution Plan

### Step 1: Receive the Sub-Agent Report

The "quick-developer" sub-agent sends a `SendMessage` to the team lead (orchestrator) with:
- `type: "message"`
- Content indicating scope escalation: the change requires API gateway modifications, a new
  shared Redis cluster configuration, and updates across 12 microservices
- Recommendation: proper architecture planning is needed before implementation

The orchestrator receives this message via the team communication channel.

### Step 2: Orchestrator Evaluates the Report

The orchestrator recognizes this as a **scope escalation** situation, not a typical blocker.
Key indicators:
- Sub-agent explicitly says the scope exceeds Quick Flow capacity
- The change spans multiple components (API gateway + Redis cluster + 12 microservices)
- Architectural decisions are required (new shared infrastructure)
- This is NOT a case for the escalation ladder (orchestrator feedback -> collaborative
  escalation -> halt) because the issue is scope, not a technical blocker

Decision: **Trigger Quick Flow Scope Escalation** (not the standard error handling path).

### Step 3: Report Escalation to the User

The orchestrator would present the following message to the user:

```
The quick-developer sub-agent has reported that the rate limiting change exceeds
Quick Flow scope. Here's what was found:

- The change requires modifications to the API gateway
- A new shared Redis cluster configuration is needed
- 12 microservices need to be updated
- The sub-agent recommends proper architecture planning first

This is too large for the Quick Flow pipeline. Here are your options:

**Option A — Light Escalation:**
  Run `bmad-quick-spec` to create a more detailed, comprehensive tech-spec that
  breaks down the work into manageable pieces. Then retry Quick Flow with the
  improved spec. Best if the architecture is mostly clear and you just need a
  better task breakdown.

**Option B — Heavy Escalation:**
  Switch to the full BMAD flow (Phases 1-4). This means:
  - Phase 1: Create a PRD with proper requirements analysis
  - Phase 2: Architecture document covering the API gateway changes, Redis
    cluster design, and microservice integration plan
  - Phase 3: Epic and story breakdown for the full scope
  - Phase 4: Sequential implementation with validation

  The existing tech-spec carries forward as input to the PRD process — no work
  is lost.

Which option would you like to proceed with?
```

### Step 4: Wait for User Decision

The orchestrator **pauses and waits** for the user's response. It does NOT proceed
automatically. The "quick-developer" sub-agent remains alive (it has not been shut down yet)
in case the user wants additional details about what was discovered.

### Step 5a: If User Chooses Light Escalation (Option A)

1. **Shut down "quick-developer"** sub-agent:
   ```
   SendMessage: {
     type: "shutdown_request",
     recipient: "quick-developer",
     content: "Scope escalation acknowledged. Shutting down for re-spec."
   }
   ```

2. **Spawn "quick-spec-creator"** sub-agent in team "bmad-auto":
   ```
   Agent tool:
     name: "quick-spec-creator"
     team_name: "bmad-auto"
     prompt: |
       You are a BMAD team sub-agent. Do NOT make any git commits.

       Invoke the Skill tool with:
       - skill: "bmad-quick-spec"

       Follow the quick-spec workflow completely.

       The user's request: Implement rate limiting across the platform. Previous
       investigation found this requires: API gateway changes, a new shared Redis
       cluster config, and updates to 12 microservices. Create a comprehensive
       tech-spec that properly scopes this work.

       Report results to the team lead via SendMessage when the spec is ready.
       Include the tech-spec file path in your report.

       When you receive a shutdown_request, approve it.
   ```

3. **On sub-agent report**: Read the new tech-spec, present summary to user, ask for approval.

4. **If approved**: Shut down "quick-spec-creator", proceed to Quick Flow Step 2 with the
   new, more detailed spec.

5. **If the new spec ALSO recommends heavy escalation**: Report to user again and recommend
   Option B (heavy escalation).

### Step 5b: If User Chooses Heavy Escalation (Option B)

1. **Shut down "quick-developer"** sub-agent:
   ```
   SendMessage: {
     type: "shutdown_request",
     recipient: "quick-developer",
     content: "Scope escalation to full BMAD flow. Shutting down."
   }
   ```

2. **Clean up the team**:
   ```
   TeamDelete (automatically cleans up team and task files)
   ```

3. **Inform the user** that the Quick Flow is complete and the full BMAD flow should be
   initiated. The existing tech-spec at `_bmad-output/implementation-artifacts/tech-spec-*.md`
   will serve as input for Phase 1 (PRD creation).

4. **Invoke `skill: "bmad-help"`** to suggest next actions for starting the full BMAD flow
   (Phases 1-3 planning, then Phase 4 implementation).

5. **Stop and wait** for the user to initiate the full BMAD pipeline.

## Tools That Would Be Called

| Order | Tool | Purpose |
|-------|------|---------|
| 1 | (Receive) SendMessage from "quick-developer" | Receive scope escalation report |
| 2 | (Output to user) | Present escalation options A and B |
| 3 | (Wait) | Wait for user decision |
| 4a | SendMessage (shutdown "quick-developer") | Shut down the developer sub-agent |
| 5a | Agent tool (spawn "quick-spec-creator") | Light escalation: re-spec |
| — OR — | | |
| 4b | SendMessage (shutdown "quick-developer") | Shut down the developer sub-agent |
| 5b | TeamDelete | Clean up the team |
| 6b | Skill tool ("bmad-help") | Suggest next steps for full BMAD flow |

## Decision Points

1. **Is this a scope escalation or a technical blocker?**
   - Answer: Scope escalation. The sub-agent explicitly says the work is bigger than expected
     and recommends architecture planning. This is not a build failure or code issue — it's a
     scope mismatch.

2. **Should the orchestrator attempt the standard escalation ladder first?**
   - Answer: No. The standard escalation ladder (orchestrator feedback -> collaborative
     escalation with tech-researcher -> halt) is for technical blockers, not scope issues.
     The SKILL.md has a dedicated "Quick Flow Scope Escalation" section that takes priority.

3. **Should any existing work be discarded?**
   - Answer: No. The SKILL.md explicitly states "The tech-spec carries forward as input to
     the PRD process — no work is lost." Any investigation or partial spec work is preserved.

4. **Which escalation option is more appropriate for this scenario?**
   - Analysis: Given the scope (API gateway + Redis cluster + 12 microservices), **Heavy
     Escalation (Option B)** is likely the better fit because:
     - New shared infrastructure (Redis cluster) requires architectural decisions
     - 12 microservices implies cross-team coordination concerns
     - API gateway changes are foundational and affect all services
   - However, the orchestrator presents both options and lets the user decide.

## Key Observations

- The orchestrator correctly does NOT try to push through with implementation
- The orchestrator does NOT attempt the standard error-handling escalation ladder (feedback
  rounds, tech-researcher collaboration) because this is a scope issue, not a technical blocker
- The user is always in control of the escalation decision
- No work is lost regardless of which option is chosen
- The "quick-developer" sub-agent is kept alive until the user makes a decision, in case
  additional details are needed about what was discovered during investigation
