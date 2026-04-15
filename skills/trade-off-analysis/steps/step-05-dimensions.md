---
name: 'step-05-dimensions'
description: 'Propose evaluation dimensions based on topic type, research findings, and user expectations'
nextStepFile: './step-06-generation.md'
outputFile: '{{output_file}}'
---

# Step 5: Dimensions

**Progress: Step 5 of 8** - Next: Scoring & Generation

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
- Update frontmatter adding `step-05-dimensions` to stepsCompleted
- FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:
- You have: topic, topic_type, decision_criteria, constraints, approved options with research from Steps 1-4
- You have: ALL research documents loaded in context
- You have: dimension-guidance.csv with suggested dimensions per topic_type
- You do NOT yet have: scores, ratings, or the generated document

## YOUR TASK:
Propose the evaluation dimensions (criteria) that will be used to compare options, organized into logical categories, based on the topic type, research findings, and user expectations.

## EXECUTION SEQUENCE:

### 1. Load Dimension Guidance

Read `dimension-guidance.csv` from the skill's data directory. Find the row matching the detected `topic_type` from Step 1. Extract the `suggested_dimensions` list as the starting point.

### 2. Cross-Reference with Research and Expectations

Review the research documents and decision criteria to identify:
- **Dimensions from guidance that are clearly relevant** — keep these
- **Dimensions from guidance that are irrelevant** to this specific decision — mark for removal
- **New dimensions surfaced by research** that are not in the guidance — add these
- **Dimensions implied by user constraints** (e.g., if user said "budget is fixed", add "Cost" if not already present)
- **Dimensions implied by decision criteria** (e.g., if user said "optimizing for developer experience", ensure that dimension exists)

### 3. Organize into Categories

Group the dimensions into 2-4 logical categories. Default categories by topic_type:

- **technology_selection**: Functional, Developer Experience, Ecosystem, Operational
- **architecture_pattern**: Scalability & Performance, Development, Operations, Risk
- **build_vs_buy**: Fit & Capability, Cost & Ownership, Risk & Control, Operations
- **migration_strategy**: Risk & Safety, Effort & Timeline, Operations, Business Impact
- **infrastructure**: Reliability, Performance, Security, Cost & Operations
- **security_approach**: Security Effectiveness, Implementation, Compliance, Operations
- **general**: Functional, Technical, Business, Risk

Adjust categories based on what the research actually revealed. Do not force dimensions into categories that do not fit.

### 4. Present Proposed Dimensions

Present the full list with brief explanations:

> **Proposed Evaluation Dimensions:**
>
> **Category 1: [Name]**
> | # | Dimension | What It Measures |
> |---|-----------|-----------------|
> | 1 | [Dimension Name] | [One sentence explaining what this evaluates] |
> | 2 | [Dimension Name] | [One sentence explaining what this evaluates] |
> | ... | ... | ... |
>
> **Category 2: [Name]**
> | # | Dimension | What It Measures |
> |---|-----------|-----------------|
> | ... | ... | ... |
>
> **Total: [count] dimensions across [count] categories**
>
> Please review:
> - **Add**: Missing dimensions you care about?
> - **Remove**: Any dimensions that will not differentiate between these options?
> - **Reorder**: Should any dimension be in a different category?
> - **Approve**: If the list looks good, say "approved" or select [C]

### 5. Refine Based on Feedback

Apply user changes. If they request additions, explain briefly what the new dimension measures. If they want removals, confirm the removal.

**Quality check**: Warn the user if:
- Fewer than 8 dimensions (analysis may be too shallow)
- More than 20 dimensions (analysis will be unwieldy)
- A dimension is unlikely to differentiate between the options (all options would score the same)

### 6. Save Dimensions to Frontmatter

After user approval, save the final dimensions list:

```yaml
dimensions:
  - category: '[Category Name]'
    items:
      - name: '[Dimension Name]'
        description: '[What it measures]'
      - name: '[Dimension Name]'
        description: '[What it measures]'
  - category: '[Category Name]'
    items:
      - name: '[Dimension Name]'
        description: '[What it measures]'
stepsCompleted:
  - step-01-discovery
  - step-02-expectations
  - step-03-light-research
  - step-04-deep-research
  - step-05-dimensions
```

### 7. Present MENU OPTIONS

> **Dimensions finalized.** The analysis will evaluate **[count] dimensions** across **[count] categories**:
>
> [Category 1]: [dim1], [dim2], [dim3]...
> [Category 2]: [dim1], [dim2], [dim3]...
> ...
>
> Next, I will generate the complete trade-off document — executive summary, comparison matrix, detail tables, risk assessment, and recommendation.
>
> **[C] Continue to Scoring & Generation (Step 6 of 8)**

## SUCCESS METRICS:
- :white_check_mark: Dimensions sourced from guidance CSV AND research findings (not just one source)
- :white_check_mark: Between 10-17 dimensions (sweet spot for thorough but manageable analysis)
- :white_check_mark: Dimensions organized into logical categories
- :white_check_mark: Each dimension has a clear, non-overlapping description
- :white_check_mark: User decision criteria reflected in dimension selection
- :white_check_mark: User reviewed and approved the final list

## FAILURE MODES:
- :x: Using only the CSV suggestions without considering research findings
- :x: Including dimensions that will not differentiate between the options
- :x: Having overlapping dimensions that measure the same thing
- :x: Missing dimensions critical to the user's stated decision criteria
- :x: Proceeding without user approval of the dimensions list
- :x: Skipping to the next step before user selects [C]
