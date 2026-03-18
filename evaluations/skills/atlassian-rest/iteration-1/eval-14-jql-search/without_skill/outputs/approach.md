# Approach: Find High-Priority Blocked Bugs in PLATFORM Project (Without Skill)

## Task
Find all high-priority bugs in the PLATFORM project that are currently blocked, showing assignee and last updated date for each.

## Available Tool
`mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql` -- raw MCP tool for JQL search.

## Challenges Without the Skill

1. **Unknown Cloud ID**: The `cloudId` parameter is required but not known upfront. Without the skill's setup/configuration layer, the agent must first discover the Cloud ID by calling `mcp__plugin_atlassian_atlassian__getAccessibleAtlassianResources` or `mcp__plugin_atlassian_atlassian__getVisibleJiraProjects` to find it.

2. **JQL Construction**: The agent must manually construct the JQL query with no reference patterns or validation. Key ambiguities:
   - Is the project key literally `PLATFORM`, or something abbreviated like `PLAT`?
   - Does "blocked" mean a status named "Blocked", or a flag/label, or a resolution, or linked blocking issues?
   - Does "high priority" mean `priority = High`, or does it also include `Highest` / `Critical`?

3. **Field Selection**: The tool defaults to `["summary", "description", "status", "issuetype", "priority", "created"]`. To get assignee and last-updated, the agent must explicitly request the right field names (`assignee`, `updated`). Without the skill's guidance, the agent may miss these or use incorrect field names.

4. **Pagination**: If there are more than 50-100 results, the agent must handle `nextPageToken` manually across multiple calls.

5. **Output Formatting**: No built-in templates or formatting guidance -- the agent must parse raw JSON/ADF responses and format them into a readable report.

## Step-by-Step Approach

### Step 1: Discover Cloud ID
Call `getAccessibleAtlassianResources` to list available Atlassian sites and extract the Cloud ID.

### Step 2: Verify Project Key
Call `getVisibleJiraProjects` with the Cloud ID to confirm the exact project key for "PLATFORM" (could be `PLATFORM`, `PLAT`, etc.).

### Step 3: Construct and Execute JQL Query
```
project = PLATFORM AND issuetype = Bug AND priority = High AND status = Blocked
```
Call `searchJiraIssuesUsingJql` with:
- `cloudId`: (from Step 1)
- `jql`: the query above
- `fields`: `["summary", "status", "priority", "assignee", "updated"]`
- `maxResults`: 50
- `responseContentFormat`: "markdown"

### Step 4: Handle Ambiguity in "Blocked"
If Step 3 returns zero results, retry with variations:
- `status = "Blocked"` (quoted, in case of spaces or special chars)
- `status in ("Blocked", "On Hold")` (broader match)
- `labels = blocked` or `flagged = impediment` (Jira flag)
- Check if "blocked" is indicated by issue links (e.g., "is blocked by") -- this cannot be queried directly via JQL easily

### Step 5: Handle Ambiguity in "High Priority"
If results seem incomplete, broaden to:
```
priority in (High, Highest, Critical)
```

### Step 6: Paginate if Needed
If `nextPageToken` is returned, make additional calls until all results are retrieved.

### Step 7: Format Output
For each issue, extract and display:
- Issue key (e.g., PLATFORM-123)
- Summary
- Assignee display name (or "Unassigned")
- Last updated timestamp

## Estimated Effort
- **Minimum calls**: 3 (resources + projects + search)
- **Likely calls**: 4-6 (including retries for ambiguous terms)
- **Risk**: Wrong results if "blocked" or "high priority" don't match exact Jira field values in this instance

## What the Skill Would Provide
- Pre-configured Cloud ID (no discovery step)
- JQL pattern references with common filter idioms
- Field name mappings and defaults for common queries
- Output formatting templates
- Guidance on how "blocked" is typically represented in the target Jira instance
