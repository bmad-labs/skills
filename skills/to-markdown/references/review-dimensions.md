# Multi-Dimension Review With Subagents

One agent per dimension, dispatched in parallel, each writing a **TSV artifact** rather than a
prose report — see "Demand an artifact, not a verdict" in SKILL.md for the measured reason.

## Choose the dimensions from the source

**You pick the dimensions at review time. Do not run a fixed list.** A dimension earns a reviewer
when the source actually contains that kind of content and getting it wrong would matter.

Method:

1. Inventory what the source contains — equations, tables, figures, code, API signatures,
   citations, cross-references, glossary terms, revision history, units and tolerances.
2. For each, ask: *if this were silently wrong, would a reader be misled?* Yes → it needs a lens.
3. Split so each agent has **one source of truth** (rendered pages, or scripts, or opening images).
   Mixing kinds in one agent produces a shallow sweep.
4. Aim for 2–5 dimensions. One reviewer told to "check everything" checks nothing; ten reviewers
   is mostly overhead.

**Worked examples:**

| Source | Sensible dimensions |
|---|---|
| Thesis / paper | Fidelity · Math · Structure · Figures |
| SDK or API guide | Fidelity · Code & signatures · Figures/screenshots · Cross-references |
| Datasheet | Electrical values & units · Pin/register tables · Timing diagrams |
| Standard / spec | Normative wording (shall/should/may) · Clause numbering · Cross-references |
| Slide deck | Per-slide text · Figures · Speaker notes |
| Legal / contract | Clause text verbatim · Defined terms · Numbering & cross-refs |

A datasheet has no bibliography. A deck has no equations. Review what is there.

## Common dimensions

Starting points, not a checklist to run wholesale. Take what fits, drop the rest, add what the
source demands.

### Fidelity — text is verbatim

**Source of truth:** rendered page images.

- [ ] No dropped sentences or clauses
- [ ] No reworded or paraphrased prose
- [ ] Every number matches: percentages, measurements, units, counts
- [ ] Every table cell matches the printed grid
- [ ] **Author's own typos preserved, not silently corrected** — highest-value check here
- [ ] Emphasis preserved where the source has it
- [ ] Heading numbering and wording match

**Columns:** `item verdict page pdf_text md_text` — quote both sides on any DEFECT.

### Math — equations survived

**Source of truth:** rendered page images. Text extraction cannot settle any question here.

- [ ] Every symbol present, none invented or dropped
- [ ] **Accents exact:** `\bar` vs `\hat` vs `\dot` vs `\tilde` — highest-risk category
- [ ] Sub/superscript placement, stacked super/subscripts
- [ ] Symbol class: bold vectors, calligraphic sets, italic scalars, upright text subscripts
- [ ] Operators: sum limits, norms, cross product, transpose, inverse, piecewise
- [ ] Equation numbers match and sit in the right section
- [ ] Inline symbols in prose agree with the display equation
- [ ] Renders: balanced braces, valid environments

**Columns:** `eq verdict page symbol_confirmed`

Upright vs italic can differ *within* one document (display upright, explanatory bullets italic).
Both may be correct — check against the page, not against consistency.

### Structure — navigation and completeness

**Source of truth:** scripts.

- [ ] Source TOC fully represented, page numbers correct
- [ ] No heading-level skips
- [ ] Every anchor resolves; every asset referenced; no orphans
- [ ] Reference list complete, sequential, no gaps or duplicates
- [ ] Sampled reference entries correct in every field
- [ ] Every in-text citation exists in the reference list
- [ ] **Provenance ranges boundary-checked** — range start is that section's opening page, and the
      page after the end belongs to the next section
- [ ] No truncated files, duplicated headings, leftover page numbers

**Columns:** `check verdict count detail`

### Figures — images are right

**Source of truth:** open every image and its source page. No sampling.

- [ ] Image is the figure its filename claims
- [ ] Every promised sub-panel present — count letters against the caption
- [ ] Nothing clipped: axis labels, colorbars, scale bars, legends, panel letters
- [ ] No contamination: prose, header, page number, neighbouring figure
- [ ] **Caption not baked into the pixels**
- [ ] Integral diagram text legible at the chosen dpi
- [ ] Markdown caption matches the source verbatim

**Columns:** `figure verdict page panels_expected panels_seen caption_in_frame evidence`

Two figures sharing a page: confirm neither crop contains part of the other. No automated check
sees this.

### Code & signatures — for technical manuals

**Source of truth:** rendered pages (code is often a bitmap with no text layer).

- [ ] Every code block transcribed, none summarised or elided
- [ ] Indentation and line breaks preserved
- [ ] Identifiers character-exact, including the source's own inconsistencies
- [ ] Types, parameter order, return values, enum values match
- [ ] Language tag on each fence
- [ ] Commands and paths copy-pasteable

**Columns:** `block verdict page identifier_confirmed`

## Scoring the returned artifacts

1. **Row count first.** Short file = incomplete review, whatever the rows say.
2. **All-PASS is a yellow flag, not a green one.** Spot-check 3 rows against the source yourself.
3. **Evidence column must be specific.** "Looks correct" means no inspection happened.
4. **Verify page attributions** against your own page map. Wrong page → the agent reviewed the
   wrong thing and its verdict is void.
5. A `DEFECT` row is a **suspect**, not a finding. Confirm on the rendered page before editing.

## Dispatch template

```
You are the <DIMENSION> dimension reviewer.

SOURCE: <pdf path>          CONVERSION: <output dir>
Page offset: PDF page = printed page + <N>

Use the Read tool with the pages parameter to view source pages as RENDERED IMAGES.
Text extraction destroys math, tables, and layout — do not rely on it.

Check: <the checklist items you selected for this dimension>

Write results to <exact path>.tsv — tab-separated, one row per <item>, header:
<exact columns>

verdict is exactly PASS or DEFECT. <evidence column> must name something you
actually observed.

All <N> rows required. Then reply with only DONE and the path.
```
