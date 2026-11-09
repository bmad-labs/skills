# history.md — layout

`jira-to-local/history-v1`

Every change to the issue and to each of its subtasks, one section per ticket.
Written by `fetch-issue.mjs --part history`. Generated layout: to change it, change
`buildHistoryMarkdown` in the script and bump the version here and in
`schemas/history.schema.json`.

````
---
schema: jira-to-local/history-v1
jira_key: {KEY}
jira_url: {url}
total: {N}
items: {N}
issues: {N}
fetched: {YYYY-MM-DD}
---

# {KEY} — Change History

**Ticket**: [{KEY}]({url}) — {summary}

**Parent**: [{PARENT-KEY}]({url}) — {parent summary}

{N} change(s){ across this ticket and its N subtask(s)}, holding {N} field change(s). Each section lists one ticket, oldest change first.

A long or multi-line value is a text edit. …

## [{KEY}]({url}) — {summary}

| Date | Author | Field | From | To |
| --- | --- | --- | --- | --- |
| {YYYY-MM-DD HH:MM +ZZZZ} | {name} | {field} | {value|—} | {value|—} |
| {YYYY-MM-DD HH:MM +ZZZZ} | {name} | {field} | Text edit {n} | Text edit {n} |

### Text edits

#### Text edit {n} — {field}

{YYYY-MM-DD HH:MM +ZZZZ}, {name}.

```diff
@@ -{a},{b} +{c},{d} @@
 {unchanged line}
-{removed line}
+{added line}
```

## [{SUBTASK-KEY}]({url}) — {subtask summary}

_No changes recorded._
````

## Rules

| Element | Rule |
|---|---|
| `total` | Changelog entries summed over every section. Each section holds its ticket's own changelog `total`; a short section is a failed part |
| `items` | Field changes. One entry can change several fields, so this is at least `total` |
| `issues` | One plus the subtask count. The fetched issue comes first, then the subtasks in the parent's order |
| Row order | Oldest first within a section, so the table reads as the story of the ticket |
| From, To | The display value Jira's History tab shows. The raw value, usually an id, only when Jira gives no display value |
| Text edit | A value with a newline or over 120 characters. Both cells name the edit; the diff under the table holds the change |
| The diff | Unified, two lines of context. Applied in reverse from the current value, the chain of diffs rebuilds every earlier version, so nothing is lost by not writing each full value |
| Text edit numbers | Count up across the whole file, so each `#### Text edit {n}` heading is unique |
| Diff fence | Longer than any backtick run in the diff, so the edited text cannot close it |
| Unreadable subtask | Its section says so, instead of vanishing, so the file still names every subtask |
| Diff contents | Never edited. The changelog stores rich text as Jira wiki markup (`h2.`, `*bold*`), and the diff keeps it, because it is the record of what was typed |

## Why the subtasks are read too

Work on this project happens on the subtasks: a status move, an assignee change, a
re-estimate. The story's own changelog shows how the requirement changed; the
subtasks' changelogs show how the work moved. A story-only read keeps one half.
