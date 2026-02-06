# Step-File Workflow Pattern

Use this pattern when a skill has workflows that are long enough to lose track of during context compaction (typically 5+ steps or 150+ lines). This architecture splits a monolithic workflow into individual step files with progress tracking, making workflows context-safe.

## When to Use

- Workflow has 5+ sequential steps
- Workflow is long enough that context compaction could lose progress
- Workflow produces an output document (report, log, etc.)
- Workflow needs to be resumable after interruption

When workflows are short (< 5 steps) or simple, use the standard sequential workflow pattern from `references/workflows.md` instead.

## Directory Structure

```
skill-name/
├── SKILL.md
└── workflows/
    └── workflow-name/
        ├── workflow.md              # Entry point
        ├── templates/
        │   └── output-template.md   # Output document template with YAML frontmatter
        └── steps/
            ├── step-01-init.md      # Initialize + continuation detection
            ├── step-01b-continue.md # Resume handler
            ├── step-02-*.md         # First analysis/action step
            ├── step-03-*.md
            └── step-NN-*.md         # Final step (marks complete)
```

## Component Patterns

### Output Document Template

The template defines the output document structure with YAML frontmatter for progress tracking:

```markdown
---
stepsCompleted: []
workflowType: 'workflow-name'
status: 'in-progress'
date: ''
---

# Output Document Title

**Date**: {{date}}
**Status**: {{status}}

---
```

Key frontmatter fields:
- `stepsCompleted`: Array of step numbers completed (e.g., `[1, 2, 3]`)
- `status`: `'in-progress'` or `'complete'`
- Add workflow-specific fields as needed (target files, decisions, etc.)

### workflow.md (Entry Point)

The entry point describes the workflow, lists all steps, defines rules, and points to `step-01-init.md`:

```markdown
---
name: 'workflow-name'
description: 'What this workflow does'
firstStepFile: './steps/step-01-init.md'
templateFile: './templates/output-template.md'
---

# Workflow Title

[Brief description and when to use]

## Step-File Architecture

[Explain that this workflow uses step files for context-safe execution]

### Steps

| Step | File | Description |
|------|------|-------------|
| 1 | `step-01-init.md` | Initialize, set output path, detect continuation |
| 1b | `step-01b-continue.md` | Resume from last completed step |
| 2 | `step-02-*.md` | First analysis step |
| ... | ... | ... |

### Rules

1. Load one step at a time
2. Update frontmatter after each step
3. Wait for user confirmation before proceeding
4. Load reference files specified by each step before analysis

## Begin

Load `steps/step-01-init.md` to start.
```

### step-01-init.md (Initialization + Continuation Detection)

This step sets up the workflow and detects whether to resume a previous session:

```markdown
---
name: 'step-01-init'
description: 'Initialize workflow and detect continuation'
nextStepFile: './step-02-*.md'
---

# Step 1: Initialize

## STEP GOAL

Set up the session: identify the target, set the output path, check for existing output to resume.

## EXECUTION

### 1. Ask the User
- What to work on (target code, PR, document, etc.)
- Output path for the report/log
- Or path to existing output to resume

### 2. Check for Existing Output
If user provides an existing file path:
- Read and parse YAML frontmatter
- If `stepsCompleted` is non-empty → load `step-01b-continue.md`

### 3. Fresh Setup
If starting fresh:
- Copy template, fill frontmatter, write to output path
- Perform any initial analysis for this step

### 4. Append to Output
Append initial context/findings to the output document.

## FRONTMATTER UPDATE
Add `1` to `stepsCompleted`.

## PRESENT TO USER
Show summary, ask: **[C] Continue to Step 2**

## NEXT STEP
After `[C]`, load next step file.
```

### step-01b-continue.md (Resume Handler)

This step reads the existing output, shows progress, and routes to the next incomplete step:

```markdown
---
name: 'step-01b-continue'
description: 'Resume from last completed step'
---

# Step 1b: Continue Previous Session

## STEP GOAL

Resume by reading existing output, showing progress, routing to next step.

## EXECUTION

### 1. Read Existing Output
Parse YAML frontmatter, extract `stepsCompleted`.

### 2. Show Progress
Display which steps are done/pending.

### 3. Offer Options
- **[R] Resume** from next incomplete step
- **[O] Overview** — re-read existing output first
- **[X] Start over** — fresh output (confirm overwrite)

### 4. Route to Next Step
Determine next step from `max(stepsCompleted) + 1`, load that file.

## NEXT STEP
Load the determined step file.
```

### Analysis/Action Step Files (step-02 through step-NN)

Each step follows a consistent structure:

```markdown
---
name: 'step-NN-descriptive-name'
description: 'What this step does'
nextStepFile: './step-NN+1-*.md'
referenceFiles:                          # Optional
  - 'references/category/rules.md'
---

# Step N: Title

## STEP GOAL
One-sentence goal for this step.

## REFERENCE LOADING
Load and read reference files listed in frontmatter before starting analysis. Cite specific rules in findings.

(Omit this section if the step has no referenceFiles.)

## ANALYSIS PROCESS / EXECUTION
Numbered sub-tasks describing what to do.

## PRESENT FINDINGS
Show results in a consistent format. Then ask: **[C] Continue to Step N+1**

## FRONTMATTER UPDATE
Add `N` to `stepsCompleted`. Append findings to output document.

## NEXT STEP
After `[C]`, load the next step file.
```

### Final Step (marks complete)

The last step compiles results and marks the workflow complete:

```markdown
## FRONTMATTER UPDATE
Add final step number to `stepsCompleted`.
Set `status` to `'complete'`.

## WORKFLOW COMPLETE
The workflow is complete. Output saved at the output path.
```

## Loop Pattern

For workflows with repeating cycles (e.g., refactoring: change → test → commit → repeat):

```markdown
# Step N: Repeat or Complete

## DECISION

### If NOT done
- Update `iterations` array in frontmatter
- Load the first step of the loop (e.g., `step-04-make-change.md`)

### If done
- Set `status` to `'complete'`
- Workflow finished
```

When looping, reset the loop step numbers in `stepsCompleted` so they can be re-added in the next iteration, but keep earlier non-loop steps.

## Step File Frontmatter Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Step identifier (e.g., `step-02-analysis`) |
| `description` | Yes | What this step does |
| `nextStepFile` | No | Relative path to the next step file. Omit for final steps or steps with conditional routing. |
| `referenceFiles` | No | List of reference files to load before analysis |

## Design Guidelines

1. **One concern per step** — each step should do one category of analysis or one action
2. **Self-contained** — each step file has enough context to execute without reading other steps
3. **Reference before analysis** — always load reference files before starting analysis, never rely on memory
4. **Cite rules** — when reporting findings, cite the specific rule from the reference file
5. **User gates** — present findings and wait for `[C]` before proceeding to the next step
6. **Append-only output** — never overwrite previous sections of the output document, only append
7. **Consistent format** — use the same presentation format across all steps of a workflow
