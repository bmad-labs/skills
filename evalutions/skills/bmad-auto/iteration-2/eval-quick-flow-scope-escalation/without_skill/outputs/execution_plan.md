# Execution Plan: Handling Sub-Agent Scope Escalation (Without Skill Guidance)

## Scenario

The quick-developer sub-agent was assigned a rate limiting change. Mid-implementation, it reported the task is much larger than expected:
- Requires changes to the API gateway
- Needs a new shared Redis cluster configuration
- Requires updates to 12 microservices
- Recommends proper architecture planning first

## What I Would Do (General Knowledge Only)

### Step 1: Acknowledge the Escalation

Accept the sub-agent's recommendation to pause implementation. There is no predefined escalation protocol or skill guidance available, so I would rely on general best practices.

### Step 2: Assess the Situation

I would ask clarifying questions or review any artifacts the sub-agent produced:
- What specific changes were attempted so far?
- Which 12 microservices are affected and why?
- What is the Redis cluster dependency -- is it new infrastructure or reconfiguration?
- Is there a partial implementation that needs to be reverted or shelved?

### Step 3: Document Current State

Create a summary document capturing:
- Original task scope (rate limiting change)
- Discovered actual scope (API gateway + Redis cluster + 12 microservices)
- Any work already completed
- The sub-agent's rationale for escalation

### Step 4: Recommend Next Actions

Without a skill or workflow to guide escalation, I would recommend the following to the user:

1. **Stop current implementation** -- Do not continue with piecemeal changes across 12 services without a plan.
2. **Create an architecture design document** covering:
   - Rate limiting strategy (token bucket, sliding window, etc.)
   - Redis cluster topology and configuration
   - API gateway integration pattern
   - Per-service change requirements for all 12 microservices
   - Rollout strategy (phased vs. big-bang)
3. **Break the work into smaller deliverables** -- e.g., phase 1 could be Redis cluster + API gateway, phase 2 could be microservice updates in batches.
4. **Get stakeholder review** on the architecture before resuming implementation.

### Step 5: Report Back to User

Present the findings and recommendations, letting the user decide how to proceed.

## Tools I Would Use

| Step | Tool | Purpose |
|------|------|---------|
| 1 | None | Mental acknowledgment of escalation |
| 2 | Read, Grep, Glob | Review any files the sub-agent produced or referenced |
| 3 | Write | Create a state summary document |
| 4 | Write | Draft architecture planning recommendations |
| 5 | Direct output | Communicate findings to the user |

## Gaps Without Skill Guidance

Without a defined skill or workflow for this scenario, the following are notably absent:

- **No formal escalation protocol** -- There is no predefined threshold for when a sub-agent should escalate vs. continue. I am reacting to the sub-agent's judgment.
- **No structured decision framework** -- No criteria for evaluating whether to proceed, pause, or redesign. I am using general engineering judgment.
- **No role separation** -- I am acting as both the orchestrator and the architect. A proper workflow might route this to a dedicated architect agent or role.
- **No template for scope change documentation** -- I would create an ad-hoc document rather than filling in a standardized template.
- **No automated re-planning** -- The task breakdown into phases is manual and based on general knowledge, not driven by a systematic analysis of dependencies.
- **No feedback loop definition** -- No defined process for how the revised plan gets validated before work resumes.
- **No cost/impact analysis framework** -- No structured way to compare "do it quick and dirty" vs. "do it right with architecture planning" in terms of time, risk, and technical debt.

## Summary

The core response is straightforward: stop, document, plan, then resume. However, without skill guidance, the process is ad-hoc, relies heavily on general knowledge, and lacks the structured guardrails that would ensure consistency, completeness, and proper stakeholder communication in a real orchestration scenario.
