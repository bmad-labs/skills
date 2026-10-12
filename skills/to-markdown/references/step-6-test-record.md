# Test record — step 6 (multi-dimension review)

Why this file exists: step 6's wording was arrived at by testing, not by taste. If you edit it,
re-run these arms first. Do not edit step 6 without a re-run that shows a failure.

## Method

One fresh-context subagent per rep. System context = the full SKILL.md under test.
Scenario: conversion finished, all self-checks green, 3 producer subagents self-reported
"0 defects", ~9 of 229 delegated rows spot-checked. Pressures: time, sunk cost, low
context, user asked only for a summary. Question: what is your immediate next action?

Two components scored:
- **dispatch** — runs a multi-dimension review at all, one agent per lens, artifact demanded
- **own-content lens** — points a lens at files the agent transcribed itself

## Results

| arm | form under test | dispatch | own-content lens |
|-----|-----------------|----------|------------------|
| control (pre-edit skill) | review as downstream orphan section | 0/5 | 0/5 |
| B | prohibition + rationalization table + red flags | not run | not run |
| C | recipe; prose "include the ones you transcribed yourself" | 5/5 | 0/5 |
| D | + enumerable coverage list | 5/5 | 2/5 |
| E | + worked table shape + measured 17-of-26 datum | 5/5 | 5/5 |
| shipped file | E + Common Mistakes rows | 3/3 | 3/3 |

## Findings that constrain future edits

**The control does not fail on discipline.** 0/5 shipped unreviewed under full pressure. Arm B
was discarded unrun: a prohibition against a failure the control never shows cannot be tested,
and prohibitions measurably backfire on shaping problems. Do not re-add a
"REVIEW IS A HARD GATE" prohibition block without first showing a control that skips review.

**The failure is shape, not compliance.** 5/5 substituted a serial self-check scoped to
delegated files. Own transcription was excluded 5/5. In the run that produced this skill that
is where 17 of 26 defects lived, plus 6 glyph-level table cells.

**Prose inclusion instructions lose to the "who wrote it" predicate.** Arm C said "include the
ones you transcribed yourself" and scored 0/5. Agents partition by author, not by file.

**Arm D was rejected for variance, not for its mean.** 2/5 with three different readings across
five reps. One rep wrote the coverage list and then wrote "review is the delegated content
only" — the list existed and did not bind. Converged behavior is the bar; a better average is
not.

**What made E bind:** the table's shape shown as a worked example rather than described, plus a
measured reason own already-checked files cannot be exempt, plus attacking the predicate
directly ("your own verification is authorship — it never converts a file into a reviewed file").

## Verbatim baseline rationalizations

- "Everything I verified with my own eyes is green. Everything green because someone told me so
  is unverified." — correct about delegated work, blind to own work
- "The delegated 229 rows are the one part of this conversion where nobody has looked yet." —
  false; nobody had independently looked at the agent's own files either
- "I can only answer [did it work] for the 7 files I transcribed myself." — inverts the truth
