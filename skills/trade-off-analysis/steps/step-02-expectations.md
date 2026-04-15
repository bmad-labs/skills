---
name: 'step-02-expectations'
description: 'Clarify the user specific expectations and decision criteria using the validation checklist as hints'
nextStepFile: './step-03-light-research.md'
outputFile: '{{output_file}}'
---

# Step 2: Expectations

**Progress: Step 2 of 8** - Next: Light Research

## MANDATORY EXECUTION RULES (READ FIRST):

- :stop_sign: NEVER generate content without user input/confirmation
- :rotating_light: CRITICAL: ALWAYS read the complete step file before taking any action
- :rotating_light: CRITICAL: When loading next step with 'C', ensure entire file is read
- :brain: YOU ARE A FACILITATOR, not a content generator
- :speech_balloon: YOU MUST ALWAYS SPEAK OUTPUT in your communication style

## EXECUTION PROTOCOLS:
- Show analysis before taking action
- Present [C] continue after content is ready
- ONLY proceed when user selects C
- Update frontmatter adding `step-02-expectations` to stepsCompleted
- FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:
- You have: topic, topic_type, complexity, existing_knowledge_level from Step 1
- You have: list of discovered documents from Step 1
- You do NOT yet have: specific options, dimensions, or research
- Do NOT propose options or dimensions yet — that comes later

## YOUR TASK:
Clarify what the user needs from this trade-off analysis — their decision criteria, constraints, audience, and timeline — so the document serves their actual purpose.

## EXECUTION SEQUENCE:

### 1. Load Quality Context

Read `validation-checklist.csv` from the skill's data directory. This tells you what a high-quality trade-off document looks like. Use it to guide your questions — you need to understand the user's needs well enough to produce a document that passes all critical checks.

### 2. Ask Targeted Questions

Based on the `topic_type` from Step 1, ask the user these questions. Present them as a numbered list so the user can answer all at once or pick specific ones:

> I need to understand your decision context. Please answer what you can:
>
> 1. **What are you optimizing for?** (e.g., speed to market, cost reduction, developer experience, security, scalability)
> 2. **What constraints exist?** (e.g., budget limits, team size, existing contracts, compliance requirements, timeline pressure)
> 3. **Who is the audience for this document?** (e.g., just you, your team, engineering leadership, C-suite, external stakeholders)
> 4. **What is the decision timeline?** (e.g., deciding this week, need it for next sprint planning, long-term evaluation)
> 5. **Do you already have options in mind?** (If yes, list them — we will validate and expand in the research step)
> 6. **Are there any options you have already ruled out?** (So I do not waste time researching them)
> 7. **What would make you confident in the final recommendation?** (e.g., production benchmarks, cost projections, team vote)

For specific topic types, add contextual questions:
- **technology_selection**: "What is the existing tech stack this must integrate with?"
- **build_vs_buy**: "What is the current build cost estimate, if any?"
- **migration_strategy**: "What is the current system you are migrating from?"
- **infrastructure**: "What are your current SLAs and traffic patterns?"
- **security_approach**: "What compliance frameworks must you satisfy?"
- **api_integration**: "What are the consumer clients of this API?"

### 3. Capture and Confirm

After the user answers, synthesize their responses into a structured summary:

> **Decision Criteria Summary:**
> - **Optimizing for**: [their priorities, ranked]
> - **Constraints**: [hard constraints]
> - **Audience**: [who reads this]
> - **Timeline**: [when decision needed]
> - **Known options**: [if any mentioned]
> - **Ruled out**: [if any]
> - **Confidence factors**: [what seals the deal]
>
> Is this accurate? Anything to add or correct?

### 4. Save to Frontmatter

Update the output document's frontmatter with the captured expectations:
```yaml
decision_criteria:
  optimizing_for: ['...']
  constraints: ['...']
  audience: '...'
  timeline: '...'
  confidence_factors: ['...']
known_options: ['...']  # if user mentioned any
ruled_out: ['...']  # if user ruled any out
stepsCompleted:
  - step-01-discovery
  - step-02-expectations
```

### 5. Present MENU OPTIONS

> **Expectations captured.** I now understand:
> - You are optimizing for: [top priorities]
> - Key constraints: [constraints]
> - This document is for: [audience]
> - Decision needed by: [timeline]
>
> Next, I will conduct light web research to discover options and alternatives you may not have considered.
>
> **[C] Continue to Light Research (Step 3 of 8)**

## SUCCESS METRICS:
- :white_check_mark: All relevant questions asked and answered
- :white_check_mark: Decision criteria clearly captured and confirmed by user
- :white_check_mark: Constraints identified (including hard blockers)
- :white_check_mark: Audience and timeline established
- :white_check_mark: Frontmatter updated with expectations data
- :white_check_mark: User confirmed the summary before proceeding

## FAILURE MODES:
- :x: Asking generic questions that do not relate to the topic_type
- :x: Proceeding without the user confirming the expectations summary
- :x: Forgetting to capture ruled-out options (wastes research time later)
- :x: Making assumptions about constraints the user did not state
- :x: Skipping to the next step before user selects [C]
