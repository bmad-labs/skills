# Approach: Move PROJ-456 to 'Done' and Add Comment

## Task

Move Jira issue PROJ-456 to the 'Done' status and add a comment saying "Deployed to production in release v2.3.1".

## Why This Cannot Be Executed Directly

No Atlassian skill or MCP plugin is available in this context. The task requires authenticated access to the Jira REST API, which requires:

1. A Jira instance base URL (e.g., `https://your-domain.atlassian.net`)
2. Authentication credentials (API token, OAuth token, or basic auth)
3. Network access to the Jira API

## Approach Using Jira REST API

### Step 1: Get Available Transitions for the Issue

Before transitioning an issue, you must look up the transition ID that corresponds to "Done".

```
GET /rest/api/3/issue/PROJ-456/transitions
```

**curl example:**

```bash
curl -s -u user@example.com:<API_TOKEN> \
  -H "Content-Type: application/json" \
  "https://<YOUR_DOMAIN>.atlassian.net/rest/api/3/issue/PROJ-456/transitions"
```

From the response, find the transition object where `name` equals "Done" (or the equivalent in your workflow) and note its `id`.

### Step 2: Transition the Issue to 'Done'

Using the transition ID from Step 1 (e.g., `31`):

```
POST /rest/api/3/issue/PROJ-456/transitions
```

**curl example:**

```bash
curl -s -u user@example.com:<API_TOKEN> \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"transition": {"id": "31"}}' \
  "https://<YOUR_DOMAIN>.atlassian.net/rest/api/3/issue/PROJ-456/transitions"
```

A `204 No Content` response indicates success.

### Step 3: Add a Comment to the Issue

```
POST /rest/api/3/issue/PROJ-456/comment
```

**curl example:**

```bash
curl -s -u user@example.com:<API_TOKEN> \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "body": {
      "version": 1,
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Deployed to production in release v2.3.1"
            }
          ]
        }
      ]
    }
  }' \
  "https://<YOUR_DOMAIN>.atlassian.net/rest/api/3/issue/PROJ-456/comment"
```

A `201 Created` response with the comment JSON body indicates success.

## Prerequisites

| Requirement | Details |
|---|---|
| Jira instance URL | `https://<domain>.atlassian.net` |
| Authentication | Email + API token (for Jira Cloud) |
| Permissions | Transition issues and add comments on project PROJ |
| Workflow | The issue's current status must have a valid transition path to "Done" |

## Notes

- The Atlassian Document Format (ADF) is required for the comment body in API v3. If using API v2, a plain string body is accepted instead.
- The transition ID is workflow-specific. It varies between projects and issue types. You must query the available transitions first.
- If the issue is not in a status that can transition directly to "Done", you may need to perform intermediate transitions.
