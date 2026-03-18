# Approach: Create a Rich Confluence Document (Without Skill)

## Task

Create a professional technical document in Confluence's TEAM space titled "API Migration Guide" with a table of contents, an info panel overview, Background and Migration Steps sections (with code blocks), and a Troubleshooting section with expand/collapse items. Use `--body-file` for the long content.

## What Is Needed

Without a dedicated Atlassian skill or helper scripts, there is no automated way for the agent to interact with the Confluence API. The task requires:

1. **Authentication** -- An Atlassian API token or OAuth credentials for the Confluence cloud instance.
2. **Space key resolution** -- The space key `TEAM` must exist and the authenticated user must have create-page permissions.
3. **Confluence Storage Format knowledge** -- Confluence pages use XHTML-based "storage format" with Atlassian-specific structured macros (`ac:structured-macro`). This is significantly different from standard HTML or Markdown. The agent must know the exact XML schema for macros like `toc`, `info`, `code`, and `expand`.
4. **Body file strategy** -- Because the storage-format body will be very large, it should be written to a temporary file and passed via `--body-file` (if using a CLI tool) or read from disk for a REST API call, rather than being inlined on the command line.

## Detailed Step-by-Step Approach

### Step 1: Build the Confluence Storage Format HTML Body

The entire page body must be authored in Confluence storage format (XHTML with `ac:` and `ri:` namespaced macros). Below is the complete body that would be written to a temporary file (e.g., `/tmp/api-migration-guide-body.html`):

```html
<!-- Table of Contents macro -->
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="printable">true</ac:parameter>
  <ac:parameter ac:name="style">disc</ac:parameter>
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
  <ac:parameter ac:name="minLevel">1</ac:parameter>
  <ac:parameter ac:name="type">list</ac:parameter>
</ac:structured-macro>

<!-- Overview Info Panel -->
<ac:structured-macro ac:name="info">
  <ac:parameter ac:name="title">Overview</ac:parameter>
  <ac:rich-text-body>
    <p>This guide covers the migration from API v1 to API v2. It includes background context, step-by-step migration instructions with code examples, and troubleshooting guidance for common issues encountered during migration.</p>
    <p><strong>Target Audience:</strong> Backend developers and platform engineers</p>
    <p><strong>Estimated Effort:</strong> 2-4 hours per service</p>
  </ac:rich-text-body>
</ac:structured-macro>

<!-- Background Section -->
<h1>Background</h1>
<p>API v1 has been in production since 2021 and is now being deprecated in favor of API v2. The new API introduces improved authentication, pagination, and error handling. All consumers must migrate before the deprecation deadline of Q4 2026.</p>

<h2>Key Changes</h2>
<ul>
  <li>Authentication moved from API keys to OAuth 2.0 bearer tokens</li>
  <li>Pagination changed from offset-based to cursor-based</li>
  <li>Error responses now follow RFC 7807 Problem Details format</li>
  <li>Rate limiting headers added to all responses</li>
</ul>

<!-- Migration Steps Section -->
<h1>Migration Steps</h1>

<h2>Step 1: Update Authentication</h2>
<p>Replace API key authentication with OAuth 2.0 bearer tokens.</p>

<p><strong>Before (v1):</strong></p>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:parameter ac:name="title">API v1 Authentication</ac:parameter>
  <ac:plain-text-body><![CDATA[curl -H "X-API-Key: your-api-key" \
  https://api.example.com/v1/resources]]></ac:plain-text-body>
</ac:structured-macro>

<p><strong>After (v2):</strong></p>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:parameter ac:name="title">API v2 Authentication</ac:parameter>
  <ac:plain-text-body><![CDATA[curl -H "Authorization: Bearer <access_token>" \
  https://api.example.com/v2/resources]]></ac:plain-text-body>
</ac:structured-macro>

<h2>Step 2: Update Pagination</h2>
<p>Replace offset/limit parameters with cursor-based pagination.</p>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:parameter ac:name="title">Cursor-based Pagination Example</ac:parameter>
  <ac:plain-text-body><![CDATA[async function fetchAllResources() {
  let cursor = null;
  const allResults = [];

  do {
    const url = cursor
      ? `https://api.example.com/v2/resources?cursor=${cursor}`
      : 'https://api.example.com/v2/resources';

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    allResults.push(...data.results);
    cursor = data.nextCursor;
  } while (cursor);

  return allResults;
}]]></ac:plain-text-body>
</ac:structured-macro>

<h2>Step 3: Update Error Handling</h2>
<p>Update error parsing to handle the new RFC 7807 Problem Details format.</p>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:parameter ac:name="title">Error Handling v2</ac:parameter>
  <ac:plain-text-body><![CDATA[try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const problem = await response.json();
    // RFC 7807 fields: type, title, status, detail, instance
    console.error(`Error ${problem.status}: ${problem.title}`);
    console.error(`Detail: ${problem.detail}`);
  }
} catch (err) {
  console.error('Network error:', err.message);
}]]></ac:plain-text-body>
</ac:structured-macro>

<!-- Troubleshooting Section -->
<h1>Troubleshooting</h1>
<p>Below are common issues encountered during migration and how to resolve them.</p>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">401 Unauthorized after migration</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Cause:</strong> The OAuth token has expired or the client credentials are incorrect.</p>
    <p><strong>Solution:</strong></p>
    <ul>
      <li>Verify your client ID and client secret are correct</li>
      <li>Ensure your token refresh logic is working properly</li>
      <li>Check that the token scopes include the required permissions</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">Pagination returns duplicate results</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Cause:</strong> Mixing offset-based and cursor-based pagination parameters in the same request.</p>
    <p><strong>Solution:</strong></p>
    <ul>
      <li>Remove all <code>offset</code> and <code>limit</code> query parameters</li>
      <li>Use only the <code>cursor</code> parameter returned in the previous response</li>
      <li>Do not cache or reuse cursors across separate pagination sequences</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">500 Internal Server Error on certain endpoints</ac:parameter>
  <ac:rich-text-body>
    <p><strong>Cause:</strong> Some v2 endpoints require a <code>Content-Type: application/json</code> header even for GET requests if query parameters contain special characters.</p>
    <p><strong>Solution:</strong></p>
    <ul>
      <li>Always include the <code>Content-Type: application/json</code> header</li>
      <li>URL-encode all query parameter values</li>
      <li>If the issue persists, contact the API team with your request ID from the <code>X-Request-Id</code> response header</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Step 2: Write the body to a temporary file

```bash
cat > /tmp/api-migration-guide-body.html << 'HTMLEOF'
<!-- (the full storage format HTML from Step 1 goes here) -->
HTMLEOF
```

### Step 3: Look up the TEAM space to confirm it exists

```bash
curl -s -X GET \
  "https://<instance>.atlassian.net/wiki/api/v2/spaces?keys=TEAM" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected response (extract space `id`):**
```json
{
  "results": [
    {
      "id": "12345678",
      "key": "TEAM",
      "name": "Team Space",
      "type": "global",
      "status": "current"
    }
  ]
}
```

### Step 4: Create the Confluence page via REST API

Using the Confluence REST API v2 to create the page:

```bash
curl -s -X POST \
  "https://<instance>.atlassian.net/wiki/api/v2/pages" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "spaceId": "<SPACE_ID_FROM_STEP_3>",
    "status": "current",
    "title": "API Migration Guide",
    "body": {
      "representation": "storage",
      "value": "<CONTENTS_OF_BODY_FILE>"
    }
  }'
```

Alternatively, if a CLI helper script (e.g., `confluence.mjs`) were available, the command would look like:

```bash
node confluence.mjs create-page \
  --space TEAM \
  --title "API Migration Guide" \
  --body-file /tmp/api-migration-guide-body.html
```

The `--body-file` flag is critical here because:
- The storage format body is too long to safely pass as a `--body` argument on the command line
- Shell escaping of the XHTML/CDATA content would be extremely error-prone
- A file-based approach avoids argument length limits and quoting issues

### Step 5: Verify the page was created

```bash
curl -s -X GET \
  "https://<instance>.atlassian.net/wiki/api/v2/pages/<PAGE_ID>?body-format=storage" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

Verify:
- Title is "API Migration Guide"
- Space is TEAM
- Body contains `ac:structured-macro ac:name="toc"` (table of contents)
- Body contains `ac:structured-macro ac:name="info"` (overview panel)
- Body contains `ac:structured-macro ac:name="code"` (code blocks)
- Body contains `ac:structured-macro ac:name="expand"` (collapsible troubleshooting items)

## Key Confluence Storage Format Knowledge Required

| Macro | Purpose | Key Element |
|---|---|---|
| `toc` | Table of contents | `<ac:structured-macro ac:name="toc">` with level parameters |
| `info` | Info panel (blue) | `<ac:structured-macro ac:name="info">` with `<ac:rich-text-body>` |
| `code` | Code block | `<ac:structured-macro ac:name="code">` with `<ac:plain-text-body><![CDATA[...]]>` |
| `expand` | Expand/collapse | `<ac:structured-macro ac:name="expand">` with `<ac:rich-text-body>` |

Without knowing this storage format schema, an agent would likely attempt to use HTML or Markdown, which would either fail or render incorrectly in Confluence.

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No stored credentials or instance URL | Cannot authenticate to the Confluence API |
| No MCP tool access (Atlassian plugin not loaded) | Cannot use `createConfluencePage` or related tools |
| No Confluence storage format reference | Agent must know XHTML macro syntax from training data -- likely incomplete or incorrect |
| No helper script with `--body-file` support | Must manually construct the full REST API call with the body embedded in JSON |
| No `curl`/`WebFetch` with auth headers | Cannot make raw REST calls |
| XHTML escaping complexity | Storage format body must be valid XHTML embedded inside a JSON string -- double-escaping is extremely error-prone |

## Conclusion

Without an Atlassian skill, MCP plugin, or pre-configured API credentials, this task **cannot be completed programmatically** by the agent. The agent can produce the exact Confluence storage format body and REST API request structure (shown above), but cannot execute them. The primary challenge beyond authentication is that Confluence storage format requires deep knowledge of Atlassian's proprietary XHTML macro schema (`ac:structured-macro`, `ac:rich-text-body`, `ac:plain-text-body`, CDATA blocks) -- this is not standard HTML and is poorly documented. An agent without a skill reference would very likely produce incorrect macro syntax, especially for the `code`, `expand`, and `info` macros.
