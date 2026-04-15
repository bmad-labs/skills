---
name: 'step-03-light-research'
description: 'Conduct structured technical research to discover options and alternatives using bmad-technical-research skill'
nextStepFile: './step-04-deep-research.md'
outputFile: '{{output_file}}'
---

# Step 3: Light Research (Options Discovery)

**Progress: Step 3 of 8** - Next: Deep Research

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
- Update frontmatter adding `step-03-light-research` to stepsCompleted
- FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:
- You have: topic, topic_type, complexity, decision_criteria, constraints, known_options from Steps 1-2
- You have: list of ruled-out options to SKIP
- You do NOT yet have: detailed technical research on each option
- This step uses technical research to DISCOVER the landscape of options

## YOUR TASK:
Use the technical research skill (or its fallback) to conduct structured research on the topic landscape, discovering the full set of candidate options the user should evaluate.

## EXECUTION SEQUENCE:

### 1. Prepare Research Topic

Frame the research topic for the technical research skill based on what you know:

**Research topic:** "[User's topic] — Options Landscape & Alternatives [current year]"

**Research goals:**
- Discover all viable options/technologies/approaches for the user's decision
- Identify market leaders, emerging alternatives, and unconventional approaches
- Capture key strengths and weaknesses of each option
- Find existing comparison articles and benchmark data

### 2. Execute Technical Research

Use the technical research skill with this priority order:

**Mode A — If `bmad-bmm-technical-research` skill is installed (check available skills list):**
- Invoke the skill: "Run `/bmad-bmm-technical-research` with topic: '[research topic from step 1]'"
- **IMPORTANT:** Guide the skill to store output in `{user_output_folder}/researchs/` folder (create if needed)
- Tell the skill: "Store the research document at `{user_output_folder}/researchs/research-options-landscape-[topic-slug].md`"

**Mode B — If Mode A is not available, use the bundled fallback:**
- Load `./references/bmad-technical-research/workflow.md` from THIS skill's references folder
- Follow its workflow to conduct the research
- Use `./references/bmad-technical-research/research.template.md` as the output template
- **IMPORTANT:** Save the research document to `{user_output_folder}/researchs/research-options-landscape-[topic-slug].md` (create folder if needed)

**Mode C — If neither Mode A nor Mode B is practical:**
- Conduct web research directly using 3-5 targeted search queries:
  - `"[topic] alternatives [current year]"` — discover what exists
  - `"[topic] comparison [current year]"` — find existing comparisons
  - `"[topic] vs"` — find head-to-head comparisons
  - `"best [topic category] for [user's optimization target]"` — targeted to criteria
  - `"[known option A] vs [known option B] vs"` — expand from known options

### 3. Track Research Document

Record the research output in frontmatter:

```yaml
researchDocuments:
  - type: 'options-landscape'
    path: './researchs/research-options-landscape-[topic-slug].md'
    status: 'complete'
```

### 4. Extract Candidate Options

From the research output, extract all viable options mentioned. Merge with the user's known_options. Remove any ruled_out options. Compile a list of 3-7 candidate options.

Present the options in a structured format:

> **Candidate Options Discovered:**
>
> | # | Option | Description | Key Strength | Key Weakness | Source |
> |---|--------|-------------|-------------|--------------|--------|
> | 1 | [Name] | [One sentence] | [Main advantage] | [Main disadvantage] | [Where found] |
> | 2 | [Name] | [One sentence] | [Main advantage] | [Main disadvantage] | [Where found] |
> | ... | ... | ... | ... | ... | ... |
>
> **Research document:** `[path to research output]`
>
> **Notable exclusions:** [options found but excluded because ruled out or clearly irrelevant, with brief reason]

### 5. User Review and Refinement

Ask the user to review the options list:

> Please review the options above:
> - **Add**: Are there options I missed that you want included?
> - **Remove**: Should any of these be dropped? (e.g., not a real contender, already evaluated)
> - **Modify**: Should any description be corrected?
> - **Approve**: If the list looks good, say "approved" or select [C]

Wait for the user's response. Apply any changes they request. If they add options, briefly research those too.

### 6. Finalize Options List

After user approval, assign consistent labels (Option A, Option B, etc.) and save to frontmatter:

```yaml
options:
  - label: 'A'
    name: '[Option Name]'
    shortDescription: '[One sentence]'
    keyStrength: '[Main advantage]'
    keyWeakness: '[Main disadvantage]'
  - label: 'B'
    name: '[Option Name]'
    shortDescription: '[One sentence]'
    keyStrength: '[Main advantage]'
    keyWeakness: '[Main disadvantage]'
  # ...
stepsCompleted:
  - step-01-discovery
  - step-02-expectations
  - step-03-light-research
```

### 7. Present MENU OPTIONS

> **Options list finalized.** We have **[count] options** to evaluate:
> - **A**: [Name] — [one-liner]
> - **B**: [Name] — [one-liner]
> - ...
>
> **Research document saved:** `[path]`
>
> Next, I will conduct deeper technical research on each individual option.
>
> **[C] Continue to Deep Research (Step 4 of 8)**

## SUCCESS METRICS:
- :white_check_mark: Technical research conducted using skill (Mode A/B) or structured web search (Mode C)
- :white_check_mark: Research document saved and tracked in frontmatter
- :white_check_mark: At least 3 candidate options identified (unless the domain truly has fewer)
- :white_check_mark: No more than 7 options (analysis becomes unwieldy beyond this)
- :white_check_mark: Each option has a description, key strength, key weakness, and source
- :white_check_mark: User reviewed and approved the final options list
- :white_check_mark: Ruled-out options were excluded from the list
- :white_check_mark: Options labeled consistently (A, B, C...) for use throughout the document

## FAILURE MODES:
- :x: Skipping technical research and relying only on training knowledge
- :x: Including options the user explicitly ruled out
- :x: Presenting more than 7 options without asking user to narrow down
- :x: Missing a major market player that appears in multiple search results
- :x: Proceeding without user approval of the options list
- :x: Not saving or tracking the research document
- :x: Skipping to the next step before user selects [C]
