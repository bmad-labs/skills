# GitHub links

Where a GitHub link hides on an issue, what fetching one writes, and how the
local link is added without losing the original URL.

## Why this part exists

A team that writes its technical design as a pull request leaves the issue
holding a link and nothing else. Pull that issue to disk and the folder is
complete by every count the validation checks — and still missing the document
the ticket is about. `fetch-github.mjs` closes that gap.

## Which fields are read

Three, and only three:

| Field | Why |
|---|---|
| `description` | Always read |
| The technical design field | Named in `github.sourceFields` |
| The technical solution field | Named in `github.sourceFields` |

The field ids differ on every Jira site, so they live in the config rather than
in the script. Run `config.mjs meta` to see which ids this project uses.

**A GitHub link in a comment is left alone.** A comment link is usually a passing
reference — someone pointing at a line while discussing it — rather than the
design. Fetching every one of them fills the folder with repositories nobody
asked for.

## What each kind of link writes

Every link writes one folder, `github/<slug>/`, holding a metadata document and
the file contents under `files/`.

| Link | Slug | The document holds | `files/` holds |
|---|---|---|---|
| `/pull/84` | `pull-84-<repo>` | State, author, branches, dates, the description, and a table of every changed file | Every changed text file, at the head ref |
| `/commit/<sha>` | `commit-<sha8>-<repo>` | SHA, author, date, message, and a table of every changed file | Every changed text file, at that commit |
| `/blob/<ref>/<path>` | `file-<repo>-<path>` | Repository, ref, path, and the file inline | That file |
| `/tree/<ref>/<path>` | `tree-<repo>-<path>` | Repository, ref, path, and a table of the directory | Each text file directly in it |
| `/owner/repo` | `repo-<repo>` | Description, default branch, visibility, language, last push | The readme |

A branch name may hold a slash, so `/tree/base/login-flow` can name branch
`base/login-flow` rather than a folder. The longest existing branch wins, as
it does on GitHub.

A directory is listed but not followed: a link to a directory points at that
directory, and walking into every subdirectory turns one reference into a mirror
of the repository.

**Two links to the same thing are one fetch.** A pull request URL carrying a
`#diff-<sha>` anchor names a hunk inside a page, not a different page, so the
anchor is dropped before the fetch and the same pull request linked twice comes
down once.

## Keep the GitHub URL. Add the local link after it

The URL the issue's author wrote is the record of what they linked. A local path
does not replace it — a reader needs the source to open the pull request, see
what changed since, and comment there.

Append to the same line:

```markdown
- [https://github.com/org/repo/pull/84](https://github.com/org/repo/pull/84) — [local copy of pull request 84](github/pull-84-repo/pull-84-repo.md)
```

| Do | Do not |
|---|---|
| Add the local link after the URL | Replace the URL with the local path |
| Name what the local copy is, so the link text stands alone | Write `local copy` or `here` — `WCAG-2.4.4` fails it, and rightly |
| Leave the URL exactly as the issue wrote it, anchor and all | Tidy the URL, drop its anchor, or shorten its text |

That edit re-opens `content.md`, so re-run its gates.

## Never reformat what came out of the repository

The files under `github/<slug>/files/` are someone else's source code and
documents, copied verbatim. They are not fetch output and they are not yours to
format.

- Gate the metadata document. It is written by this skill.
- Do not gate the files under `files/`. Exclude them:
  `-not -path '*/github/*/files/*'`.
- A finding in one of those files is a finding against the repository. Editing it
  makes the local copy disagree with what GitHub actually holds, which is worse
  than an ugly file — it is a wrong one.

## What is not fetched, and why

| Skipped | Reason |
|---|---|
| Binary files — images, PDFs, archives, fonts, media | A binary blob in a diff folder helps nobody |
| A file over `github.maxFileKb` (512 KB by default) | A lockfile or a bundle is noise at any size |
| Subdirectories of a linked directory | A link to a directory is a reference, not a request to mirror the repository |

Each one is still named in the document's table, with the reason, so the reader
knows the file exists and why it is not beside them.

## When `gh` is not available

The part exits 1, names why, and writes nothing. It does not degrade quietly:

```
Cannot fetch GitHub links: gh is not authenticated (run: gh auth login).
2 link(s) found and left unfetched. The issue keeps its GitHub links either way.
```

This is a part to re-run, not a pull to abandon. `content.md` still holds every
GitHub URL the issue wrote, so nothing is lost — only the local copy is missing.

`gh` needs the `repo` scope to read a private repository. Without it a private
link reports as unreadable while a public one in the same issue succeeds, which
looks like a missing page rather than a missing scope.

## Everything here reads

`gh` is called only with `view`, `api` (GET), and `--json`. Nothing in this part
creates, edits, comments on, approves, or merges anything — the same rule the
rest of the skill follows for Jira.
