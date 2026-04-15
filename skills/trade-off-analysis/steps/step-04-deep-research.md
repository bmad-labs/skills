---
name: 'step-04-deep-research'
description: 'Conduct deeper technical research for each approved option using subagents or guided research'
nextStepFile: './step-05-dimensions.md'
outputFile: '{{output_file}}'
---

# Step 4: Deep Research

**Progress: Step 4 of 8** - Next: Dimensions

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
- Update frontmatter adding `step-04-deep-research` to stepsCompleted
- FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:
- You have: topic, topic_type, decision_criteria, constraints, approved options list from Steps 1-3
- You have: basic description of each option (name, strength, weakness)
- You do NOT yet have: detailed technical evaluation of each option
- Research documents should be stored alongside the output trade-off document

## YOUR TASK:
Conduct or guide deeper technical research for each approved option so the analysis is grounded in evidence, not assumptions.

## EXECUTION SEQUENCE:

### 1. Plan Research Topics

For each approved option, propose a focused research topic. The research should cover:
- Technical architecture and how it works
- Production readiness and maturity
- Known limitations and failure modes
- Integration patterns with the user's existing stack
- Community adoption and real-world case studies
- Performance characteristics and benchmarks (if available)

Present the research plan:

> **Research Plan:**
>
> | Option | Research Topic | Key Questions |
> |--------|---------------|---------------|
> | A: [Name] | "[Name] technical deep-dive for [use case]" | How does it handle [key concern]? What are production gotchas? |
> | B: [Name] | "[Name] technical deep-dive for [use case]" | How does it handle [key concern]? What are production gotchas? |
> | ... | ... | ... |
>
> Each research topic will produce a separate document in the same folder as the trade-off analysis.
>
> Do you want to adjust any research topics or add specific questions?

### 2. Execute Research

For each option, conduct technical research. There are three modes — use whichever is available, in this priority order:

**Mode A — If `bmad-bmm-technical-research` skill is installed (check available skills list):**
- Suggest the user run the technical research skill for each option
- Provide the research topic and key questions as input
- **IMPORTANT:** Guide the skill to store output in `{user_output_folder}/researchs/` folder (create if needed)
- Example: "Run `/bmad-bmm-technical-research` with topic: '[Option A] technical evaluation for [use case]'. Store output at `{user_output_folder}/researchs/research-option-a-[name-slug].md`"
- Wait for each research document to be completed

**Mode B — If Mode A is not available, use the bundled fallback research workflow:**
- Load `./references/bmad-technical-research/workflow.md` from THIS skill's references folder
- Follow its workflow steps to conduct the technical research for each option
- Use the `./references/bmad-technical-research/research.template.md` as the output template
- **IMPORTANT:** Save each research document to `{user_output_folder}/researchs/research-option-[label]-[name-slug].md` (create folder if needed)

**Mode C — If neither Mode A nor Mode B is practical (no web search, minimal context):**
- Use web search to gather detailed technical information for each option
- For each option, compile findings into a structured research summary:
  - **Overview**: What it is, who maintains it, current version
  - **Architecture**: How it works technically
  - **Strengths**: Evidence-backed advantages (with sources)
  - **Weaknesses**: Known limitations and failure modes (with sources)
  - **Integration**: How it fits with the user's stack
  - **Adoption**: Who uses it in production, community size
  - **Cost**: Licensing, operational, and hidden costs
- Save each research summary to: `{user_output_folder}/researchs/research-option-[label]-[name-slug].md` (create folder if needed)

### 3. Track Research Documents

As each research document is created or completed, record it in the frontmatter:

```yaml
researchDocuments:
  - option: 'A'
    name: '[Option Name]'
    path: './researchs/research-option-a-[name-slug].md'
    status: 'complete'
  - option: 'B'
    name: '[Option Name]'
    path: './researchs/research-option-b-[name-slug].md'
    status: 'complete'
```

### 4. Load and Verify Research

Once ALL research documents are complete:
- Read every research document completely into context
- Verify each document has substantive content (not just stubs)
- Check for any obvious gaps: is there an option that has significantly less research?

Present a research summary:

> **Research Complete.** Here is what I found:
>
> | Option | Document | Key Findings |
> |--------|----------|-------------|
> | A: [Name] | `research-option-a.md` | [2-3 sentence summary of key findings] |
> | B: [Name] | `research-option-b.md` | [2-3 sentence summary of key findings] |
> | ... | ... | ... |
>
> **Research gaps:** [any areas where information was sparse or conflicting]
>
> Please review the research documents. When you are satisfied, select [C] to proceed.

### 5. User Review

Wait for the user to confirm they are satisfied with the research quality. If they identify gaps:
- Conduct additional targeted research
- Update the relevant research document
- Re-present the summary

### 6. Present MENU OPTIONS

> **Deep research complete.** All [count] options have been researched and documented.
>
> Research documents:
> - `research-option-a.md` — [Option A Name]
> - `research-option-b.md` — [Option B Name]
> - ...
>
> Next, I will propose evaluation dimensions based on the topic type and what the research revealed.
>
> **[C] Continue to Dimensions (Step 5 of 8)**

## SUCCESS METRICS:
- :white_check_mark: Every approved option has a research document with substantive content
- :white_check_mark: Research includes evidence-backed strengths AND weaknesses (not just marketing)
- :white_check_mark: Sources are cited with URLs where possible
- :white_check_mark: All research documents loaded into context before proceeding
- :white_check_mark: User reviewed and approved the research quality
- :white_check_mark: Research documents tracked in frontmatter

## FAILURE MODES:
- :x: Generating research from training knowledge only without web search
- :x: Producing marketing-style summaries that lack critical evaluation
- :x: Skipping an option or giving one option significantly less research depth
- :x: Proceeding without user confirming research is sufficient
- :x: Not loading ALL research documents before moving to dimensions
- :x: Skipping to the next step before user selects [C]
