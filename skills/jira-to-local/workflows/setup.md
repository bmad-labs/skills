# Setup

Create `.jira.config.json` for this project. Runs once; after that
[`pull.md`](pull.md) uses what it recorded.

**Reference files:** [`../references/jira-fields.md`](../references/jira-fields.md),
[`../templates/jira.config.json`](../templates/jira.config.json)

The config exists so the project key, the issue types and the field list were each
decided once, with the API's own answer on screen, rather than guessed on every
pull. So every step asks Jira first and the user second. **Nothing is written to
`.jira.config.json` until step 9.**

## The five decisions

| # | Decision | Step | Ticks recorded in |
|---|---|---|---|
| 1 | Which project | 2 | `project.key`, `project.name` |
| 2 | Which issue types | 3 | the keys of `issueTypes` |
| 3 | Which boards | 4 | `project.boards` |
| 4 | Which fields, per type | 6a–6d | `issueTypes.<Type>.fields` |
| 5 | Output mode and destination | 8 | `output`, `confluence` |

Two more things are recorded but are not tick files: **which of this site's custom
fields fills each metadata row** (step 6e, `project.metaFields`), and **which three
fields the checklist app writes into** (step 6f, `project.checklistFields`). For
both, you propose the mapping from the field list already on screen and the user
confirms it, so each is settled by agreement rather than by a ticked box. Leaving
either unmapped is a valid answer — an unmapped metadata row is written `—`, and an
unmapped checklist means no checklist section.

Every one of them belongs to the user. Steps 1, 5, 7, 9 and 10 are yours: they
gather, prove, record and verify. They decide nothing.

## How a decision gets settled

A decision is settled when, and only when, **a file on disk carries a tick the user
has seen**. Not when the user seems to agree, not when one option is obviously
right, not when the repository hints at an answer.

`setup-choices.mjs` writes each decision as a markdown file of checkboxes, built
from the API's own answer, and reads back what is ticked:

```bash
node <skill-path>/scripts/setup-choices.mjs generate <kind> [--type TYPE]
node <skill-path>/scripts/setup-choices.mjs read     <kind> [--type TYPE]
node <skill-path>/scripts/setup-choices.mjs status
```

`<kind>` is `project`, `issue-types`, `board`, `output`, or `fields --type "<TYPE>"`.

Every decision runs the same three beats:

1. **`generate`** the file.
2. **Hand over** its path, and say what ticking it decides.
3. **`read`** it. Exit 0 gives you the answer.

### What the exit codes mean

| Exit | Means | Do |
|---|---|---|
| 0 | Ticked | Record the answer |
| 2 | Nothing ticked | Stop. Name the file. Wait |
| 3 | No file | `generate` it first |
| 4 | `generate` would erase a decision | Read the file instead. `--force` only when the user says redo it |

Exit 2 and exit 3 mean the same thing: **that decision is not made.** An empty file
is not a vote for the default — it means the user has not looked yet. Do not infer
an answer from it, and do not fill it in to keep moving.

Exit 4 is the mechanism working. A regenerate would overwrite the user's work, so it
refuses instead. What counts as their work depends on the default: on the four
unticked kinds a **tick** is the evidence someone decided, and on a `fields` file —
which arrives fully ticked — an **untick** is. So a fresh fields file regenerates
freely, and one the user has trimmed does not. `.jira-setup-choices/` is gitignored,
so nothing restores a lost decision but asking them to make it again.

### Who may touch a box

**Four kinds — project, issue types, board, output — you never touch.** Generate,
hand over, read back. Narrowing the list before the user sees it, summarising it "to
save them reading", or marking one option as recommended inside the file all turn
the tick into a formality.

**`fields` is the one exception, and you do not touch its boxes either — but they
arrive ticked rather than empty.** Its options are the fields this issue type's
screen shows, which is Jira's own answer to what the type holds, so "keep it all" is
the honest default and the user's job is to cut. Dozens of empty boxes would be data
entry handed to them; dozens of ticked boxes with previews is a list to read and trim.

So on every kind the rule is the same: **generate, hand over, read back.** What
differs is only which way the boxes start. Do not run `read` on a fields file until
the user has looked at it — the ticks in a fresh one are the script's default, not
their answer.

`status` lists every file and whether it is settled. Step 9 will not write the
config while it exits non-zero.

---

## Step 1: Credentials

Two environment variables carry the secret. The config never does.

```bash
node <skill-path>/scripts/jira-api.mjs whoami
```

A name and an account id back means all three settings are good. Go to step 2.

If variables are missing, walk the user through it:

1. Open <https://id.atlassian.com/manage-profile/security/api-tokens>
2. Click **Create API token**, label it, copy the value.
3. Export both, in the shell profile so every later `node` call sees them rather
   than just this session:

```bash
echo 'export ATLASSIAN_EMAIL="you@example.com"' >> ~/.zshrc
echo 'export ATLASSIAN_API_TOKEN="paste-it-here"' >> ~/.zshrc
```

Then ask for the site domain — the host they use for Jira, like
`mycompany.atlassian.net`. That becomes `jira.domain`. There is no domain
environment variable: the config holds it, because it is not a secret.

The user must open a new shell, or `source` the profile, before `whoami` will pass.
Re-run it until it does.

## Step 2: The project

```bash
node <skill-path>/scripts/setup-choices.mjs generate project
node <skill-path>/scripts/setup-choices.mjs read     project
```

Every project the account can see, one tick each. Usually dozens.

**The repository is not evidence.** A `CLAUDE.md` that mentions `PROJ-123`, a folder
named after a team, a git remote — none of these settle it. A team's tickets often
live in a project its repository is not named after, and an account can see many
projects that look plausible. Only the tick settles it.

**Record:** the ticked key as `project.key`, the name beside it as `project.name`.

## Step 3: The issue types

```bash
node <skill-path>/scripts/setup-choices.mjs generate issue-types
node <skill-path>/scripts/setup-choices.mjs read     issue-types
```

Every type the project has, split into types pulled directly and subtask types,
each with its own description. Dozens is normal.

**Give the user the whole file.** A type you have never heard of is exactly the kind
a team invented for itself and pulls daily — an unfamiliar name is a reason to leave
it in the list, not to drop it. `Story` and `Bug` earn their place by being ticked,
like everything else.

Worth one sentence to the user: `--part tasks` reports subtasks of the subtask types
whether or not they are ticked, and their names are rarely the plain "Sub-task" —
`Sub-Task`, `Sub Item` and the like are what a team actually calls them. That `Sub`
prefix also decides which types get the estimate field in step 6a.
Ticking one is only for pulling it as an issue in its own right.

**Record:** each ticked type becomes a key under `issueTypes`. Each also gets its
own fields decision in step 6.

## Step 4: The boards

```bash
node <skill-path>/scripts/setup-choices.mjs generate board
node <skill-path>/scripts/setup-choices.mjs read     board
```

The easiest decision to get wrong, because the API returns boards in an order that
looks like ranking and is not. A project commonly has half a dozen boards whose
names all mention the same team — `TEAM Board`, `TEAM Subtasks`, `TEAM Planning` —
and nothing in the response says which the team uses. **The first row is not a
default.**

**More than one board is a normal answer, not a conflict.** A team running a story
board and a separate subtask board uses both daily; forcing one answer records a
fact that is not true. The file also carries a `none` option, for a project with no
board or a site where the agile API is unavailable.

**Record:** every ticked board as an entry in `project.boards`, each
`{ id, name, type }` from the file's own row, in the order they appear. Nothing when
`none` is ticked. `project.activeSprint` is a string or absent — a kanban board has
no active sprint, so leave the key out rather than writing `null`, which the schema
rejects.

## Step 5: Find a sample issue per type

Step 6 reads a real issue of each type to list its fields. Find those first, one per
type ticked in step 3:

```bash
node <skill-path>/scripts/inspect.mjs sample <PROJECT-KEY> --type "<TYPE>"
```

A key back is the sample step 6 uses. Nothing back means the type name is wrong — a
display name that differs from the API's name, or a typo. Go back to step 3 rather
than configuring a type the pull will never match.

**Prefer a filled-in issue.** The sample decides which fields appear at all: a type
whose newest issue has a blank description will not offer `description` in step 6,
and the user cannot tick what is not listed. If you know a well-filled ticket of
that type, note its key for `--sample`.

## Step 6: The fields, one decision per type

The step that makes the config worth having. **One decision per ticked type, not one
for all of them** — the types genuinely differ: the same project holds the story
text in `description` on one type and in a custom field on another, and a field full
on a Story is often empty on a Bug. One list applied to every type guarantees a
wrong heading somewhere.

What a tick decides — tell the user this once:

- **A ticked field is written. An unticked one is not**, anywhere. There is no
  catch-all section that keeps the rest.
- Where a ticked field lands is decided for them, by the field's type and then by
  the value: a field typed `adf` always gets **its own heading**; any other field
  gets a heading when its value runs to more than one line, and becomes a **row in
  the metadata table** — and a key in the frontmatter — when it fits on one.
- So a tick decides **whether the field appears at all.** The list they are cutting
  is the type's whole screen, so an unticked row is a field the project saw and
  passed over.

Run 6a to 6d **per type**, then 6e and 6f **once for the project**. Generating and
pre-ticking several types in parallel is fine
— that is mechanical. What must never be batched is the *deciding*: one merged list
covering every type, or a list drafted in chat rather than in the file, is the
failure this step exists to prevent.

### 6a. Generate the file

```bash
node <skill-path>/scripts/setup-choices.mjs generate fields --type "<TYPE>" [--sample KEY]
```

**The list is the issue type's own screen**, not every field Jira has. A project
commonly defines hundreds of fields and an issue carries dozens it never displays;
offering all of them buries the handful that matter. So a row appears when the type's
screen shows it, or when it is one of the read-only rows Jira displays that no form
can carry — `created`, `updated`, `creator`, `reporter`, `status`, `resolution`,
`resolutiondate`, `lastViewed`. On a **subtask** type `timeoriginalestimate` joins
that list, because a subtask is where an estimate actually lives. On a real Story
that is a few dozen rows.

Each row carries the display name, the field id, whether it is writable, and a
preview of the value on a real issue. The preview is the point — a field id says
nothing on its own.

Two kinds of field are left out, and the file says which:

- **Off the screen and not on that allowlist.** The type does not display it, so a
  heading for it would be a field the reader never sees in Jira either.
- **Fields with their own file** — `comment`, `subtasks`, `worklog` and the time
  aggregates are pulled in full into `comments.md`, `tasks.md` and `worklogs.md`,
  and `content.md` links to each. A heading here would repeat that content in worse
  form. The file names them under "Not listed", so nothing looks lost.

A row marked `empty on this sample` is on the screen but blank on this one ticket.
It stays in the list: a field blank on one issue is often filled on others, and
dropping it would hide it from the decision.

The file records its sample in a `sample:` line, and a regenerate reuses it. That
matters for the previews: an unpinned sample drifts to a different issue, and the
value shown beside each field changes with it.

### 6b. Hand it over as it is

`generate` already ticked every row, so there is nothing to pre-tick and no
subagent pass here. The list is not arbitrary: `inspect.mjs` narrows it to the
fields **this issue type's screen shows**, plus the read-only rows Jira displays
that no create or edit form can carry — `created`, `updated`, `creator`,
`reporter`, `status`, `resolution`, `resolutiondate`, `lastViewed`, plus
`timeoriginalestimate` on subtask types.

That is Jira's own answer to what this type holds, which makes "keep it all" the
honest default and unticking the user's job. On a typical Story it is a few dozen
rows rather than the hundreds of fields the project defines.

**Why the default is ticked, not empty.** Dozens of empty boxes is not a question put
to someone, it is data entry handed to them. Dozens of ticked boxes with previews beside
them is a list to read and cut, which is a smaller job and a better-informed one —
the user is deciding what to *remove* from a document they can already picture.

**Do not tick or untick anything yourself.** Not to tidy the list, not because a
field looks like boilerplate, not because a preview is empty. The screen list is the
proposal; the user's cuts are the decision. An agent editing the boxes before the
user sees them is the failure this whole mechanism exists to prevent.

Two things are worth saying when you hand over the path, because they change how
much care the review needs:

- **Unticking drops the field.** An unticked field is not written anywhere, so a
  row cut here is content the pull will never report. That is the point of the
  cut — but it means the review is worth the time.
- **A row marked `empty on this sample`** is on the screen but blank on this one
  ticket. It may well be filled in on others, so an empty preview is not a reason to
  cut it.

### 6c. Let the user trim it

The file is theirs now. Say three things when you give them the path:

- **Every box starts ticked**, because this is the field list Jira shows for this
  type. Their job is to untick what they do not want in the document.
- **Unticking drops the field.** An unticked field is not written anywhere, so the
  tick decides whether the field is kept, not merely where it sits.
- **They do not choose where a kept field goes.** Prose gets its own heading, a
  one-line value becomes a row in the metadata table. The document decides that
  from the value; they decide what is in it.
- **A row marked `empty on this sample`** is on the screen but blank on this one
  ticket, so an empty preview is not a reason to cut it.

Two observations worth making while the file is in front of them — as facts about
their data, not as answers:

- The acceptance criteria often live in a custom field rather than `description`.
  The previews show which; read them rather than assuming an id.
- A preview reading like a blank form is an unfilled template. Note it for step 7 —
  the format pass deletes that boilerplate.

Their edit is the decision. Do not argue a row back in, and do not treat the file as
settled until they have actually looked at it. A file still holding every tick is
either a considered "keep it all" or a file nobody has opened, and only they can say
which.

### 6d. Read it back and record

```bash
node <skill-path>/scripts/setup-choices.mjs read fields --type "<TYPE>"
```

Ask for the heading text per ticked field, and the order. Where the user has no
preference, the field's own display name is the heading.

**Record:** each ticked field as `{ id, name, heading, type }` under
`issueTypes.<Type>.fields`, with `type` taken from the `configType` the file shows.
Include `description` when the project calls it something else — giving it
`heading: "User Story"` makes `content.md` use that heading.

### 6e. Map the metadata rows

Done once for the project, not per type, and best done here because the field list
is already on screen from 6a — it needs no extra API call.

`content.md` opens with a fixed metadata table. Most rows come from stock Jira
fields and need nothing. Seven come from a **custom** field whose id differs on
every Jira site, so they have to be mapped or they cannot be filled:

| Row | Config role | Look for a field named like |
|---|---|---|
| Team | `team` | Team |
| Sprint | `sprint` | Sprint |
| Story Points | `storyPoints` | Story Points, Points, Estimate |
| Rough Story Points | `roughStoryPoints` | A second, coarser estimate — many projects have none |
| Due Date | `dueDate` | A custom due date, where the project keeps one instead of Jira's |
| Git and Deployments | `development` | Development |
| *(no row)* | `epicLink` | Epic Link — mapping it suppresses the field, so it is not written a second time as a duplicate of the Parent row |

Read the display names in the fields file from 6a and match them to these roles.
Show the user what you matched and let them correct it — a project can have two
fields called something like "Team", and only they know which one their board uses.

**Unmapped is a normal answer.** That row is then written `—`. The field itself is
not lost by leaving the role unmapped: if the user ticked it in step 6, it is still
written, just as an ordinary field rather than as that row. Do not invent a mapping
to fill a row.

**Record:** the confirmed pairs under `project.metaFields`, role to field id. Omit
any role the project has no field for — do not write `null`, which the schema
rejects.

### 6f. Map the checklist fields

Also once for the project, from the same field list, and settled the same way: you
propose the mapping and the user confirms it.

A Checklist app does not keep its list in one field. It writes three, and only one
of them is any use on its own:

| Config key | Look for a field holding | Why it is needed |
|---|---|---|
| `contentYaml` | The YAML dump of the list | **The only field carrying each item's checked state** |
| `text` | The rendered list text | Item names, no state |
| `completed` | A one-word completion summary | The count, in a word |

When the three are mapped, `content.md` rebuilds them as one `## Checklist` section
of real markdown checkboxes — `- [ ]` and `- [x]` — and none of the three raw fields
is printed. That is the whole reason to map them: printed as they arrive, the YAML
field runs to hundreds of lines that read as loose text, and the other two repeat it
without the state.

**Unmapped is a valid answer**, and the right one for a project with no checklist
app. No checklist section is written, and nothing else changes.

**Record:** the confirmed ids under `project.checklistFields`. Omit the whole block
when the project has no checklist.

## Step 7: Write the instructions

`instructions` is free text an agent reads before it fetches anything. It is for
what the API cannot say.

Ask the user what someone new to this project would get wrong. Offer what the
probing already showed as a first draft — more useful than a blank prompt:

- the subtask type names from step 3, when they are unusual
- which field really held the acceptance criteria, from step 6
- any field that looked like an unfilled template
- whether tickets are written in more than one language

**Record:** the project-wide text as `instructions`, anything type-specific as
`issueTypes.<Type>.instructions`. Empty is allowed. It can be edited by hand at any
time, and it should be — this is the field that gets better with use.

## Step 8: Output

```bash
node <skill-path>/scripts/setup-choices.mjs generate output
node <skill-path>/scripts/setup-choices.mjs read     output
```

Three things in one file:

- **Mode** — `markdown`, `json`, or `both`. JSON is for something that reads the
  files programmatically; markdown is for a person. `both` doubles the files and
  adds a schema-validation step to every pull.
- **Confluence** — `maxDepth: 0` is the linked page alone, almost always right: a
  linked page is a reference, not a space to mirror.
- **Destination folder** — the user writes the path into the file.

`output.assets` is not ticked. The template already carries it, and its default is
worth saying out loud once: **`imagesOnly` is `false`, so every attachment comes
down** — a ticket's evidence is as often a spreadsheet, a PDF or a log as it is a
screenshot. Two kinds are still skipped: **executable file types** (`.exe`, `.sh`,
`.bat`, `.cmd`, `.com`, `.msi`, `.app`, `.dmg`, `.deb`, `.rpm`, `.jar`, `.ps1`,
`.scr`, `.vbs`, `.pkg` and the shell variants), which nothing here should ever run,
and anything over `maxMb`. A skipped file is still listed in the Attachments table
with its size and the reason, so nothing goes missing quietly. Set `imagesOnly` to
`true` only if the user asks for images alone.

Before recording the path, check whether it is ignored:

```bash
git check-ignore -v <the-path>
```

Pulled tickets are Jira content, and committing them duplicates the source of truth.
If the path is not ignored, say so and let the user decide — add it to `.gitignore`,
or commit the tickets deliberately. Do not add the ignore rule on their behalf, and
do not silently choose a different folder.

**Record:** `output.mode`, `output.dir`, the `output.assets` block as the template
has it, and the `confluence` block.

## Step 9: Write the config

**The gate first.** Every decision must be settled:

```bash
node <skill-path>/scripts/setup-choices.mjs status
```

Non-zero means at least one decision is still waiting. **Do not write the config.**
Name the waiting files and stop. A config written past this gate records your
guesses as the user's choices, which is worse than no config: the next pull looks
configured and is not.

Once `status` exits 0:

1. Copy [`../templates/jira.config.json`](../templates/jira.config.json) and fill it
   from the ticks.
2. Show the user the whole file and get their word. **Show then write** — approval
   after the write is a review, not a decision.
3. Write it.
4. Validate:

```bash
node <skill-path>/scripts/check-json.mjs .jira.config.json
```

It must exit clean. The message names the exact path of anything wrong.

The config holds no secret, so it can be committed — deliberately, so the whole team
pulls with the same field choices and the same notes.

`.jira-setup-choices/` has done its job. Tell the user they may delete it, and leave
that to them: it is the record of what they chose, and configuring a new type later
reads it again.

## Step 10: Trial pull

Run [`pull.md`](pull.md) on one real issue, then show the user the folder and the
files. This is the only way to find out that a chosen heading reads badly, or that a
field they skipped was the important one — while it is still cheap to change.

Fix the config and pull again if anything looks wrong.

---

## Taking over a decision: what it sounds like

Every line below was said by an agent running this workflow, while skipping a
decision it believed it was handling helpfully. None intended to override the user.
That is what makes them worth listing.

| What it sounds like | What is actually happening |
|---|---|
| "The common pulls are Story, Bug and Epic." | Most of the project's types were never shown. The list came from what types are usually called, not from this project's API answer. |
| "Proposing field choices rather than making you read the whole list." | The long list is the deliverable. Reading it is the user's job, and the only way their data gets read by the person who knows it. |
| "The repository is named after this team, so the project is obvious." | A team's tickets often live in a project its repository is not named after. Suggesting the tick is fine; recording it unticked is not. |
| Recording the first board the API returned. | The response order is not a ranking. Several boards can mention the same team. |
| Marking one option "(Recommended)" inside the file. | For project, issue types, board and output that makes the tick a formality. Recommend in prose, outside the file, or not at all. |
| Unticking rows in a fields file to "clean it up" before the user sees it. | The screen list is the proposal and the cuts are theirs. A field you judged boilerplate is one they never got to keep. |
| Reading a fully ticked fields file back as the user's answer. | Every box was ticked when the file was written. A file still holding all of them is either a considered "keep it all" or a file nobody opened, and only they can say which. |
| Defending a row the user unticked. | They know which fields their team writes into. A row they cut was not wanted, and that is the whole answer. |
| "I probed every type and drafted the field lists." | Every type's decision collapsed into one. Each type's previews differ; that is why each type gets a file. |
| Writing the config first, then showing it for approval. | Approval after the write is a review, not a decision. The file already exists. |
| "The field previews make the answer obvious, so I filled it in." | Obvious to you, from a preview. The user knows which field their team actually writes into. |
| Regenerating a file to refresh its options. | If it had ticks, `--force` erased a decision. Exit 4 was the mechanism working; the fix is to read the file, not to overrule it. |

**The check:** for each of the five decisions, can you name the file on disk and the
box in it that the user ticked? If not, that decision is still open, whatever else
was said about it.
