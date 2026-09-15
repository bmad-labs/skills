---
name: jira-to-local
description: >
  Use when the user wants Jira issues pulled onto disk as local files — "pull
  PROJ-123", "fetch this story", "get that ticket locally", "download the
  bug", "save this issue and its comments", "grab the NFR", "read this ticket
  offline", or a pasted Jira browse URL with nothing else asked of it. Also for
  many at once — "sync all tickets in sprint 62", "pull every bug in the sprint",
  "fetch the whole backlog locally", "download all of team X's issues". Covers any
  issue type — story, bug, epic, subtask, or whatever types the project has
  invented for itself. Also when the issue links
  a Confluence page that should come down with it. This skill only reads: for
  creating, editing, transitioning, commenting, searching, or pushing anything
  back to Jira, use atlassian-rest instead.
---

# Pull a Jira issue into a local folder

One job: an issue key goes in, a folder of readable files comes out. One issue,
one folder, everything in it — fields, comments, subtasks, worklogs, attachments, and
any Confluence page the issue links to.

`<skill-path>` below is this skill's directory.

## The seven rules

**1. Pull only.** This skill never creates, edits, transitions, comments on,
assigns, or deletes anything in Jira. Every request reads: every REST call is a GET,
and the one POST is a GraphQL *query* — the only way to read the deployment list,
which no REST endpoint serves. Nothing here mutates anything. If the user wants a
write, say so plainly and route to `atlassian-rest` — do not improvise it here.

**2. Config first, and the config records the user's ticks.** No
`.jira.config.json` means run [`workflows/setup.md`](workflows/setup.md) before
anything else. Setup's five decisions — project, issue types, fields per type,
board, output — are the user's, and each is settled by a box in a file that
`setup-choices.mjs` generates from the API's own answer. The agent fetches the
options and records what the user did — never narrowing a list, summarising it, or
marking one option as recommended before they have seen all of it.

Only the starting state differs. Project, issue types, board and output arrive
**unticked**, so a tick is the answer. A per-type fields file arrives **fully
ticked**, because its options are the fields that issue type's screen shows — Jira's
own answer to what the type holds — so keeping it all is the honest default and the
user's job is to untick what they do not want. Either way their edit is the decision,
and a fresh file is not one.

Setup also records one thing that is not a tick file: which of this site's custom
fields fills each metadata row (`project.metaFields`). Propose that mapping from the
field list already on screen, then let the user confirm it. An unmapped row is
written `—`, never guessed.

**3. One part per call.** `fetch-issue.mjs` writes one document per run. Never
reach for a single call that fetches everything: the parts are separate so each
can be checked while it is still small enough to check.

**4. Complete or failed, never partial.** Every comment and every worklog entry is
written. Any list read from the API is paged to the server's own `total`, and the
count is asserted before the file is written. **A file holding one page of a longer
list is a failed pull, not a pull with a caveat.** Never read a list out of
`fields=*all` — that response is capped, silently.

The same rule decides when a pull is done: **the folder is the evidence, not the
report.** An agent that says it finished, or that reports itself idle, has stated a
hypothesis. Check the counts against Jira before believing it — and when many issues
are in flight, stop the agent before reading its folder, because idle is reported
while a write is still in flight.

**5. Every document is versioned, and every JSON file is validated.** Markdown
declares `schema:` in its frontmatter; JSON declares `$schema` as its first key. In
`json` or `both` mode, `check-json.mjs` must exit clean on every JSON file before
the pull is reported done. A file that fails validation, or carries no `$schema`,
is a failed pull. A pulled Confluence page is markdown in every mode, so
`check-markdown.mjs` covers it and `check-json.mjs` never runs on it.

**6. The format pass changes formatting, never words.** Layout, headings, table
syntax, list markers, unfilled boilerplate: all fair game. Wording, terminology,
spelling, code, ids, dates, names, URLs: never. A ticket written in mixed
languages, or with a typo in an acceptance criterion, stays exactly as written —
that is what the ticket says. The one exception is image alt text, written from
what the image shows. Detail in
[`references/refactor-guide.md`](references/refactor-guide.md).

Within that boundary the target is a document a person can read, not a document
the checker accepts. `check-markdown.mjs` covers what someone thought to automate,
so a clean exit is the floor: the agent still reads the file as the reader will and
fixes what renders wrong or breaks the reading, whether or not a rule names it. A
clean gate on a visibly badly formatted file is a failed part.

**7. Write for someone who has never seen the issue or the code.** The reader
cannot open Jira, has not read the repository, and does not know the project's
shorthand. An unexplained ticket key, field name, or file path costs them a
lookup they cannot make. Name what a thing is, once, in a short clause.

## Pick the workflow

| The request is… | Workflow |
|---|---|
| "pull PROJ-123", "fetch this story", a pasted issue URL | [`workflows/pull.md`](workflows/pull.md) |
| "sync sprint 62", "pull every bug in the backlog", any JQL or sprint | [`workflows/bulk-pull.md`](workflows/bulk-pull.md) |
| No `.jira.config.json` exists yet, or a new issue type needs configuring | [`workflows/setup.md`](workflows/setup.md) |

Setup runs once per project. Pull runs every time after that.

## The scripts

All are Node 18+, zero dependencies, run from anywhere inside the workspace.

| Script | Does |
|---|---|
| `config.mjs` | Finds, reads and validates `.jira.config.json`. `path`, `validate`, `instructions [TYPE]`, `types`, `type <TYPE>`, `meta`, `where [KEY]`, and `show` for the whole file — thousands of lines on a real project, so prefer a narrower one |
| `jira-api.mjs` | Credentials, the one paged GET, and a read-only GraphQL query for what REST will not serve. `whoami`, `get`, `count`, `pages` |
| `inspect.mjs` | Setup's read-only probes: `projects`, `issue-types`, `fields`, `sample`, `board`, `count-type` |
| `setup-choices.mjs` | Setup's decision files. `generate`/`read <kind> [--type T] [--sample KEY]`, `status`. Project, issue types, board and output arrive unticked; a per-type fields file arrives fully ticked. `--force` re-generates over existing ticks. Exit 2 = nothing ticked, 3 = no file, 4 = would erase a tick |
| `fetch-issue.mjs` | One part per run: `<KEY>` with `--part` set to `content`, `comments`, `tasks`, `worklogs` or `development` |
| `fetch-confluence.mjs` | `--issue KEY` pulls the pages that issue links, into its folder |
| `check-markdown.mjs` | 18 rendering and readability rules. Exit 1 while any remain |
| `check-json.mjs` | Validates a JSON file against the schema its `$schema` names |

Run any of them with `--help` for the full flag list.

Three more files in `scripts/` are libraries with no command line, imported by the
scripts above: `adf.mjs` converts Atlassian Document Format to markdown,
`confluence-format.mjs` does the same for a wiki page, and `dev-status.mjs` reads
the development panel.

## What the config holds

`.jira.config.json` sits at the workspace root. It runs to thousands of lines,
almost all of it `issueTypes`, so read it with `config.mjs types`,
`config.mjs type <TYPE>`, `config.mjs meta` and `config.mjs where` rather than
`config.mjs show`.

| Block | Decides |
|---|---|
| `jira.domain`, `auth.envVars` | Which site, and which two environment variables hold the credentials. No token is ever in the file |
| `project.key`, `project.boards` | Which project. The boards are a note for a human; nothing reads them |
| `project.metaFields` | Which custom field fills each row of the metadata table. Unmapped means the row reads `—` |
| `project.checklistFields` | Which fields the Checklist app writes into. Unmapped means no Checklist section |
| `instructions` | What the project knows that the API cannot say. Read before every pull, and passed to the subagent |
| `output.dir`, `output.mode`, `output.assets` | Where the folders go, whether markdown or JSON or both, and which attachments come down |
| `confluence` | Whether linked pages are pulled, into which subfolder, and how deep |
| `issueTypes` | Per issue type: its `docType`, its own instructions, and the ticked fields in the order they are written. This is the whole size of the file |

## What a pulled issue looks like

```
<output.dir>/PROJ-123/
  content.md      the issue: metadata, description, the ticked fields, checklist,
                  attachments, subtask list, links, development summary,
                  Linked Documents
  comments.md     every comment, oldest first
  tasks.md        every subtask in full (absent when the issue has none)
  worklogs.md     every worklog entry, on the issue and on every subtask
  development.md  pull requests, commits, builds and deployments, grouped by
                  repository (absent when the issue has no development activity)
  assets/         attachments, shared by the files above
  confluence/     linked pages, each with its own assets/ (only when linked)
```

In `json` mode the same folder holds `content.json`, `comments.json`,
`tasks.json`, `worklogs.json`, `development.json`. In `both` mode it holds both
sets.

## Credentials

The token never goes in the config. Two environment variables, best set in a shell
profile so every `node` call sees them:

```bash
export ATLASSIAN_EMAIL="you@example.com"
export ATLASSIAN_API_TOKEN="your-api-token"   # id.atlassian.com/manage-profile/security/api-tokens
```

The site itself is `jira.domain` in the config. Check all three at once with
`node <skill-path>/scripts/jira-api.mjs whoami`.

## Nothing here is configured for your Jira yet

Every example in these documents uses `PROJ-123` and `your-site.atlassian.net`, and
every field id reads `customfield_NNNNN`. **Those are placeholders, not defaults.**
Four things differ on every Jira site, and the skill hard-codes none of them:

- **Project key and issue type names.** A project commonly has dozens of types, most of
  them names the team invented. The config is keyed by the type's own name, so any
  of them works.
- **Custom field ids.** Jira gives the same field a different `customfield_NNNNN` id
  on every site, so an id copied from someone else's config points at the wrong
  field — or at nothing.
- **Which field fills which metadata row.** Team, Sprint, Story Points, Due Date and
  the development panel all live in custom fields. `project.metaFields` maps them; a
  row left unmapped is written `—` rather than guessed.
- **Which fields the checklist app writes into.** `project.checklistFields` maps the
  three, and `content.md` rebuilds them as one list of checkboxes. All three are
  mapped together or none is. None of them carries the live per-item state — the
  YAML field is written once, at issue creation — so the real count comes from the
  issue's `checklist` property and is written as one line above the list, with every
  box left unticked.

[`workflows/setup.md`](workflows/setup.md) asks Jira for all of it and records what
the user ticks. Run it once before the first pull.

## Reference documentation

Load these when the moment calls for them, not upfront. The subagent's set is
pointed at from [`templates/subagent-instruction.md`](templates/subagent-instruction.md),
so it reads a file when a step names it rather than being handed all of them.

| Reference | Who reads it | When |
|---|---|---|
| [`references/format-guide.md`](references/format-guide.md) | The fetch-and-format subagent | Running the format pass: every checker rule, its defect, its fix |
| [`references/refactor-guide.md`](references/refactor-guide.md) | The fetch-and-format subagent | The formatting/wording boundary, worked examples, what to leave alone |
| [`references/jira-fields.md`](references/jira-fields.md) | Main thread, during setup | Choosing fields, reading a `customfield_NNNNN`, why some fields are excluded |
| [`references/confluence-links.md`](references/confluence-links.md) | The subagent, at the Confluence part | Where a page link hides on an issue, and how deep to follow it |
| [`references/output-json.md`](references/output-json.md) | The subagent, in `json` or `both` mode | The JSON shape per document, and how to version a layout change |
| [`templates/`](templates/) | Whoever changes a layout | The layout each document follows, with its version |

## Errors

| Error | Cause | Fix |
|---|---|---|
| `No .jira.config.json found` | Never set up here | Run [`workflows/setup.md`](workflows/setup.md) |
| A script prints nothing and exits 0 | The script loaded as a library instead of running: its `main()` guard compared raw paths, which disagree when the skill directory is a symlink. The guard now resolves both sides with `realpathSync` | Nothing to do. If it recurs, a script has been given a raw `process.argv[1] === import.meta.url` guard again — use `isMainScript` instead |
| `Nothing ticked in …` (exit 2) | A decision file the user has not filled in | Stop. Tell them which file waits. An empty file is not a vote for the default |
| `No decision file at …` (exit 3) | `read` before `generate` | Generate it, hand the user the path, wait for the tick |
| `does not match schemas/config.schema.json` | Config edited by hand into an invalid shape | Read the reported paths and fix them; the message names each one |
| `Issue type "X" is not configured` | A type the config has no entry for | Add it — the message prints the `inspect.mjs fields` command to run |
| `401 Unauthorized` | Token wrong or expired | Regenerate it, re-export it |
| `403 Forbidden` | The account cannot see this issue or project | Ask for access; do not work around it |
| `404 Not Found` | Wrong key, or wrong `jira.domain` | Check both. `whoami` proves the domain |
| `429 Too Many Requests` | Rate limited | Wait, then re-run the part that failed |
| `yielded N of M row(s)` | A list could not be read completely | Re-run that part. Never accept the short file — see Rule 4 |
| `only N distinct id(s)` | Pages overlapped | Re-run that part; the document would have held duplicates |
| A part failed and left `assets/` with no document | The run stopped mid-way | Re-run the same command. Writes overwrite, so re-fetching is always safe |
| `fetch failed` with no status code | Network, not Jira. `whoami` fails the same way | Wait, re-run the part. Distinguish it from `429` before treating it as rate limiting |
| A page sits in `confluence/` that `content.md` never links | The subagent skipped the `## Linked Documents` edit. No gate can see this | Add the link, then re-gate `content.md` |
| Gate reports findings on a folder that is correct | The file list swept `assets/` — those `.md` files are attachments, uploaded verbatim | Use `find <folder> -name '*.md' -not -path '*/assets/*'` |
| Gate reports nothing at all, on every issue | A `*.md` glob matched nothing and zsh aborted the whole command | Use `find`, never a glob |
| An agent reports idle with an incomplete folder | Idle is reported while a write is still in flight, and on failure too | Stop the agent, then read the folder. Verify counts against Jira — see Rule 4 |
