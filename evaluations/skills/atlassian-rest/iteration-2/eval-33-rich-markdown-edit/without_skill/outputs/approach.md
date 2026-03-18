# Approach: Update Jira Issue Description with Rich Markdown Content (Without Skill)

## Task

Update the description of issue DO-100 in the DO project at `https://wnesolutions.atlassian.net` with rich content including: a heading "## Release Notes", bold and italic text, a bullet list of 3 items, a table with columns Feature/Status/Owner, and a JavaScript code block.

## What Is Needed

Without a dedicated Atlassian skill or helper scripts, there is no automated way for the agent to interact with the Jira API. The task requires:

1. **Authentication** -- An Atlassian API token or OAuth credentials for the Jira cloud instance at `https://wnesolutions.atlassian.net`.
2. **ADF (Atlassian Document Format) knowledge** -- Jira Cloud REST API v3 does NOT accept Markdown for the `description` field. It requires Atlassian Document Format (ADF), a proprietary JSON-based document schema. Every piece of rich formatting (headings, bold, italic, lists, tables, code blocks) must be expressed as nested ADF nodes.
3. **Issue existence** -- Issue DO-100 must exist and the authenticated user must have edit permissions.

## Critical Complexity: Markdown to ADF Conversion

The core challenge of this task is that Jira REST API v3 does **not** support Markdown in the description field. The "rich markdown content" requested must be manually translated into Atlassian Document Format (ADF) -- a deeply nested JSON structure. Each formatting element maps to specific ADF node types:

| Markdown Element | ADF Node Type | ADF Mark/Attribute |
|---|---|---|
| `## Heading` | `heading` with `attrs.level: 2` | -- |
| `**bold**` | `text` | `marks: [{ type: "strong" }]` |
| `*italic*` | `text` | `marks: [{ type: "em" }]` |
| `- bullet item` | `bulletList` > `listItem` > `paragraph` | -- |
| Table | `table` > `tableRow` > `tableHeader` / `tableCell` | -- |
| `` ```js `` code block | `codeBlock` with `attrs.language: "javascript"` | -- |

## Detailed Step-by-Step Approach

### Step 1: Fetch the current issue to confirm it exists

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-100" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

Verify the issue exists and note its current description (if any) to understand whether this is a full replacement or an append.

### Step 2: Construct the ADF description body

The full ADF JSON for the requested rich content:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [
        { "type": "text", "text": "Release Notes" }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "This release includes ",
          "marks": []
        },
        {
          "type": "text",
          "text": "critical improvements",
          "marks": [{ "type": "strong" }]
        },
        {
          "type": "text",
          "text": " and "
        },
        {
          "type": "text",
          "text": "performance optimizations",
          "marks": [{ "type": "em" }]
        },
        {
          "type": "text",
          "text": " across the platform."
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                { "type": "text", "text": "Upgraded authentication module to support OAuth 2.0" }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                { "type": "text", "text": "Fixed memory leak in session management service" }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                { "type": "text", "text": "Added retry logic for transient API failures" }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "table",
      "attrs": {
        "isNumberColumnEnabled": false,
        "layout": "default"
      },
      "content": [
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableHeader",
              "attrs": {},
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    { "type": "text", "text": "Feature", "marks": [{ "type": "strong" }] }
                  ]
                }
              ]
            },
            {
              "type": "tableHeader",
              "attrs": {},
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    { "type": "text", "text": "Status", "marks": [{ "type": "strong" }] }
                  ]
                }
              ]
            },
            {
              "type": "tableHeader",
              "attrs": {},
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    { "type": "text", "text": "Owner", "marks": [{ "type": "strong" }] }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "OAuth 2.0 Support" }] }
              ]
            },
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Complete" }] }
              ]
            },
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Alice" }] }
              ]
            }
          ]
        },
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Memory Leak Fix" }] }
              ]
            },
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "In Progress" }] }
              ]
            },
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Bob" }] }
              ]
            }
          ]
        },
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Retry Logic" }] }
              ]
            },
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Planned" }] }
              ]
            },
            {
              "type": "tableCell",
              "attrs": {},
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Charlie" }] }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "codeBlock",
      "attrs": {
        "language": "javascript"
      },
      "content": [
        {
          "type": "text",
          "text": "async function fetchWithRetry(url, options, maxRetries = 3) {\n  for (let attempt = 1; attempt <= maxRetries; attempt++) {\n    try {\n      const response = await fetch(url, options);\n      if (response.ok) return response;\n      if (response.status >= 500 && attempt < maxRetries) {\n        await new Promise(r => setTimeout(r, 1000 * attempt));\n        continue;\n      }\n      throw new Error(`HTTP ${response.status}: ${response.statusText}`);\n    } catch (err) {\n      if (attempt === maxRetries) throw err;\n      await new Promise(r => setTimeout(r, 1000 * attempt));\n    }\n  }\n}"
        }
      ]
    }
  ]
}
```

### Step 3: Update the issue description via PUT

```bash
curl -s -X PUT \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-100" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "fields": {
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        ... (the full ADF JSON from Step 2)
      ]
    }
  }
}'
```

A successful update returns HTTP `204 No Content` with no response body.

### Step 4: Verify the update

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-100?fields=description" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

Verify the response contains:
- A `heading` node with level 2 and text "Release Notes"
- `text` nodes with `strong` marks (bold) and `em` marks (italic)
- A `bulletList` node with 3 `listItem` children
- A `table` node with a header row (Feature, Status, Owner) and 3 data rows
- A `codeBlock` node with `language: "javascript"` containing the retry function

## Key ADF Challenges Without a Skill

| Challenge | Detail |
|---|---|
| No Markdown-to-ADF conversion | Jira v3 API requires ADF, not Markdown. The agent must manually construct the JSON tree |
| Deeply nested JSON structure | A simple table with 3 columns and 4 rows requires ~80 lines of JSON. The full description is 200+ lines of ADF |
| Table structure complexity | ADF tables require `table` > `tableRow` > `tableHeader`/`tableCell` > `paragraph` > `text` -- 5 levels of nesting for each cell |
| Code block syntax | ADF code blocks use `codeBlock` with `attrs.language`, not fenced markdown syntax |
| Text mark composition | Bold-italic text requires `marks: [{ type: "strong" }, { type: "em" }]` on the same text node |
| No validation feedback | If the ADF structure is invalid, the API returns a generic 400 error with minimal detail about which node is malformed |

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No stored credentials or instance URL | Cannot authenticate to the Jira API at all |
| No MCP tool access (Atlassian plugin not loaded) | Cannot use `editJiraIssue`, `getJiraIssue`, etc. |
| No Markdown-to-ADF library or helper script | Must manually construct ~200 lines of nested ADF JSON by hand |
| No `curl`/`WebFetch` with auth headers | Cannot make raw REST calls |
| No ADF schema validation | Agent must know the exact ADF node schema from training data -- easy to get wrong for tables and marks |
| Shell escaping of large JSON | Passing 200+ lines of nested JSON as a curl `-d` argument is fragile and error-prone |

## Conclusion

Without an Atlassian skill, MCP plugin, or pre-configured API credentials, this task **cannot be completed programmatically** by the agent. The agent can produce the exact ADF payload and REST API request structure (shown above) that a human or CI pipeline would need to execute. The primary challenge beyond authentication is the Markdown-to-ADF translation: the Jira REST API v3 does not accept Markdown, so every formatting element must be expressed as deeply nested ADF JSON nodes. This is particularly complex for tables (5 levels of nesting per cell) and code blocks (special `codeBlock` node type with language attributes). An agent without a skill or helper library would need to construct this entire JSON structure manually, which is highly error-prone.
