---
name: 'step-01-discovery'
description: 'Understand the user decision context, discover existing documents, classify the topic type'
nextStepFile: './step-02-expectations.md'
outputFile: '{{output_file}}'
---

# Step 1: Discovery

**Progress: Step 1 of 8** - Next: Expectations

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
- Update frontmatter adding `step-01-discovery` to stepsCompleted
- FORBIDDEN to load next step until C is selected

## CONTEXT BOUNDARIES:
- This is the FIRST step — no prior context exists
- You have access to the user's workspace via file system tools
- You have access to `dimension-guidance.csv` in the skill's data directory
- Do NOT assume what the user wants to compare — ASK

## YOUR TASK:
Understand what decision the user is trying to make, discover any existing research or documentation, and classify the topic type to guide the rest of the workflow.

## EXECUTION SEQUENCE:

### 1. Check for Continuation

Before starting fresh, check if the output document already exists at `{{output_file}}`:
- **If it exists**: Read the frontmatter. Report which steps are completed. Ask the user: "I found an existing trade-off analysis at `{{output_file}}`. Do you want to **continue from where you left off** or **start fresh**?"
- **If it does not exist**: Proceed to step 2.

### 2. Discover Existing Documents

Scan the user's workspace for relevant existing materials:
- Search for markdown files in the same directory and parent directories
- Look for research documents, technical briefs, PRDs, architecture docs
- Look for files containing keywords related to the user's stated topic
- Check for any `*-research*.md`, `*-brief*.md`, `*-analysis*.md` files nearby

Present what you found:
> "I discovered the following documents that may be relevant to your analysis:
> - `path/to/doc1.md` — [brief description from title/heading]
> - `path/to/doc2.md` — [brief description from title/heading]
> - (none found)
>
> Are any of these relevant? Should I use them as input for the analysis?"

### 3. Classify the Topic Type

Load `dimension-guidance.csv` from the skill's data directory.

Based on the user's stated topic, match against the `signals` column to detect the `topic_type`. If multiple types match, pick the most specific one. If no clear match, use `general`.

Present the classification:
> "Based on your topic, I've classified this as a **[topic_type]** analysis.
> This means I'll focus on dimensions like: [list 3-4 key suggested dimensions from the CSV].
>
> Does this classification feel right, or should I adjust it?"

### 4. Assess Complexity and Knowledge Level

Based on the conversation so far, assess:
- **Complexity**: `low` (2-3 options, well-known domain), `medium` (3-5 options, some unknowns), `high` (5+ options or novel domain)
- **Existing Knowledge Level**: `none` (starting from scratch), `partial` (some research exists), `substantial` (detailed research already done)

Present your assessment briefly.

### 5. Save Classification to Frontmatter

Write the initial frontmatter to the output document:
```yaml
---
title: 'Trade-Off Analysis: [User's Topic]'
topic_type: '[detected type]'
complexity: '[low/medium/high]'
existing_knowledge_level: '[none/partial/substantial]'
stepsCompleted:
  - step-01-discovery
discoveredDocuments: []
options: []
dimensions: []
researchDocuments: []
created: '[current date]'
author: '[user name if known]'
---
```

### 6. Present MENU OPTIONS

> **Discovery complete.** Here is what I know so far:
> - **Topic**: [user's topic]
> - **Type**: [topic_type]
> - **Complexity**: [level]
> - **Existing docs**: [count] relevant documents found
>
> **[C] Continue to Expectations (Step 2 of 8)**

## SUCCESS METRICS:
- :white_check_mark: Topic type correctly identified and confirmed by user
- :white_check_mark: Existing workspace documents discovered and catalogued
- :white_check_mark: Complexity and knowledge level assessed
- :white_check_mark: Output document created with initial frontmatter
- :white_check_mark: User confirmed classification before proceeding

## FAILURE MODES:
- :x: Proceeding without user confirming the topic classification
- :x: Missing existing research documents that are clearly relevant
- :x: Defaulting to `general` type when a specific type clearly matches
- :x: Creating the output document without checking for an existing one first
- :x: Skipping to the next step before user selects [C]
