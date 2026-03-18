# Approach: Generate Weekly Status Report for PHOENIX Project

## 1. Sub-Skill / Workflow Loaded

**File:** `skills/generate-status-report.md` (the "Generate Status Report" sub-skill)

This workflow is a 5-step process: Gather Parameters, Query Jira Data, Generate Report, Present to User, and Publish to Confluence. It is triggered because the user wants a "weekly status report" for a project and wants it published to Confluence -- matching the workflow description exactly.

## 2. Clarifications to Ask the User

Before executing, the following must be resolved:

- **Date range:** The user said "weekly" but did not specify which week. Default to the last 7 days (current week). Confirm: "Should the report cover the last 7 days (2026-03-11 to 2026-03-18), or a different date range?"
- **Audience:** Who is the intended audience? This affects tone and level of detail (executive summary vs. detailed engineering report). The Weekly Status Template from `references/report-templates.md` is suitable for a team/stakeholder audience.
- **Confluence parent page:** The user specified the ENG space but did not provide a parent page ID. Ask: "Should this be created as a top-level page in the ENG space, or nested under an existing page? If nested, please provide the parent page title or ID."
- **Additional context:** Are there any highlights, risks, or commentary the user wants manually added beyond what Jira data provides?

For this simulation, we assume:
- Date range: last 7 days (2026-03-11 through 2026-03-18)
- Audience: engineering team and stakeholders
- Confluence space: ENG, top-level page (no parent)

## 3. Exact JQL Queries to Run

All queries use `<skill-path>` = `/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest`.

### Query 1: Completed issues (resolved in the last 7 days)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = PHOENIX AND statusCategory = Done AND resolved >= "-7d"' --max 50
```

**Purpose:** Populate the "Completed Work" section. Returns issue keys, summaries, assignees for all items moved to Done in the reporting period.

### Query 2: In-progress issues

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = PHOENIX AND statusCategory = "In Progress"' --max 50
```

**Purpose:** Populate the "In Progress" section. Shows current active work items across the project.

### Query 3: Blocked issues

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = PHOENIX AND status = Blocked' --max 50
```

**Purpose:** Populate the "Blockers & Risks" section. Identifies items that are stuck and need attention.

### Query 4: Newly created issues (created in the last 7 days)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = PHOENIX AND created >= "-7d"' --max 50
```

**Purpose:** Populate the "Upcoming Work" section. Shows new work that entered the backlog during the reporting period.

### Query 5 (supplementary): Open bugs by priority

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = PHOENIX AND issuetype = Bug AND resolution = Unresolved ORDER BY priority ASC' --max 20
```

**Purpose:** Enrich the "Metrics" section with bug counts and priority breakdown. Drawn from `references/jql-patterns.md` Bug & Issue Tracking patterns.

### Query 6 (supplementary): Stale in-progress items

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = PHOENIX AND status = "In Progress" AND updated < -14d' --max 20
```

**Purpose:** Identify items that may be silently stuck (no update in 14 days). Adds depth to the "Blockers & Risks" section. Pattern from `references/jql-patterns.md` Date-Based Queries.

## 4. How Results Would Be Analyzed and Categorized

### Data Processing

For each query result set:

1. **Parse returned issues** -- extract key, summary, status, assignee, priority, created date, resolved date, and labels from the JSON response.
2. **Deduplicate** -- an issue may appear in multiple queries (e.g., created this week AND completed this week). Track by issue key to avoid double-counting.
3. **Categorize into report sections:**
   - **Completed Work:** All issues from Query 1, sorted by resolved date descending.
   - **In Progress:** All issues from Query 2, grouped by assignee for workload visibility.
   - **Blockers & Risks:** Issues from Query 3, plus any stale items from Query 6. For each blocked item, attempt to extract blocker details from the issue description or linked issues.
   - **Upcoming Work:** Issues from Query 4 that are NOT in the completed set (i.e., new items still open).
   - **Metrics:** Aggregate counts -- total completed, total in progress, total blocked, total created, created-vs-resolved ratio, open bug count from Query 5.

### Metric Derivation

| Metric | Derivation |
|--------|-----------|
| Items completed | Count of Query 1 results |
| Items in progress | Count of Query 2 results |
| Items blocked | Count of Query 3 results |
| New items created | Count of Query 4 results |
| Created vs. Resolved ratio | Query 4 count / Query 1 count |
| Open bugs | Count of Query 5 results |
| Stale items (>14 days no update) | Count of Query 6 results |

### Overall Status Determination

- **Green (On Track):** No blockers, created/resolved ratio <= 1, no stale items.
- **Yellow (At Risk):** 1-2 blockers, or created/resolved ratio > 1.5, or stale items present.
- **Red (Off Track):** 3+ blockers, or critical/blocker priority bugs unresolved, or significant stale backlog.

## 5. Report Template / Format

The report would follow the **Weekly Status Template** from `references/report-templates.md`, enhanced with the **Executive Summary Template** header and **Metrics** section from the sub-skill's Step 3.

### Markdown Format (presented to user for review)

```markdown
## Weekly Status -- PHOENIX (2026-03-11 to 2026-03-18)

### Executive Summary

**Overall Status:** {Green/Yellow/Red}

{2-3 sentence high-level progress overview based on metrics and blockers.}

### Completed This Week
| Key | Summary | Assignee |
|-----|---------|----------|
| PHOENIX-xxx | {summary} | {assignee} |

### In Progress
| Key | Summary | Assignee | Status |
|-----|---------|----------|--------|
| PHOENIX-xxx | {summary} | {assignee} | In Progress |

### Blockers & Risks
| Key | Summary | Blocker Details | Action Needed |
|-----|---------|-----------------|---------------|
| PHOENIX-xxx | {summary} | {reason} | {mitigation} |

### Upcoming Work (New This Week)
| Key | Summary | Priority |
|-----|---------|----------|
| PHOENIX-xxx | {summary} | {priority} |

### Metrics
| Metric | Value |
|--------|-------|
| Completed this week | {N} |
| Currently in progress | {N} |
| Blocked | {N} |
| New items created | {N} |
| Created/Resolved ratio | {X} |
| Open bugs | {N} |
| Stale items (>14d) | {N} |
```

### Confluence Storage Format (for publishing)

The markdown report would be converted to Confluence storage format (XHTML) following the patterns in `references/report-templates.md` "Confluence Storage Format Example" section, including:
- `<h2>` / `<h3>` for headings
- `<table><tbody>...</tbody></table>` for tabular data
- `<ac:structured-macro ac:name="status">` for the overall status badge (Green/Yellow/Red)
- `<ac:structured-macro ac:name="warning">` for blocker callouts
- `<a href="https://{domain}.atlassian.net/browse/PHOENIX-xxx">` for clickable issue links

## 6. Exact Confluence Command to Publish

After user reviews and confirms, the following command would be executed:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs create-page \
  --space ENG \
  --title "Weekly Status Report - PHOENIX - 2026-03-18" \
  --body "<h2>Weekly Status -- PHOENIX (2026-03-11 to 2026-03-18)</h2><ac:structured-macro ac:name=\"status\"><ac:parameter ac:name=\"colour\">{Green|Yellow|Red}</ac:parameter><ac:parameter ac:name=\"title\">{ON TRACK|AT RISK|OFF TRACK}</ac:parameter></ac:structured-macro><h3>Completed This Week</h3><table><tbody><tr><th>Key</th><th>Summary</th><th>Assignee</th></tr>{...rows...}</tbody></table><h3>In Progress</h3><table><tbody><tr><th>Key</th><th>Summary</th><th>Assignee</th><th>Status</th></tr>{...rows...}</tbody></table><h3>Blockers &amp; Risks</h3>{...content...}<h3>Upcoming Work</h3><table><tbody>{...rows...}</tbody></table><h3>Metrics</h3><table><tbody><tr><th>Metric</th><th>Value</th></tr>{...rows...}</tbody></table>"
```

If a parent page ID were provided (e.g., 12345), the command would include `--parent 12345`.

If updating an existing report page instead of creating a new one:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs update-page <pageId> \
  --title "Weekly Status Report - PHOENIX - 2026-03-18" \
  --body "<full report HTML>"
```

After publishing, the Confluence page URL would be reported back to the user.

## 7. Reference Files Consulted

| File | Why It Was Consulted |
|------|---------------------|
| `skills/generate-status-report.md` | Primary workflow -- defines the 5-step process, the 4 core JQL queries, report sections, and publish commands |
| `references/report-templates.md` | Report formatting guidance -- Weekly Status Template, Executive Summary Template, Confluence storage format examples, status macros |
| `references/jql-patterns.md` | Additional JQL patterns beyond the core 4 -- bug tracking queries, stale item detection, date-based queries, combined filters for reports |
| `references/query-languages.md` | JQL syntax reference -- field names, operators, date functions (startOfWeek, relative dates), ORDER BY clauses |
| `references/confluence-api.md` | Confluence API details -- storage format basics, create/update page request shapes, status macro color options |
| `SKILL.md` | Top-level skill entry point -- identified the generate-status-report workflow, confirmed script paths and CLI syntax for jira.mjs and confluence.mjs |
