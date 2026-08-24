# worklogs.md — layout

`jira-to-local/worklogs-v2`

Every worklog entry, on the issue and on each of its subtasks, in one date-sorted
table. Written by `fetch-issue.mjs --part worklogs`, then formatted by hand.
Generated layout: to change it, change `buildWorklogs` in the script and bump the
version here and in `schemas/worklogs.schema.json`.

````
---
schema: jira-to-local/worklogs-v2
jira_key: {KEY}
jira_url: {url}
total: {N}
totalSeconds: {N}
fetched: {YYYY-MM-DD}
---

# {KEY} — Worklogs

**Ticket**: [{KEY}]({url}) — {summary}

**Parent**: [{PARENT-KEY}]({url}) — {parent summary}

{N} entr(y/ies){ across this ticket and its subtasks}. **Total logged: {Nd Nh Nm}** ({N.NN}h).

| Date | Ticket | Author | Time | Comment |
| --- | --- | --- | --- | --- |
| {YYYY-MM-DD} | [{KEY}]({url}) — {summary} | {name} | {time} | {comment|—} |

---

## Total by person

| Author | Time | Hours |
| --- | --- | --- |
| {name} | {Nd Nh Nm} | {N.NN} |

---

## Total by ticket

| Ticket | Time | Hours |
| --- | --- | --- |
| [{KEY}]({url}) — {summary} | {Nd Nh Nm} | {N.NN} |
````

When nothing is logged:

```
_No time logged on this ticket{ or its subtasks}._
```

## Rules

| Element | Rule |
|---|---|
| `Ticket` column | The issue the time was logged against — usually a subtask, not the fetched issue |
| Row order | Oldest first, by `started`, so the table reads as the history of the work |
| Duration format | Jira's own: `2h`, `30m`, `1d 4h`. A day is 8 hours |
| `Hours` column | The same duration as a decimal, so a reader can add it up |
| Both totals | Each sums to the header total. A mismatch means a parse or fetch bug, not a rounding difference |
| "across this ticket and its subtasks" | Present only when the issue has subtasks |
| Total by ticket | Written only when more than one issue carries time. One issue makes the table a restatement of the header |
| Worklog comments | Newlines collapsed and `\|` escaped, so free text cannot break the table |
| Names, dates, durations | Never edited. This is a record of who did what, when |

## Why the parent alone is not enough

People log work against the subtask they are working on, so an issue's own
`timetracking` is routinely empty while its subtasks carry every hour. A story
routinely reports `timetracking: {}` — nothing at all — while its subtasks hold the
hours. A parent-only read reports no time on a story where work has plainly
happened.

So this file reads the parent **and** every subtask, and pages each one to its own
`total`. Both halves matter: reading only the parent loses the subtasks' hours, and
reading one page of each loses whatever does not fit in it.
