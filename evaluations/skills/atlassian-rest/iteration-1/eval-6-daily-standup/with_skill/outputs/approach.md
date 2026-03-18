# Daily Standup Summary -- Approach Document

## 1. How I Adapted the Workflow for Daily Standup Format

The `generate-status-report` sub-skill (`skills/generate-status-report.md`) is designed for weekly/sprint status reports with a default 7-day lookback. I adapted it for a daily standup as follows:

**Parameters (Step 1 adaptation):**
- Project key: `BACKEND` (provided by user)
- Date range: Changed from the default 7 days to **last 24 hours / since yesterday** (`-1d`, `startOfDay(-1)`)
- Confluence target: **None** -- user explicitly said "don't publish to Confluence"

**Report sections (Step 3 adaptation):**
The sub-skill defines 6 sections (Executive Summary, Completed Work, In Progress, Blockers & Risks, Upcoming Work, Metrics). For a daily standup, I collapsed these into the classic 3-question standup format:

1. **What changed since yesterday** -- maps to "Completed Work" + recently transitioned issues
2. **Who's blocked** -- maps to "Blockers & Risks"
3. **What's coming up today** -- maps to "In Progress" + "Upcoming Work" (To Do items in current sprint)

The Executive Summary and Metrics sections were dropped to keep the output compact and standup-appropriate.

**Workflow steps used:**
- Step 1 (Gather Parameters): Fully satisfied by user input -- no need to ask follow-up questions
- Step 2 (Query Jira Data): Used, but with narrower date ranges (see section 2 below)
- Step 3 (Generate Report): Used, but with the compact daily standup format instead of the full report template
- Step 4 (Present to User): Used -- display in markdown to the user
- Step 5 (Publish): **Skipped entirely** -- user said "don't publish to Confluence"

## 2. Exact JQL Queries

All queries target `project = BACKEND` and are scoped to the last 24 hours or current state.

### Query 1: What got done since yesterday (resolved/completed in last 24h)

```sql
project = BACKEND AND status CHANGED TO Done DURING (startOfDay(-1), now()) ORDER BY resolved DESC
```

This uses the `CHANGED TO ... DURING` syntax from `references/jql-patterns.md` (line 89: "Recently transitioned to Done") and `references/query-languages.md` (line 36: CHANGED operator), adapted from the weekly pattern (`startOfWeek(-1)`) to daily (`startOfDay(-1)`).

### Query 2: Issues updated/transitioned yesterday (status changes, not just Done)

```sql
project = BACKEND AND status CHANGED DURING (startOfDay(-1), now()) ORDER BY updated DESC
```

Catches all status transitions (e.g., moved to In Review, moved to QA) -- not just completions. Gives a fuller picture of "what changed."

### Query 3: Currently blocked issues

```sql
project = BACKEND AND (status = Blocked OR status = "On Hold") ORDER BY priority ASC
```

Directly from `references/jql-patterns.md` (line 82). No date filter needed -- blockers are current-state, not time-bounded. The `--max 50` flag on the script call ensures we capture all blockers.

### Query 4: Currently in progress (what people are working on today)

```sql
project = BACKEND AND statusCategory = "In Progress" ORDER BY assignee, priority ASC
```

Shows what each team member is actively working on. Ordered by assignee to group work by person for the standup.

### Query 5: Up next / ready to start today

```sql
project = BACKEND AND sprint in openSprints() AND statusCategory = "To Do" ORDER BY rank ASC
```

From `references/jql-patterns.md` (line 25: "Sprint backlog (not started)"). Shows what is queued up in the current sprint, ranked by board priority.

### Script invocations (would be executed, but not in this simulation)

```bash
node <skill-path>/scripts/jira.mjs search 'project = BACKEND AND status CHANGED TO Done DURING (startOfDay(-1), now()) ORDER BY resolved DESC' --max 50
node <skill-path>/scripts/jira.mjs search 'project = BACKEND AND status CHANGED DURING (startOfDay(-1), now()) ORDER BY updated DESC' --max 50
node <skill-path>/scripts/jira.mjs search 'project = BACKEND AND (status = Blocked OR status = "On Hold") ORDER BY priority ASC' --max 50
node <skill-path>/scripts/jira.mjs search 'project = BACKEND AND statusCategory = "In Progress" ORDER BY assignee, priority ASC' --max 50
node <skill-path>/scripts/jira.mjs search 'project = BACKEND AND sprint in openSprints() AND statusCategory = "To Do" ORDER BY rank ASC' --max 20
```

## 3. The Compact Format I Would Use

Instead of the full report templates in `references/report-templates.md`, I would use a condensed daily standup format:

```
## BACKEND Daily Standup -- 2026-03-18

### Done Since Yesterday
| Key | Summary | Assignee |
|-----|---------|----------|
| BACKEND-xxx | ... | @person |

### Blocked
| Key | Summary | Assignee | Blocker |
|-----|---------|----------|---------|
| BACKEND-xxx | ... | @person | Waiting on ... |

(If no blockers: "No blockers -- all clear.")

### In Progress Today
| Key | Summary | Assignee |
|-----|---------|----------|
| BACKEND-xxx | ... | @person |

### Up Next
- BACKEND-xxx: {summary} (top-ranked To Do)
- BACKEND-xxx: {summary}
(Top 5 items from sprint backlog, ranked)

---
*{N} completed | {N} in progress | {N} blocked | {N} in sprint backlog*
```

**Key format decisions:**
- Tables for structured data (done, blocked, in progress) -- scannable in standup
- Bullet list for "up next" -- less formal, since these are upcoming
- One-line metrics footer instead of a full Metrics section
- No Executive Summary -- the data speaks for itself in a daily cadence
- Blocker section includes the "what is blocking" detail so the team can unblock immediately
- Grouped by assignee in the In Progress query so each person can see their items together

## 4. Whether I Respected "Don't Publish to Confluence"

**Yes, fully respected.** The workflow's Step 5 (Publish) was skipped entirely. The approach:

- The `generate-status-report` sub-skill makes Confluence publishing optional (Step 5 says "If the user wants to publish to Confluence")
- The user explicitly said "Don't publish to Confluence, just show me"
- No `confluence.mjs` commands would be invoked at all
- Output is rendered as markdown directly in the conversation (Step 4: "Display the full generated report in markdown format")
- The SKILL.md principle "Confirm before mutating" (line 48) also reinforces this -- Confluence writes are mutations that require user confirmation, and the user preemptively declined

## 5. Reference Files Consulted

| File | Path | Why Consulted |
|------|------|---------------|
| SKILL.md | `skills/atlassian-rest/SKILL.md` | Entry point -- identified the generate-status-report workflow, understood script interfaces and core principles (confirm before mutating, resolve ambiguity, use workflows for complex tasks) |
| generate-status-report.md | `skills/atlassian-rest/skills/generate-status-report.md` | Primary workflow -- followed its 5-step process, adapted date ranges from 7d to 1d, used its JQL templates as starting points |
| jql-patterns.md | `skills/atlassian-rest/references/jql-patterns.md` | JQL query construction -- used patterns for blocked items (line 82), sprint backlog (line 25), status transitions (line 89), weekly completed (line 117-118) adapted to daily |
| query-languages.md | `skills/atlassian-rest/references/query-languages.md` | JQL syntax validation -- confirmed CHANGED/DURING operator syntax (line 36), date functions like startOfDay() (line 45), statusCategory field usage (line 22) |
| report-templates.md | `skills/atlassian-rest/references/report-templates.md` | Report formatting -- reviewed Weekly Status Template (line 59-80) as closest match to daily standup, adapted its section structure into a more compact form |
