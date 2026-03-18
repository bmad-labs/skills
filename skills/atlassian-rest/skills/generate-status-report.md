# Generate Status Report

Workflow for generating project status reports from Jira data and optionally publishing to Confluence.

**Reference files:** `references/report-templates.md`, `references/jql-patterns.md`

---

## Step 1: Gather Parameters

Ask the user for:

- **Project key(s)** — one or more Jira project keys (e.g., `PROJ`, `TEAM`)
- **Date range** — defaults to last 7 days if not specified
- **Confluence target** (optional) — space key and parent page for publishing the report

## Step 2: Query Jira Data

Run the following queries for each project. Adjust the date range as needed.

**Completed issues:**

```bash
node <skill-path>/scripts/jira.mjs search 'project = PROJ AND statusCategory = Done AND resolved >= "-7d"' --max 50
```

**In-progress issues:**

```bash
node <skill-path>/scripts/jira.mjs search 'project = PROJ AND statusCategory = "In Progress"' --max 50
```

**Blocked issues:**

```bash
node <skill-path>/scripts/jira.mjs search 'project = PROJ AND status = Blocked' --max 50
```

**Newly created issues:**

```bash
node <skill-path>/scripts/jira.mjs search 'project = PROJ AND created >= "-7d"' --max 50
```

See `references/jql-patterns.md` for additional query variations and date formatting.

## Step 3: Generate Report

Using the queried data, compile the report with these sections:

1. **Executive Summary** — high-level progress overview in 2-3 sentences
2. **Completed Work** — list of resolved issues with keys, summaries, and assignees
3. **In Progress** — current active work items
4. **Blockers & Risks** — blocked issues with details on what is blocking them
5. **Upcoming Work** — newly created or prioritized items
6. **Metrics** — total completed, total in progress, total blocked, items created vs resolved

Consult `references/report-templates.md` for formatting guidance and section structure.

## Step 4: Present to User

Display the full generated report in markdown format. Ask the user to:

- Review for accuracy
- Edit any sections
- Confirm whether to publish to Confluence

## Step 5: Publish (if requested)

If the user wants to publish to Confluence:

**Create a new page:**

```bash
node <skill-path>/scripts/confluence.mjs create-page \
  --space <SPACE_KEY> \
  --title "Status Report - PROJ - 2024-01-15" \
  --body "<report HTML>" \
  --parent <parentPageId>
```

**Update an existing page:**

```bash
node <skill-path>/scripts/confluence.mjs update-page <pageId> \
  --title "Status Report - PROJ - 2024-01-15" \
  --body "<report HTML>"
```

Report the Confluence page URL back to the user.
