# Common JQL Patterns

## Personal Queries

```sql
-- My open issues
assignee = currentUser() AND resolution = Unresolved ORDER BY priority DESC, updated DESC

-- My issues updated today
assignee = currentUser() AND updated >= startOfDay()

-- Issues I reported
reporter = currentUser() AND resolution = Unresolved

-- Issues I recently resolved
assignee = currentUser() AND status CHANGED TO Done DURING (startOfWeek(), now())
```

## Sprint Queries

```sql
-- Current sprint work
sprint in openSprints() AND project = PROJ

-- Sprint backlog (not started)
sprint in openSprints() AND statusCategory = "To Do"

-- Sprint in progress
sprint in openSprints() AND statusCategory = "In Progress"

-- Sprint completed
sprint in openSprints() AND statusCategory = Done

-- Sprint carryover candidates (in progress, near end)
sprint in openSprints() AND statusCategory != Done AND updated < -3d
```

## Bug & Issue Tracking

```sql
-- Open bugs by priority
issuetype = Bug AND resolution = Unresolved ORDER BY priority ASC, created ASC

-- Critical/blocker bugs
issuetype = Bug AND priority IN (Highest, High) AND resolution = Unresolved

-- Bugs created this week
issuetype = Bug AND created >= startOfWeek()

-- Bugs without assignee
issuetype = Bug AND resolution = Unresolved AND assignee IS EMPTY

-- Regressions (reopened bugs)
issuetype = Bug AND status CHANGED FROM Done TO Open
```

## Date-Based Queries

```sql
-- Created this week
created >= startOfWeek() AND project = PROJ

-- Updated in last 7 days
updated >= -7d AND project = PROJ

-- Overdue issues
duedate < now() AND resolution = Unresolved

-- Due this week
duedate >= startOfWeek() AND duedate <= endOfWeek()

-- Stale issues (no update in 14 days)
updated < -14d AND resolution = Unresolved AND statusCategory = "In Progress"

-- Created last month
created >= startOfMonth(-1) AND created < startOfMonth()
```

## Status & Workflow

```sql
-- Blocked items
status = Blocked OR status = "On Hold"

-- Items in review
status IN ("In Review", "Code Review", "QA")

-- Recently transitioned to Done
status CHANGED TO Done DURING (startOfDay(-7), now())

-- Stuck in progress (>7 days)
status = "In Progress" AND status CHANGED TO "In Progress" BEFORE -7d
```

## Cross-Project & Reporting

```sql
-- All projects, high priority unresolved
priority IN (Highest, High) AND resolution = Unresolved ORDER BY project, priority

-- Multiple projects
project IN (PROJ1, PROJ2, PROJ3) AND statusCategory != Done

-- Release scope
fixVersion = "2.0" AND project = PROJ ORDER BY priority ASC

-- Unestimated stories
issuetype = Story AND (story_points IS EMPTY OR story_points = 0) AND sprint in openSprints()

-- Epics in progress
issuetype = Epic AND statusCategory = "In Progress" ORDER BY rank ASC
```

## Combined Filters for Reports

```sql
-- Weekly status: completed
project = PROJ AND status CHANGED TO Done DURING (startOfWeek(-1), endOfWeek(-1))

-- Weekly status: new issues
project = PROJ AND created >= startOfWeek(-1) AND created < startOfWeek()

-- Team workload
project = PROJ AND resolution = Unresolved AND assignee IS NOT EMPTY ORDER BY assignee, priority

-- Velocity input: done per sprint
project = PROJ AND sprint = {sprintId} AND statusCategory = Done
```

## Label & Component Queries

```sql
-- By label
labels = backend AND resolution = Unresolved

-- By component
component = "Auth Service" AND issuetype = Bug

-- Missing labels
labels IS EMPTY AND issuetype IN (Story, Bug) AND created >= -30d

-- Tech debt
labels IN (tech-debt, refactor) AND resolution = Unresolved ORDER BY priority
```
