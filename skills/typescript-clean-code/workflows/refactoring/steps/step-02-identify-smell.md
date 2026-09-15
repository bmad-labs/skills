---
name: 'step-02-identify-smell'
description: 'Identify the specific code smell to fix'
nextStepFile: './step-03-fowler-sweep.md'
referenceFiles:
  - 'references/smells/rules.md'
  - 'references/smells/fowler.md'
  - 'references/smells/typescript.md'
---

# Step 2: Identify the Smell

## STEP GOAL

Know exactly what you're fixing. Identify the specific code smell, understand why it's a problem, and define the target state.

Cite the file and entry id when identifying the smell.

## ANALYSIS PROCESS

### 1. Scan for Smells

Name the smell before planning the change. An unnamed smell produces a refactoring
with no stopping condition — you will not know when you are done.

Detect by the question, not by a threshold:

| Smell | Detection question | Paired refactoring |
|-------|--------------------|--------------------|
| Duplicated Code (G5) | If this rule changed, would I change it in more than one place? | Extract Function; Pull Up Method |
| Long Function | Can I name each section of this function? | Extract Function; Replace Temp with Query |
| Long Parameter List | At the call site, can I tell what each argument means? | Introduce Parameter Object; Preserve Whole Object |
| Data Clumps | Do these fields always travel together? | Extract Class; Introduce Parameter Object |
| Feature Envy (G14) | Does this touch another module's data more than its own? | Move Function; Extract then Move |
| Large Class | Do all the fields get used by all the methods? | Extract Class; Extract Superclass |
| Primitive Obsession | Could I pass the wrong one of these and have it compile? | Branded type; literal union; Replace Primitive with Object |
| Shotgun Surgery | To add one more of these, how many files do I open? | Move Function/Field; Combine Functions into Class |
| Divergent Change | Do this file's recent reasons-to-change share a subject? | Extract Class; Split Phase |
| Message Chains (G36) | How many objects does this line need to know about? | Hide Delegate; Extract then Move Function |
| Speculative Generality | Who is the second caller? | Collapse Hierarchy; Inline Function; Remove Dead Code |
| Dead Code (G9) | Does anything call it? (ask `knip`, not your eye) | Remove Dead Code |

Full entries, including the **when NOT to fix** guidance for each, are in
`references/smells/fowler.md`.

### 2. Confirm with User

Present the identified smell and ask the user to confirm:
- What the smell is
- Why it's a problem
- What the target state looks like

## PRESENT FINDINGS

```
Step 2: Smell Identification
============================

Identified Smell: {{smell code}} — {{smell name}}
Location: {{file:line}}
Evidence: {{what makes this a smell}}
Impact: {{why it's a problem}}
Target State: {{what it should look like after refactoring}}

Rule: smells/rules.md — {{smell code}}
```

**This step is done when** one smell is named with its evidence, its impact, and the
target state — step 3 then checks that naming against the full twelve.

Then ask: **[C] Continue to Step 3: Fowler Sweep**

## FRONTMATTER UPDATE

Update the output document:
- Add `2` to `stepsCompleted`
- Set `smell` to the identified smell name
- Append the findings to the log

## NEXT STEP

After user confirms `[C]`, load `step-03-fowler-sweep.md`.
