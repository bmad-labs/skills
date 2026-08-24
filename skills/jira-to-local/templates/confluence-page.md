# confluence-page.md — layout

`jira-to-local/confluence-page-v1`

A Confluence page the issue links to, pulled into the issue's own folder. Written by
`fetch-confluence.mjs`, then formatted by hand.

**This document is markdown in every output mode.** A wiki page is a written
document, not a record with fields: its whole content is one prose body, so there
is no useful JSON shape for it and no schema in `schemas/`. `check-json.mjs` never
runs on it; `check-markdown.mjs` always does.

````
---
schema: jira-to-local/confluence-page-v1
page_id: {N}
page_url: {url}
title: "{title}"
space: {SPACEKEY}
version: {N}
linked_from: {KEY}
fetched: {YYYY-MM-DD}
---

# [{title}]({url})

_Pulled from Confluence for [{KEY}]({issue url})._

{the page body, storage format converted to markdown}
````

## Rules

| Element | Rule |
|---|---|
| The title is a link | To the page in Confluence, so a reader can reach the live version and see who is editing it |
| `linked_from` | The issue whose folder this page sits in, and why it was pulled at all |
| Images and attachments | Downloaded into this folder's own `assets/`, so a page's images stay with the page rather than mixing into the issue's |
| Attachment links | Both image references and `view-file` macro links are rewritten to the local copy. A `view-file` macro produces a plain link, not an image reference, so both forms need rewriting |
| Depth | `confluence.maxDepth` in the config. `0` is this page alone. A linked page is a reference, not a space to mirror, so the default pulls one page |
| Child pages | When depth allows them, each is its own file beside this one, and this file links to them |
| No commentary | The page is recorded as Confluence has it. Nothing is written about the file itself |
