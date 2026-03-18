# Spec to Backlog

Workflow for converting a Confluence specification document into a Jira Epic with structured child tickets.

**Reference files:** `references/epic-templates.md`, `references/ticket-writing-guide.md`, `references/breakdown-examples.md`

---

## Step 1: Get Spec

Ask the user for:

- **Confluence page ID or URL** containing the specification
- **Target Jira project key** for creating the backlog items

Fetch the spec content:

```bash
node <skill-path>/scripts/confluence.mjs get-page <pageId>
```

## Step 2: Analyze Spec

Read the spec content thoroughly and identify:

- **Major features or sections** — these become the Epic description or are split into multiple Epics
- **Implementation tasks** — discrete units of work that become Stories or Tasks
- **Technical requirements** — infrastructure, API, or architecture work
- **Acceptance criteria** — testable conditions extracted from requirements
- **Dependencies** — ordering constraints between tasks

## Step 3: Create Breakdown

Structure the work into a backlog hierarchy:

**Epic:**
- Clear summary capturing the spec's goal
- Description with context, scope, and link back to the Confluence spec
- Follow `references/epic-templates.md` for Epic description format

**Child tickets (Stories/Tasks):**
- Each ticket covers a single deliverable
- Include acceptance criteria in the description
- Follow `references/ticket-writing-guide.md` for writing clear tickets
- Consult `references/breakdown-examples.md` for sizing and granularity guidance

Aim for tickets that represent 1-3 days of work. Split larger items further.

## Step 4: Present Plan

Show the user the proposed backlog structure:

- Epic summary and description
- List of child tickets with type, summary, and acceptance criteria
- Suggested priority ordering

Ask the user to review and confirm. Allow edits to any item before creation.

## Step 5: Create Epic

Create the Epic in Jira:

```bash
node <skill-path>/scripts/jira.mjs create \
  --project <PROJECT_KEY> \
  --type Epic \
  --summary "<epic summary>" \
  --description "<epic description with link to spec>"
```

Capture the returned Epic key for linking child tickets.

## Step 6: Create Child Tickets

For each approved child ticket, create it under the Epic:

```bash
node <skill-path>/scripts/jira.mjs create \
  --project <PROJECT_KEY> \
  --type Story \
  --summary "<ticket summary>" \
  --description "<description with acceptance criteria>" \
  --parent <epicKey>
```

Create tickets in priority order so the backlog is pre-sorted.

## Step 7: Report

Present the final summary:

| Type  | Key       | Summary                  |
|-------|-----------|--------------------------|
| Epic  | PROJ-100  | Implement feature X      |
| Story | PROJ-101  | Build API endpoint       |
| Story | PROJ-102  | Create UI components     |
| Task  | PROJ-103  | Write integration tests  |

Include links to all created issues and the original Confluence spec.
