# Approach: Link Jira Issues (Without Skill)

## Task
1. Link PROJ-200 as "is blocked by" PROJ-100 (i.e., PROJ-100 blocks PROJ-200).
2. Link PROJ-100 "relates to" PROJ-50.

## Approach

### Step 1: Identify Available Link Types

Before creating links, query the Jira instance for supported issue link types:

```
GET /rest/api/3/issueLinkType
```

This returns the list of link types (e.g., "Blocks", "Relates", "Clones", "Duplicates"). Each link type has:
- `id` — used when creating the link
- `name` — e.g., "Blocks"
- `inward` — e.g., "is blocked by"
- `outward` — e.g., "blocks"

We need:
- A link type where `name` = "Blocks" (or similar) for the first link.
- A link type where `name` = "Relates" (or similar) for the second link.

### Step 2: Create "Blocks" Link (PROJ-100 blocks PROJ-200)

```
POST /rest/api/3/issueLink
Content-Type: application/json

{
  "type": {
    "name": "Blocks"
  },
  "inwardIssue": {
    "key": "PROJ-200"
  },
  "outwardIssue": {
    "key": "PROJ-100"
  }
}
```

Semantics:
- `outwardIssue` (PROJ-100) **blocks** `inwardIssue` (PROJ-200)
- Equivalently, PROJ-200 **is blocked by** PROJ-100

### Step 3: Create "Relates" Link (PROJ-100 relates to PROJ-50)

```
POST /rest/api/3/issueLink
Content-Type: application/json

{
  "type": {
    "name": "Relates"
  },
  "inwardIssue": {
    "key": "PROJ-50"
  },
  "outwardIssue": {
    "key": "PROJ-100"
  }
}
```

For "Relates" links the direction is symmetrical — both issues show "relates to" each other — so inward/outward assignment does not matter.

## Key Considerations

- **Authentication**: Requires a valid Atlassian API token or OAuth credentials, plus the correct cloud instance base URL (e.g., `https://your-domain.atlassian.net`).
- **Permissions**: The authenticated user must have the "Link Issues" permission in the PROJ project.
- **Link type names vary**: The exact `name` field depends on the Jira instance configuration. Common names are "Blocks" and "Relates", but some instances use different labels. Step 1 (querying link types) handles this.
- **Idempotency**: Jira does not create duplicate links. If the same link already exists, the API returns success without creating a second one.
- **No MCP tools available**: Without the Atlassian skill/plugin, these API calls cannot be executed directly. This document describes the manual REST API approach that would need to be performed via `curl`, Postman, or similar HTTP client.

## What I Cannot Do Without the Skill

I do not have access to Atlassian MCP tools in this session. Therefore I cannot:
1. Discover the exact link type names/IDs on the target instance.
2. Execute the `POST /rest/api/3/issueLink` calls.
3. Verify the links were created successfully.

This approach document captures the full plan that would be executed if the Atlassian REST skill were available.
