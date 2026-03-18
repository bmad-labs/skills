# Approach: Create Epic with 3 Child Stories in DO Project (Without Skill)

## Task

Create an Epic called "Q2 Performance Initiative" in the DO project at `https://wnesolutions.atlassian.net`, then create 3 child stories linked to the Epic. Assign Story #1 to john.doe.

## What Is Needed

Without a dedicated Atlassian skill or helper scripts, there is no automated way for the agent to interact with the Jira API. The task requires:

1. **Authentication** -- An Atlassian API token or OAuth credentials for the Jira cloud instance at `https://wnesolutions.atlassian.net`.
2. **User account ID lookup** -- Jira's REST API requires an `accountId` (not a display name or email) for the assignee field. A user search call must resolve "john.doe" to an account ID.
3. **Project and issue type metadata** -- The project key `DO` must exist and support both "Epic" and "Story" issue types.
4. **Parent linking mechanism** -- Next-gen/team-managed projects use the `parent` field. Company-managed projects may require the Epic Link custom field (e.g., `customfield_10014`). The correct mechanism must be determined.

## Detailed Step-by-Step Approach

### Step 1: Look up john.doe's Account ID

Before creating any issues, resolve the assignee to a Jira `accountId`:

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/user/search?query=john.doe" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected response (extract `accountId`):**
```json
[
  {
    "accountId": "5f1a2b3c4d5e6f7a8b9c0d1e",
    "displayName": "John Doe",
    "emailAddress": "john.doe@example.com",
    "active": true
  }
]
```

Save the `accountId` value for use when creating Story 1.

### Step 2: Verify project and issue type availability

Confirm that the DO project supports Epic and Story issue types:

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/project/DO" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

Then retrieve available issue types for the project:

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/createmeta?projectKeys=DO&expand=projects.issuetypes.fields" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

This confirms that "Epic" and "Story" are valid issue types and reveals any required fields or custom field IDs (such as the Epic Link field for company-managed projects).

### Step 3: Confirm plan before executing

Before executing any mutating operations, present the following plan to the user:

| Field       | Epic                              | Story 1                                   | Story 2                                | Story 3                                      |
|-------------|-----------------------------------|--------------------------------------------|----------------------------------------|----------------------------------------------|
| Project     | DO                                | DO                                         | DO                                     | DO                                           |
| Issue Type  | Epic                              | Story                                      | Story                                  | Story                                        |
| Summary     | Q2 Performance Initiative         | Optimize database query response times     | Implement Redis caching layer for API  | Set up performance monitoring dashboards     |
| Priority    | Medium                            | Medium                                     | Medium                                 | Medium                                       |
| Assignee    | --                                | john.doe (`<ACCOUNT_ID>`)                  | --                                     | --                                           |
| Parent      | --                                | `<EPIC_KEY>`                               | `<EPIC_KEY>`                           | `<EPIC_KEY>`                                 |

### Step 4: Create the Epic

```bash
curl -s -X POST \
  "https://wnesolutions.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "fields": {
    "project": {
      "key": "DO"
    },
    "issuetype": {
      "name": "Epic"
    },
    "summary": "Q2 Performance Initiative",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 2 },
          "content": [{ "type": "text", "text": "Goal" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Improve system performance across database queries, API response times, and observability to meet Q2 targets." }]
        },
        {
          "type": "heading",
          "attrs": { "level": 2 },
          "content": [{ "type": "text", "text": "Scope" }]
        },
        {
          "type": "bulletList",
          "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Optimize slow database queries and reduce average response times" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Implement a Redis caching layer for frequently accessed API endpoints" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Set up performance monitoring dashboards for ongoing visibility" }] }] }
          ]
        },
        {
          "type": "heading",
          "attrs": { "level": 2 },
          "content": [{ "type": "text", "text": "Success Criteria" }]
        },
        {
          "type": "bulletList",
          "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Average database query response time reduced by 40%" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "API cache hit rate exceeds 80% for eligible endpoints" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Performance dashboards operational with real-time alerting" }] }] }
          ]
        }
      ]
    },
    "priority": {
      "name": "Medium"
    }
  }
}'
```

**Expected response:**
```json
{
  "id": "10100",
  "key": "DO-100",
  "self": "https://wnesolutions.atlassian.net/rest/api/3/issue/10100"
}
```

Capture the `key` value (e.g., `DO-100`) for use as the parent in subsequent story creation calls.

### Step 5: Create Story 1 -- Optimize database query response times (assigned to john.doe)

```bash
curl -s -X POST \
  "https://wnesolutions.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "fields": {
    "project": {
      "key": "DO"
    },
    "issuetype": {
      "name": "Story"
    },
    "parent": {
      "key": "<EPIC_KEY>"
    },
    "summary": "Optimize database query response times",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Profile and optimize the slowest database queries contributing to degraded API response times. Identify missing indexes, refactor N+1 patterns, and validate improvements under load." }]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Acceptance Criteria" }]
        },
        {
          "type": "bulletList",
          "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Top 10 slowest queries identified and documented" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Average query response time reduced by 40% for identified queries" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "No N+1 query patterns remain in critical code paths" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Load test confirms improvements under production-like traffic" }] }] }
          ]
        }
      ]
    },
    "priority": {
      "name": "Medium"
    },
    "assignee": {
      "accountId": "<JOHN_DOE_ACCOUNT_ID>"
    }
  }
}'
```

**Note:** If the project is company-managed and does not support the `parent` field, replace it with the Epic Link custom field:
```json
"customfield_10014": "<EPIC_KEY>"
```
The correct custom field ID must be determined from Step 2's createmeta response.

### Step 6: Create Story 2 -- Implement Redis caching layer for API

```bash
curl -s -X POST \
  "https://wnesolutions.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "fields": {
    "project": {
      "key": "DO"
    },
    "issuetype": {
      "name": "Story"
    },
    "parent": {
      "key": "<EPIC_KEY>"
    },
    "summary": "Implement Redis caching layer for API",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Implement a Redis-backed caching layer for frequently accessed API endpoints. Define TTL strategies per resource type, implement cache invalidation on writes, and add cache metrics to monitoring." }]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Acceptance Criteria" }]
        },
        {
          "type": "bulletList",
          "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Redis caching integrated for at least 5 high-traffic API endpoints" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Cache hit rate exceeds 80% for eligible endpoints" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Cache invalidation correctly triggers on data mutations" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "API response times for cached endpoints reduced by 60% or more" }] }] }
          ]
        }
      ]
    },
    "priority": {
      "name": "Medium"
    }
  }
}'
```

### Step 7: Create Story 3 -- Set up performance monitoring dashboards

```bash
curl -s -X POST \
  "https://wnesolutions.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "fields": {
    "project": {
      "key": "DO"
    },
    "issuetype": {
      "name": "Story"
    },
    "parent": {
      "key": "<EPIC_KEY>"
    },
    "summary": "Set up performance monitoring dashboards",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Create centralized performance dashboards covering API response times, database query latency, cache performance, and error rates. Set up alerting thresholds and historical trend views." }]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Acceptance Criteria" }]
        },
        {
          "type": "bulletList",
          "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Dashboard displays real-time API response time percentiles (P50, P95, P99)" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Database query latency metrics visible with per-query breakdown" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Alerts trigger when P95 response time exceeds defined thresholds" }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Historical data retained for at least 30 days for trend analysis" }] }] }
          ]
        }
      ]
    },
    "priority": {
      "name": "Medium"
    }
  }
}'
```

### Step 8: Verify all created issues

Fetch each created issue to confirm fields were set correctly:

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/<EPIC_KEY>" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

Repeat for each story key. Verify:
- Epic has correct summary and issue type
- All 3 stories have the Epic as their parent
- Story 1 has john.doe as the assignee
- All issues have Medium priority
- All issues are in the DO project

## Execution Order and Dependencies

```
Step 1 (Lookup john.doe) ──┐
                            ├── Step 3 (Confirm plan) ── Step 4 (Create Epic) ──┬── Step 5 (Story 1 + assignee)
Step 2 (Verify project)  ──┘                                                    ├── Step 6 (Story 2)
                                                                                 └── Step 7 (Story 3)
```

- Steps 1 and 2 can run in parallel (independent lookups)
- Step 4 must complete before Steps 5-7 (Epic key needed as parent)
- Steps 5-7 can run in parallel (independent story creations; only Story 1 needs the account ID from Step 1)
- Step 8 runs after all stories are created

## Total API Calls

| Call                  | Endpoint                          | Count |
|-----------------------|-----------------------------------|-------|
| User search           | `GET /rest/api/3/user/search`    | 1     |
| Project metadata      | `GET /rest/api/3/issue/createmeta` | 1   |
| Create Epic           | `POST /rest/api/3/issue`         | 1     |
| Create Stories        | `POST /rest/api/3/issue`         | 3     |
| Verify issues         | `GET /rest/api/3/issue/{key}`    | 4     |
| **Total**             |                                   | **10** |

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No stored credentials or instance URL | Cannot authenticate to the Jira API at all |
| No MCP tool access (Atlassian plugin not loaded) | Cannot use `createJiraIssue`, `lookupJiraAccountId`, etc. |
| No `curl`/`WebFetch` with auth headers | Cannot make raw REST calls either |
| Account ID unknown for john.doe | Would need a separate lookup call before creating Story 1 |
| Epic Link field ID unknown | Company-managed projects may need a custom field instead of `parent` |
| ADF format required | Jira v3 API requires Atlassian Document Format for descriptions, not markdown |

## Conclusion

Without an Atlassian skill, MCP plugin, or pre-configured API credentials, this task **cannot be completed programmatically** by the agent. The agent can only produce the exact API request payloads (shown above) that a human or CI pipeline would need to execute against the Jira REST API v3 with valid credentials. The approach documents the full sequence of calls needed: user lookup, project validation, Epic creation, 3 child story creations with parent linking, and verification of all created issues.
