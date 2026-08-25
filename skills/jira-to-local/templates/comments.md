# comments.md — layout

`jira-to-local/comments-v2`

The whole comment thread. Written by `fetch-issue.mjs --part comments`, then
formatted by hand. Generated layout: to change it, change `buildComments` in the
script and bump the version here and in `schemas/comments.schema.json`.

Comments live in their own file because a thread grows without bound, and a long
one buries the issue's own content. The heading repeats the key and the URL so the
file reads on its own, and its inline images resolve against the same shared
`assets/` folder as `content.md`.

````
---
schema: jira-to-local/comments-v2
jira_key: {KEY}
jira_url: {url}
total: {N}
fetched: {YYYY-MM-DD}
---

# {KEY} — Comments

**Jira**: [{KEY}]({url}) — {summary}

{N} comment(s), oldest first.

---

## {author} — {YYYY-MM-DD HH:MM +ZZZZ}

{the comment, ADF converted to markdown. An attached file becomes a link to the
local copy — `[filename](assets/filename)` — and an image is embedded. A comment's
media node carries no filename of its own, so the name comes from Jira's rendered
copy of the thread.}

---

## {author} — {YYYY-MM-DD HH:MM +ZZZZ}

{the comment}
````

When the issue has no comments, the body is one line and there are no sections:

```
_No comments._
```

## Rules

| Element | Rule |
|---|---|
| `total` and the count line | What Jira reported, not what happened to arrive. The fetch pages to this number and fails rather than writing fewer — see Rule 4 in `SKILL.md` |
| Order | Oldest first, the order the conversation happened in. Never re-sorted |
| Attachments | A screenshot, a spreadsheet, a PDF or a log lives in a comment as often as in the description. All of them resolve into the shared `assets/`, by the same resolver `content.md` uses — an image is embedded, any other file becomes a link. `comments.json` lists every one of them per comment in `attachments` |
| An empty comment | Written as `_(empty)_` rather than an empty section, so the author and date still read |
| Author names and dates | Never edited. A reworded record is a wrong record |
