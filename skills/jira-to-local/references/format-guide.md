# Format guide

What to fix in a fetched file, and how. Read this while running the format pass.

The conversion from Atlassian Document Format is mechanical. It cannot tell a
heading from a bold line, and it copies unfilled Jira template text verbatim. So
every fetched file needs a formatting pass — not as polish, but because a document
that renders as one wall of text is not readable at all.

`check-markdown.mjs` finds most of it. The rest is judgment.

```bash
node <skill-path>/scripts/check-markdown.mjs <file.md>
```

Exit 0 is clean. Exit 1 while any finding remains. Re-run after editing.

## The 18 checker rules

| Rule | Defect | Fix |
|---|---|---|
| `emphasis` | `**GIVEN **text` — a space before the closing `**` | Move the space out: `**GIVEN** text`. CommonMark will not close an emphasis run whose closing `**` is preceded by whitespace, so the asterisks render literally |
| `MD001` | Heading level jumps, `##` then `####` | Renumber so each level increments by one |
| `heading-bold` | `## **Title**` | Drop the `**`. A heading is already emphasized |
| `heading-punct` | `## Pre-condition:` | Drop the trailing `:` or `.`. Punctuation that only ended a bold label is formatting, not wording |
| `MD012` | Two or more blank lines in a row | Collapse to one |
| `MD032` | A list glued to the paragraph above it | Insert a blank line, or the list renders as running text |
| `MD034` | A bare URL in prose | Give it link text naming the destination |
| `empty-row` | `\|  \|  \|  \|` | Delete the row. Delete the table when every row is empty |
| `boilerplate` | `<Insert Text>`, `As a _______` | Delete the block. It says nothing about this issue |
| `bogus-link` | `[Field.Name](http://Field.Name)` | Jira auto-linkified a field name. Unwrap it to plain text or code: `` `Field.Name` `` |
| `inline-code` | A long statement in backticks, 60 characters or more | Move it to a fenced block with a language tag |
| `list-marker` | `- - item` | Remove the doubled marker |
| `short-rule` | `--` alone on a line | Make it `---`. Two markers are not a thematic break: the line renders as literal text, and when content sits directly above it, CommonMark reads the pair as a setext `<h2>` instead. Jira authors type it as a separator between blocks, so a rule is the intent |
| `broken-image` | The referenced file is not in `assets/` | Re-fetch the part. Never silently drop the reference |
| `WCAG-1.1.1` | `![image-20260101-120000.png](…)` | Replace the filename with what the image shows. Open it and look |
| `WCAG-2.4.4` | `[here](…)`, `[click here](…)` | Use text naming the target: `[Check the linked ticket](…)` |
| `table-candidate` | Six or more `Label: value` bullets in a row | Convert to a two-column table |
| `gwt-not-list` | `**GIVEN** …` as a bare paragraph line | Make every clause a list item |

## Two worth understanding beyond the table

The first has a rule, `gwt-not-list`, but the fetch usually settles it before the
checker runs. The second the checker cannot detect at all.

**Given-When-Then blocks.** Every clause is its own list item:

```markdown
- **GIVEN** the record has no owner
- **WHEN** the user opens the list
- **THEN** the Owner column reads `Unassigned`
```

Putting each clause on its own source line without the marker is not enough. A
single newline is a softbreak, so consecutive paragraph lines render as one
paragraph however the source looks. A list also groups the clauses visually as one
scenario.

**The fetch now emits these as list items**, so a clean file should arrive with no
`gwt-not-list` findings at all. The rule stays because the converter only recognises
a clause it can see: a keyword the author bolded oddly, or wrote in another
language, still arrives as a paragraph. If one does, make it an item — and check the
render, not the source.

**A paragraph doing a heading's job.** `Before the form is submitted:` followed by a
list is a heading. Promote it.

## The defects these files actually contain

In the order they are usually worth fixing.

**1. Bold wrappers inside headings.** ADF heading nodes keep their bold marks, so a
heading arrives as `## **AC1: Show the selected value**`. Remove the
`**`, keep the text.

**2. Bold lines that are siblings of a heading.** A ticket often mixes the two: the
first criterion arrives as `## **AC1: …**` while the rest stay `**AC2: …**` bold
lines — the same kind of thing in two forms. Make them one level, and prefer headings, so they
appear in a table of contents.

**3. Heading levels that skip or collide.** The sections the script writes are
`##`. A heading lifted out of a field body must sit below its section, so `###` or
deeper — never another `##` competing with the section above it. Do not skip a
level either: the first heading inside a `##` section is `###`, not `####`.

**4. Empty table rows.** An unfilled Jira table converts to `|  |  |  |  |`.
Delete the row; delete the whole table when every row is empty.

**5. Unfilled template boilerplate.** A project's story-format field often holds the
blank template — `As a _______, I want _______`, `<Insert Text>`, and whatever
prompt the template shipped with. It says nothing about this issue. Delete the
section. Keep it only where someone filled it in.

**6. Filename alt text.** Every fetched image arrives with its filename as alt
text, because the script has not seen the image. Open it, then describe it:
`![Settings dialog, save confirmation](assets/image-20260101-120000.png)`.

**7. Run-together paragraphs.** Add the blank line that separates a paragraph from
the list or table below it.

## When a finding cannot be fixed

Some findings can only be fixed by changing words. The never-change-words rule
wins: leave the finding and name it in the report. A run that does not reach a
clean exit is correct when every remaining finding is recorded that way.

Two rules sit on this line often:

- `WCAG-2.4.4` on link text the issue's author wrote
- `MD034` on a URL inside quoted content

Fix only the ones fixable by moving or re-marking text. See
[`refactor-guide.md`](refactor-guide.md) for where the line is.

## Read it once more at the end

Every heading at the right depth, every table with content in it, no section that
tells the reader nothing. A pass that only pattern-matches on syntax misses the
defects that actually stop someone understanding the issue.

**The rules above are a floor, not the definition of a well-formatted file.** They
cover what someone thought to automate. A clean exit means no *known* defect is
left — it does not mean the document reads well, and it never licenses shipping a
file you can see is a mess.

So the last pass is yours, not the checker's: read the whole file as the reader
will, and fix anything that renders wrong or breaks the reading, whether or not a
rule names it. A `--` between two correct `---` separators passes every rule that
predates `short-rule`, and an agent that infers from the clean exit that there was
nothing to fix has made exactly the mistake to avoid. When you find such a defect, fix it in the file
and say so in your report — a defect that recurs across issues is worth a new rule
here.
