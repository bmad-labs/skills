# Approach: Create Rich Confluence Document — API Migration Guide

## Workflow Used

`workflows/create-confluence-document.md` — the 6-step workflow for creating professional Confluence pages with macros, layouts, and structured formatting.

## References Consulted

- `references/confluence-formatting.md` — storage format XHTML syntax for TOC, panels, code blocks, expand/collapse macros, tables, and document templates (specifically the **Technical Document** template)

---

## Step 1: Gather Requirements

The task specifies:
- **Space:** `TEAM`
- **Title:** `API Migration Guide`
- **Parent page:** Not specified (top-level in space)
- **Document type:** Technical Document
- **Content requirements:** Table of contents, overview info panel, Background section, Migration Steps with code blocks, Troubleshooting with expand/collapse per issue
- **Local images/files:** None specified

No ambiguity to resolve — all required parameters are provided.

## Step 2: Plan Document Structure

Based on the Technical Document template from `references/confluence-formatting.md`, the outline is:

1. **Table of Contents** — `ac:structured-macro ac:name="toc"` (document has 3+ sections)
2. **Overview** — `ac:structured-macro ac:name="info"` panel summarizing the guide's purpose, target audience, and scope
3. **Background** — `<h2>` section with context paragraphs explaining why the migration is needed
4. **Migration Steps** — `<h2>` section with numbered sub-steps (`<h3>`), each containing `ac:structured-macro ac:name="code"` blocks
5. **Troubleshooting** — `<h2>` section with multiple `ac:structured-macro ac:name="expand"` blocks, one per known issue

Present this outline to the user and get confirmation before proceeding.

## Step 3: Build Storage Format Body

Write the full storage format HTML to a temporary file since it will exceed 2000 characters. The body file uses these Confluence macros from the formatting reference:

- **TOC macro** with `maxLevel=3`
- **Info panel** for the overview summary
- **Code blocks** with `language`, `title`, and `linenumbers` parameters
- **Expand/collapse** sections for each troubleshooting issue
- **Warning panel** for critical migration notes

### Command: Write the body file

```bash
cat > /tmp/confluence-body.html << 'HTMLEOF'
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
  <ac:parameter ac:name="minLevel">1</ac:parameter>
</ac:structured-macro>

<h1>Overview</h1>
<ac:structured-macro ac:name="info">
  <ac:parameter ac:name="title">API Migration Guide — Summary</ac:parameter>
  <ac:rich-text-body>
    <p>This document provides a step-by-step guide for migrating from the legacy REST API (v1) to the new REST API (v2). It covers authentication changes, endpoint mapping, request/response format differences, and common troubleshooting scenarios. Target audience: backend engineers and integration developers.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Background</h2>
<p>The v1 REST API has been in production since 2019 and is scheduled for deprecation on 2026-06-30. The v2 API introduces improved authentication via OAuth 2.0, consistent JSON:API response formatting, pagination via cursor tokens, and enhanced rate limiting with retry-after headers.</p>
<p>All integrations must be migrated before the deprecation date. This guide walks through each required change with concrete code examples.</p>

<ac:structured-macro ac:name="warning">
  <ac:parameter ac:name="title">Deprecation Deadline</ac:parameter>
  <ac:rich-text-body>
    <p>The v1 API will be fully decommissioned on <strong>2026-06-30</strong>. After this date, all v1 endpoints will return <code>410 Gone</code>. Plan your migration accordingly.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Migration Steps</h2>

<h3>Step 1: Update Base URL</h3>
<p>All API requests must point to the new v2 base URL. Update your configuration or environment variables:</p>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:parameter ac:name="title">Environment Configuration</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[# Old v1 configuration
API_BASE_URL=https://api.example.com/v1

# New v2 configuration
API_BASE_URL=https://api.example.com/v2]]></ac:plain-text-body>
</ac:structured-macro>

<h3>Step 2: Migrate Authentication</h3>
<p>Replace API key header authentication with OAuth 2.0 bearer tokens:</p>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:parameter ac:name="title">Authentication — Before (v1)</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[// v1: API key in header
const response = await fetch('https://api.example.com/v1/resources', {
  headers: {
    'X-API-Key': process.env.API_KEY,
    'Content-Type': 'application/json'
  }
});]]></ac:plain-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:parameter ac:name="title">Authentication — After (v2)</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[// v2: OAuth 2.0 bearer token
const token = await getOAuth2Token(clientId, clientSecret);
const response = await fetch('https://api.example.com/v2/resources', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});]]></ac:plain-text-body>
</ac:structured-macro>

<h3>Step 3: Update Response Parsing</h3>
<p>The v2 API uses JSON:API format. Update your response parsers:</p>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:parameter ac:name="title">Response Parsing — Before vs After</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[// v1 response shape
// { "items": [...], "total": 100, "page": 1 }
const items = data.items;
const total = data.total;

// v2 response shape (JSON:API)
// { "data": [...], "meta": { "total": 100 }, "links": { "next": "cursor_abc" } }
const items = data.data;
const total = data.meta.total;
const nextCursor = data.links.next;]]></ac:plain-text-body>
</ac:structured-macro>

<h3>Step 4: Update Pagination</h3>
<p>Replace page-based pagination with cursor-based pagination:</p>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:parameter ac:name="title">Cursor-Based Pagination</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[// v2: cursor-based pagination
async function fetchAllResources() {
  let cursor = null;
  const allItems = [];

  do {
    const url = new URL('https://api.example.com/v2/resources');
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url, { headers: authHeaders });
    const data = await response.json();

    allItems.push(...data.data);
    cursor = data.links?.next || null;
  } while (cursor);

  return allItems;
}]]></ac:plain-text-body>
</ac:structured-macro>

<h3>Step 5: Handle Rate Limiting</h3>
<p>The v2 API includes <code>Retry-After</code> headers. Implement exponential backoff:</p>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:parameter ac:name="title">Rate Limit Handling</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
      console.warn(`Rate limited. Retrying after ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }

    return response;
  }
  throw new Error('Max retries exceeded');
}]]></ac:plain-text-body>
</ac:structured-macro>

<h2>Troubleshooting</h2>
<p>Common issues encountered during migration and their resolutions:</p>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">401 Unauthorized — Token Rejected</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Symptom:</strong> Requests return <code>401 Unauthorized</code> even with a valid-looking token.</p>
    <p><strong>Cause:</strong> The OAuth 2.0 token was generated with v1 scopes that are not valid in v2.</p>
    <p><strong>Resolution:</strong> Regenerate the token with the v2 scope set. Ensure your OAuth client configuration includes the <code>api.v2.read</code> and <code>api.v2.write</code> scopes.</p>
    <ac:structured-macro ac:name="code">
      <ac:parameter ac:name="language">bash</ac:parameter>
      <ac:plain-text-body><![CDATA[curl -X POST https://auth.example.com/oauth/token \
  -d "grant_type=client_credentials" \
  -d "scope=api.v2.read api.v2.write" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET"]]></ac:plain-text-body>
    </ac:structured-macro>
  </ac:rich-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">400 Bad Request — Invalid JSON:API Format</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Symptom:</strong> POST/PUT requests return <code>400 Bad Request</code> with message "Invalid request body format".</p>
    <p><strong>Cause:</strong> The v2 API expects JSON:API formatted request bodies, not the flat JSON used in v1.</p>
    <p><strong>Resolution:</strong> Wrap your request body in the JSON:API envelope:</p>
    <ac:structured-macro ac:name="code">
      <ac:parameter ac:name="language">json</ac:parameter>
      <ac:plain-text-body><![CDATA[{
  "data": {
    "type": "resources",
    "attributes": {
      "name": "My Resource",
      "description": "Details here"
    }
  }
}]]></ac:plain-text-body>
    </ac:structured-macro>
  </ac:rich-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">404 Not Found — Endpoint Path Changed</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Symptom:</strong> Previously working endpoints now return <code>404 Not Found</code>.</p>
    <p><strong>Cause:</strong> Several v1 endpoint paths were restructured in v2.</p>
    <p><strong>Resolution:</strong> Consult the endpoint mapping table below:</p>
    <table>
      <thead>
        <tr>
          <th style="background-color: #f4f5f7; font-weight: bold;">v1 Endpoint</th>
          <th style="background-color: #f4f5f7; font-weight: bold;">v2 Endpoint</th>
        </tr>
      </thead>
      <tbody>
        <tr><td><code>/v1/users/{id}</code></td><td><code>/v2/accounts/{id}</code></td></tr>
        <tr><td><code>/v1/projects/{id}/tasks</code></td><td><code>/v2/projects/{id}/work-items</code></td></tr>
        <tr><td><code>/v1/search</code></td><td><code>/v2/query</code></td></tr>
      </tbody>
    </table>
  </ac:rich-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">429 Too Many Requests — Rate Limit Exceeded</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Symptom:</strong> Burst requests trigger <code>429</code> responses more frequently than in v1.</p>
    <p><strong>Cause:</strong> The v2 API has stricter per-client rate limits (100 req/min vs 500 req/min in v1).</p>
    <p><strong>Resolution:</strong> Implement the <code>fetchWithRetry</code> function from Step 5 above. Additionally, batch bulk operations using the new <code>/v2/batch</code> endpoint to reduce request count.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">502 Bad Gateway — Intermittent Failures During Migration</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Symptom:</strong> Sporadic <code>502</code> errors during the migration cutover window.</p>
    <p><strong>Cause:</strong> Load balancer is routing traffic between v1 and v2 backends during the transition period.</p>
    <p><strong>Resolution:</strong> Implement retry logic with exponential backoff. If errors persist beyond 5 minutes, check the <a href="https://status.example.com">status page</a> for incident reports.</p>
  </ac:rich-text-body>
</ac:structured-macro>
HTMLEOF
```

## Step 4: Create the Page

Using `--body-file` since the content is long (well over 2000 characters):

```bash
node <skill-path>/scripts/confluence.mjs create-page \
  --space TEAM \
  --title "API Migration Guide" \
  --body-file /tmp/confluence-body.html
```

**Note:** The returned page ID is captured for use in Step 6.

## Step 5: Upload & Embed Images

No local images or files were specified for this task. This step is skipped.

## Step 6: Review

Fetch the created page to verify it rendered correctly:

```bash
node <skill-path>/scripts/confluence.mjs get-page <pageId> --format storage
```

Report to the user:
- Page URL (from `_links.webui` in the response)
- Confirm the TOC macro, info panel, code blocks, and expand/collapse sections all rendered
- Ask if any adjustments are needed (e.g., additional troubleshooting entries, different code languages, parent page assignment)

---

## Summary of Confluence Macros Used

| Macro | Purpose | Reference Section |
|-------|---------|-------------------|
| `ac:structured-macro ac:name="toc"` | Auto-generated table of contents | `confluence-formatting.md` — Table of Contents Macro |
| `ac:structured-macro ac:name="info"` | Overview summary panel (blue) | `confluence-formatting.md` — Info / Warning / Note / Tip Panels |
| `ac:structured-macro ac:name="warning"` | Deprecation deadline callout (orange) | `confluence-formatting.md` — Info / Warning / Note / Tip Panels |
| `ac:structured-macro ac:name="code"` | Code blocks with syntax highlighting and line numbers | `confluence-formatting.md` — Code Blocks |
| `ac:structured-macro ac:name="expand"` | Collapsible troubleshooting entries | `confluence-formatting.md` — Expand / Collapse Sections |
| `<table>` with styled `<th>` | Endpoint mapping table inside troubleshooting | `confluence-formatting.md` — Tables |

## Key Decisions

1. **Used `--body-file`** because the storage format HTML is approximately 6000+ characters, well above the 2000-character threshold specified in the workflow.
2. **Used Technical Document template** as the base structure from `references/confluence-formatting.md`, adapting it with migration-specific sections.
3. **Five expand/collapse sections** in Troubleshooting — one per common HTTP error (401, 400, 404, 429, 502) — each with symptom/cause/resolution structure and inline code examples where relevant.
4. **Code blocks use specific languages** (`bash`, `javascript`, `json`) with `linenumbers=true` and descriptive titles for readability.
5. **No parent page** specified — page is created at top level in the TEAM space. User can be asked if they want it nested under an existing page.
