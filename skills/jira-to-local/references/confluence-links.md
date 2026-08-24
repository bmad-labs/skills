# Confluence links

How a Jira issue points at a wiki page, and how that page comes down with it.

## Where the link hides

Three places, and a real issue uses all of them. Checking only one misses pages.

| Source | Endpoint or location | What it looks like |
|---|---|---|
| A proper remote link | `GET /rest/api/3/issue/{key}/remotelink` | `object.url` plus `object.title` — the reliable one, and it carries the page title |
| The description | The issue's `description` ADF | An `inlineCard` smart link, a text node with a link mark, or a bare URL |
| A comment | Each comment's `body` ADF | The same three forms, added later in the conversation |

`fetch-confluence.mjs` walks all three and de-duplicates by page id:

```bash
node <skill-path>/scripts/fetch-confluence.mjs --issue PROJ-123 --list
```

`--list` reports what it found and writes nothing — the fastest way to see whether
an issue has documents attached to it at all.

An `inlineCard` deserves a specific note: a smart link renders in Jira as a tidy
card with the page's title, so it does not look like a URL, but its `attrs.url` is
a plain page link. An agent reading only visible text would miss it.

## Turning a URL into a page id

```
/wiki/spaces/KEY/pages/12345/Page+Title      -> 12345
/wiki/spaces/KEY/pages/12345                 -> 12345
/pages/viewpage.action?pageId=12345          -> 12345
/wiki/x/AbCdEf                               -> no id in the URL
```

The last form is a short link. It carries no id, so it cannot be resolved from the
string alone — `--list` reports it as `(short link)` and the pull skips it with a
note rather than guessing. Open it in a browser and pass the full URL:

```bash
node <skill-path>/scripts/fetch-confluence.mjs --issue KEY --page-url "https://…/pages/12345/Title"
```

## Where the page is written

Inside the issue's own folder, under `confluence.subdir`:

```
<output.dir>/PROJ-123/
  content.md
  assets/                                  the issue's images
  confluence/
    Feature-Specification.md               the page
    assets/                                the page's images
```

One issue, one folder. The page keeps its own `assets/` so its images stay with it
rather than mixing into the issue's.

After writing, link the page from `content.md` under a `## Linked Documents`
heading. A file the reader never learns about is a file they will not open.

## Depth

`confluence.maxDepth` in the config:

| Value | Pulls |
|---|---|
| `0` | The linked page alone. The default, and almost always right |
| `1` | The page and its direct children |
| `2`+ | Deeper |

A linked page is a reference, not a space to mirror. Raise the depth only when the
children are genuinely part of what the issue is asking for — a page tree can run
to hundreds of pages, and each one costs a request plus its attachments.

## Always markdown

A wiki page is a written document, not a record with fields: its whole content is
one prose body. There is no useful JSON shape for it, so:

- `output.mode` does not apply — the page is markdown in `json` mode too
- there is no `confluence-page` schema in `schemas/`
- `check-json.mjs` never runs on it; `check-markdown.mjs` always does

It still declares `schema: jira-to-local/confluence-page-v1` in its frontmatter, so
the layout it follows is recorded like every other document's.

## Attachments

Both forms of reference need rewriting to the local copy:

- an image reference — `![name](name.png)`
- a plain link — `[name](name.pdf)`

A Confluence `view-file` macro produces a **link**, not an image reference, so
handling only images leaves every attached document pointing back at Confluence.
Filenames with spaces arrive percent-encoded, so each name is rewritten in every
spelling it might appear in.

If a page renders with a broken image while the file sits in `assets/`, that is the
rewrite missing a spelling — not a failed download.

## What this never does

Write to Confluence. There is no push, no page creation, no comment. The page is
pulled read-only, and its own first lines say so.
