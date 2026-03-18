# Daily Standup Summary -- Approach Document

## 1. Workflow Selection and Adaptation

The SKILL.md workflow table (line 237) maps "project status report, sprint summary, or weekly update" to `workflows/generate-status-report.md`. A daily standup summary is a compact variant of a status report, so I selected this workflow and adapted it.

**Workflow: `generate-status-report.md` -- 5 steps, adapted as follows:**

| Step | Original Purpose | Adaptation for Daily Standup |
|------|-----------------|------------------------------|
| Step 1: Gather Parameters | Ask for project key(s), date range, Confluence target | Project key = `DO`, date range = last 24h (`-1d` / `startOfDay(-1)`), Confluence = **none** |
| Step 2: Query Jira Data | Run JQL queries for completed, in-progress, blocked, newly created | Same queries but narrowed from 7d to 1d; added status-transition query for richer "what changed" view |
| Step 3: Generate Report | Compile into 6 sections (Executive Summary, Completed, In Progress, Blockers, Upcoming, Metrics) | Collapsed into classic 3-part standup: Done / Blocked / In Progress + Upcoming. Dropped Executive Summary and full Metrics. |
| Step 4: Present to User | Display markdown, ask for review | Same -- present markdown directly in conversation |
| Step 5: Publish to Confluence | Create or update Confluence page | **Skipped entirely** -- user explicitly said no Confluence publishing |

**Reference files consulted (per SKILL.md line 267-268 guidance: "Read reference docs when needed"):**
- `references/jql-patterns.md` -- JQL query construction, date-based patterns, sprint queries, status transition syntax
- `references/report-templates.md` -- Weekly Status Template as closest match to daily standup format
- `references/query-languages.md` -- JQL syntax validation (CHANGED/DURING operators, date functions, statusCategory)

## 2. Exact Commands with Arguments

All commands use the skill script path convention from SKILL.md. The `<skill-path>` placeholder resolves to the installed skill directory.

### 2.1 Setup Verification (First-Use Only)

```bash
node <skill-path>/scripts/setup.mjs
```

Per SKILL.md lines 26-29: "Before any operation, verify the user has credentials configured." This confirms `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_DOMAIN` (wnesolutions.atlassian.net) are set.

### 2.2 Query 1: Issues Completed in Last 24 Hours

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND status CHANGED TO Done DURING (startOfDay(-1), now()) ORDER BY resolved DESC' --max 50
```

**JQL rationale:** Uses `status CHANGED TO Done DURING (startOfDay(-1), now())` from `references/jql-patterns.md` line 89 ("Recently transitioned to Done"), adapted from weekly (`startOfWeek(-1)`) to daily (`startOfDay(-1)`). The `CHANGED TO ... DURING` operator is documented in `references/query-languages.md` line 36.

**Purpose:** Captures all issues that moved to Done status since the start of yesterday -- the "what got done" section of the standup.

### 2.3 Query 2: All Status Transitions in Last 24 Hours

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND status CHANGED DURING (startOfDay(-1), now()) ORDER BY updated DESC' --max 50
```

**JQL rationale:** Broader than Query 1 -- captures any status change (e.g., To Do -> In Progress, In Progress -> In Review, In Review -> Done). This gives a complete picture of "what changed since yesterday" beyond just completions.

**Purpose:** Shows all movement on the board in the last 24 hours. Combined with Query 1, this builds the full "changes since yesterday" narrative.

### 2.4 Query 3: Currently Blocked Issues

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND (status = Blocked OR status = "On Hold") ORDER BY priority ASC' --max 50
```

**JQL rationale:** Directly from `references/jql-patterns.md` line 82 ("Blocked items"). No date filter needed -- blockers are current-state, not time-bounded. Includes "On Hold" as an alternate blocked state.

**Purpose:** The "blockers" section of the standup. Each blocked issue will be examined for blocker details (from comments, linked issues, or description) to answer "what is blocking and what action is needed."

### 2.5 Query 4: Currently In Progress

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND statusCategory = "In Progress" ORDER BY assignee, priority ASC' --max 50
```

**JQL rationale:** Uses `statusCategory = "In Progress"` (documented in `references/query-languages.md` line 22) which captures all statuses mapped to the "In Progress" category (including custom statuses like "In Review", "In QA", etc.). Ordered by assignee to group work by person for standup discussion.

**Purpose:** Shows what each team member is actively working on today.

### 2.6 Query 5: Upcoming Work (Sprint Backlog)

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND sprint in openSprints() AND statusCategory = "To Do" ORDER BY rank ASC' --max 20
```

**JQL rationale:** From `references/jql-patterns.md` line 25 ("Sprint backlog (not started)"). Uses `openSprints()` function (`references/query-languages.md` line 43) to scope to the current sprint, and `statusCategory = "To Do"` for items not yet started. Ranked by board priority (`rank ASC`) so the most important upcoming items appear first.

**Purpose:** The "what's coming up" section -- shows the top-priority items ready to be picked up today.

### 2.7 Query 6: Newly Created Issues in Last 24 Hours

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND created >= "-1d" ORDER BY created DESC' --max 30
```

**JQL rationale:** Adapted from the workflow's Step 2 ("Newly created issues") which uses `created >= "-7d"`, narrowed to `-1d` for daily scope. Uses relative date syntax from `references/query-languages.md` line 15.

**Purpose:** Surfaces new issues filed since yesterday that the team should be aware of -- new bugs, new requests, new stories added to the backlog.

## 3. Output Format

Based on the Weekly Status Template from `references/report-templates.md` lines 59-80, adapted into the classic three-question daily standup format:

```markdown
## DO Daily Standup -- 2026-03-18

### Done Since Yesterday
| Key | Summary | Assignee | Resolved |
|-----|---------|----------|----------|
| DO-xxx | ... | @person | 2026-03-17 |

### Status Changes (Last 24h)
| Key | Summary | From | To | Assignee |
|-----|---------|------|----|----------|
| DO-xxx | ... | In Progress | In Review | @person |

### Blocked
| Key | Summary | Assignee | Blocker | Action Needed |
|-----|---------|----------|---------|---------------|
| DO-xxx | ... | @person | Waiting on ... | Escalate to ... |

> No blockers -- all clear. *(if none found)*

### In Progress Today
| Key | Summary | Assignee | Priority |
|-----|---------|----------|----------|
| DO-xxx | ... | @person | High |

### Up Next (Sprint Backlog)
- **DO-xxx**: {summary} (High priority)
- **DO-xxx**: {summary} (Medium priority)
*(Top 5 items by rank from current sprint backlog)*

### New Issues (Last 24h)
- **DO-xxx**: {summary} ({type}, created by @person)

---
*{N} completed | {N} in progress | {N} blocked | {N} new | {N} in sprint backlog*
```

**Format decisions:**
- Tables for structured sections (done, blocked, in progress) -- easy to scan during standup
- Bullet lists for upcoming and new items -- less formal, these are informational
- Single-line metrics footer instead of a full Metrics section -- keeps it compact
- Blocker section includes "Action Needed" column so the team can unblock immediately
- Status Changes section shows all transitions, not just completions, for full board awareness
- Ordered by assignee in In Progress section so each person sees their items grouped

## 4. Confluence Publishing -- Explicitly Skipped

The user specified "No Confluence publishing." This is fully respected:

- Step 5 of `workflows/generate-status-report.md` is **skipped entirely**
- No `confluence.mjs` commands are invoked
- The report is rendered as markdown directly in the conversation (Step 4)
- Per SKILL.md line 49 ("Confirm before mutating"), Confluence writes are mutations requiring user confirmation -- the user preemptively declined

## 5. Skill Principles Applied

| SKILL.md Principle | How Applied |
|-------------------|-------------|
| **Resolve ambiguity first** (line 47) | Project key `DO` and domain `wnesolutions.atlassian.net` are provided -- no ambiguity. Date range inferred as "last 24h" from "daily standup" context. |
| **Confirm before mutating** (line 49) | This task is read-only (search queries only). No mutations (create, edit, transition) are performed. No confirmation needed. |
| **Use workflows for complex tasks** (line 62) | Selected `generate-status-report.md` workflow as the matching workflow for status report generation. |
| **Read reference docs when needed** (line 64) | Consulted `jql-patterns.md` for query construction, `report-templates.md` for formatting, `query-languages.md` for JQL syntax validation. |
| **Never delete** (line 51) | No delete operations involved in this task. |

## 6. Complete Execution Sequence

```bash
# 0. Verify credentials (first-use only)
node <skill-path>/scripts/setup.mjs

# 1. Completed issues (last 24h)
node <skill-path>/scripts/jira.mjs search 'project = DO AND status CHANGED TO Done DURING (startOfDay(-1), now()) ORDER BY resolved DESC' --max 50

# 2. All status transitions (last 24h)
node <skill-path>/scripts/jira.mjs search 'project = DO AND status CHANGED DURING (startOfDay(-1), now()) ORDER BY updated DESC' --max 50

# 3. Blocked issues (current state)
node <skill-path>/scripts/jira.mjs search 'project = DO AND (status = Blocked OR status = "On Hold") ORDER BY priority ASC' --max 50

# 4. In progress (current state)
node <skill-path>/scripts/jira.mjs search 'project = DO AND statusCategory = "In Progress" ORDER BY assignee, priority ASC' --max 50

# 5. Sprint backlog / upcoming
node <skill-path>/scripts/jira.mjs search 'project = DO AND sprint in openSprints() AND statusCategory = "To Do" ORDER BY rank ASC' --max 20

# 6. Newly created issues (last 24h)
node <skill-path>/scripts/jira.mjs search 'project = DO AND created >= "-1d" ORDER BY created DESC' --max 30

# 7. Compile results into daily standup markdown format
# 8. Present to user for review (no Confluence publishing)
```

**Total commands:** 1 setup + 6 search queries = 7 commands. All are read-only operations.
