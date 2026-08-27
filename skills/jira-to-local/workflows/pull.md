# Pull

Bring one Jira issue onto disk as readable files, complete and checked.

**Reference files:** [`../templates/subagent-instruction.md`](../templates/subagent-instruction.md),
[`../references/format-guide.md`](../references/format-guide.md),
[`../references/refactor-guide.md`](../references/refactor-guide.md)

Five steps. Step 3 is one subagent doing a loop; everything else is the main
thread.

---

## Step 1 [main]: Read the config

```bash
node <skill-path>/scripts/config.mjs path
```

Nothing found means this project has never been set up: run
[`setup.md`](setup.md), then come back here.

Read the instructions now, before anything is fetched:

```bash
node <skill-path>/scripts/config.mjs instructions
```

This is what the project knows that the API cannot say. Hold it for the whole run
and pass it to the subagent in step 3.

## Step 2 [main]: Identify the issue

Ask for the issue id or URL, unless the user already gave one. Both forms work:

- a bare key — `PROJ-123`
- a browse URL — `https://your-site.atlassian.net/browse/PROJ-123`

Resolve the type, because the config is keyed by it:

```bash
node <skill-path>/scripts/jira-api.mjs get "/rest/api/3/issue/<KEY>?fields=issuetype,summary"
```

Then get that type's own instructions, which the fetch will also need:

```bash
node <skill-path>/scripts/config.mjs instructions "<TYPE>"
```

If the type is not in the config, `fetch-issue.mjs` stops and prints the
`inspect.mjs fields` command for it. Do not work around that by pulling with
another type's field list — add the type (setup step 6) or ask the user, then
continue.

## Step 3 [subagent]: Fetch and format, one part at a time

Dispatch **one** subagent, on **`sonnet`**. It keeps the file contents out of the
main thread, which is the point: a fetched issue runs to hundreds of lines and the
main thread needs its context for the task the user actually asked about. The work
itself is procedural — fetch, format, gate — so a larger model buys nothing.

For more than one issue, use [`bulk-pull.md`](bulk-pull.md) instead: the failures
that matter at 80 issues are not the ones that matter at one.

Give it: the issue key, the output folder, the output mode, the instructions text
from steps 1 and 2, and the whole of
[`../templates/subagent-instruction.md`](../templates/subagent-instruction.md).

### The loop

**fetch → snapshot → format → check → report → next part.**

A part is not done when the script exits. It is done when its file is formatted
and its gates are clean. Carry nothing forward: never fetch the next part while
the previous one is still unformatted, and never save the formatting to the end.
The parts are separate so each is checked while it is small enough to check.

The parts, in this order:

| # | Command | Writes | Note |
|---|---|---|---|
| 1 | `fetch-issue.mjs <KEY> --part content` | `content.md` + `assets/` | The issue itself |
| 2 | `fetch-issue.mjs <KEY> --part comments` | `comments.md` | Pages to `total`; reports `N of N` |
| 3 | `fetch-issue.mjs <KEY> --part tasks` | `tasks.md` | Skipped when the issue has no subtasks |
| 4 | `fetch-issue.mjs <KEY> --part worklogs` | `worklogs.md` | Reads the issue **and every subtask** |
| 5 | `fetch-issue.mjs <KEY> --part development` | `development.md` | Skipped when the issue has no development activity |
| 6 | `fetch-confluence.mjs --issue <KEY>` | `confluence/*.md` | Only when the issue links a page |

Each pass through the loop:

1. **Fetch.** One part, one call. A non-zero exit stops the loop — a part that
   could not be read completely is not a part to format, it is a part to re-run.
2. **Snapshot.** Copy the raw file aside before touching it, or step 4 has nothing
   to compare against:
   ```bash
   cp <folder>/<file>.md <scratchpad>/<part>.fetched.md
   ```
3. **Format by hand.** Read the file, open every image it references, fix the
   layout. The agent edits; no script rewrites prose.
   [`../references/format-guide.md`](../references/format-guide.md) lists what to
   fix; [`../references/refactor-guide.md`](../references/refactor-guide.md) draws
   the line at wording.
4. **Check.**
   ```bash
   node <skill-path>/scripts/check-markdown.mjs <folder>/<file>.md
   node <skill-path>/scripts/check-json.mjs <folder>/<file>.json    # json or both mode
   ```
   Re-run until clean. A finding that can only be fixed by changing words stays,
   and gets named in the report — the never-change-words rule wins.
5. **Report.** One line on what the fetch found, one line per formatting change,
   and the gates' exit state. Never the file contents.

Then the next part.

### Part notes

**`confluence`** — sources are `/issue/{key}/remotelink`, plus any wiki URL in the
description or a comment, including an `inlineCard` smart link. Depth comes from
`confluence.maxDepth`. `--list` reports what it found without writing anything.

After writing a page, link it from `content.md` under a `## Linked Documents`
heading, so the reader finds it without being told it exists. That edit re-opens
`content.md`, so re-run its gates.

A pulled page is markdown in every output mode, so `check-json.mjs` never runs on
it.

**`development`** — the panel comes from `/rest/dev-status/1.0/`, which Atlassian
does not document. Unlike every other part, a gap here is **not** a failed part: the
endpoint publishes no total to page to, and the panel is a third-party rollup rather
than the issue's own data, so a call that returns nothing is named inside the
document and the run continues. Read the counts in the report — a `degraded:` line
means the section is thinner than Jira's panel, and that is a complete pull that
says so, not a partial one.

The build count in `content.md` will not match Jira's panel, by design: the panel
shows the latest build per pipeline, the file shows the full history. The file says
which is which, so leave both numbers alone.

The deployment list comes from the GraphQL query Jira's own Deployments tab runs,
because `dev-status` serves no deployment list. It is still a read. When that query
returns nothing, `## Deployments` falls back to one row per environment and says so —
that is the degraded case, not an empty issue.

**Shared `assets/`** — `content` and `comments` both download into it. An image a
later part references may already be on disk; that is expected, not a conflict.

## Step 4 [main]: Validate against Jira

Trust the subagent's report only after checking it. Two things to establish: the
formatting pass changed no words, and the files match Jira.

**No words added.** Against the step-3 snapshots, per file. Deletions are expected
— that is the boilerplate. Additions mean wording changed.

```bash
norm() { sed -e 's/!\[[^]]*\]/![]/g' -e 's/^#\{1,6\} //' -e 's/\*\*//g' \
  -e 's/^[-*+] //' -e 's/^|//' -e 's/|$//' "$1" \
  | tr '|' '\n' | sed 's/:$//' | tr -s '[:space:]' '\n' | grep -v '^$' | sort; }
for f in content comments tasks worklogs development; do
  [ -f <folder>/$f.md ] || continue
  diff <(norm <scratchpad>/$f.fetched.md) <(norm <folder>/$f.md) | grep '^>' \
    && echo "^ $f.md added words"
done
# must print nothing
```

A hit is not automatically a violation — check it in context. Moving words into a
table cell is fine and this diff handles it; an unusual rewrite will surface here
and must be reverted.

**Counts match Jira.** This is what makes Rule 4 checkable rather than a promise:

```bash
node <skill-path>/scripts/jira-api.mjs count /rest/api/3/issue/<KEY>/comment
node <skill-path>/scripts/jira-api.mjs get /rest/api/3/issue/<KEY>/properties/checklist
```

- comment count in `comments.md` equals that `total`
- worklog entry count and time total in `worklogs.md` equal the sum over the issue
  and every subtask
- subtask count in `tasks.md` equals the issue's own subtask count
- summary, status and assignee in `content.md` match the issue
- the checklist line in `content.md` matches the count in that `checklist` property.
  The boxes stay unticked whatever it says — only the count is checkable
- `content.md`'s development counts equal `development.md`'s row counts, and both
  name any gap the endpoint left
- every page in `confluence/` is linked from `content.md`. A page on disk that
  nothing points at is invisible to the reader, and no gate can see it missing

**Both gates clean, across the folder:**

```bash
# find, not a glob: zsh aborts the whole command when a glob matches nothing, so
# the `confluence/*.md` form silently skips the check on every issue that links
# no page — it looks like it ran.
# -not -path '*/assets/*': those .md files are issue attachments, uploaded
# verbatim. Gating them reports findings on a correct folder and invites an
# agent to reformat someone else's file.
node <skill-path>/scripts/check-markdown.mjs \
  $(find <folder> -name '*.md' -not -path '*/assets/*')
node <skill-path>/scripts/check-json.mjs $(find <folder> -name '*.json' -not -path '*/assets/*')
```

Any count mismatch, or either gate non-zero, is a failed pull. Re-run that part.
Do not report the folder as complete.

## Step 5 [main]: Report

Tell the user:

- the folder, and the files in it with their line counts
- comments, subtasks, worklog entries and total time — each as `N of N`
- the checklist count, and that the boxes are drawn unticked because Jira exposes
  no per-item state
- pull requests, commits, builds, and deployments across their environments, plus
  anything the development endpoints would not return
- assets downloaded, and anything listed but deliberately not downloaded, with why
- Confluence pages pulled, if any
- both gates' final exit state
- anything left unfixed because fixing it would have changed words

State plainly what was verified. A count checked against Jira is worth saying; a
count copied out of the fetch's own output is not evidence of anything.
