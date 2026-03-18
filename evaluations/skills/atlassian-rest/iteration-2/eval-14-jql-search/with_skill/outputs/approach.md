# Approach: Find Blocked High-Priority Bugs in DO Project

## Task Analysis

The user wants to find bugs in the DO project at `wnesolutions.atlassian.net` that are:
1. **Blocked** (status = Blocked or "On Hold")
2. **High priority** (priority IN Highest, High)
3. With **assignee** and **last update time** visible in results

This is a read-only JQL search operation requiring a single `jira.mjs search` call with carefully constructed JQL and field selection.

## References Consulted

- **SKILL.md** -- Section "Search Issues" for `jira.mjs search` syntax
- **references/query-languages.md** -- JQL field names, operators, priority values, status patterns
- **references/jql-patterns.md** -- "Blocked items" pattern (`status = Blocked OR status = "On Hold"`), "Critical/blocker bugs" pattern (`issuetype = Bug AND priority IN (Highest, High) AND resolution = Unresolved`)

## JQL Query Construction

Combining patterns from the reference docs:

```
project = DO AND issuetype = Bug AND priority IN (Highest, High) AND (status = Blocked OR status = "On Hold") AND resolution = Unresolved
```

**Rationale for each clause:**
- `project = DO` -- scopes to the target project
- `issuetype = Bug` -- only bugs
- `priority IN (Highest, High)` -- high-priority (includes both "Highest" and "High" per Jira's 5-level scheme, as referenced in `query-languages.md`)
- `(status = Blocked OR status = "On Hold")` -- matches blocked items per the pattern in `jql-patterns.md` under "Status & Workflow > Blocked items"
- `resolution = Unresolved` -- ensures we only get open/active bugs, not resolved ones that happened to be blocked at some point

**Ordering:** `ORDER BY priority ASC, updated DESC` -- Highest priority first (ASC because Highest=1, High=2), then most recently updated first.

## Exact Commands

### Step 1: Verify credentials are configured

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

### Step 2: Execute the search with required fields

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search \
  'project = DO AND issuetype = Bug AND priority IN (Highest, High) AND (status = Blocked OR status = "On Hold") AND resolution = Unresolved ORDER BY priority ASC, updated DESC' \
  --max 50
```

The search command returns issue key, summary, status, priority, assignee, and updated fields by default -- which covers the user's requirement for assignee and last update time.

### Step 3 (if results need more detail): Get full details per issue

If the search output is summary-level and the user needs richer detail on specific issues:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-<number> \
  --fields summary,status,priority,assignee,updated,created,reporter,description
```

### Step 4 (fallback if "Blocked" status name differs): Broaden the status filter

Jira status names are project-specific. If Step 2 returns zero results, the "Blocked" status may be named differently in the DO project. Broaden the search to find all unresolved high-priority bugs and inspect their statuses:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search \
  'project = DO AND issuetype = Bug AND priority IN (Highest, High) AND resolution = Unresolved ORDER BY priority ASC, updated DESC' \
  --max 50
```

Then inspect the returned statuses to identify which status name represents "blocked" in this project, and re-run with the corrected status value.

## Expected Output

A list of blocked high-priority bugs showing for each:
- Issue key (e.g., DO-456)
- Summary
- Status (Blocked / On Hold)
- Priority (Highest or High)
- Assignee (display name or "Unassigned")
- Updated (last update timestamp)

## Key Decisions

1. **Included both "Highest" and "High" priorities** -- The user said "high-priority" which is ambiguous; including both ensures nothing critical is missed.
2. **Added `resolution = Unresolved`** -- Without this, resolved bugs that were once blocked could appear in results.
3. **Included fallback strategy** -- Status names vary across Jira instances; the fallback in Step 4 handles the case where "Blocked" is not the exact status name in the DO project.
4. **No confirmation needed** -- This is a read-only search operation; per SKILL.md guidelines, read operations do not require user confirmation.
