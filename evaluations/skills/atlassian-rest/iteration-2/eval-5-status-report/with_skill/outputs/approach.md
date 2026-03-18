# Approach: Generate Weekly Status Report for DO Project and Publish to Confluence (ENG Space)

## Skill Used
`atlassian-rest` — following the `workflows/generate-status-report.md` workflow with references to `references/report-templates.md`, `references/jql-patterns.md`, and `references/confluence-formatting.md`.

## Workflow Followed
`generate-status-report.md` — a 5-step workflow: Gather Parameters, Query Jira Data, Generate Report, Present to User, Publish to Confluence.

---

## Step 1: Gather Parameters

Parameters are known from the task:

- **Project key:** `DO`
- **Date range:** Last 7 days (default for weekly report)
- **Confluence target:** Space key `ENG`, no specific parent page given (will need to resolve)

No ambiguity to resolve — project key and space key are provided.

---

## Step 2: Verify Setup

Run setup check to ensure credentials are configured:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

This confirms `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_DOMAIN` (wnesolutions.atlassian.net) are set.

---

## Step 3: Query Jira Data

Run four JQL queries per the workflow to gather all data for the report. Each uses `jira.mjs search` with the `DO` project key and a 7-day window.

### 3a. Completed Issues (resolved in last 7 days)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND statusCategory = Done AND resolved >= "-7d"' --max 50
```

### 3b. In-Progress Issues

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND statusCategory = "In Progress"' --max 50
```

### 3c. Blocked Issues

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND status = Blocked' --max 50
```

### 3d. Newly Created Issues (created in last 7 days)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND created >= "-7d"' --max 50
```

---

## Step 4: Generate Report

Using the data returned from all four queries, compile a markdown report with the following sections (per workflow Step 3 and `references/report-templates.md` Weekly Status Template):

1. **Executive Summary** — 2-3 sentence overview including overall status (Green/Yellow/Red), key highlights, and risk summary
2. **Completed Work** — table of resolved issues with Key, Summary, Assignee columns
3. **In Progress** — table of active work items with Key, Summary, Assignee, Status columns
4. **Blockers & Risks** — blocked issues with details on what is blocking them; if none, note that
5. **Upcoming Work** — newly created or prioritized items from query 3d
6. **Metrics** — total completed, total in progress, total blocked, items created vs resolved

The report title follows the pattern: `Weekly Status Report - DO - YYYY-MM-DD` (using current date).

---

## Step 5: Present Report to User for Review

Display the full generated markdown report to the user. Ask for:
- Review for accuracy
- Any edits to sections
- Confirmation to publish to Confluence in the ENG space

---

## Step 6: Resolve Confluence Space and Parent Page

Before publishing, find the ENG space to confirm it exists and optionally identify a parent page for status reports:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs spaces --max 50
```

Optionally, search for an existing "Status Reports" parent page in ENG:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs search 'type = page AND space = ENG AND title = "Status Reports"' --max 5
```

If a parent page exists, use its ID as `--parent`. Otherwise, create the page at the space root.

---

## Step 7: Build Confluence Storage Format HTML

Convert the markdown report into Confluence storage format XHTML. Per `references/confluence-formatting.md`, the Status Report template uses:

- **Layout macro** with two-column header (Overall Status lozenge + Sprint/Week info)
- **Status lozenge** (`ac:structured-macro ac:name="status"`) with Green/Yellow/Red colour
- **Tables** for Completed, In Progress, and Upcoming sections
- **Warning panel** (`ac:structured-macro ac:name="warning"`) for Risks & Blockers
- **TOC macro** if the document has 3+ sections

Write the HTML body to a temp file since it will exceed 2000 characters:

```bash
cat > /tmp/do-status-report-body.html << 'HTMLEOF'
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
</ac:structured-macro>

<ac:layout>
  <ac:layout-section ac:type="two_equal">
    <ac:layout-cell>
      <h3>Overall Status</h3>
      <p><ac:structured-macro ac:name="status">
        <ac:parameter ac:name="colour">Green</ac:parameter>
        <ac:parameter ac:name="title">ON TRACK</ac:parameter>
      </ac:structured-macro></p>
    </ac:layout-cell>
    <ac:layout-cell>
      <h3>Report Period</h3>
      <p>Week of YYYY-MM-DD</p>
    </ac:layout-cell>
  </ac:layout-section>
</ac:layout>

<h2>Executive Summary</h2>
<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p>{2-3 sentence summary derived from query results}</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Completed This Week</h2>
<table>
  <thead><tr>
    <th style="background-color: #f4f5f7; font-weight: bold;">Ticket</th>
    <th style="background-color: #f4f5f7; font-weight: bold;">Summary</th>
    <th style="background-color: #f4f5f7; font-weight: bold;">Assignee</th>
  </tr></thead>
  <tbody>
    <tr>
      <td><a href="https://wnesolutions.atlassian.net/browse/DO-XXX">DO-XXX</a></td>
      <td>{summary}</td>
      <td>{assignee}</td>
    </tr>
    <!-- one row per completed issue from query 3a -->
  </tbody>
</table>

<h2>In Progress</h2>
<table>
  <thead><tr>
    <th style="background-color: #f4f5f7; font-weight: bold;">Ticket</th>
    <th style="background-color: #f4f5f7; font-weight: bold;">Summary</th>
    <th style="background-color: #f4f5f7; font-weight: bold;">Assignee</th>
    <th style="background-color: #f4f5f7; font-weight: bold;">Status</th>
  </tr></thead>
  <tbody>
    <tr>
      <td><a href="https://wnesolutions.atlassian.net/browse/DO-YYY">DO-YYY</a></td>
      <td>{summary}</td>
      <td>{assignee}</td>
      <td>{status}</td>
    </tr>
    <!-- one row per in-progress issue from query 3b -->
  </tbody>
</table>

<h2>Blockers &amp; Risks</h2>
<ac:structured-macro ac:name="warning">
  <ac:parameter ac:name="title">Risks &amp; Blockers</ac:parameter>
  <ac:rich-text-body>
    <ul>
      <li><strong>DO-ZZZ:</strong> {blocker description}</li>
      <!-- one item per blocked issue from query 3c, or "No blockers this week" -->
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Upcoming Work</h2>
<table>
  <thead><tr>
    <th style="background-color: #f4f5f7; font-weight: bold;">Ticket</th>
    <th style="background-color: #f4f5f7; font-weight: bold;">Summary</th>
    <th style="background-color: #f4f5f7; font-weight: bold;">Priority</th>
  </tr></thead>
  <tbody>
    <tr>
      <td><a href="https://wnesolutions.atlassian.net/browse/DO-NNN">DO-NNN</a></td>
      <td>{summary}</td>
      <td>{priority}</td>
    </tr>
    <!-- one row per newly created issue from query 3d -->
  </tbody>
</table>

<h2>Metrics</h2>
<table>
  <thead><tr>
    <th style="background-color: #f4f5f7; font-weight: bold;">Metric</th>
    <th style="background-color: #f4f5f7; font-weight: bold;">Value</th>
  </tr></thead>
  <tbody>
    <tr><td>Issues Completed</td><td>{count from 3a}</td></tr>
    <tr><td>Issues In Progress</td><td>{count from 3b}</td></tr>
    <tr><td>Issues Blocked</td><td>{count from 3c}</td></tr>
    <tr><td>Issues Created</td><td>{count from 3d}</td></tr>
    <tr><td>Created vs Resolved</td><td>{ratio}</td></tr>
  </tbody>
</table>
HTMLEOF
```

---

## Step 8: Publish to Confluence

Create the page in the ENG space using `--body-file`:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs create-page \
  --space ENG \
  --title "Weekly Status Report - DO - 2026-03-18" \
  --body-file /tmp/do-status-report-body.html
```

If a parent page was found in Step 6, add `--parent <parentPageId>`:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs create-page \
  --space ENG \
  --title "Weekly Status Report - DO - 2026-03-18" \
  --body-file /tmp/do-status-report-body.html \
  --parent <parentPageId>
```

---

## Step 9: Verify and Report

Fetch the created page to confirm it rendered correctly:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page <newPageId> --format storage
```

Report to the user:
- The Confluence page URL (from `_links.webui` in the response)
- Summary of what was published (section counts, metrics)
- Ask if any adjustments are needed

If edits are requested, update the page:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs update-page <pageId> \
  --title "Weekly Status Report - DO - 2026-03-18" \
  --body-file /tmp/do-status-report-body-updated.html
```

---

## Summary of Commands (in execution order)

| Step | Command | Purpose |
|------|---------|---------|
| 2 | `setup.mjs` | Verify credentials |
| 3a | `jira.mjs search 'project = DO AND statusCategory = Done AND resolved >= "-7d"' --max 50` | Get completed issues |
| 3b | `jira.mjs search 'project = DO AND statusCategory = "In Progress"' --max 50` | Get in-progress issues |
| 3c | `jira.mjs search 'project = DO AND status = Blocked' --max 50` | Get blocked issues |
| 3d | `jira.mjs search 'project = DO AND created >= "-7d"' --max 50` | Get newly created issues |
| 6 | `confluence.mjs spaces --max 50` | Confirm ENG space exists |
| 6 | `confluence.mjs search 'type = page AND space = ENG AND title = "Status Reports"' --max 5` | Find parent page (optional) |
| 8 | `confluence.mjs create-page --space ENG --title "Weekly Status Report - DO - 2026-03-18" --body-file /tmp/do-status-report-body.html` | Publish report |
| 9 | `confluence.mjs get-page <pageId> --format storage` | Verify published page |

## Key Skill Features Leveraged

- **Workflow-driven approach** — followed `generate-status-report.md` step-by-step
- **JQL patterns from references** — used date-range queries from `references/jql-patterns.md`
- **Confluence storage format** — used Status Report template from `references/confluence-formatting.md` with status lozenges, layout macros, warning panels, styled tables
- **`--body-file` for large content** — avoids shell argument limits for the HTML body
- **Confirm-before-mutate principle** — present report to user before publishing
- **Professional formatting** — two-column layout header, TOC macro, coloured status lozenges, styled table headers, linked ticket keys
