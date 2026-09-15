---
name: 'refactoring'
description: 'Safe refactoring process with tests as a safety net'
firstStepFile: './steps/step-01-init.md'
templateFile: './templates/log-template.md'
---

# Refactoring Workflow

Safe refactoring process with tests as a safety net.

## When to Use

- Improving code quality without changing behavior
- Before adding new features to messy code
- After getting tests passing (the REFACTOR phase of TDD)
- When you encounter code smells

## Prerequisites

- **Tests exist and pass** - This is non-negotiable
- Understand what the code does
- Have a specific improvement goal

## The Golden Rule

> **Never refactor without tests. Never.**

If tests don't exist, write them first. See `test-strategy.md` workflow.

## Step-File Architecture

This workflow uses a **step-file architecture** for context-safe execution:

- Each step is a separate file loaded sequentially
- Progress is tracked via `stepsCompleted` in the output document's YAML frontmatter
- If context is compacted mid-workflow, step-01 detects existing output and resumes from the last completed step via step-01b
- Steps 5-8 form a **loop**: make change, run tests, commit, repeat until the named smell is gone

### Steps

| Step | File | Description |
|------|------|-------------|
| 1 | `step-01-init.md` | Initialize workflow, verify tests, detect continuation |
| 1b | `step-01b-continue.md` | Resume from last completed step |
| 2 | `step-02-identify-smell.md` | Identify the specific code smell |
| 3 | `step-03-fowler-sweep.md` | Sweep all twelve change-shape smells, pick the root one |
| 4 | `step-04-plan-steps.md` | Plan small, safe refactoring steps |
| 5 | `step-05-make-change.md` | Make ONE structural change |
| 6 | `step-06-run-tests.md` | Verify tests still pass |
| 7 | `step-07-commit.md` | Commit the change |
| 8 | `step-08-repeat.md` | Check if done; loop to step-05 or mark complete |

### Rules

1. **Load one step at a time** — read the step file, execute it, then load the next.
   Each step names its own reference files and its own completion criterion
2. **Update frontmatter after each step** — add the step number to `stepsCompleted`,
   so a compacted context resumes via `step-01b-continue.md`
3. **Wait for `[C]`** between steps
4. **One change at a time** — each loop iteration makes exactly one structural change
5. **Tests stay green** — a failing test after a change means undo, then retry smaller

**The refactoring is done when** the smell named in step 2 is gone, every loop
iteration ended on passing tests and a commit, and behavior is unchanged.

## Begin

Load `steps/step-01-init.md` to start.
