# Approach: Search Confluence for Deployment Runbook (Without Atlassian Skill)

## Task

Search Confluence specifically for the deployment runbook on the Atlassian instance at https://wnesolutions.atlassian.net.

## Outcome

**I cannot complete this task.** I have no way to authenticate with the Confluence instance without specialized Atlassian tooling or pre-configured credentials.

## Detailed Step-by-Step Approach

### Step 1: Search for the Deployment Runbook Using CQL

The Confluence Cloud REST API supports Content Query Language (CQL) for targeted searches. The primary endpoint is:

```
GET https://wnesolutions.atlassian.net/wiki/rest/api/content/search?cql=<query>
```

I would construct a CQL query targeting pages containing "deployment" and "runbook":

```
GET https://wnesolutions.atlassian.net/wiki/rest/api/content/search?cql=type=page AND (title~"deployment runbook" OR title~"deploy runbook")&limit=10
```

Alternatively, a broader text search across both title and body:

```
GET https://wnesolutions.atlassian.net/wiki/rest/api/content/search?cql=type=page AND text~"deployment runbook"&limit=10
```

Using `curl`:

```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'user@example.com:ATLASSIAN_API_TOKEN' | base64)" \
  -H "Accept: application/json" \
  "https://wnesolutions.atlassian.net/wiki/rest/api/content/search?cql=type%3Dpage%20AND%20title~%22deployment%20runbook%22&limit=10"
```

**Blockers:**
- I do not have an Atlassian API token or user email with access to this instance.
- CQL queries require authentication; anonymous access is typically disabled on Confluence Cloud.

### Step 2: Review Search Results and Identify the Target Page

The search response returns an array of matching pages. I would inspect the results to find the most relevant match:

```bash
curl -s -u "user@example.com:ATLASSIAN_API_TOKEN" \
  -H "Accept: application/json" \
  "https://wnesolutions.atlassian.net/wiki/rest/api/content/search?cql=type%3Dpage%20AND%20title~%22deployment%20runbook%22&limit=10" \
  | jq '.results[] | {id: .id, title: .title, space: .space.key, url: ._links.webui}'
```

Expected response structure:

```json
[
  {
    "id": "12345678",
    "title": "Production Deployment Runbook",
    "space": "ENG",
    "url": "/wiki/spaces/ENG/pages/12345678/Production+Deployment+Runbook"
  }
]
```

### Step 3: Fetch the Full Page Content

Once the page ID is identified from the search results, I would retrieve the full page content using:

```
GET https://wnesolutions.atlassian.net/wiki/rest/api/content/{pageId}?expand=body.storage,version
```

Using `curl`:

```bash
curl -s -u "user@example.com:ATLASSIAN_API_TOKEN" \
  -H "Accept: application/json" \
  "https://wnesolutions.atlassian.net/wiki/rest/api/content/12345678?expand=body.storage,version"
```

This returns the page body in Confluence storage format (XHTML-based markup). The content is found at `.body.storage.value` in the JSON response.

### Step 4: Parse and Present the Results

The storage format content would need to be converted to readable text. I would:

1. Strip or convert XHTML tags to plain text or Markdown
2. Present the page title, space, and a link to the original page
3. Display the runbook content in a readable format

Example output:

```
## Deployment Runbook

**Page:** Production Deployment Runbook
**Space:** ENG
**URL:** https://wnesolutions.atlassian.net/wiki/spaces/ENG/pages/12345678/Production+Deployment+Runbook

### Content
1. Pre-deployment checklist...
2. Deploy to staging...
3. Run smoke tests...
4. Deploy to production...
```

## Alternative Approaches Considered

### Confluence v2 API Search

The newer v2 API provides a search endpoint:

```
GET https://wnesolutions.atlassian.net/wiki/api/v2/search?query=deployment+runbook&limit=10
```

This uses a simpler query string instead of CQL but offers less control over filtering. The v1 CQL-based search is preferred because it allows filtering by content type (`type=page`) and targeting the title field specifically.

### MCP Atlassian Plugin

The environment lists MCP Atlassian tools such as `searchConfluenceUsingCql` and `getConfluencePage` which could perform this search directly with pre-configured authentication. However, this baseline evaluation explicitly excludes using any skill or plugin.

### Web Search / Web Fetch

Confluence pages sit behind authentication, so fetching the web UI URL directly would not return useful data without a valid session. A web search engine might index public Confluence spaces, but enterprise instances like this one are typically private.

## Blockers and Limitations

| Item | Detail |
|------|--------|
| **No credentials available** | No Atlassian API token, OAuth token, or session cookie is available. |
| **Instance URL is known** | The task provides `https://wnesolutions.atlassian.net`, so the endpoint is clear. |
| **Confluence API is well-documented** | The CQL search and content retrieval endpoints are straightforward. |
| **No skill/plugin allowed** | MCP Atlassian plugin tools are explicitly excluded for this baseline test. |
| **Storage format parsing** | Confluence returns XHTML-like storage format that requires conversion for readability. |

## Conclusion

The search strategy is clear: use CQL via the Confluence REST API to search for pages matching "deployment runbook" (`type=page AND title~"deployment runbook"`), then fetch the full page content using the page ID from the search results. The two-step process (search then retrieve) is the standard pattern for Confluence content discovery. However, without valid authentication credentials (an Atlassian API token paired with an authorized email address), neither the search nor the content retrieval can be executed. This task requires either:

1. A configured Atlassian MCP plugin with stored OAuth/API credentials
2. A valid API token provided directly by the user
3. A pre-authenticated session or CLI tool with Confluence access
