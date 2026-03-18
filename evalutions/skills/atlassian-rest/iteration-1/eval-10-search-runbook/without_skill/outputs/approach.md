# Approach: Search Confluence for Deployment Runbook (Without Skill)

## Task

Search Confluence for the deployment runbook and retrieve the steps for deploying to production.

## Status: Cannot Execute

This task cannot be completed because no Atlassian skill or MCP tool is available in this context. The task was explicitly scoped to run **without** the Atlassian skill.

## What Would Be Required

To search Confluence and retrieve a deployment runbook, the following capabilities are needed:

### 1. Authentication

- An Atlassian API token or OAuth2 access token.
- The Confluence cloud instance URL (e.g., `https://<your-domain>.atlassian.net`).
- A valid user account with read access to the relevant Confluence space.

### 2. API Calls Needed

**Step A: Search for the runbook page**

Use the Confluence REST API v2 or CQL search:

```
GET /wiki/rest/api/content/search?cql=title~"deployment runbook" AND type=page
```

Or with the v2 search endpoint:

```
GET /wiki/api/v2/search?query=deployment+runbook&limit=10
```

Headers required:
- `Authorization: Basic <base64(email:api-token)>` or `Bearer <oauth-token>`
- `Accept: application/json`

**Step B: Retrieve the page content**

Once the page ID is found from the search results, fetch its body:

```
GET /wiki/rest/api/content/{pageId}?expand=body.storage
```

This returns the page content in Confluence storage format (XHTML-like markup).

**Step C: Parse the content**

The storage format would need to be parsed to extract the production deployment steps in a human-readable form.

### 3. Tools That Would Enable This

Any of the following would work:

- **Atlassian MCP plugin** (preferred): Provides `searchConfluenceUsingCql`, `getConfluencePage`, and related tools that handle auth and API calls automatically.
- **WebFetch tool** with manually constructed API requests: Would require the user to provide credentials and instance URL.
- **A custom script** using `curl` or a library like `atlassian-python-api`: Would need to be written, configured with credentials, and executed.

## Recommended Next Steps

1. Enable the Atlassian skill/plugin so that the `searchConfluenceUsingCql` and `getConfluencePage` MCP tools become available.
2. Re-run this task with the skill enabled.
3. The skill-based approach would use CQL search (e.g., `title ~ "deployment runbook" AND type = page`) to locate the page, then fetch and present its content.
