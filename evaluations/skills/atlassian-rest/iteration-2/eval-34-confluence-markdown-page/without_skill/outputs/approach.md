# Approach: Create Confluence Page with Markdown Content (Without Skill)

## Task Summary

Create a Confluence page in the TEAM space titled "API Integration Guide" with headings, bullet lists, an ordered list, and a Python code block showing a sample API call. The content should be authored in markdown and converted to Confluence storage format.

## Intended Markdown Content

The page body would be written in markdown like this:

```markdown
# API Integration Guide

## Overview

This guide covers how to integrate with our REST API, including authentication, making requests, and handling responses.

## Prerequisites

- A valid API key (generate one from Settings > API Keys)
- Python 3.8 or later installed
- The `requests` library (`pip install requests`)

## Authentication

All API requests require a Bearer token in the Authorization header. Tokens expire after 24 hours.

### Getting a Token

1. Navigate to your account settings
2. Click "Generate API Key"
3. Copy the key and store it securely
4. Use the key in the Authorization header for all requests

## Sample API Call

```python
import requests

BASE_URL = "https://api.example.com/v2"
API_KEY = "your-api-key-here"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# Fetch a list of resources
response = requests.get(f"{BASE_URL}/resources", headers=headers)
response.raise_for_status()

data = response.json()
for item in data["results"]:
    print(f"ID: {item['id']}, Name: {item['name']}")
```

## Error Handling

Common error codes returned by the API:

- **400 Bad Request** -- malformed request body or missing required fields
- **401 Unauthorized** -- invalid or expired API key
- **404 Not Found** -- the requested resource does not exist
- **429 Too Many Requests** -- rate limit exceeded; retry after the period in the `Retry-After` header
- **500 Internal Server Error** -- unexpected server-side failure; contact support

## Next Steps

- Review the full API reference documentation
- Set up webhook integrations for real-time event notifications
- Configure rate limit handling in your client library
```

## What the Skill Would Do: Markdown-to-Storage Conversion

The key capability provided by the atlassian-rest skill is the `confluence.mjs` helper script backed by the `confluence-format.mjs` module. This module uses the **`marked` library** to parse markdown and a custom renderer to convert markdown elements into Confluence storage format (XHTML with `ac:` namespaced macros).

Specifically, the `markdownToStorage()` function in `confluence-format.mjs`:

1. **Code blocks** (```` ```python ... ``` ````) are converted to Confluence code macros:
   ```html
   <ac:structured-macro ac:name="code">
     <ac:parameter ac:name="language">python</ac:parameter>
     <ac:plain-text-body><![CDATA[import requests
   ...code here...]]></ac:plain-text-body>
   </ac:structured-macro>
   ```

2. **Headings** (`# H1`, `## H2`, etc.) are converted to `<h1>`, `<h2>`, etc.

3. **Bullet lists** (`- item`) are converted to `<ul><li>item</li></ul>`

4. **Ordered lists** (`1. item`) are converted to `<ol><li>item</li></ol>`

5. **Inline formatting** (`**bold**`, `*italic*`, `` `code` ``) is converted to `<strong>`, `<em>`, `<code>` respectively.

The `marked` library handles all the parsing -- the skill does not use a custom markdown parser. It only customizes the renderer for Confluence-specific output (primarily the code block macro).

## Expected Command (With Skill)

With the skill available, the agent would run:

```bash
node confluence.mjs create-page \
  --space TEAM \
  --title "API Integration Guide" \
  --body "# API Integration Guide

## Overview
This guide covers how to integrate with our REST API...
(full markdown content here)
"
```

Or using `--body-file` to avoid shell escaping issues:

```bash
cat > /tmp/api-integration-guide.md << 'EOF'
# API Integration Guide
...
(full markdown content)
EOF

node confluence.mjs create-page \
  --space TEAM \
  --title "API Integration Guide" \
  --body-file /tmp/api-integration-guide.md
```

The script would:
1. Detect that `--body` content is markdown (does not start with `<`)
2. Call `markdownToStorage()` to convert markdown to Confluence storage format using `marked`
3. Look up the TEAM space ID via `GET /wiki/api/v2/spaces?keys=TEAM`
4. Create the page via `POST /wiki/api/v2/pages` with the converted storage format body

## What Would Need to Happen Without the Skill

### Step 1: Manually Convert Markdown to Confluence Storage Format

Without the `marked`-based conversion in `confluence-format.mjs`, the agent would need to manually author the full Confluence storage format XHTML. This is the expected output of the conversion:

```html
<h1>API Integration Guide</h1>

<h2>Overview</h2>
<p>This guide covers how to integrate with our REST API, including authentication, making requests, and handling responses.</p>

<h2>Prerequisites</h2>
<ul>
  <li>A valid API key (generate one from Settings &gt; API Keys)</li>
  <li>Python 3.8 or later installed</li>
  <li>The <code>requests</code> library (<code>pip install requests</code>)</li>
</ul>

<h2>Authentication</h2>
<p>All API requests require a Bearer token in the Authorization header. Tokens expire after 24 hours.</p>

<h3>Getting a Token</h3>
<ol>
  <li>Navigate to your account settings</li>
  <li>Click &quot;Generate API Key&quot;</li>
  <li>Copy the key and store it securely</li>
  <li>Use the key in the Authorization header for all requests</li>
</ol>

<h2>Sample API Call</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">python</ac:parameter>
  <ac:plain-text-body><![CDATA[import requests

BASE_URL = "https://api.example.com/v2"
API_KEY = "your-api-key-here"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# Fetch a list of resources
response = requests.get(f"{BASE_URL}/resources", headers=headers)
response.raise_for_status()

data = response.json()
for item in data["results"]:
    print(f"ID: {item['id']}, Name: {item['name']}")]]></ac:plain-text-body>
</ac:structured-macro>

<h2>Error Handling</h2>
<p>Common error codes returned by the API:</p>
<ul>
  <li><strong>400 Bad Request</strong> -- malformed request body or missing required fields</li>
  <li><strong>401 Unauthorized</strong> -- invalid or expired API key</li>
  <li><strong>404 Not Found</strong> -- the requested resource does not exist</li>
  <li><strong>429 Too Many Requests</strong> -- rate limit exceeded; retry after the period in the <code>Retry-After</code> header</li>
  <li><strong>500 Internal Server Error</strong> -- unexpected server-side failure; contact support</li>
</ul>

<h2>Next Steps</h2>
<ul>
  <li>Review the full API reference documentation</li>
  <li>Set up webhook integrations for real-time event notifications</li>
  <li>Configure rate limit handling in your client library</li>
</ul>
```

### Step 2: Look Up the TEAM Space ID

```bash
curl -s -X GET \
  "https://<instance>.atlassian.net/wiki/api/v2/spaces?keys=TEAM" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

### Step 3: Create the Page via REST API

```bash
curl -s -X POST \
  "https://<instance>.atlassian.net/wiki/api/v2/pages" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "spaceId": "<SPACE_ID>",
    "status": "current",
    "title": "API Integration Guide",
    "body": {
      "representation": "storage",
      "value": "<FULL_STORAGE_FORMAT_HTML>"
    }
  }'
```

### Step 4: Verify the Page

```bash
curl -s -X GET \
  "https://<instance>.atlassian.net/wiki/api/v2/pages/<PAGE_ID>?body-format=storage" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>"
```

Verify:
- Title is "API Integration Guide"
- Space is TEAM
- Body contains `<ac:structured-macro ac:name="code">` with `<ac:parameter ac:name="language">python</ac:parameter>`
- Body contains `<h1>` through `<h3>` headings
- Body contains `<ul><li>` bullet lists
- Body contains `<ol><li>` ordered list
- The Python code is inside `<![CDATA[...]]>`

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No `confluence.mjs` script | Cannot run `create-page --space TEAM --body <markdown>` |
| No `marked` library or `markdownToStorage()` | Must manually convert markdown to Confluence storage format XHTML -- extremely error-prone |
| No stored credentials or instance URL | Cannot authenticate to the Confluence REST API |
| No MCP Atlassian plugin | Cannot use `createConfluencePage` tool |
| Code block conversion is non-trivial | Must know the exact `ac:structured-macro` / `ac:plain-text-body` / `CDATA` syntax for code macros -- standard HTML `<pre><code>` would not render correctly in Confluence |
| Ordered vs unordered list distinction | Must manually ensure `1.` items become `<ol>` while `-` items become `<ul>` -- `marked` handles this automatically |
| XHTML escaping inside JSON | The storage format body must be valid XHTML embedded in a JSON string, requiring double-escaping of quotes, ampersands, etc. |

## What the Atlassian MCP Plugin Would Alternatively Provide

If the Atlassian MCP tools were available (without the full skill), the workflow would be:

1. **`getConfluenceSpaces`** -- Verify the TEAM space exists and get its space ID.
2. **`createConfluencePage`** -- Create the page with the storage format body.
3. **`getConfluencePage`** -- Verify creation and retrieve the URL.

However, the MCP plugin alone does **not** provide markdown-to-storage conversion. The agent would still need to manually author the Confluence storage format XHTML. The skill's `confluence-format.mjs` module with its `marked`-based `markdownToStorage()` function is the critical differentiator -- it lets the agent write natural markdown and have it automatically converted to proper Confluence XHTML with code macros.

## Conclusion

This task **cannot be completed** without authenticated access to the Confluence API and ideally the `confluence.mjs` helper script. The core challenge is twofold:

1. **Authentication** -- No API credentials are available to make REST calls.
2. **Markdown-to-Confluence conversion** -- Without the `marked`-based `markdownToStorage()` function from `confluence-format.mjs`, the agent must manually craft Confluence storage format XHTML, correctly mapping Python code blocks to `ac:structured-macro` code macros with the `python` language parameter, headings to `<h1>`-`<h6>`, bullet lists to `<ul><li>`, and ordered lists to `<ol><li>`. This manual conversion is error-prone and defeats the purpose of being able to author content in markdown.

The skill's approach of accepting markdown in `--body` and using `marked` for automatic conversion is significantly more reliable and ergonomic than manual storage format authoring.
