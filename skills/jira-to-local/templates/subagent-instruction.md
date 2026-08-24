# subagent-instruction.md

The prompt for the fetch-and-format subagent. Fill the `{...}` slots and pass the
whole thing. The rules below are what keep it from rewriting the issue; a prompt
that says "tidy up the markdown" without them invites exactly the prose edits that
make a fetched file wrong.

The prompt is markdown, and stays markdown when you pass it: the subagent's whole
job is judging markdown, so a prompt whose own headings and tables render is one it
can read at a glance. Keep the headings — they are what makes a rule findable when
the subagent is mid-part and looking for one.

The format and never-change-words rules are paraphrased here rather than only
pointed at, because they apply to every file of every part — a rule the subagent
has to go and read is a rule it can skip. The pointers are for the cases the
paraphrase does not cover. Do not tidy one of the two away in favour of the other.

---

````markdown
# Pull Jira issue {KEY}

Pull it into `{FOLDER}`, one part at a time.

- Output mode is `{MODE}`.
- Skill scripts are at `{SKILL_PATH}/scripts/`.
- Snapshots go in `{SCRATCHPAD}/`.

## References

Read the one a step names, when that step needs it.

| Reference | When |
|---|---|
| `{SKILL_PATH}/references/format-guide.md` | Every checker rule, its defect, its fix |
| `{SKILL_PATH}/references/refactor-guide.md` | The formatting/wording line, case by case |
| `{SKILL_PATH}/references/confluence-links.md` | The Confluence part only |
| `{SKILL_PATH}/references/output-json.md` | `json` or `both` mode only |

## What this project expects

{INSTRUCTIONS}

## The loop

**For each part: fetch, snapshot, format, check, report, then the next.**

A part is not done when the script exits. It is done when its file is formatted and
both gates are clean. Never fetch the next part while the previous one is still
unformatted, and never save the formatting to the end. One part at a time is the
point: each file gets checked while it is still small enough to check.

The parts, in this order. Skip 3 if the issue has no subtasks, skip 5 if it has no
development activity, skip 6 if it links no Confluence page. Each part that writes
nothing says so and exits 0 — that is a skip, not a failure.

```bash
node {SKILL_PATH}/scripts/fetch-issue.mjs {KEY} --part content
node {SKILL_PATH}/scripts/fetch-issue.mjs {KEY} --part comments
node {SKILL_PATH}/scripts/fetch-issue.mjs {KEY} --part tasks
node {SKILL_PATH}/scripts/fetch-issue.mjs {KEY} --part worklogs
node {SKILL_PATH}/scripts/fetch-issue.mjs {KEY} --part development
node {SKILL_PATH}/scripts/fetch-confluence.mjs --issue {KEY}
```

### 1. Fetch

One part, one call. If it exits non-zero, stop and report — a part that could not be
read completely is not a part to format. Do not retry with different flags to make
it succeed.

### 2. Snapshot

Before editing, copy the raw file aside:

```bash
cp {FOLDER}/<file>.md {SCRATCHPAD}/<part>.fetched.md
```

The main thread diffs against this to confirm you changed no words. Without it there
is nothing to check and the work cannot be trusted.

### 3. Format

Read the file end to end first, and open every image in `assets/` that it
references — you cannot write alt text for an image you have not looked at. Then fix
the layout. You edit the file yourself; no script rewrites the prose.

**Judge the file as a human reader, not as a checker input.** Your job is a
document someone can read; the checker is one tool for finding defects, not the
definition of a good file. So read every line and ask what it renders as. Anything
that renders wrong, reads as a mess, or would make a reader stop and re-read is
yours to fix — whether or not any rule names it.

Things no rule may name, all of them real:

- a separator with the wrong number of markers — `--` is not a rule, it is literal
  text, and next to real `---` separators the intent is obvious
- an empty heading, a heading with nothing under it, a stray `##`
- a table whose columns do not line up with its header, or a one-cell table
- a numbered list that restarts at 1, or whose numbers jump
- items indented under the wrong parent, so the nesting says something false
- a section in an order that makes no sense to read

Do not wait for the checker to give you permission to fix these.

### 4. Check

```bash
node {SKILL_PATH}/scripts/check-markdown.mjs {FOLDER}/<file>.md
node {SKILL_PATH}/scripts/check-json.mjs {FOLDER}/<file>.json   # json or both mode
```

Re-run until clean. A rule you do not recognise is defined in
`references/format-guide.md`; `references/output-json.md` has the JSON shape per
document and the null-not-`""` convention.

**A clean exit is the floor, not the finish.** The gates catch what someone thought
to write a rule for. When they come back clean, read the file once more and ask
whether you would hand it to a colleague. If not, keep fixing — a clean gate on a
badly formatted file is a failed part.

### 5. Report

One line on what the fetch found, one line per change you made, and the gates' exit
state. Never paste the file contents.

## What to fix

The checker names most of it:

- space inside bold markers — `**GIVEN **text` renders literal asterisks
- heading level jumps, bold inside headings
- blank-line runs, lists glued to the paragraph above
- bare URLs, empty table rows
- unfilled Jira template boilerplate, auto-linkified field names
- long statements in inline code, doubled list markers
- broken image paths, filename-as-alt-text, vague link text
- runs of `Label: VALUE` bullets that belong in a table

Ones the checker cannot see — and this list is not complete, because it cannot be.
Anything that reads badly is in scope:

- **A paragraph that introduces a list is a heading.** Promote it.
- **A short rule is not a rule.** `--` or `**` alone on a line renders as literal
  text, or turns the line above into a heading by accident. Make it `---`.
- **An empty heading carries nothing.** A bare `##` with no text, or a heading with
  no content under it, is fetch residue — remove it.

And one it catches but rarely has to:

- **A Given-When-Then clause is its own list item** — `- **GIVEN** …`. The fetch
  already emits them that way; if you ever see one as a bare paragraph, make it an
  item, because markdown folds consecutive lines into one paragraph and it would
  render as a wall of text. Check the render, not the source.

Both lists are the short version. `references/format-guide.md` has each rule with
the defect it catches and the fix for it.

## Never change the words

Not the wording, terminology, spelling, code, ids, dates, names, or URLs. This file
is a record of what the issue says, and a reworded record is a wrong one. Moving a
word into a table cell or onto its own line is formatting; rewriting it is not. Do
not improve text that reads poorly — that is what the ticket says. A ticket written
in mixed languages stays in those languages; never translate.

**The one exception is image alt text**, which you write from what you see in the
image.

When a finding can only be fixed by changing words, leave it and name it in your
report. A run that does not reach a clean exit is correct when every remaining
finding is recorded that way. Two rules sit on this line often: `WCAG-2.4.4` on link
text the author wrote, and `MD034` on a URL inside quoted content.

`references/refactor-guide.md` works the boundary case by case, including when
deleting an unfilled template counts as removing boilerplate rather than removing
content — that one stops a run dead otherwise.

## Write for someone who has never seen this issue

The reader cannot open Jira, has not read the code, and does not know the project's
shorthand. Where an unexplained ticket key, field name, or file path would cost them
a lookup they cannot make, name what it is in a short clause. That clause is the
only new prose you write, besides alt text.

## After the Confluence part

If a Confluence page was written, link it from `content.md` under a
`## Linked Documents` heading, so the reader finds it without being told it exists.
That edit re-opens `content.md` — re-run its gates.

`references/confluence-links.md` has the rules for the page itself: its attachment
paths get rewritten, and a pulled page is markdown in every output mode, so
`check-json.mjs` never runs on it.

## Finish

Report, in this order:

1. Each part: what the fetch found, as `N of N`.
2. Each part: the changes you made, one line each.
3. Both gates' final exit state.
4. Anything left unfixed because fixing it would have changed words.

Never the file contents.
````

---

## Filling the slots

| Slot | Value |
|---|---|
| `{KEY}` | The issue key, uppercase |
| `{FOLDER}` | The issue's output folder — `output.dir` plus the key |
| `{MODE}` | `output.mode`: `markdown`, `json`, or `both` |
| `{SKILL_PATH}` | This skill's directory |
| `{SCRATCHPAD}` | A temporary directory for the snapshots |
| `{INSTRUCTIONS}` | `config.mjs instructions "<TYPE>"` — the project-wide text plus this type's. Write "Nothing recorded." when it is empty, rather than leaving the heading with nothing under it |
