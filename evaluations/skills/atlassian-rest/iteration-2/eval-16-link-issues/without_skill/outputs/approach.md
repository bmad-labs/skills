# Approach: Link Jira Issues (Without Skill)

## Task
1. Link DO-100 blocks DO-200 (i.e., DO-100 blocks DO-200, and DO-200 is blocked by DO-100).
2. Link DO-100 relates to DO-50.

Target instance: `https://wnesolutions.atlassian.net`
Target project: DO

## Approach

### Step 1: Discover Available Issue Link Types

Before creating links, query the Jira instance for the supported issue link types to get the exact names:

```
GET https://wnesolutions.atlassian.net/rest/api/3/issueLinkType
Authorization: Basic <base64(email:api-token)>
Accept: application/json
```

This returns a list of link types. Each link type object includes:
- `id` — numeric identifier
- `name` — e.g., "Blocks"
- `inward` — the inward description, e.g., "is blocked by"
- `outward` — the outward description, e.g., "blocks"

We need to find:
- A link type where `name` is "Blocks" (or similar) for the first link.
- A link type where `name` is "Relates" (or similar) for the second link.

### Step 2: Create "Blocks" Link (DO-100 blocks DO-200)

```
POST https://wnesolutions.atlassian.net/rest/api/3/issueLink
Authorization: Basic <base64(email:api-token)>
Content-Type: application/json

{
  "type": {
    "name": "Blocks"
  },
  "outwardIssue": {
    "key": "DO-100"
  },
  "inwardIssue": {
    "key": "DO-200"
  }
}
```

Semantics of the Jira issue link model:
- `outwardIssue` (DO-100) **blocks** `inwardIssue` (DO-200)
- Equivalently, DO-200 **is blocked by** DO-100
- The `outwardIssue` is the source that performs the outward action ("blocks"), and the `inwardIssue` is the target that receives the inward action ("is blocked by")

A successful response returns HTTP 201 with no body.

### Step 3: Create "Relates" Link (DO-100 relates to DO-50)

```
POST https://wnesolutions.atlassian.net/rest/api/3/issueLink
Authorization: Basic <base64(email:api-token)>
Content-Type: application/json

{
  "type": {
    "name": "Relates"
  },
  "outwardIssue": {
    "key": "DO-100"
  },
  "inwardIssue": {
    "key": "DO-50"
  }
}
```

For "Relates" links the relationship is symmetrical — both issues display "relates to" each other — so the assignment of inward vs. outward does not affect the visible result.

A successful response returns HTTP 201 with no body.

### Step 4: Verify the Links Were Created

Fetch either issue to confirm the links appear:

```
GET https://wnesolutions.atlassian.net/rest/api/3/issue/DO-100?fields=issuelinks
Authorization: Basic <base64(email:api-token)>
Accept: application/json
```

The `issuelinks` field in the response should contain two entries:
1. A "Blocks" link where DO-100 blocks DO-200 (outward link to DO-200)
2. A "Relates" link where DO-100 relates to DO-50

## Key Considerations

- **Authentication**: Requires a valid Atlassian API token with Basic auth (email + API token base64-encoded) or OAuth 2.0 credentials.
- **Permissions**: The authenticated user must have the "Link Issues" permission in the DO project.
- **Link type names vary by instance**: The exact `name` values depend on the Jira instance configuration. Common defaults are "Blocks" and "Relates", but some instances use different labels (e.g., "Blockers"). Step 1 handles discovery.
- **Idempotency**: Jira does not create duplicate links. If the same link already exists, the API returns success without creating a second one.
- **Error handling**: If the link type name does not match exactly, the API returns a 404. Use the exact `name` value from Step 1.

## What I Cannot Do Without the Skill

I do not have access to Atlassian MCP tools or helper scripts in this session. Therefore I cannot:
1. Authenticate against the Jira instance to discover the exact link type names/IDs.
2. Execute the `POST /rest/api/3/issueLink` calls to create the links.
3. Verify the links were created successfully by fetching the issues.

This approach document captures the full plan that would be executed if the Atlassian REST skill or direct API access were available.
