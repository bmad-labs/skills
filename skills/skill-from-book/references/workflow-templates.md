# Workflow Templates

Templates and best practices for creating skill workflows.

## What Are Workflows?

Workflows are step-by-step processes that guide consistent execution of common tasks. They complement reference files by providing:
- **Procedural guidance** - How to do something, not just what to know
- **Repeatability** - Same process every time
- **Checklists** - Verify completion at each step
- **Cross-references** - Link to relevant knowledge files

## When to Create Workflows

Create workflows when:
- A task has **multiple steps** that must be done in order
- The task is **repeated frequently**
- Consistency matters (different people should get same results)
- The task requires **referencing multiple knowledge files**
- There's a clear **start and end state**

## Workflow Best Practices

### 1. Clear Trigger

State exactly when to use this workflow:
```markdown
## When to Use

- [Specific situation 1]
- [Specific situation 2]
- [Specific situation 3]
```

### 2. Prerequisites

List what's needed before starting:
```markdown
## Prerequisites

- [Requirement 1]
- [Requirement 2]
- [Tool/access needed]

**Reference**: `references/[topic]/rules.md`
```

### 3. Numbered Steps with Checkboxes

Each step should be:
- **Actionable** - Clear what to do
- **Verifiable** - Can check if done
- **Atomic** - One thing per step

```markdown
### Step 1: [Action Verb] [Object]

**Goal**: [What this step accomplishes]

- [ ] [Specific action]
- [ ] [Specific action]
- [ ] [Verification check]

**Reference**: `references/[topic]/rules.md`
```

### 4. Decision Points

When workflow branches:
```markdown
**If [condition A]**:
- [ ] Do X
- [ ] Then Y

**If [condition B]**:
- [ ] Do Z instead
```

### 5. Cross-References

Link to knowledge files at relevant steps:
```markdown
**Reference**: `references/functions/rules.md`
```

### 6. Quick Reference Section

Provide a summary checklist:
```markdown
## Quick Checklist

```
[ ] Step 1 complete
[ ] Step 2 complete
[ ] Step 3 complete
[ ] All verifications passed
```
```

### 7. Exit Criteria

Define what "done" means:
```markdown
## Exit Criteria

Task is complete when:
- [ ] [Condition 1]
- [ ] [Condition 2]
- [ ] [Final verification]
```

---

## Workflow Template

Copy this template for new workflows:

```markdown
# [Task Name] Workflow

[One-sentence description of what this workflow accomplishes.]

## When to Use

- [Trigger situation 1]
- [Trigger situation 2]
- [Trigger situation 3]

## Prerequisites

- [Requirement 1]
- [Requirement 2]

**Reference**: `references/[topic]/rules.md`

---

## Workflow Steps

### Step 1: [Action Verb] [Object]

**Goal**: [What this step accomplishes in one sentence.]

- [ ] [Specific actionable item]
- [ ] [Specific actionable item]
- [ ] [Verification: How to know this step is done]

**Ask**: "[Question to guide thinking]"

**Reference**: `references/[topic]/rules.md`

---

### Step 2: [Action Verb] [Object]

**Goal**: [What this step accomplishes.]

- [ ] [Specific actionable item]
- [ ] [Specific actionable item]

**If [condition]**:
- [ ] [Alternative action]

**Reference**: `references/[topic]/rules.md`

---

### Step 3: [Action Verb] [Object]

**Goal**: [What this step accomplishes.]

- [ ] [Specific actionable item]
- [ ] [Specific actionable item]

---

### Step N: Verify and Complete

**Goal**: Ensure all steps were completed correctly.

- [ ] [Final verification 1]
- [ ] [Final verification 2]
- [ ] [Documentation/commit if needed]

---

## Quick Checklist

```
[ ] Step 1: [Brief description]
[ ] Step 2: [Brief description]
[ ] Step 3: [Brief description]
[ ] Step N: Verified complete
```

---

## Common Mistakes

| Mistake | Why It's Bad | Do Instead |
|---------|--------------|------------|
| [Common error 1] | [Consequence] | [Correct approach] |
| [Common error 2] | [Consequence] | [Correct approach] |

---

## Exit Criteria

Task is complete when:
- [ ] [Measurable condition 1]
- [ ] [Measurable condition 2]
- [ ] [Final state description]
```

---

## Example Workflows by Category

### Code-Focused Workflows

| Workflow | Purpose | Key Steps |
|----------|---------|-----------|
| Code Review | Review code quality | Understand → Check functions → Check naming → Check tests → Feedback |
| TDD | Test-driven development | Think → RED (failing test) → GREEN (pass) → REFACTOR → Repeat |
| Refactoring | Safe code improvement | Verify tests → Identify smell → Small change → Test → Commit → Repeat |
| Bug Fix | Fix bugs with tests | Understand → Reproduce → Write failing test → Fix → Verify |
| New Feature | Build new functionality | Requirements → Plan → Acceptance test → TDD build → Review |

### Professional Workflows

| Workflow | Purpose | Key Steps |
|----------|---------|-----------|
| Estimation | Estimate tasks accurately | Clarify → Break down → PERT values → Calculate → Communicate |
| Deadline Negotiation | Handle pressure | Gather info → Estimate → Identify options → Negotiate → Document |
| PR Review | Review pull requests | Context → Tests first → High-level → Details → Security → Feedback |

---

## Workflow Identification Guide

When analyzing a book for potential workflows, look for:

### 1. Process Descriptions

Book sections that describe "how to" do something:
- "The steps for..."
- "The process of..."
- "How to approach..."
- "When doing X, first... then..."

### 2. Repeated Tasks

Tasks mentioned multiple times or emphasized as important:
- Daily/weekly activities
- Quality gates
- Review processes
- Decision-making frameworks

### 3. Checklists in the Book

Any existing checklists can become workflows:
- Pre-commit checks
- Review criteria
- Quality standards

### 4. Anti-Pattern Sections

"What not to do" sections often imply workflows for doing it right:
- If "don't rush" → Planning workflow
- If "don't skip tests" → TDD workflow
- If "don't commit without review" → PR Review workflow

---

## Workflow File Naming

```
workflows/
├── [verb]-[noun].md           # Action-oriented names
│   ├── code-review.md
│   ├── bug-fix.md
│   ├── new-feature.md
│   └── estimation.md
```

**Naming rules**:
- Use kebab-case
- Start with verb or action
- Be specific (not "review.md" but "code-review.md" or "pr-review.md")
- Keep short (2-3 words max)

---

## Workflow Quality Checklist

Before finalizing a workflow:

- [ ] **Clear trigger**: When to Use section is specific
- [ ] **Prerequisites listed**: What's needed before starting
- [ ] **Steps are numbered**: Clear sequence
- [ ] **Steps have goals**: Each step states its purpose
- [ ] **Checkboxes present**: Can track completion
- [ ] **References included**: Links to knowledge files
- [ ] **Decision points marked**: Branches are clear
- [ ] **Quick checklist**: Summary for fast reference
- [ ] **Exit criteria defined**: Know when done
- [ ] **Common mistakes listed**: Help avoid errors
