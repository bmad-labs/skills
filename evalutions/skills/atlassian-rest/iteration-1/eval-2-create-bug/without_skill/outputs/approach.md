# Approach: Create a High-Priority Bug Ticket in Jira (Without Skill)

## Task

Create a bug ticket in the PLATFORM project for a login endpoint timeout issue, assign it to Sarah Chen, and apply labels.

## What Is Needed

Without a dedicated Atlassian skill or helper scripts, there is no automated way for the agent to interact with the Jira API. The task requires:

1. **Authentication** -- An Atlassian API token or OAuth credentials, plus the Jira cloud instance URL (e.g., `https://<instance>.atlassian.net`).
2. **User account ID lookup** -- Jira's REST API requires an `accountId` (not a display name) for assignee. You would need to call the user search endpoint first.
3. **Project and issue type metadata** -- The project key `PLATFORM` must exist, and the issue type `Bug` must be available in that project.

## Manual Steps Required

### Step 1: Look up Sarah Chen's account ID

```
GET /rest/api/3/user/search?query=Sarah%20Chen
```

Extract the `accountId` from the response.

### Step 2: Create the Jira issue

```
POST /rest/api/3/issue
Content-Type: application/json

{
  "fields": {
    "project": {
      "key": "PLATFORM"
    },
    "issuetype": {
      "name": "Bug"
    },
    "summary": "Login endpoint times out after 30s when user has 50+ active sessions",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "The /login (or /auth/login) endpoint times out after 30 seconds when the authenticating user has more than 50 active sessions. This affects all users who have accumulated a large number of concurrent sessions and prevents them from logging in."
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
            { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Observe that the request hangs and times out after 30 seconds." }] }] }
          ]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Expected Behavior" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Login should complete within normal response time regardless of the number of active sessions." }]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Actual Behavior" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "The endpoint times out after 30 seconds, returning a timeout error." }]
        }
      ]
    },
    "priority": {
      "name": "High"
    },
    "assignee": {
      "accountId": "<SARAH_CHEN_ACCOUNT_ID>"
    },
    "labels": ["backend", "urgent"],
    "components": [
      {
        "name": "API"
      }
    ]
  }
}
```

### Step 3: Verify the issue was created

Check the response for the `key` field (e.g., `PLATFORM-1234`) and confirm the issue exists.

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No stored credentials or instance URL | Cannot authenticate to the Jira API at all |
| No MCP tool access (Atlassian plugin not loaded) | Cannot use `createJiraIssue`, `lookupJiraAccountId`, etc. |
| No `curl`/`WebFetch` with auth headers | Cannot make raw REST calls either |
| Account ID unknown for "Sarah Chen" | Would need a separate lookup call before creating the issue |

## Conclusion

Without an Atlassian skill, MCP plugin, or pre-configured API credentials, this task **cannot be completed programmatically** by the agent. The agent can only produce the exact API request payloads (shown above) that a human or CI pipeline would need to execute against the Jira REST API v3 with valid credentials. All the necessary request structure, field values, and endpoint paths are documented here for manual execution.
