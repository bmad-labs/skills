# development.md — layout

`jira-to-local/development-v1`

The issue's development panel in full, written by the `development` part of
`fetch-issue.mjs` and then formatted by hand. This is a **generated** layout: to
change it, change `buildDevelopmentMarkdown` in the script and bump the version
here and in `schemas/development.schema.json`.

**Repository is the top-level grouping**, because that is how Jira's own panel is
organised — every tab nests under `owner/repo` — so a reader comparing the file to
the panel sees the same shape. Within a repository the order is Pull Requests,
Commits, Builds: the unit of review, then what it contained, then what ran. A
repository contributes only the subsections it has records for, so a config
repository with commits and no pull requests gets a Commits heading alone.

`## Deployments` sits at the end, at repository level, because a deployment belongs
to an environment rather than to one repository.

The file is absent when the issue has no development activity at all.

````
---
schema: jira-to-local/development-v1
jira_key: {KEY}
jira_url: {url}
repositories: {N}
pullRequests: {N}
commits: {N}
builds: {N}
fetched: {YYYY-MM-DD}
---

# {KEY} — Development

**Jira**: [{KEY}]({url}) — {summary}

{N} repositor(ies): {N} pull request(s), {N} commit(s), {N} build(s).

{Jira's panel reports {N} build(s), the latest per pipeline. The {N} here is the
full history. Written only when the two disagree.}

{_Jira reports this activity but the {what} detail could not be read. Open the
ticket for the panel._ — one line per gap, and only when there is one.}

| Repository | Pull requests | Commits | Builds |
| --- | --- | --- | --- |
| {owner/repo} | {N} | {N} | {N} |

## {owner/repo}

[{owner/repo}]({repo url}) — GitHub

### Pull Requests

| PR | Summary | Branch | Status | Reviewers | Comments | Updated |
| --- | --- | --- | --- | --- | --- | --- |
| [#{N}]({url}) | {title} | `{source}` → `{target}` | {MERGED} | {name (approved)}, … | {N} | {YYYY-MM-DD HH:MM} |

### Commits

| Commit | Message | Author | When | Files |
| --- | --- | --- | --- | --- |
| [`{shortSha}`]({url}) | {first line of the message} | {name} | {YYYY-MM-DD HH:MM} | {N} |

### Builds

{N} build(s): {N successful, N failed}.

| Pipeline | # | State | When |
| --- | --- | --- | --- |
| [{pipeline}]({url}) | {N} | {successful} | {YYYY-MM-DD HH:MM} |

## Deployments

{N} deployment(s): {N successful, N failed}. Grouped by environment type, as Jira's
own Deployments tab groups them.

### {Production}

| Pipeline | Environment | Deployment | State | When |
| --- | --- | --- | --- | --- |
| {deploy} | {env-name} | [{first line of the triggering commit}]({url}) | {SUCCESSFUL} | {YYYY-MM-DD HH:MM} |

{When the deployment query returns nothing, the section falls back to one row per
environment from the summary — Environment, State, When — under the same type
headings, and says the list could not be read.}

---

Summary in [content.md](content.md).
````

## Rules that are not visible in the shape above

| Element | Rule |
|---|---|
| Where it comes from | `/rest/dev-status/1.0/` for pull requests, commits and builds, and the Deployments tab's own GraphQL query for the deployment list. Neither is documented. One summary call, then one detail call per data type the summary says has data, plus the deployment query — so one request on an issue with no activity, up to five on a busy one |
| The instance key | A detail call's `applicationType` must be the key the summary reports under `byInstanceType`. A readable name like `GitHub` returns an empty list; omitting the parameter returns 500. It is read, never guessed |
| A failed call | Named in the document and counted in `degraded`, never a non-zero exit. The panel is a third-party rollup rather than the issue's own data, and Rule 4 governs lists read to a server-declared total, which this has none of. A thinner section that says it is thinner cannot mislead anyone; a silent one can |
| The build count | The summary counts the latest build per pipeline — what Jira's panel shows. The detail returns the full history, which can be many times larger on the same story. Both are reported, and the file says which is which |
| Branches | No `branch` detail call is made: it returns the same pull-request payload, so it would be a second request for data already in hand. Branch names come from each pull request's own source and target |
| Deployments | GraphQL, not REST. `dev-status` serves no deployment list — every spelling returns an empty detail — and the issue property behind Jira's tab holds unlinked lists of distinct values rather than records. The tab's own `DevDetailsDialog` query does return the list, and it answers to an API token, so that is what is read. When it returns nothing, the section falls back to the summary's one row per environment and says that is what happened |
| Environment grouping | From each deployment's own `environment.type`, so Production, Staging, Testing and Development are the API's answer rather than a guess. Only the fallback rows classify by name |
| The environment list | Rolled up from the deployments, not from the summary's `topEnvironments`: that gave a single row on a story deployed to more than one environment, and stamped it with the newest deployment anywhere, so a row's state and its timestamp could belong to different environments. `content.md`'s Deployment table carries the rolled-up rows |
| Environment type, in the fallback | Only the summary rows classify by name, because their payload carries no type. An unrecognised name goes under `### Other` rather than being guessed |
| Authors | The pull-request payload names every author the literal `User`, so no author column is written for pull requests, and such a name is left out of the reviewer list. Commit authors are real and are shown |
| Commit messages | First line only. A full commit body is unreadable in a table cell, and this is a rollup rather than an archive |
| An unattributable record | A pull request or build whose repository cannot be read from its URL goes under a trailing `## Unattributed` heading. It is kept, never dropped |
| Feature flags | No section. The panel offers only an "Add feature flag" affordance, and no endpoint returns any |
