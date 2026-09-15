# JSON output

What each document looks like in `json` or `both` mode, and how to change a layout
without breaking whatever already reads it.

Set it in the config:

```json
"output": { "mode": "both" }
```

`markdown` (default) writes `.md` only, `json` writes `.json` only, `both` writes
both side by side. `assets/` is the same either way — the JSON references the same
image files by the same relative paths.

**Confluence pages have no JSON form.** A wiki page is one prose body, so there is
nothing to structure. Those files stay markdown in every mode.

## The five documents

| File | `$schema` | Holds |
|---|---|---|
| `content.json` | `jira-to-local/content-v3` | The issue: metadata, description, the ticked prose fields, `metaRows`, `checklist` with its `checklistProgress`, attachments, subtask list, links, and the `development` and `deployment` summaries |
| `comments.json` | `jira-to-local/comments-v2` | Every comment, oldest first, with `total` |
| `tasks.json` | `jira-to-local/tasks-v2` | Every subtask in full |
| `worklogs.json` | `jira-to-local/worklogs-v2` | Every worklog entry, plus totals per person and per issue |
| `development.json` | `jira-to-local/development-v1` | Pull requests, commits and builds grouped by repository, plus every deployment and the state per environment |

`$schema` is the first key in every file. It names the layout, and
`check-json.mjs` resolves it to the matching file in `schemas/`.

## A worked example

`worklogs.json`, for a story whose subtask carries the time — the shape a real
pull produces:

```json
{
  "$schema": "jira-to-local/worklogs-v2",
  "key": "PROJ-123",
  "url": "https://your-site.atlassian.net/browse/PROJ-123",
  "summary": "Add a status column to the item list",
  "parent": {
    "key": "PROJ-100",
    "summary": "Item list improvements",
    "url": "https://your-site.atlassian.net/browse/PROJ-100"
  },
  "readOnly": true,
  "scope": "issue-and-subtasks",
  "total": 1,
  "totalSeconds": 3600,
  "entries": [
    {
      "issueKey": "PROJ-124",
      "author": "A. Developer",
      "started": "2026-08-22T04:00:00.000Z",
      "seconds": 3600,
      "timeSpent": "1h",
      "comment": null
    }
  ],
  "byPerson": [
    { "author": "A. Developer", "seconds": 3600, "timeSpent": "1h" }
  ],
  "sources": [
    { "issueKey": "PROJ-123", "total": 0 },
    { "issueKey": "PROJ-124", "total": 1 }
  ]
}
```

Two things worth reading in that. `entries[0].issueKey` is `PROJ-124`, a **subtask**
rather than the `PROJ-123` that was fetched, because that is where the time was
logged. And `sources` records every issue read with the count Jira reported for it —
so the fetched issue's own `total: 0` is visible as a fact rather than an absence,
and a truncated read would be provable after the event.

That pattern is not contrived. A story routinely reports `timetracking: {}` — no
time at all — while its subtasks hold the hours. A parent-only read would report the
story as untouched.

## Conventions across all five

- **A missing value is `null`**, never `""` and never an absent key. The fixed
  metadata block always carries all 20 keys, so an empty field is visibly empty
  rather than indistinguishable from one the fetch missed.
- **A count is what the server reported**, in its own key: `total` on comments,
  tasks and worklogs. Row arrays hold exactly that many. Anything else is a failed
  pull, not a shorter document. `development.json` is the one exception and carries
  no `total`: its endpoints publish none, so it reports `counts` from what it read
  and names anything it could not in `degraded`.
- **`additionalProperties: false` everywhere**, so a typo in a key is a validation
  failure rather than a field that silently vanishes.
- **`readOnly: true`** on `tasks.json`, `worklogs.json` and `development.json`. They
  record what other issues, or a repository integration, say; editing them reaches
  nothing.
- **Text is markdown**, already converted from ADF. The JSON is a structured
  wrapper around readable prose, not a copy of Jira's internal format.

## Validating

Never optional in `json` or `both` mode:

```bash
node <skill-path>/scripts/check-json.mjs <folder>/*.json
```

Exit 0 clean, 1 otherwise, with the JSON path of every violation:

```
comments.json  (comments.schema.json)
  comments[7]  required property "author" is missing
  total        expected integer, found string
```

`fetch-issue.mjs` runs this on each file it writes and exits non-zero if it fails,
so an invalid document cannot outlive the run that produced it. The pull workflow
runs it again across the folder after the format pass, because that pass edits
prose inside the JSON too.

A missing or unrecognised `$schema` is itself a failure. An unversioned file does
not pass.

## Changing a layout

The version is a promise about shape. Breaking it silently is what versioning
exists to prevent.

**Adding an optional key** — same version. Nothing that read the old shape breaks.

**Removing or renaming a key, or changing a type** — new version:

1. Copy `schemas/x.schema.json` to `schemas/x-v2.schema.json`, and set both `$id`
   and the `$schema` `const` to `jira-to-local/x-v2`.
2. Update the writer in `fetch-issue.mjs` to emit the new `$schema`.
3. Update `templates/x.md` to the same version, so the markdown and JSON stay in
   step.
4. Keep the v1 schema file. Documents already on disk still declare v1, and
   `check-json.mjs` should keep validating them rather than rejecting them.
