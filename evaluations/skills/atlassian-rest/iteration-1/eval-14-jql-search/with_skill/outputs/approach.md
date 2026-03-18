# Approach: Find High-Priority Blocked Bugs in PLATFORM

## 1. Exact JQL Query Constructed

```sql
project = PLATFORM AND issuetype = Bug AND priority IN (Highest, High) AND status = Blocked ORDER BY updated DESC
```

**Reasoning:**

- `project = PLATFORM` -- scopes to the PLATFORM project as requested.
- `issuetype = Bug` -- restricts to bugs only.
- `priority IN (Highest, High)` -- captures high-priority bugs. Jira's standard priority scheme uses "Highest" and "High" as the two top tiers. Including both covers the intent of "high-priority." If the user meant only `priority = High` exactly, this could be narrowed, but casting a slightly wider net with Highest included is the safer default.
- `status = Blocked` -- filters to currently blocked issues. Per `jql-patterns.md`, the pattern for blocked items is `status = Blocked OR status = "On Hold"`. Since the user specifically said "blocked" (not "on hold"), only `Blocked` is used. If no results come back, a follow-up query adding `OR status = "On Hold"` would be warranted.
- `ORDER BY updated DESC` -- sorts by most recently updated first, which aligns with the user wanting to see "when it was last updated."

## 2. Exact jira.mjs Search Command

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = PLATFORM AND issuetype = Bug AND priority IN (Highest, High) AND status = Blocked ORDER BY updated DESC' --max 50
```

**Notes:**

- `--max 50` is used to get a generous result set. If the team has more than 50 blocked high-priority bugs, that itself is a finding worth reporting, and the query can be paginated.
- The `search` command returns issue keys plus standard fields including summary, status, assignee, priority, and updated timestamp -- all the data needed to answer the user's question.
- No `--fields` flag is needed for the search command; the script returns a standard field set by default. If the output lacked assignee or updated date, a follow-up `jira.mjs get <key> --fields summary,status,assignee,priority,updated` per issue would fill the gaps.

## 3. How I Would Format and Present Results

After running the search command, I would present a summary table like this:

```
### Blocked High-Priority Bugs in PLATFORM

| Issue Key     | Summary                         | Priority | Assignee         | Last Updated        |
|---------------|---------------------------------|----------|------------------|---------------------|
| PLATFORM-456  | Payment gateway timeout on retry| Highest  | Jane Smith       | 2026-03-17 14:32    |
| PLATFORM-312  | Auth token refresh race condition| High    | Unassigned       | 2026-03-15 09:11    |
| PLATFORM-289  | Data sync fails for large batches| High    | Carlos Rivera    | 2026-03-12 16:45    |
```

**Presentation details:**

- Issues sorted by last updated (most recent first), matching the ORDER BY in the JQL.
- Unassigned issues explicitly called out as "Unassigned" so the user can take action.
- If zero results are returned, I would report that clearly and suggest broadening the search (e.g., include "On Hold" status, or check if the project uses a custom blocked status name by running `jira.mjs search 'project = PLATFORM AND issuetype = Bug AND priority IN (Highest, High)' --max 10` and inspecting the status values).
- A count summary at the top: "Found N blocked high-priority bugs in PLATFORM."

## 4. Reference Files Consulted

### `references/jql-patterns.md`
- **Bug & Issue Tracking section** -- Used the pattern `issuetype = Bug AND priority IN (Highest, High) AND resolution = Unresolved` as a starting point for filtering high-priority bugs. Adapted it by replacing `resolution = Unresolved` with `status = Blocked` since the user specifically wants blocked issues (blocked implies unresolved).
- **Status & Workflow section** -- Used the pattern `status = Blocked OR status = "On Hold"` to understand how blocked items are typically queried. Chose to use only `status = Blocked` based on the user's specific wording.

### `references/query-languages.md`
- **JQL Fields table** -- Confirmed that `priority` accepts values like `Highest, High, Medium, Low, Lowest`, validating the use of `priority IN (Highest, High)`.
- **JQL Fields table** -- Confirmed `status` uses quoted multi-word values, but "Blocked" is a single word so no quoting needed.
- **Operators table** -- Confirmed `IN` operator for set membership, used for the priority filter.
- **JQL Fields table** -- Confirmed `updated` field is available for ordering results by last update time.
- **JQL Fields table** -- Confirmed `project` takes a key (like PLATFORM) directly.
