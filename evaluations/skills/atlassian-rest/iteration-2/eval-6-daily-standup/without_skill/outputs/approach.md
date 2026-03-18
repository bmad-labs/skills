# Approach: Daily Standup Summary (Without Atlassian Skill)

## Task

Generate a daily standup summary for the DO project at https://wnesolutions.atlassian.net showing changes from the last 24 hours, blockers, and upcoming work. Output directly -- do not publish to Confluence.

## Outcome

**I cannot complete this task.** Without a configured Atlassian skill, MCP plugin, or API credentials, I have no way to authenticate against the Jira instance to retrieve issue data.

## Detailed Step-by-Step Approach

### Step 1: Identify the Required JQL Queries

A daily standup follows the classic three-question format: What was done? What is blocked? What is coming up? This maps to four JQL queries scoped to the last 24 hours and current state.

**Query 1 -- Completed in the last 24 hours (Done Yesterday):**

```
GET https://wnesolutions.atlassian.net/rest/api/3/search
```

```json
{
  "jql": "project = DO AND status CHANGED TO Done DURING (startOfDay(-1), now()) ORDER BY resolved DESC",
  "fields": ["summary", "status", "assignee", "priority", "issuetype", "resolved"],
  "maxResults": 50
}
```

This uses the `CHANGED TO ... DURING` JQL syntax to capture issues that transitioned to a Done status within the last 24 hours, not just issues updated recently.

**Query 2 -- All status changes in the last 24 hours (What Changed):**

```json
{
  "jql": "project = DO AND status CHANGED DURING (startOfDay(-1), now()) ORDER BY updated DESC",
  "fields": ["summary", "status", "assignee", "priority", "issuetype", "updated"],
  "maxResults": 50
}
```

Captures all status transitions (e.g., moved to In Review, moved to QA, reopened) -- not just completions. Provides a fuller picture of yesterday's activity.

**Query 3 -- Currently blocked issues:**

```json
{
  "jql": "project = DO AND (status = Blocked OR status = \"On Hold\" OR labels = blocked OR flagged = impediment) ORDER BY priority ASC",
  "fields": ["summary", "status", "assignee", "priority", "labels", "comment"],
  "maxResults": 50
}
```

No date filter needed -- blockers are current-state, not time-bounded. Including `labels = blocked` and `flagged = impediment` catches issues flagged on the board even if not formally in a "Blocked" status.

**Query 4 -- In Progress and Up Next (Coming Up Today):**

```json
{
  "jql": "project = DO AND sprint in openSprints() AND statusCategory IN (\"In Progress\", \"To Do\") ORDER BY statusCategory DESC, rank ASC",
  "fields": ["summary", "status", "assignee", "priority", "issuetype"],
  "maxResults": 50
}
```

Returns items in the active sprint that are either being worked on or queued up, ordered so In Progress items appear first, followed by To Do items ranked by board priority.

### Step 2: Authenticate and Execute the Queries

Using `curl` with Basic Auth (email + API token):

```bash
# Query 1: Done in last 24h
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://wnesolutions.atlassian.net/rest/api/3/search" \
  -d '{
    "jql": "project = DO AND status CHANGED TO Done DURING (startOfDay(-1), now()) ORDER BY resolved DESC",
    "fields": ["summary", "status", "assignee", "priority", "issuetype", "resolved"],
    "maxResults": 50
  }'

# Query 2: All status changes in last 24h
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://wnesolutions.atlassian.net/rest/api/3/search" \
  -d '{
    "jql": "project = DO AND status CHANGED DURING (startOfDay(-1), now()) ORDER BY updated DESC",
    "fields": ["summary", "status", "assignee", "priority", "issuetype", "updated"],
    "maxResults": 50
  }'

# Query 3: Blocked issues
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://wnesolutions.atlassian.net/rest/api/3/search" \
  -d '{
    "jql": "project = DO AND (status = Blocked OR status = \"On Hold\" OR labels = blocked) ORDER BY priority ASC",
    "fields": ["summary", "status", "assignee", "priority", "labels"],
    "maxResults": 50
  }'

# Query 4: In Progress + To Do in active sprint
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://wnesolutions.atlassian.net/rest/api/3/search" \
  -d '{
    "jql": "project = DO AND sprint in openSprints() AND statusCategory IN (\"In Progress\", \"To Do\") ORDER BY statusCategory DESC, rank ASC",
    "fields": ["summary", "status", "assignee", "priority", "issuetype"],
    "maxResults": 50
  }'
```

**Blockers:**
- I do not have a Jira API token or user email with access to this instance.
- No Jira CLI tool is installed or configured in this environment.

### Step 3: Parse and Deduplicate Results

Each query returns a JSON payload with `.issues[]` containing the matched items. I would:

1. Parse each response with `jq` to extract key, summary, assignee, status, and priority.
2. Deduplicate between Query 1 and Query 2 (items completed yesterday appear in both).
3. Separate Query 2 results into "status changes that are not completions" for a transition log.
4. Split Query 4 into two groups: In Progress items and To Do items.

Example `jq` extraction:

```bash
# Extract completed issues
cat done_response.json | jq -r '.issues[] | [.key, .fields.summary, (.fields.assignee.displayName // "Unassigned")] | @tsv'

# Extract blocked issues
cat blocked_response.json | jq -r '.issues[] | [.key, .fields.summary, (.fields.assignee.displayName // "Unassigned"), .fields.priority.name] | @tsv'
```

### Step 4: Compile Standup Report

Aggregate the parsed results into a compact standup format:

```markdown
## DO Daily Standup -- 2026-03-18

### Done Since Yesterday
| Key | Summary | Assignee |
|-----|---------|----------|
| DO-xxx | Issue summary... | @person |

### Status Changes (Last 24h)
| Key | Summary | From | To | Assignee |
|-----|---------|------|----|----------|
| DO-xxx | Issue summary... | In Progress | In Review | @person |

### Blocked
| Key | Summary | Assignee | Priority |
|-----|---------|----------|----------|
| DO-xxx | Issue summary... | @person | High |

(If no blockers: "No blockers -- all clear.")

### In Progress Today
| Key | Summary | Assignee |
|-----|---------|----------|
| DO-xxx | Issue summary... | @person |

### Up Next (Sprint Backlog)
- DO-xxx: Issue summary (Priority)
- DO-xxx: Issue summary (Priority)
(Top items from sprint backlog, ranked by board priority)

---
*N completed | N in progress | N blocked | N in sprint backlog*
```

**Key format decisions:**
- Tables for structured data (done, blocked, in progress) for scannability.
- Bullet list for "up next" since these are less formal.
- One-line metrics footer instead of a full metrics section.
- No executive summary -- the data speaks for itself at daily cadence.
- Blocker section highlights priority so the team can triage immediately.

### Step 5: Present Results Directly (No Confluence)

The report is rendered as markdown directly to the user. No Confluence page creation or update is performed. This respects the explicit instruction to not publish.

## Alternative Approaches Considered

### MCP Atlassian Plugin

The environment lists MCP Atlassian tools (e.g., `mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql`) which could execute these JQL queries directly with pre-configured authentication. However, this baseline evaluation explicitly excludes using any skill or plugin.

### Jira Board API

An alternative approach would use the Agile REST API to fetch the active sprint board directly:

```
GET https://wnesolutions.atlassian.net/rest/agile/1.0/board/{boardId}/sprint?state=active
GET https://wnesolutions.atlassian.net/rest/agile/1.0/sprint/{sprintId}/issue
```

This would give sprint-scoped data but requires knowing the board ID first, adding another API call.

### Web Fetch

Jira pages sit behind authentication, so fetching `https://wnesolutions.atlassian.net/browse/DO-xxx` via a web fetch tool would not return useful data without a valid session.

## Challenges Without a Skill

| Challenge | Detail |
|-----------|--------|
| **No credentials available** | No Jira API token, OAuth token, or session cookie is available to authenticate API calls. |
| **Multiple manual API calls** | Four separate JQL queries must be constructed, executed, and parsed individually. |
| **No pre-built formatting** | Results come back as raw JSON; assembling a readable standup report requires manual parsing and structuring with `jq`. |
| **Status name guessing** | Statuses like "Blocked", "On Hold", "Done", "In Progress" may differ per project workflow scheme. Without the skill, there is no automatic adaptation to the project's actual status names. |
| **No deduplication logic** | Issues appearing in multiple query results (e.g., an issue completed yesterday also shows in status changes) must be manually deduplicated. |
| **No template or convention** | Without a skill, there is no standardized standup format; each run must be hand-crafted. |
| **Date range precision** | The `startOfDay(-1)` function uses server timezone. Without knowing the Jira instance timezone setting, the "last 24 hours" window may not align with the team's actual working day. |

## Conclusion

The approach is straightforward -- four JQL queries scoped to the last 24 hours covering completed work, status changes, blockers, and upcoming sprint items. The results would be formatted into a compact standup report (Done/Blocked/In Progress/Up Next) and presented directly without Confluence publishing. However, without valid authentication credentials or a configured Atlassian plugin, none of the API calls can be executed. This task requires either:

1. A configured Atlassian MCP plugin with stored OAuth/API credentials
2. A Jira CLI tool with pre-configured authentication
3. A valid API token provided directly by the user
