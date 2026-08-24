# tasks.md — layout

`jira-to-local/tasks-v2`

Every subtask in full. Written by `fetch-issue.mjs --part tasks`, then formatted by
hand. Generated layout: to change it, change `buildTasks` in the script and bump
the version here and in `schemas/tasks.schema.json`.

One overview table, then one section per subtask. **Subtasks stay in Jira's own
order — never re-sorted.** A subtask fetch writes no `tasks.md` at all, because a
subtask has no children.

````
---
schema: jira-to-local/tasks-v2
jira_key: {KEY}
jira_url: {url}
total: {N}
fetched: {YYYY-MM-DD}
---

# {KEY} — Subtasks

**Ticket**: [{KEY}]({url}) — {summary}

**Parent**: [{PARENT-KEY}]({url}) — {parent summary}

{N} subtask(s), in Jira order.

| Subtask | Title | Type | Status | Assignee | Original Estimate | Time Spent |
| --- | --- | --- | --- | --- | --- | --- |
| [{SUB-KEY}]({url}) | {type} | {status} | {name|Unassigned} | {time|—} |

---

## {SUB-KEY} — {summary}

| Field | Value |
| --- | --- |
| **Type** | {type} |
| **Status** | {status} |
| **Priority** | {priority} |
| **Assignee** | {name|Unassigned} |
| **Reporter** | {name} |
| **Original Estimate** | {estimate|—} |
| **Time Spent** | {time|—} |
| **Created** | {YYYY-MM-DD} |
| **Updated** | {YYYY-MM-DD} |

{the subtask's own description, ADF converted to markdown}
````

A subtask the account cannot read still gets a section, with a note instead of a
table:

```
## {SUB-KEY} — {summary}

_Could not be read; only the parent's summary is available. Open [{SUB-KEY}]({url}) in Jira._
```

## Rules

| Element | Rule |
|---|---|
| The **Parent** line | Written only when the fetched issue has a parent, so a story names its epic |
| Metadata rows | A fixed list, always in this order. An absent value is `—`, never a dropped row |
| The count in the heading | Always matches Jira, because an unreadable subtask becomes a section that says so rather than a missing one |
| Order | Jira's own. The board's order is information; re-sorting destroys it |
| No commentary | `tasks.md` records what other issues say. Nothing is written here about the file itself |
| Cost | One request per subtask. A parent returns only `summary`, `status`, `priority` and `issuetype` for each child — no description, no assignee, no logged time — so the detail cannot be had any cheaper |
