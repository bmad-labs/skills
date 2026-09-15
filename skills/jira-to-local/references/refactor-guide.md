# Refactor guide

Where the formatting pass stops. Read this with
[`format-guide.md`](format-guide.md): that one says what to fix, this one says what
to leave alone.

## The boundary

**Change the formatting. Never change the words.**

A fetched file is a record of what the issue says. A reworded record is a wrong
record — and worse than an ugly one, because nothing about it looks wrong. Someone
reading it later has no way to tell which sentences are the author's and which are
an agent's improvements.

| Change this | Leave this alone |
|---|---|
| Heading levels and heading syntax | The wording of any issue text |
| Bold lines that are really headings | Terminology, including odd or local terms |
| Empty table rows and broken table syntax | Spelling and grammar inside quoted content |
| Blank lines, list markers, indentation | Code, ids, dates, names, URLs |
| Bullets that belong in a table | Numbers of any kind |
| Unfilled template boilerplate (delete it) | Anything you would have to rewrite to "improve" |

Editing prose is out of scope **even when the prose is poor**. An issue written in
mixed languages stays in those languages. A typo in an acceptance criterion stays.
That is what the ticket says, and the ticket is the thing being recorded.

## The one exception

**Image alt text.** Every fetched image arrives with its filename as alt text,
because the script never saw the image. Open it and describe what it shows. This is
new prose, written on purpose.

Nothing else is an exception. Not a sentence that reads badly, not a word that
looks misspelled, not a term that seems wrong.

## Moving words is not rewriting them

The distinction that matters in practice:

| Allowed | Not allowed |
|---|---|
| `**Notes for Dev:**` → `### Notes for Dev` | `### Developer notes` |
| `+ Label: value` → `- Label: value` | `- Label value: value` |
| Six `Label: value` bullets → a two-column table | Renaming a label on the way into the table |
| Splitting a run-together paragraph into its clauses | Rephrasing a clause so it reads better |
| Deleting `As a _______, I want _______` | Filling in the blanks |

A word moved into a table cell, onto its own line, or under a heading is the same
word. A word replaced by a better word is a different document.

## How this gets checked

The main thread diffs the formatted file against the pre-format snapshot, word by
word, and **any word added is a violation**. Deletions are expected — that is the
boilerplate.

```bash
norm() { sed -e 's/!\[[^]]*\]/![]/g' -e 's/^#\{1,6\} //' -e 's/\*\*//g' \
  -e 's/^[-*+] //' -e 's/^|//' -e 's/|$//' "$1" \
  | tr '|' '\n' | sed 's/:$//' | tr -s '[:space:]' '\n' | grep -v '^$' | sort; }
diff <(norm <snapshot>) <(norm <file>) | grep '^>'
# must print nothing
```

The normalization strips markup, alt text and trailing colons first, because the
allowed edits would otherwise read as wording changes: a bold label becoming a
heading drops a colon, a changed list marker changes the line, and alt text is
rewritten on purpose.

A hit is not automatically a violation — check it in context. Converting bullets to
a table moves words between cells, which this diff handles. An unusual rewrite will
surface as an addition and must be reverted.

## Deleting boilerplate is not deleting content

Unfilled template text is the one thing to remove outright:

- `As a _______, I want _______, so that ________`
- `<Insert Text>`
- `Please attach any supporting files`
- A table whose every row is empty

None of it says anything about this issue. Keep it only where someone filled it in
— and then it is content, and it stays exactly as written.

## When a fix would need a rewrite

Leave the finding. Name it in the report. The never-change-words rule wins, and a
checker run that does not reach a clean exit is correct when every remaining
finding is recorded that way.

The two that come up most:

- `WCAG-2.4.4` — vague link text like `[here](…)` that the author wrote. Rewriting
  it invents words.
- `MD034` — a bare URL inside quoted content. Labelling it changes the quote.

## Why this is strict

An ugly fetched file costs a reader some patience. A reworded one costs them the
truth, silently, and there is no way to spot it later without going back to Jira —
which is the thing the local copy was supposed to save them.
