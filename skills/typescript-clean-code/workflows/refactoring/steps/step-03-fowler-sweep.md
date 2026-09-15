---
name: 'step-03-fowler-sweep'
description: 'Sweep all twelve change-shape smells before planning the refactoring'
nextStepFile: './step-04-plan-steps.md'
referenceFiles:
  - 'references/smells/fowler.md'
---

# Step 3: Fowler Sweep

## STEP GOAL

Run all twelve change-shape smells over the target before any change is planned, so
the refactoring attacks the shape that actually hurts.

Step 2 named the smell you noticed first. That is often a symptom of a larger shape:
Data Clumps and Long Parameter List are usually the same missing concept; Shotgun
Surgery and Divergent Change are inverses, and extracting for one can create the
other. Sweeping the full twelve before planning is what keeps step 4 from planning a
change that relocates the problem.

## ANALYSIS PROCESS

### 1. Run all twelve

Shotgun Surgery · Feature Envy · Data Clumps · Long Method · Divergent Change ·
Duplicated Code · Large Class · Long Parameter List · Primitive Obsession ·
Message Chains · Dead Code · Speculative Generality

Ask each one's detection question from `fowler.md`'s quick checklist against the
target. Mark each **present** or **absent** — a sweep that skips entries is a sweep
that misses the shape, so record all twelve either way.

### 2. Decide which one to fix

One refactoring session fixes **one** smell. From the present set, pick by:

- **Root over symptom.** Where two smells share a cause, fix the cause. Data Clumps
  under a Long Parameter List means the missing concept is the target, and fixing it
  resolves both.
- **Enabling order.** Dead Code first when present — deleting it shrinks everything
  that follows. Speculative Generality likewise: collapsing an unused abstraction
  often removes several other findings at once.
- **Cost of leaving it.** Shotgun Surgery and Divergent Change are paid on every
  future edit; Message Chains and Long Method are paid on every read.

Where the pick differs from the smell named in step 2, say so and update the log's
`smell` field — the sweep found the better target, which is what it is for.

### 3. Check "when NOT to fix" for the chosen smell

Read the chosen entry's **when NOT to fix** field in `fowler.md` before proceeding.
Two cases stop refactorings most often:

- **Coincidental duplication** — blocks that look alike but answer to different
  owners and will diverge. De-duplicating couples things that should be free to
  change apart, and that coupling is harder to undo than the duplication was.
- **A long but linear function** — no branching, no nameable sections. Splitting it
  produces shallow functions and moves the reader's cost rather than removing it.

If the chosen smell hits its "when NOT to fix" case, return to the present set and
pick the next one. If every present smell hits its case, stop and say so — not
refactoring is a valid outcome.

## PRESENT FINDINGS

```
Step 3: Fowler Sweep
=====================

Sweep (all twelve)
  Shotgun Surgery ........ present / absent — {{evidence}}
  Feature Envy ........... present / absent — {{evidence}}
  Data Clumps ............ present / absent — {{evidence}}
  Long Method ............ present / absent — {{evidence}}
  Divergent Change ....... present / absent — {{evidence}}
  Duplicated Code ........ present / absent — {{evidence}}
  Large Class ............ present / absent — {{evidence}}
  Long Parameter List .... present / absent — {{evidence}}
  Primitive Obsession .... present / absent — {{evidence}}
  Message Chains ......... present / absent — {{evidence}}
  Dead Code .............. present / absent — {{evidence}}
  Speculative Generality . present / absent — {{evidence}}

Chosen target: {{smell}}
  Reason: {{root cause / enabling order / cost of leaving it}}
  Changed from step 2: yes / no
  when NOT to fix: checked — does not apply because {{reason}}

Deferred: {{other present smells, left for a later session}}
```

**This step is done when** all twelve carry a present/absent verdict, one smell is
chosen with its reason recorded, and that smell's "when NOT to fix" case has been
checked and ruled out.

Then ask: **[C] Continue to Step 4: Plan Steps**

## FRONTMATTER UPDATE

Update the output document:
- Add `3` to `stepsCompleted`
- Set `smell` to the chosen smell (overwriting step 2's if the sweep changed it)
- Set `sweepPresent` to the smells marked present, `sweepDeferred` to those left for
  a later session — the loop in steps 5-8 keeps `3` completed, so these fields are
  what carries the sweep through compaction
- Append the sweep to the log

## NEXT STEP

After user confirms `[C]`, load `step-04-plan-steps.md`.
