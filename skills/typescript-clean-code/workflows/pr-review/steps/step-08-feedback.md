---
name: 'step-08-feedback'
description: 'Compile feedback — categorize, format, prepare for decision'
nextStepFile: './step-09-decision.md'
referenceFiles:
  - 'references/collaboration/rules.md'
  - 'references/smells/rules.md'
---

# Step 8: Provide Feedback

## STEP GOAL

Compile all findings from steps 2-7 into categorized, constructive, actionable feedback.

## COMPILATION PROCESS

### 1. Gather All Findings

Read through the output document and collect all issues found in steps 2-7.

### 2. Cut before categorizing

**A finding the author will not act on is a false positive even when it is
correct** — it spends the trust that makes the rest of the review land. For each
candidate ask: would a reasonable author act on this today? If no, cut it, and count
what you cut.

Merge rather than repeat: anything a linter decides becomes one "wire this into CI"
item (see `references/smells/tooling.md`); a smell appearing ten times becomes one
finding with the worst example.

### 3. Label Each Item

Conventional Comments labels — the table is in `references/smells/rules.md` →
Severity vocabulary. Add an explicit `(blocking)` / `(non-blocking)` decoration to
every item.

What actually blocks a merge: correctness, security, data loss, a design decision
expensive to reverse. Catalog smells are argued, not enforced.

### 4. Format Each Item

```
issue (blocking): src/services/userExporter.ts:45 — exporter does four things

It validates, fetches, formats, and saves in one function, so none of the four
can be tested without the other three.

Reference: functions/rules.md — "Do One Thing"

Fix: extract validateExportRequest(), fetchUser(), formatUser(), saveExport()
```

An `issue` with no fix is a complaint — supply one or downgrade to `question`.

### 5. Include Praise

Call out what is done well — clean patterns, good test coverage, a hard problem
solved simply. It is not filler; it tells the author which instincts to repeat.

## PRESENT FINDINGS

```
Step 8: Feedback Summary
========================

issue (blocking) — N items
  1. ...
  2. ...

suggestion (non-blocking) — N items
  1. ...

question — N items
  1. ...

nitpick (non-blocking) — N items
  1. ...

praise — N items
  1. ...

Filtered: N findings considered and not reported as unlikely to be acted on
```

Then ask: **[C] Continue to Step 9: Decision**

## FRONTMATTER UPDATE

Update the output document:
- Add `8` to `stepsCompleted`
- Append the categorized feedback to the report

## NEXT STEP

After user confirms `[C]`, load `step-09-decision.md`.
