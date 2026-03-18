# Approach: Create Confluence Page with Rich Content

## Task Summary

Create a Confluence page in the TEAM space titled "API Integration Guide" containing headings, bullet lists, an ordered list, and a Python code block showing a sample API call.

## Skill References Used

- `SKILL.md` -- Confluence operations section (lines 179-227)
- `references/confluence-formatting.md` -- Storage format XHTML for code blocks, lists, headings
- `workflows/create-confluence-document.md` -- Step-by-step workflow for creating pages

## Step-by-Step Approach

### Step 1: Verify Setup

Run the setup script to confirm credentials are configured:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

### Step 2: Verify TEAM Space Exists

List available spaces to confirm TEAM is valid:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs spaces --max 20
```

### Step 3: Build the Storage Format HTML Body

Per the workflow (`create-confluence-document.md` Step 3), the body must be Confluence storage format XHTML. Since the content will exceed ~2000 characters, write it to a temporary file.

The body file `/tmp/confluence-body.html` contains:

```html
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
  <ac:parameter ac:name="minLevel">1</ac:parameter>
</ac:structured-macro>

<h1>API Integration Guide</h1>
<p>This guide covers how to integrate with our REST API, including authentication, making requests, handling responses, and best practices.</p>

<h2>Overview</h2>
<p>Our API provides programmatic access to core platform resources. It follows RESTful conventions and returns JSON responses.</p>
<ul>
  <li>Base URL: <code>https://api.example.com/v2</code></li>
  <li>Authentication: Bearer token via OAuth 2.0</li>
  <li>Rate limit: 1000 requests per minute</li>
  <li>Response format: JSON</li>
</ul>

<h2>Authentication</h2>
<p>All API requests require a valid Bearer token in the Authorization header. To obtain a token:</p>
<ol>
  <li>Register your application in the Developer Portal</li>
  <li>Generate client credentials (client ID and secret)</li>
  <li>Exchange credentials for an access token via the OAuth endpoint</li>
  <li>Include the token in the <code>Authorization</code> header of every request</li>
</ol>

<h2>Making Your First API Call</h2>
<p>Below is a sample Python script that authenticates and fetches a list of projects:</p>

<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">python</ac:parameter>
  <ac:parameter ac:name="title">Sample API Call</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[import requests

API_BASE = "https://api.example.com/v2"
TOKEN = "your-access-token-here"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

# Fetch all projects
response = requests.get(f"{API_BASE}/projects", headers=headers)
response.raise_for_status()

projects = response.json()
for project in projects["data"]:
    print(f"Project: {project['name']} (ID: {project['id']})")]]></ac:plain-text-body>
</ac:structured-macro>

<h2>Error Handling</h2>
<p>The API uses standard HTTP status codes. Common errors to handle:</p>
<ul>
  <li><strong>401 Unauthorized</strong> -- Token is missing, expired, or invalid</li>
  <li><strong>403 Forbidden</strong> -- Insufficient permissions for the requested resource</li>
  <li><strong>404 Not Found</strong> -- The requested resource does not exist</li>
  <li><strong>429 Too Many Requests</strong> -- Rate limit exceeded; back off and retry</li>
  <li><strong>500 Internal Server Error</strong> -- Server-side issue; retry with exponential backoff</li>
</ul>

<h2>Best Practices</h2>
<ul>
  <li>Always validate response status codes before processing the body</li>
  <li>Implement retry logic with exponential backoff for transient errors</li>
  <li>Cache responses where appropriate to reduce API calls</li>
  <li>Use pagination parameters (<code>limit</code> and <code>offset</code>) for large result sets</li>
  <li>Store tokens securely and never commit them to version control</li>
</ul>
```

Write this to a temp file:

```bash
cat > /tmp/confluence-body.html << 'HTMLEOF'
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
  <ac:parameter ac:name="minLevel">1</ac:parameter>
</ac:structured-macro>
<h1>API Integration Guide</h1>
<p>This guide covers how to integrate with our REST API, including authentication, making requests, handling responses, and best practices.</p>
<h2>Overview</h2>
<p>Our API provides programmatic access to core platform resources. It follows RESTful conventions and returns JSON responses.</p>
<ul>
  <li>Base URL: <code>https://api.example.com/v2</code></li>
  <li>Authentication: Bearer token via OAuth 2.0</li>
  <li>Rate limit: 1000 requests per minute</li>
  <li>Response format: JSON</li>
</ul>
<h2>Authentication</h2>
<p>All API requests require a valid Bearer token in the Authorization header. To obtain a token:</p>
<ol>
  <li>Register your application in the Developer Portal</li>
  <li>Generate client credentials (client ID and secret)</li>
  <li>Exchange credentials for an access token via the OAuth endpoint</li>
  <li>Include the token in the <code>Authorization</code> header of every request</li>
</ol>
<h2>Making Your First API Call</h2>
<p>Below is a sample Python script that authenticates and fetches a list of projects:</p>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">python</ac:parameter>
  <ac:parameter ac:name="title">Sample API Call</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[import requests

API_BASE = "https://api.example.com/v2"
TOKEN = "your-access-token-here"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

# Fetch all projects
response = requests.get(f"{API_BASE}/projects", headers=headers)
response.raise_for_status()

projects = response.json()
for project in projects["data"]:
    print(f"Project: {project['name']} (ID: {project['id']})")]]></ac:plain-text-body>
</ac:structured-macro>
<h2>Error Handling</h2>
<p>The API uses standard HTTP status codes. Common errors to handle:</p>
<ul>
  <li><strong>401 Unauthorized</strong> -- Token is missing, expired, or invalid</li>
  <li><strong>403 Forbidden</strong> -- Insufficient permissions for the requested resource</li>
  <li><strong>404 Not Found</strong> -- The requested resource does not exist</li>
  <li><strong>429 Too Many Requests</strong> -- Rate limit exceeded; back off and retry</li>
  <li><strong>500 Internal Server Error</strong> -- Server-side issue; retry with exponential backoff</li>
</ul>
<h2>Best Practices</h2>
<ul>
  <li>Always validate response status codes before processing the body</li>
  <li>Implement retry logic with exponential backoff for transient errors</li>
  <li>Cache responses where appropriate to reduce API calls</li>
  <li>Use pagination parameters (<code>limit</code> and <code>offset</code>) for large result sets</li>
  <li>Store tokens securely and never commit them to version control</li>
</ul>
HTMLEOF
```

### Step 4: Create the Page Using --body-file

Per the SKILL.md and workflow, use `--body-file` for content exceeding shell argument limits:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs create-page \
  --space TEAM \
  --title "API Integration Guide" \
  --body-file /tmp/confluence-body.html
```

This command:
- Creates a page in the TEAM space
- Sets the title to "API Integration Guide"
- Reads the storage format XHTML from `/tmp/confluence-body.html`
- The body starts with `<` so the script treats it as raw HTML storage format (not plain text)

### Step 5: Verify the Page

After creation, retrieve the page to confirm it rendered correctly:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs get-page <pageId> --format storage
```

Replace `<pageId>` with the ID returned from the create command.

Report the page URL from the `_links.webui` field in the response.

## Content Structure Summary

The page contains:

| Element | Type | Location |
|---------|------|----------|
| Table of Contents | `toc` macro | Top of page |
| "API Integration Guide" | `<h1>` heading | After TOC |
| "Overview" | `<h2>` heading | Section 1 |
| API details | `<ul>` bullet list (4 items) | Under Overview |
| "Authentication" | `<h2>` heading | Section 2 |
| Token steps | `<ol>` ordered list (4 items) | Under Authentication |
| "Making Your First API Call" | `<h2>` heading | Section 3 |
| Python sample | `code` macro (language=python) | Under API Call section |
| "Error Handling" | `<h2>` heading | Section 4 |
| HTTP errors | `<ul>` bullet list (5 items) | Under Error Handling |
| "Best Practices" | `<h2>` heading | Section 5 |
| Recommendations | `<ul>` bullet list (5 items) | Under Best Practices |

## Key Decisions

1. **Used `--body-file` instead of `--body`**: The storage format HTML is ~2500+ characters, exceeding the practical limit for inline `--body` shell arguments. The workflow explicitly recommends `--body-file` for content over ~2000 characters.

2. **Used Confluence storage format XHTML, not Markdown**: The `--body` flag accepts raw HTML when content starts with `<`. The skill does not convert Markdown to Confluence storage format -- the body must be constructed as valid XHTML with Confluence-specific macros (e.g., `ac:structured-macro` for code blocks, `ac:parameter` for language).

3. **Used `ac:structured-macro` for the code block**: Per `references/confluence-formatting.md`, code blocks use the `code` macro with `language`, `title`, and `linenumbers` parameters, and the code itself is wrapped in `<ac:plain-text-body><![CDATA[...]]></ac:plain-text-body>`.

4. **Included a TOC macro**: The document has 5+ sections, so per the workflow (Step 3.1) and formatting reference, a TOC macro is added at the top.

5. **Confirmed before mutating**: Per SKILL.md principle #2, the agent should show the user the planned page structure and get confirmation before running the create command.
