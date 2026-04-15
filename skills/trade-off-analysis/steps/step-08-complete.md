---
name: 'step-08-complete'
description: 'Finalize the workflow, present the completed document, and suggest next steps'
nextStepFile: null
outputFile: '{{output_file}}'
---

# Step 8: Complete

**Progress: Step 8 of 8** - Workflow Complete

## MANDATORY EXECUTION RULES (READ FIRST):

- :stop_sign: NEVER generate content without user input/confirmation
- :rotating_light: CRITICAL: ALWAYS read the complete step file before taking any action
- :rotating_light: CRITICAL: This is the FINAL step — there is no next step to load
- :brain: YOU ARE A FACILITATOR, not a content generator
- :speech_balloon: YOU MUST ALWAYS SPEAK OUTPUT in your communication style

## EXECUTION PROTOCOLS:
- Show analysis before taking action
- This is the final step — no [C] menu needed after completion
- Update frontmatter adding `step-08-complete` to stepsCompleted
- Mark the workflow as complete in frontmatter

## CONTEXT BOUNDARIES:
- You have: the complete, validated trade-off document
- You have: all frontmatter metadata from Steps 1-7
- You have: validation results from Step 7
- This step does NOT modify document content — only finalizes metadata and presents summary

## YOUR TASK:
Finalize the workflow by updating metadata, presenting a completion summary, and suggesting actionable next steps.

## EXECUTION SEQUENCE:

### 1. Update Final Frontmatter

Update the output document's frontmatter to mark completion:

```yaml
stepsCompleted:
  - step-01-discovery
  - step-02-expectations
  - step-03-light-research
  - step-04-deep-research
  - step-05-dimensions
  - step-06-generation
  - step-07-validation
  - step-08-complete
status: 'complete'
completedAt: '[timestamp]'
```

### 2. Present Completion Summary

Compile and present a clear summary of the entire analysis:

> ---
>
> **Trade-Off Analysis Complete**
>
> **Document:** `{{output_file}}`
>
> **What was analyzed:**
> - **Topic**: [topic description]
> - **Type**: [topic_type]
> - **Options compared**: [count] ([list option names])
> - **Dimensions evaluated**: [count] across [count] categories
>
> **Recommendation:**
> - **Primary**: [Option X — Name] — [one-sentence rationale]
> - **Alternative**: [Option Y — Name] — [when this is better]
>
> **Quality:**
> - Validation: [pass_count]/[total_checks] checks passed
> - Fixes applied: [count]
>
> **Supporting documents:**
> - [List all research documents created in Step 4]
> - [List any discovered documents referenced from Step 1]
>
> ---

### 3. Suggest Next Steps

Based on the topic_type and available BMAD skills, suggest what the user can do next:

> **Suggested next steps:**
>
> 1. **Share the analysis** — Send `{{output_file}}` to [audience from Step 2] for review and discussion
> 2. **Inform your architecture** — Use the recommendation to guide architecture decisions
>    - If available: "Run `/bmad-bmm-create-architecture` to create a solution architecture based on this analysis"
> 3. **Create a PRD** — If this analysis supports a product decision
>    - If available: "Run `/bmad-bmm-create-prd` to create a product requirements document"
> 4. **Plan implementation** — Break the recommendation into actionable work
>    - If available: "Run `/bmad-bmm-create-epics-and-stories` to create implementation epics"
> 5. **Conduct a follow-up analysis** — If the decision leads to new sub-decisions
>    - "Run `/trade-off-analysis` again for any follow-up comparisons"

### 4. Offer Final Actions

> **Anything else you need?**
> - **[R] Review** — I can walk through any section of the document
> - **[E] Edit** — Tell me what to change and I will update the document
> - **[X] Export** — I can help format this for a different audience or medium
> - **[D] Done** — You are all set

## SUCCESS METRICS:
- :white_check_mark: Frontmatter marked as complete with timestamp
- :white_check_mark: Summary accurately reflects the full analysis (options, dimensions, recommendation)
- :white_check_mark: All supporting documents listed with paths
- :white_check_mark: Next steps are contextual (not generic boilerplate)
- :white_check_mark: User knows exactly where the document is and what it contains

## FAILURE MODES:
- :x: Modifying document content in this step (content is finalized in Step 6, fixes in Step 7)
- :x: Presenting inaccurate summary (wrong option count, wrong recommendation)
- :x: Not listing research documents created during the workflow
- :x: Suggesting BMAD skills that are not actually installed
- :x: Ending abruptly without offering follow-up actions
