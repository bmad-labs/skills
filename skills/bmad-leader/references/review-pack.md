# Review pack — a change batch the User can read fast

Use this when the User must catch up on a change set: a correct-course batch, a set of Story
changes, a migration, or any answer to "what changed, why, what is the impact".

The pack is one HTML file. Open it in a browser. It is not a chat reply and not a Markdown
document: it carries colour, tooltips, and a review state per item.

Template: `assets/review-pack.template.html`. Copy it, then replace every `{{PLACEHOLDER}}` and
every `Example:` block. Keep the CSS and the script.

Worked example: `assets/review-pack.example.html`, a 14-clause batch for a fictional notes API. Read it before filling the template: it shows the length of a card, the
amount of colour per row, and how much prose each section holds.

## File pair

Every correct course writes two files with the same basename, in
`<planning-artifacts>/`:

| File | Reader | Purpose |
| --- | --- | --- |
| `sprint-change-proposal-<date>[-<slug>].md` | leader and record | proposal: `file:line`, exact OLD → NEW, evidence, owner Story, and whether it blocks |
| `sprint-change-proposal-<date>[-<slug>].html` | User | review pack built from the template |

The `.md` is what `bmad-correct-course` writes by default; do not rename it to `correct-course-*.md`.
Example: `sprint-change-proposal-2026-11-03-epic-4-open.md` beside `.html`. Do not move the pack to
`diagrams/`, and do not merge two batches into one pair. A batch that is already applied keeps its
own pair as the record.

## When to build one

- A `bmad-correct-course` proposal is drafted or applied.
- A change set spans documents and code, or spans more than one Epic.
- The User asks what changed, why it is needed, the impact, or the process before and after.
- A decision list must be answered item by item.

Skip it for one Story with no planning-document change; report those in chat.

## Structure, in this order

| # | Section | Content | Failure if missing |
| --- | --- | --- | --- |
| 1 | Overview | Scope, reason, effect on the User's work, status | The User reads the detail first |
| 2 | Purpose | Who reads the documents, and the two fault types: promises work nobody does, omits a fact | The changes look like pedantry |
| 3 | Behaviour changes | One card per change: Current / After / Reason / Observed by / diagrams / review row | The User cannot judge an item |
| 4 | Document-only changes | One row per clause: stated before, actual, effect if unchanged | Text corrections look like behaviour changes |
| 5 | Impact | User's work, intent and PRD, architecture, Agent behaviour, stored data, rollback, if not applied | The User cannot decide safely |
| 6 | Process before and after | One pair of complete diagrams for the whole flow, plus how the batch is applied | The steps stay abstract |
| 7 | What it enables | Clause → Story → what fails without it | The reason to approve is unclear |
| 8 | Decisions | Only approval-tier questions, each with a decision badge. Detail changes carry `tier: detail` and their boundary citation in the appendix, with no decision row | Decisions hide in prose, or the User is asked about detail |
| — | Appendix | The full clause table, collapsed | Checking a clause means opening files |

## Writing rules

1. **Neutral tone.** State facts. Remove "the value is", "it is worth", "smooth", "powerful",
   "just", "simply". Never sell the change.
2. **Plain words first, identifier second.** Each `Where` cell reads
   `<code>path:line</code> — plain description`. A reader without the code must still follow.
3. **Highlight means an inline mark, never a summary.** Use colour, bold, a badge, or a label
   on the existing sentence. Do not add a summary paragraph and call it a highlight.
4. **Two complete diagrams.** Before and after are separate panels with the same step list and
   the same layout. Never draw one diagram and annotate only the delta.
5. **Colour only the difference.** Unchanged lines stay black, so the eye finds the change.
6. **One concept per row or card.** If a cell needs "and also", split it.
7. **Bold the deciding fact, not the whole sentence.** One mark per reason.
8. **Label what needs the User.** A `your decision` badge on the card and on the decision item.
9. **Tooltip on first use.** Hover and keyboard focus both show it. The tooltip is the only
   definition; there is no separate glossary section.
10. **No numbers that are not counted.** `{{CLAUSE_COUNT}}` must equal the rows in the appendix.

## Mark vocabulary

| Mark | HTML | Meaning |
| --- | --- | --- |
| removed | `<span class="del">…</span>` | before only, goes away |
| added | `<span class="add">…</span>` | after only, new |
| changed in place | `<span class="chg">…</span>` | same sentence, different word |
| deciding fact | `<strong class="hl">…</strong>` | the fact that forces the change |
| no effect | `<b class="v-ok">No change.</b>` | Impact cell, first word |
| effect | `<span class="v-watch">Two clauses.</span>` | Impact cell, first word |
| needs the User | `<span class="badge need">your decision</span>` | card header and decision item |
| term | `<span class="term" data-tip="…">label</span>` | hover definition |
| review | `.review` block with checkbox and select | per-item state, saved in localStorage |

Keep the legend at the top in step with this table. A mark the legend does not name is a defect.

## Diagram rules

**Medium depends on what you can draw reliably**, not on the document:

| You can | Medium | Why |
| --- | --- | --- |
| produce precise inline SVG geometry | Inline SVG | Cleaner boxes, arrows and labels |
| not produce it reliably | ASCII inside `<pre>` | Cheaper to produce correctly; no risk of malformed paths or overlapping text |

Write the rule you used in the chat report, one line, so the next reader knows why a pack looks different.

### SVG rules

- Inline `<svg>` in the HTML. No external file, no `<img>`, no data URI. The pack stays one file.
- `viewBox="0 0 W H"` with a fixed width and height, and `width="100%"` so it scales. One `viewBox` unit per character cell keeps the geometry predictable.
- `role="img"` plus `<title>` and `<desc>` on every diagram. The title names the flow and the state; the desc names the difference.
- Same palette as the text marks: `#b3122b` removed, `#0a7d32` added, `#7a5800` changed in place, `#23231f` text, `#e3e3e0` borders.
- Full before and full after: two SVGs, same viewBox, same step positions. Mark unreachable steps in red rather than deleting them.
- Text: `<text font-family="ui-monospace, Menlo, monospace" font-size="13">`. One `<tspan>` per line, `x` fixed at the box's left padding plus 8.
- Arrows: one `<marker id="arrow">` reused by `<path marker-end="url(#arrow)">`. Straight lines and one elbow only; no curves.
- Boxes: `<rect rx="6">` with a 1px `#e3e3e0` stroke and white fill. A changed box takes the palette colour on its stroke and its title only.
- No animation, no script, no gradient. It must print.
- Check before linking: open the file, zoom to 50 % and 200 %, and confirm no label overlaps a border and no arrow head covers text.

### ASCII rules

- ASCII inside `<pre>`, monospace. One step per line group: number, action, outcome.
- Both panels carry the full step list, from the first step to the last. Mark unreachable steps
  in red rather than deleting them: the reader must see where the flow stops.
- Keep both panels the same width and the same indentation so a line-by-line comparison works.
- Put the diagram inside the behaviour card it explains. Do not collect per-item diagrams in a
  separate section; the reader should not scroll back and forth.

## Build order

1. Collect the clauses. Each needs path, line, before, after, reason, an owning Story, and a tier:
   `approval` (intent, PRD direction, architecture, technical-design contract) or `detail`
   (with the boundary line it stays inside). See the Decision ladder in `SKILL.md`.
2. Sort into behaviour changes (the User decides) and document-only changes (no decision).
3. Count: clauses, applied, proposed, behaviour items. Those numbers go into the Overview.
4. Copy the template beside its proposal:
   `<planning-artifacts>/sprint-change-proposal-<date>[-<slug>].html`.
5. Fill the sections in order. Build the appendix table first if the counts are unclear.
6. Add a tooltip at each specialist term's first use. The tooltip is the only definition.
7. Open the file in a browser. Hover every term. Tick one review box and reload to prove the
   state persists.
8. Run the checks below.

## Checks before you link the file

| Check | How |
| --- | --- |
| HTML is well formed | `python3 -c "from html.parser import HTMLParser; …"` until `unclosed: []` |
| Every `Where` has path and line | `grep -o 'code>[^<]*:[0-9]'` and read the misses |
| Counts match | compare Overview numbers with appendix rows and behaviour cards |
| No sales language | search `value`, `smooth`, `powerful`, `simply`, `just`, `easy` |
| No summary block | every added paragraph must be a heading intro, not a recap |
| Tiers are right | every `detail` clause cites a boundary line; every `approval` clause has a decision row |
| Diagram pairs are full | each panel starts at the first step and ends at the last |
| Legend covers every mark | legend names red, green, amber, highlight, decision badge, verdict words |
| Every specialist term has a tooltip at its first use | read the section once and mark each term |
| Neutral numbers only | no estimate or "about" in a table cell |

## Report in chat

One line: the file path, the section order, the count of items that need the User, and the open
decisions. Do not paste the table content into chat; the file is the report.
