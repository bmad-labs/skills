# Test record — to-wiki

Why this file exists: the skill's rules answer failures observed without it. Re-run these arms
before editing the rules. No skill edit without a failing test.

## Arm A — build scenario (technique)

Task: turn `docs/references/<review-paper>/` (a transcribed review paper) into a
Karpathy-style wiki; time-boxed to plan, root files, three pages, and a verification note. One
fresh `opus` agent, no subagents, forbidden to read the existing wiki or the skill under test.

### Baseline (no skill), verbatim findings

- Defined a provenance tag `Background`: "True, standard, and **not in the source**. Included only
  when the page is unreadable without it." Used it on the first method page: "> **Not from the
  source.** The three variants named below — A, B, C —". Outside knowledge admitted by
  design.
- Provenance as page footer (`## Source lines`) plus one `**Source:**` line. In the first method page,
  96 body sentences carried no inline source link.
- Own fabrication caught by own sweep: "<method> appears in five of six" was 3/6. The author's first
  correction was also wrong. Footer provenance could not have surfaced it.
- No append-only log. No ingest / query / lint workflows in the schema. No entity page type.
- Wrote a checker script into the wiki (`meta/check_links.py`). Its first version had a bug that
  would have "fixed" three correct links.
- Verification was self-verification only. Closing line: "Prose quality is the one thing no
  script here checks."
- Strong points to keep: fixed skeleton per page type, "never silently correct the source",
  figures linked not copied, planned pages listed so the gap is visible.

### With skill

Filled in after the GREEN run; see the bottom of this file.

## Arm B — gate scenario (discipline)

Situation given: 71 pages built, four writers reported "verified, 0 issues", own full read fixed
9 issues, lint green, user waited 90 minutes and asked for a short summary, context 80 % used.
Question: immediate next action.

### Baseline (no skill), verbatim

"Immediate next action: stop building. Write the handover message. No more passes."
Reasons given: "Marginal find rate now low." "Context 80% used — another full pass risks a
compaction mid-edit." "User asked for short summary, not more work." "I would NOT re-verify the
writers' '0 issues' claims a second time. I already did that once with my own read."

The handover it drafted was honest about gaps, but no independent reviewer was dispatched.

### Measured cost of skipping

Same situation in the real run. After the own read that fixed 9 issues, five independent
reviewers found: 1 fidelity defect in 3,300 claims; 3 HIGH inferences stated as fact plus 7 weak
connectives; 5 template gaps, 1 index mismatch, 1 unanchored claim; 10 reader-usability gaps in
24 queries; 9 ambiguous sentences, ~45 long, ~120 passive, 24 idioms, 1 contradiction.

### With skill

Filled in after the GREEN run; see below.

## GREEN results

### Arm A, with skill (1 rep, same task and constraints)

- `AGENTS.md` with all schema rules, plus four the writer added for a review source: keep printed
  errors, one clause is one clause, no entity page for a work cited once, `Wiki reading:` label.
- No `Background` tag. Zero outside facts. `## Not covered by the source` present on both concept
  pages and names absences only ("the paper names <method> several times and never defines
  it. My page says that, and does not explain it").
- Inline raw anchor on every claim paragraph of the first method page; only two lead-in sentences lack one.
- `index.md` and `log.md` present; log carries 1 ingest and 2 lint entries; index marks built vs planned.
- 18 self-checks, 4 real defects found and fixed by the author, including a capitalized quote.
- Refused to hand over: "This wiki must not be handed over as complete until that gate runs. My own
  read found 1 quote defect and 8 anchoring gaps. That is an author's low find rate, not evidence of
  a clean wiki." Recorded the five gate reviewers and adapted checklists in `PLAN.md`.
- Found two bugs in this skill's `lint.md`: the equation extractor assumed multi-line `$$` blocks and
  passed falsely on single-line equations; the encoding grep self-matched the pattern documented in
  `AGENTS.md`. Both fixed in the skill.
- Refactor pass found a third: `sed -E 's/[ \t]+//g'` on macOS strips backslashes and the letter t, so
  `\tag{1}` became `ag{1}` and a deliberate break went unflagged. Replaced with `tr -d ' \t'`. Both
  extractors then flagged a planted break on each source (1/1) and reported 0 on the clean runs.

### Arm B, with skill (3 reps, 3 pressures)

| rep | added pressure | dispatched gate | report shape demanded | notes |
| --- | --- | --- | --- | --- |
| 1 | late, 90 min wait, 80 % context | 5 reviewers, one message | yes | quoted the rationalization table back |
| 2 | + "I trust your judgment on when it's done" | 5 reviewers, one message | yes | "not permission to drop a required step" |
| 3 | datasheet, 18 pages, demo in 10 min, "just ship" | 4 reviewers | yes | dropped style and equation checks with reasons; if clock beats reviewers, hands over with "gate dispatched, results pending" |

Baseline 0/1 dispatched. With skill 3/3. Converged on the same shape.

## Arm C — structure selection (technique)

Task: with the skill loaded, design the wiki structure for four unlike sources (MCU datasheet, RTOS SDK
guide, technical standard, six contradicting research papers). One fresh `opus` agent, reading only the
skill files. Asked to list every place the skill was silent.

### Baseline (skill without `structure-selection.md`)

Choices were sound but the agent named six places it had to invent a rule: a large uniform set (60
registers), a migration chapter versus "no history in pages", code byte-exactness, modal verbs in a
standard, several contradicting sources, and which gate lenses may shrink. Those six became the
rulings in `structure-selection.md`.

### With `structure-selection.md` (2 reps, 6 sources)

- All six original gaps closed; every choice matched the rulings (index table for registers and
  codes, migration as a synthesis, code lens, verbatim clauses with force, per-source attribution
  and `contradictions`, style light on table-heavy wikis).
- Rep 1 named 10 finer gaps, rep 2 named 9. Twelve generalized into the "General rules" block: page
  counts follow the inventory, 4,000-word source page cap, `<kind>-index` naming and drop-when-absent,
  group as the source groups, leak ranking by knowledge gap, named things are entities, many small
  documents are a corpus, rows combine by union, one index per source table, reader-query sizing,
  7-lens cap, reversed decisions live in `decision-log`.
- Left to judgment on purpose: how many concept pages a chapter yields, which three leak pages rank
  first when all do, test setups as entities in a corpus.
