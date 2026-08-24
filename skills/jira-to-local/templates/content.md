# content.md — layout

`jira-to-local/content-v3`

The issue itself. Written by `fetch-issue.mjs --part content`, then formatted by
hand. This is a **generated** layout, not something anyone writes from scratch: to
change it, change `buildContentMarkdown` in the script and bump the version here and in
`schemas/content.schema.json`.

Section order is fixed: frontmatter, title, metadata table, description, the
ticked fields, Checklist, Attachments, Subtasks, Linked Issues, Development,
Deployment, Linked Documents, More. **A section is written only when the issue has
that content**, so a ticket with no subtasks simply has no Subtasks heading. Only
the frontmatter and the metadata table are always present.

````
---
schema: jira-to-local/content-v3
jira_key: {KEY}
jira_url: {url}
summary: "{summary}"
type: {type}
status: {status}
priority: {priority}
assignee: {name}
reporter: {name}
team: {team}
sprint: {sprint}
storyPoints: {N}
roughStoryPoints: {N}
dueDate: {YYYY-MM-DD}
originalEstimate: {estimate}
timeTracking: {spent of estimate}
parent: {PARENT-KEY}
labels: {a, b}
components: {a, b}
fixVersions: {a, b}
git: {N pull request(s), state OPEN; N build(s)}
releases: {env-name (DEPLOYED)}
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
fetched: {YYYY-MM-DD}
{oneKeyPerTickedSingleLineField: {value}}
---

# {KEY}: {summary}

**Jira**: [{KEY}]({url})

| Field | Value |
| --- | --- |
| **Type** | {type} |
| **Status** | {status} |
| **Priority** | {priority} |
| **Assignee** | {name|—} |
| **Reporter** | {name|—} |
| **Team** | {team|—} |
| **Sprint** | {sprint|—} |
| **Story Points** | {N|—} |
| **Rough Story Points** | {N|—} |
| **Due Date** | {YYYY-MM-DD|—} |
| **Original Estimate** | {estimate|—} |
| **Time Tracking** | {spent of estimate|—} |
| **Parent** | [{PARENT-KEY}]({url}) — {parent summary}{|—} |
| **Labels** | {a, b|—} |
| **Components** | {a, b|—} |
| **Fix Versions** | {a, b|—} |
| **Git** | {pull request and build activity|—} |
| **Releases** | {deployment environments|—} |
| **Created** | {YYYY-MM-DD} |
| **Updated** | {YYYY-MM-DD} |
| **{ticked field}** | {value} |

## {description heading}

{the description, ADF converted to markdown}

## {chosen field heading}

{the field's value. One section per field named in the config for this issue
type, in config order. A field with no value is skipped.}

## Checklist

{The Checklist app's items, rebuilt from its YAML field. Written only when
`project.checklistFields` maps it.}

**{N} of {N} done** in Jira. Jira does not expose which ones, so every box below is
drawn unticked.

**{group label}**

- [ ] {an item}

## Attachments

| File | Type | Size | Local copy |
| --- | --- | --- | --- |
| {filename} | {mime type} | {N.N MB} | [{filename}](assets/{filename}) |
| {filename} | {mime type} | {N.N MB} | _not downloaded: {executable file type|N.N MB over the N MB limit}_ |

{Everything skipped is still listed, with its size and the reason, so nothing
disappears without a trace. Open the ticket to get it: {url}}

## Subtasks

{N} subtask(s). Full detail in [tasks.md](tasks.md).

| Subtask | Type | Status | Summary |
| --- | --- | --- | --- |
| [{SUB-KEY}]({url}) | {type} | {status} | {summary} |

## Linked Issues

| Link | Issue | Status | Summary |
| --- | --- | --- | --- |
| {relates to} | [{KEY}]({url}) | {status} | {summary} |

## Development

{N} pull request(s), {N} commit(s) in {N} repositor(ies), {N} build(s). Written by
the repository integration, not by anyone editing the issue.

| What | Count | Detail |
| --- | --- | --- |
| Pull requests | {N} | [development.md](development.md) |
| Commits | {N} | [development.md](development.md) |
| Builds | {N}: {N successful, N failed} | [development.md](development.md) |

{Jira's own panel reports {N} build(s) — the latest per pipeline. The {N} above is
the full history across every repository. Written only when the two disagree.}

{_Jira reports this activity but the {what} detail could not be read. Open the
ticket for the panel._ — one line per gap, and only when there is one.}

## Deployment

| Environment | Type | Latest state | When | Deployments |
| --- | --- | --- | --- | --- |
| {env-name} | {Production} | {SUCCESSFUL} | {YYYY-MM-DD HH:MM} | {N} |

{N} deployment(s) across {N} environment(s), newest first per environment. Full
listing in [development.md](development.md).

{When the deployment query returns nothing, the table drops the Deployments column
and carries the summary's rows instead, followed by: "The current state per
environment, as Jira summarises it. The deployment list behind it could not be read,
so this is a state and not a log, and an environment Jira did not summarise is
missing from it."}

## Linked Documents

{Confluence pages this issue links to, pulled into this folder. Always markdown.}

- [{page title}](confluence/{page}.md) — [open in Confluence]({url})

---

## More

- [Comments](comments.md) — {N}
- [Subtasks](tasks.md) — {N}
- [Worklogs](worklogs.md) — {N} entr(y/ies), {Nd Nh Nm}
````

## Rules that are not visible in the shape above

| Element | Rule |
|---|---|
| Metadata rows | A fixed list, always in this order. A field Jira has no value for is written `—` rather than dropped, so an empty field is visibly empty rather than indistinguishable from one the fetch missed |
| Site-specific rows | Team, Sprint, Story Points, Rough Story Points, Due Date, Git and Releases come from custom fields whose id differs on every Jira site, so they are filled only when `project.metaFields` in the config maps them. Unmapped means `—`, and the field, if ticked, is still written as an ordinary field. `Rough Story Points` is an example of a row many projects simply have no field for |
| Description heading | Comes from the config, not a literal. A project that calls it "User Story" gets that heading. Written once — the field is skipped in the chosen-field loop so it cannot repeat |
| Chosen field order | Config order, never Jira's order. The config decides what comes first, never what is dropped |
| What is written | Only fields the config ticked. An unticked field is one the project saw in the decision file and passed over, so it is not reported |
| Where a field lands | A field the config typed `adf` is prose and always gets a `##` heading, even when one ticket's value happens to be short. Everything else follows its value: multi-line gets a heading, a single line gets a metadata row and a frontmatter key |
| Checklist | Rebuilt as one list of checkboxes; the three raw fields are never printed, one being unreadable YAML. No field carries the live state — the YAML is written once, at issue creation — so the real count comes from the issue's `checklist` property and is written as one line above the list, with every box left unticked |
| `Git` and `Releases` | The one-line rollup, parsed out of the Development field. `## Development` and `## Deployment` are the detail, from the `dev-status` endpoint. Both are kept: the field costs no extra request and still answers when that endpoint does not. Read-only in Jira |
| `## Development` / `## Deployment` | One summary call to `dev-status`, then one detail call per data type that has data, plus the GraphQL query for the deployment list that REST does not serve. Every one is undocumented, and the detail call needs an instance key read back out of the summary, so a call that fails is reported inside the section rather than failing the part: a missing panel is a thinner pull, not a partial one. The full listing goes to `development.md` |
| `## Deployment` rows | One per environment, rolled up from the deployments themselves rather than from the summary's `topEnvironments` — that reported a single row on a story deployed to more than one environment, and dated it from the newest deployment anywhere. Ordered by environment type, then most recent first |
| Image paths | Relative into `assets/`, shared with `comments.md`, so the file renders offline the way the ticket renders in Jira |
| Alt text | Written from what the image shows, never the filename. This is the one place the format pass writes new words |
