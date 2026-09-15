---
name: 'step-09-feedback'
description: 'Compile final feedback — prioritize, summarize, mark complete'
referenceFiles:
  - 'references/collaboration/rules.md'
  - 'references/smells/rules.md'
---

# Step 9: Provide Feedback

## STEP GOAL

Compile all findings from steps 2-8 into a prioritized, actionable feedback summary. Mark the review as complete.

## COMPILATION PROCESS

### 1. Gather All Findings

Read through the output document and collect all issues found in steps 2-8.

### 2. Cut before you prioritize

Run the false-positive filter over the whole set first. **A finding the author will
not act on is a false positive regardless of whether it is correct**, and it spends
the trust that makes the rest of the review land. For each candidate ask: would a
reasonable author act on this today?

Cut aggressively. A review naming three things worth doing beats one naming twenty
things that are true. Record the count you cut — it belongs in the summary.

Merge two classes rather than listing them:
- Anything a tool decides (`references/smells/tooling.md`) becomes one "wire this
  into CI" item.
- Repeated instances of one smell become one finding carrying the worst example.

### 3. Label each surviving finding

Conventional Comments labels — the table is in `references/smells/rules.md` →
Severity vocabulary. Add a decoration where the label leaves it open:
`(blocking)`, `(non-blocking)`, `(if-minor)`.

**What actually blocks**: correctness, security, data loss, a design flaw that will
be expensive to undo. Catalog smells are argued, not enforced — they are
`suggestion` unless the change under review is itself paying the cost.

### 4. Format each finding

```
label (decoration): short subject — file:line
Why: what breaks, or what future change this makes expensive
Fix: concrete suggestion
Rule: <reference file> — <entry id>
```

An `issue` with no `Fix:` line is a complaint. Either supply the fix or downgrade it
to a `question`.

### 5. Write Summary

Append to the output document:

```markdown
## Final Review Summary

### Blocking
- [list or "None"]

### Suggestions (non-blocking)
- [list or "None"]

### Nitpicks (ignorable)
- [list or "None"]

### Praise
- [what was done well, if anything — this is not filler]

### Coverage Checklist
- [ ] Functions: one thing each, arguments readable at the call site
- [ ] Names: reveal intent, consistent
- [ ] Classes/modules: one reason to change, cohesive
- [ ] Errors: exceptions, no null returns, context carried
- [ ] Tests: exist, readable, F.I.R.S.T.
- [ ] Comments: rationale kept, restatement and stale ones removed
- [ ] Per-line smells (`smells/rules.md`)
- [ ] Change-shape smells (`smells/fowler.md`)
- [ ] TypeScript smells (`smells/typescript.md`)
- [ ] Tooling gaps reported once, not per-instance (`smells/tooling.md`)

### Filtered
N findings were considered and not reported as unlikely to be acted on.

### Verdict
[Approve / Approve with suggestions / Needs work / Major concerns]
```

### 6. Reach the verdict

**The standard is "does this change improve the overall code health of the system",
not "is this change perfect".** Approve once it definitely improves code health,
even where it is imperfect — there is no perfect code, only better code. Unresolved
`nitpick` and `suggestion` items do not withhold approval.

Withhold approval for: correctness, security, data loss, or a design decision that
will be expensive to reverse later.

Where a design point is genuinely disputed and the author has shown a valid
alternative through data or engineering principles, **prefer the author's** and say
so. Do not hold a change on a threshold preference.

## PRESENT TO USER

Show the final summary. Blocking items first, then the count of what was filtered
out — the filtered count is evidence of restraint and belongs in the report.

Feedback principles (from `collaboration/rules.md`):
1. **Be specific**: Point to exact lines/functions
2. **Explain why**: Reference principles, not just preferences
3. **Suggest alternatives**: Don't just criticize, propose solutions
4. **Mark polish as ignorable**: An author who cannot tell which comments are
   optional treats all of them as mandatory, or none of them
5. **Be respectful**: Critique code, not the person

## FRONTMATTER UPDATE

Update the output document frontmatter:
- Add `9` to `stepsCompleted`
- Set `status` to `'complete'`

## WORKFLOW COMPLETE

The code review workflow is complete. The full report is saved at the output path.
