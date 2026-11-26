# Structured Sources

Use this route when the source file holds the data itself: a spreadsheet
(`.xlsx`, `.csv`, a native Google Sheet exported as `.xlsx`) or a diagram file
(draw.io `.drawio` / mxGraph XML, Mermaid). The rendered-page route in
`SKILL.md` does not apply.

**Read the data, not a render.** A spreadsheet's cells and a diagram's shapes
and arrows are already exact. Rendering them to PDF and copying the page by eye
throws away fills, hidden columns, stored values, and which arrow joins which
shape — the information that makes the file worth converting. Never convert an
`.xlsx` or a `.drawio` file to PDF in order to transcribe it.

No `poppler`, PyMuPDF, or LibreOffice is needed on this route. A ZIP reader and
an XML reader are enough; any language's standard library has both.

## Spreadsheets

### Output contract

| Rule | Why |
|---|---|
| Copy values as stored. A formula gives its last saved result | The stored value is what the author saw |
| Write a whole number stored as `4.0` as `4`; change no other value | Some exporters, including Google's `.xlsx` export, store whole numbers as `4.0`. Removing trailing zeros loses no digit |
| One `## Sheet: <name>` section per sheet, in workbook order | The sheet is the unit a reader cites |
| When the sheet has a header row, its labels head the table, each with its column letter: `LENGTH (H)` | Keeps a cell reference such as `H5` usable |
| A header row has two or more text values and at least one row under it | Without this test, a data row or a title becomes a header |
| Rows above the header with one value each are title rows, written as `Row 1: <value>` | A title is not a table row |
| Keep a `Row` column with the sheet's own row numbers | Rows with no values are left out, so the table index is not the sheet row |
| Leave out rows and columns with no values, and say so above the first table | A reader must know a gap is deliberate |
| List filled cells by fill colour and cell range, under `### Highlighted cells in <sheet>` | Markdown tables cannot show colour, and a fill often marks what changed |
| Merged cells: write the value once, in the top-left cell, and name the merged range in a note under the table | Repeating the value invents data; dropping the range hides the shape |
| A column with values but no header label is headed by its letter alone: `K` | An invented label is not in the source |
| List only filled cells that hold a value. Any compact range form is fine, such as `I4:I7` or `A38:I42`, but the list must expand to exactly those cells | A fill on an empty cell carries no data, and a range that covers empty cells overstates the highlight |

Cell fills come from `xl/styles.xml`: a cell's `s` attribute indexes
`cellXfs`, whose `fillId` indexes `fills`. Fill patterns `none` and `gray125`
and pure white are no fill. A theme colour has no RGB value; write
`theme colour <n>` rather than guessing one.

### Provenance

Per file: source path or URL, file id when there is one, and the source's
modified time. Write `not available` for a value the file does not carry; do not
substitute a local file time. Per citation: sheet name plus cell range, such as
`Sheet 1!C5:H5`. Page ranges do not apply.

## Diagrams

### Redrawing from data is not fabrication

`SKILL.md` forbids redrawing a diagram from a picture. That rule stands. A
diagram rebuilt from the source file's own shape and arrow data is a
different act: every node and edge comes from the file, so it is a
transcription. Prefer it to a cropped image, because it can be searched and
diffed.

If a PDF figure was drawn from a diagram file you can obtain, convert the file
instead of cropping the figure.

### Output contract

For each diagram page:

| Part | Holds |
|---|---|
| Count line | Shapes and arrows, and how many arrows are attached at both ends, inferred, or open |
| `### Diagram` | A `mermaid` flowchart. Node ids `n1`, `n2` … follow the shapes top to bottom, then left to right |
| `### Flow` | Each flow walked from its start shape, one line per shape, with the next shapes and arrow labels such as `[YES]` |
| `### Shapes` | Node id, kind, label, and the container the shape sits in |

Rules:

- **One shape, one node.** Two shapes with the same label stay two nodes. Writing
  arrows by label merges them, and the flow becomes unreadable.
- **Keep the shape kind**, read from the first style token or `shape=`:

  | Style | Kind | Mermaid |
  |---|---|---|
  | `rhombus`, `mxgraph.flowchart.decision` | decision | `{"…"}` |
  | `ellipse`, `doubleEllipse`, `mxgraph.flowchart.terminator` | start/end | `(["…"])` |
  | `umlActor`, any `*actor*` | actor | `(("…"))` |
  | `cylinder`, `*datastore*`, `*database*`, `mxgraph.flowchart.direct_data` | database | `[("…")]` |
  | `note`, `text` | note | `>"…"]` |
  | `image` | image | `[/"…"/]` |
  | `swimlane`, `group`, `container=1`, or any shape that is a parent of others | container | `subgraph` |
  | anything else | box | `["…"]` |

  Name the style of any shape you map to `box` only because it is unknown, so a
  reader can correct the kind.
- **Keep draw.io links.** A shape wrapped in `<object>` or `<UserObject>` can carry
  a `link` attribute. Keep it in a `Link` column of the shape table.
- **Keep label line breaks.** draw.io labels are HTML: `<br>` and every block
  tag (`<div>`, `<p>`, opening or closing) start a new line. Dropping only
  `<br>` glues `KAFKA TOPIC<div>topic-name</div>` into one word.
- **Name loose arrow ends.** draw.io stores an unattached end as a point. An end
  whose point lands on a shape, or within 10 px of its box, is attached to that
  shape and marked *inferred*, drawn dotted (`-.->`). When two shapes qualify,
  take the smaller one. An end that lands on no shape is an *open end*. Never
  drop an arrow because an end is missing.
- **Walk each flow depth first.** A flow starts at a shape with an outgoing arrow
  and no incoming one, in node-id order. Follow outgoing arrows in node-id order
  of their targets. A shape already listed is named, not repeated. If shapes with
  outgoing arrows remain unvisited (a loop), start the next flow at the first of
  them. List shapes no flow reaches under their own heading.
- **Shapes without text** that an arrow touches are kept as
  `(<kind> without text)`. Do not guess what an embedded image shows. You may save
  an embedded image as-is to `assets/` and link it from the shape table.
- **Leave out** shapes with no text and no arrow; say so in the intro line.

### Provenance

Per file: source path or URL, file id, modified time. Per citation: page name
plus node id, such as `페이지-1 n9`.

## Agent-written summary

A summary of a spreadsheet or diagram is the only new text this route allows.

- Put it under its own heading, first in the file.
- Open it with a line saying who wrote it and that the converted data below it is
  the record.
- Quote every label exactly, copied from the converted output — never from
  memory or from the rendered picture. Write a label's line break as one space.
- Name inferred and open arrows as such.

## Verification that can fail

| Claim | Check |
|---|---|
| No cell dropped | Per sheet, count non-empty cells in the source and in the output table plus title rows. The counts must match |
| No value changed | Diff every output cell against the parsed source value, allowing only the trailing-zero rule |
| Fills are complete | Count filled non-empty cells below the header in the source; compare with the cells listed under the highlight heading |
| No arrow dropped | The count line's attached + inferred + open equals the number of edge cells in the source |
| No shape merged | Count shapes per label in the source; the shape table must hold the same count per label |
| Arrow labels kept | Every non-empty edge label appears once in the Mermaid block |
| Diagram renders | Render the Mermaid block (a Markdown preview or `mmdc`); a syntax error is a failed file. With no renderer, at least check that every node id an arrow uses is defined once, and say the render was not checked |
| Summary is grounded | Every backticked or quoted label in the summary appears verbatim in the shape table, after writing each `<br>` in the table as one space |

Count cells from the source XML, not from your own output. In draw.io, the
`<mxCell>` inside an `<object>` or `<UserObject>` belongs to that wrapper:
count the pair once, or the shape count doubles.

**Prove each check can fail.** Change one cell value and delete one Mermaid
arrow in a copy of the output; the value, edge-count, and arrow-label checks
must fail. Then restore it.

These checks replace the lens review of `SKILL.md` step 6 for the converted
data. The summary is the one part an author wrote, so when another agent wrote
it, check it as a reviewer: open the shape table and confirm each claim.

## Reference implementation

`jira-to-local/scripts/google-links.mjs` implements most of this contract for
`.xlsx` and draw.io files: `parseWorkbook`, `renderWorkbookMarkdown`,
`parseDrawio`, and `renderDiagramMarkdown`, with specs in
`google-links.spec.mjs`. It does not handle merged cells, `.csv`, or draw.io
`link` attributes, and it does not run the counting checks above. Read it for the method. It is part of another
skill, so do not call it as this skill's converter.
