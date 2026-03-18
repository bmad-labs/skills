# Approach: Create a High-Priority Bug Ticket in Jira (Without Skill)

## Task

Create a bug ticket in the DO project at `https://wnesolutions.atlassian.net` for a login endpoint timeout issue, assign it to Sarah Chen, and apply `backend` and `urgent` labels.

## What Is Needed

Without a dedicated Atlassian skill or helper scripts, there is no automated way for the agent to interact with the Jira API. The task requires:

1. **Authentication** -- An Atlassian API token or OAuth credentials for the Jira cloud instance at `https://wnesolutions.atlassian.net`.
2. **User account ID lookup** -- Jira's REST API requires an `accountId` (not a display name) for the assignee field. A user search call must be made first to resolve "Sarah Chen" to her account ID.
3. **Project and issue type metadata** -- The project key `DO` must exist, and the issue type `Bug` must be available in that project.

## Detailed Step-by-Step Approach

### Step 1: Look up Sarah Chen's Account ID

Before creating the issue, resolve the display name to a Jira `accountId`:

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/user/search?query=Sarah%20Chen" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected response (extract `accountId`):**
```json
[
  {
    "accountId": "60a1b2c3d4e5f6a7b8c9d0e1",
    "displayName": "Sarah Chen",
    "emailAddress": "sarah.chen@example.com",
    "active": true
  }
]
```

Save the `accountId` value for use in Step 3.

### Step 2: Confirm ticket details before creating

Before executing the create call, confirm the following with the user:

| Field       | Value                                                                      |
|-------------|----------------------------------------------------------------------------|
| Project     | DO                                                                         |
| Issue Type  | Bug                                                                        |
| Priority    | High                                                                       |
| Summary     | [Login API] Timeout after 30s - Users with 50+ active sessions cannot log in |
| Assignee    | Sarah Chen (`<SARAH_CHEN_ACCOUNT_ID>`)                                     |
| Labels      | `backend`, `urgent`                                                        |
| Description | See full ADF body below                                                    |

### Step 3: Create the Jira issue

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
      "name": "Bug"
    },
    "summary": "[Login API] Timeout after 30s - Users with 50+ active sessions cannot log in",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "The login endpoint is timing out after 30 seconds when the authenticating user has more than 50 active sessions. This affects all users who have accumulated a large number of concurrent sessions and prevents them from logging in."
            }
          ]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Steps to Reproduce" }]
        },
        {
          "type": "orderedList",
          "content": [
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Have a user account with more than 50 active sessions." }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Attempt to log in via the login endpoint." }] }] },
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Observe that the request hangs and times out after approximately 30 seconds." }] }] }
          ]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Expected Behavior" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Login should complete within normal response time (< 2 seconds) regardless of the number of active sessions." }]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Actual Behavior" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "The login endpoint times out after 30 seconds and returns a timeout error when the user has more than 50 active sessions." }]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Impact" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Users with many active sessions are completely unable to log in. This is a blocking issue for power users and service accounts." }]
        }
      ]
    },
    "priority": {
      "name": "High"
    },
    "assignee": {
      "accountId": "<SARAH_CHEN_ACCOUNT_ID>"
    },
    "labels": ["backend", "urgent"]
  }
}'
```

### Step 4: Verify the issue was created

Check the response for the `key` and `self` fields:

```json
{
  "id": "10042",
  "key": "DO-42",
  "self": "https://wnesolutions.atlassian.net/rest/api/3/issue/10042"
}
```

Then fetch the created issue to confirm all fields were set correctly:

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-42" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

Verify:
- Priority is "High"
- Assignee is Sarah Chen
- Labels include both "backend" and "urgent"
- Issue type is "Bug"
- Project is "DO"

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No stored credentials or instance URL | Cannot authenticate to the Jira API at all |
| No MCP tool access (Atlassian plugin not loaded) | Cannot use `createJiraIssue`, `lookupJiraAccountId`, etc. |
| No `curl`/`WebFetch` with auth headers | Cannot make raw REST calls either |
| Account ID unknown for "Sarah Chen" | Would need a separate lookup call before creating the issue |

## Conclusion

Without an Atlassian skill, MCP plugin, or pre-configured API credentials, this task **cannot be completed programmatically** by the agent. The agent can only produce the exact API request payloads (shown above) that a human or CI pipeline would need to execute against the Jira REST API v3 with valid credentials. All the necessary request structure, field values, and endpoint paths are documented here for manual execution.
