# Jira fields

How to find out what a field is, and which fields are worth putting in the config.

## A field id says nothing

`customfield_NNNNN` could be anything. Jira gives every custom field a numeric id
and keeps the human name somewhere else, so a config full of raw ids is unreadable
and unverifiable. **The same id means different things on different sites**, which
is why nothing in this skill hard-codes one. Four endpoints together make a field
knowable:

| Endpoint | Gives |
|---|---|
| `GET /rest/api/3/field` | Every field's id, display name and schema |
| `GET /rest/api/3/issue/createmeta/{project}/issuetypes/{typeId}` | Which fields this issue type's screen shows — the filter |
| `GET /rest/api/3/issue/{key}?fields=*all&expand=names` | What one real issue carries, its values, and this project's own names |
| `GET /rest/api/3/issue/{key}/editmeta` | Which fields are writable on that issue's type |

`inspect.mjs fields` joins all four:

```bash
node <skill-path>/scripts/inspect.mjs fields <PROJECT> --type "Story"
node <skill-path>/scripts/inspect.mjs fields <PROJECT> --type "Story" --json
```

It lists the fields the type's screen shows — populated first, custom before
built-in — each with its display name, its id, whether it is writable, and a preview
of the real value. The preview is what makes the choice real: it is how you find out
that one opaque id holds the acceptance criteria while its neighbour holds an
unfilled template nobody ever completes.

`--sample KEY` pins the sample issue. Without it, the newest issue of that type is
used.

## Issue types are not a fixed list

A real project has far more types than anyone expects — dozens is normal, and
most of them are names the team invented for itself, meaningless outside it. A type
you have never heard of is often the one a team pulls every day.

```bash
node <skill-path>/scripts/inspect.mjs issue-types <PROJECT>
```

The config is keyed by the type's **own name, exactly as the API returns it**, so any
of them works with no code change. Note that subtask types are rarely called
"Sub-task" — using the real name matters when reading `tasks.md`.

## Which fields the setup file offers

Not all of them. A project commonly defines hundreds of fields and any one issue
carries dozens it never displays, so offering everything buries the handful that
matter.

A field is offered when **the issue type's screen shows it** — Jira's own answer to
what that type holds, read from
`GET /rest/api/3/issue/createmeta/{project}/issuetypes/{typeId}`.

Plus eight read-only rows Jira displays on every issue that no create or edit form
can carry, so they appear on no screen at all:

`created`, `updated`, `creator`, `reporter`, `status`, `resolution`,
`resolutiondate`, `lastViewed`

Those are the spine of a document meant for *reading*. A fetched issue that cannot
say its own status, or when it was last touched, is not much use — and none of them
is settable, so a screen-only list would exclude every one.

**On a subtask type, `timeoriginalestimate` joins them.** A subtask is where the
estimate and the hours actually live — a parent story routinely shows nothing while
its children carry every hour — so the original estimate is real content there in a
way it is not on a story. `worklogs.md` still reports the time *logged*; the two
answer different questions, what was planned and what was spent.

Whether a type is a subtask comes from `/rest/api/3/project/{key}`, which is the
only endpoint that says so — `createmeta` does not carry the flag.

The name is the fallback: a type called `Sub-Task`, `Sub Item` or `Subtask` counts
as one when the flag cannot be read, because a `Sub-*` type carries a subtask's
fields whatever the API reports. A separator is required, so `Submission` and
`Subsidiary` do not match — a word merely beginning with "sub" is not a
subtask type. Where both are available they agree; the name is only the fallback
for when the flag cannot be read.

On a typical Story that comes to a few dozen rows, down from several hundred.

## Every row arrives ticked

The file is generated with every box already ticked, and unticking is the user's
job.

That is the right default because the list is not arbitrary: it is what Jira itself
shows for this type. Dozens of empty boxes is not a question put to someone, it is
data entry handed to them; dozens of ticked boxes with a value preview beside each is a list
to read and trim, which is both a smaller job and a better-informed one.

**Unticking drops the field.** Only the ticked fields are written; an unticked one
is not reported anywhere. That is what makes the tick worth reading for: the file
lists every field on this type's screen, so an unticked row is one the project
looked at and passed over.

**The tick does not decide where the field goes.** That follows the field's type,
then its value. A field typed `adf` — prose — always gets its own `## heading`,
even on a ticket whose value happens to be one line. Any other field gets a heading
when its value runs to more than one line, and becomes a row in the metadata table,
plus a key in the frontmatter, when it fits on one. A heading holding a single word
buries the prose under it, which is why the shape decides and not the id.

A row marked `empty on this sample` is on the screen but blank on the one issue that
was sampled. It stays in the list, because a field blank on one ticket is often
filled on others.

**No agent ticks or unticks these boxes.** The script writes the default; the user
makes the cuts. Because of that, an *unticked* box is the evidence a human has been
through a fields file — which is what `generate` checks before it refuses to
overwrite one.

## Fields that have their own file

Twelve built-in fields are never offered in the fields decision file, because the
pull already writes each of them in full elsewhere. There is nothing to decide: a
field nobody can tick is one the document already carries, in a better place than a
heading would be:

| Field | Written to |
|---|---|
| `comment` | `comments.md` |
| `subtasks` | `tasks.md` |
| `worklog` | `worklogs.md` |
| `timetracking`, `timespent`, `timeestimate` | `worklogs.md`, and the metadata table |
| `aggregatetimespent`, `aggregatetimeestimate`, `aggregatetimeoriginalestimate`, `aggregateprogress`, `progress`, `workratio` | `worklogs.md` — these are Jira's own roll-ups of the same hours, and `worklogs.md` computes its totals from the entries themselves |

`timeoriginalestimate` is **not** on that list. It is the estimate for one issue's
own work rather than a roll-up, so on a subtask type it is offered as a tickable
field — see above.

The list lives in `COVERED_ELSEWHERE` at the top of `setup-choices.mjs`, one line
each with the file it goes to. That is the source of truth; this table follows it.

`content.md` links to each of those files, so the content is one click away rather
than duplicated. `setup-choices.mjs` drops them from the fields decision file and
lists them under a "Not listed" heading, so a reader can see where each went.

## The metadata rows, and which fields fill them

`content.md` opens with a fixed metadata table. Most of its rows come from stock
Jira fields that exist on every site — type, status, priority, assignee, reporter,
parent, labels, components, fix versions, created, updated — and those need no
configuration.

Seven rows cannot work that way, because Jira holds them in a **custom** field whose
id differs on every site:

| Row | Config role | Note |
|---|---|---|
| Team | `team` | |
| Sprint | `sprint` | An array of sprint objects on a scrum board |
| Story Points | `storyPoints` | Must hold a number |
| Rough Story Points | `roughStoryPoints` | Only some projects keep a second, coarser estimate |
| Due Date | `dueDate` | Jira's own `duedate` is preferred; this fills the row only when that is empty |
| Git, Deployments | `development` | One field, split into two rows — see below |

Setup records these in `project.metaFields`, matching display name to id from the
same field list the user ticks. **A role left unmapped writes `—` in that row.** The
field is not lost by that: if the user ticked it, it is still written, as an
ordinary field rather than as that row.

## Fields a mapping suppresses

`content.md` writes the fields the config ticked, and no others. A few of those
ticked fields are then held back, because the document already reports them
somewhere better:

- **The ids this site mapped to a metadata row.** They are in the table above, so
  writing them a second time as an ordinary field would be noise.
- **The three ids mapped in `project.checklistFields`.** The `## Checklist` section
  is rebuilt from them; the raw fields would repeat it, one of them as unreadable
  YAML.
- **`summary`, `description`, and the stock ids the fixed table renders** —
  `status`, `priority`, `assignee`, `labels`, `parent` and the rest. Setup ticks
  these on every type, and rightly so, but the H1 and the table already give them
  prominence. A `## Status` section holding the one word the table shows two lines
  above is noise, not prominence.

The suppression set is **derived from the config, not hard-coded**. This matters
more than it sounds. A fixed list of ids would suppress another site's field ids on a
site that never mapped them — hiding a field the user ticked, which is invisible
when it happens. Map a role and its field stops being written twice; leave it
unmapped and the ticked field is still reported.

An `epicLink` role exists for the same reason with no row of its own: a legacy Epic
Link duplicates the Parent row, so mapping it suppresses the field rather than
writing that duplicate.

## The checklist fields

A Checklist app spreads one list across three custom fields, and `content.md`
rebuilds them into one section. `project.checklistFields` names the three:

| Config key | Holds |
|---|---|
| `contentYaml` | The YAML dump — the item text, and a `checked:` that is **frozen at issue creation** |
| `text` | The rendered list: item names, with `[open]`-style markers that are the same snapshot |
| `completed` | A one-word completion summary |

Mapped, the three become a single `## Checklist` of markdown checkboxes, and none
of the raw three is printed. Unmapped — which is right for a project with no
checklist app — no checklist section is written and the fields behave like any
others.

**No field carries the live checked state.** The YAML field is written once, when
the issue is created, and never again: on a ticket with some items ticked in Jira, all
of them still read `checked: false, status: open`, because the field is written once,
at creation, and never updated. The `text` field's `[open]` markers
are that same snapshot. The Checklist app's own fields — `Checklist Progress`,
`Progress %`, the view-only text — return `null` on every issue, through
`renderedFields` and `versionedRepresentations` alike.

The live source is an issue property, not a field:
`/rest/api/3/issue/{KEY}/properties/checklist`, which reports
`progressText: "Checklist: N/M"` and the counts behind it — and no per-item
breakdown at all. So `content.md` writes the true count as one line above the list
and leaves every box unticked, because that is the honest rendering of what Jira
will tell you. A subtask has no such property, and the line is then omitted.

The `status:` line that follows each `checked:` — `open`, `done` or `skipped` — is
deliberately not parsed. It comes from the same frozen blob, so it is exactly as
stale, and requiring it in the pattern would drop any item whose app omitted it.

The parser reads the YAML field rather than printing it, because printed it runs to
hundreds of lines that render as loose text. It handles YAML's folded form
(`text: >-` with the words on the lines below), so a long item is read to its own
`checked:` line rather than to the end of the first line; reading only the first
line silently drops every long item.
An item whose text starts with `---` is the app's own group separator, so it is
written as a bold label instead of a checkbox.

## The development field

The field mapped to the `development` role holds what Jira's development panel
renders. It arrives as a Java `toString` dump with the real payload embedded as
`json={...}`, so the parser brace-matches that fragment and reads only it.

It answers two different questions, so it becomes two rows:

- **Git** — pull request and build activity: `N build(s): N passed, N failed`
- **Deployments** — deployment environments: `<env> (DEPLOYED)`

The field is maintained by a source-control integration. It is read-only, and this
skill only reads anyway. Leave the role unmapped and both rows read `—`.

**The field is a rollup, and an incomplete one.** It can omit the `pullrequest` key
entirely, so the Git row reports builds and says nothing of the pull requests. The detail — pull requests, commits, branches,
builds — comes from `/rest/dev-status/1.0/`, which `scripts/dev-status.mjs` reads
into `## Development` and `## Deployment` in `content.md` and the full listing in
`development.md`. The two coexist on purpose: the field costs no extra request and
still answers when that undocumented endpoint does not.

Three traps in that endpoint. Its `applicationType` must be the instance key the
summary reports under `byInstanceType` — a readable name like `GitHub` returns an
empty list and omitting the parameter returns 500. Its build **summary** counts the
latest build per pipeline, which is what Jira's panel shows, while its build
**detail** returns the full history, which can be many times larger on the same
story. Both are true about different things, so the document reports both and says
which is which.

And it serves **no deployment list at all**: `deployment`, `deployment-environment`
and `deployments` each return an empty detail under every instance key, while the
issue property behind Jira's Deployments tab holds three parallel unlinked lists of
distinct values rather than records. The list comes instead from the GraphQL query
that tab itself runs — `DevDetailsDialog` on `/jsw2/graphql`, which takes the
numeric issue id and answers to an API token. That query is where the full
deployment list and each deployment's real `environment.type` come from.

## Where the acceptance criteria live

Often not in the description. A project commonly keeps the user story and a design
link in `description` while the acceptance criteria sit in a separate custom ADF
field — so the id to look for is not guessable, only readable from the previews.

This is exactly what the config's `instructions` field is for: someone works it out
once, writes it down, and no later session has to rediscover it.

## Unfilled templates

A field whose value reads like a blank form is an unfilled template:

```
Description: As a _______, I want _______, so that ________
Background:<Insert Text>
```

A project that ships a story template usually has one of these: a custom field
holding the blank form, filled in on almost no ticket. It is populated — so it
passes every "has a value" test — and says nothing. The format pass deletes it as
boilerplate. Worth naming in the config's `instructions` so the next session does
not stop to wonder about it.

## Field types

The config's `type` describes what the value is, which decides how it renders:

| Type | Jira schema | Rendered as |
|---|---|---|
| `adf` | `doc`, or a `textarea` custom field | Markdown, through the ADF converter |
| `option` | `option`, `priority`, `status` | Its `value` or `name` |
| `user` | `user` | The display name |
| `array` | `array` | Its members, comma-joined |
| `number`, `date`, `string` | as named | Directly |

`inspect.mjs` guesses this from the field's schema, and the guess is usually right.
A field rendering as `[object Object]` means the type is wrong — check what
`--json` reports for it.
