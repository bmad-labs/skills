# Approach: Create a Markdown-Formatted Jira Comment (Without Skill)

## Task

Add a comment to issue DO-123 at `https://wnesolutions.atlassian.net` that includes bold text, a bullet list, and an inline code snippet -- all rendered with proper formatting in Jira.

## What Is Needed

Without a dedicated Atlassian skill or helper scripts (such as `jira.mjs` with marklassian for automatic markdown-to-ADF conversion), the agent must:

1. **Authentication** -- An Atlassian API token or OAuth credentials for `https://wnesolutions.atlassian.net`.
2. **ADF knowledge** -- Jira Cloud REST API v3 requires comments in Atlassian Document Format (ADF), not raw markdown. The agent must manually construct the ADF JSON structure for bold text, bullet lists, and inline code.
3. **Issue existence** -- Issue DO-123 must exist and be accessible to the authenticated user.

## Key Challenge: Markdown to ADF Conversion

Jira Cloud REST API v3 does **not** accept raw markdown in comment bodies. All rich text must be expressed in Atlassian Document Format (ADF), a structured JSON format. Without a skill that provides marklassian (a markdown-to-ADF converter), the agent must hand-craft the ADF JSON, which is verbose and error-prone.

The required formatting elements map to ADF as follows:

| Markdown | ADF Representation |
|---|---|
| `**bold text**` | `{ "type": "text", "text": "bold text", "marks": [{ "type": "strong" }] }` |
| `- bullet item` | `{ "type": "bulletList", "content": [{ "type": "listItem", ... }] }` |
| `` `code snippet` `` | `{ "type": "text", "text": "code snippet", "marks": [{ "type": "code" }] }` |

## Detailed Step-by-Step Approach

### Step 1: Construct the ADF Comment Body

Build the ADF JSON document that includes all three formatting elements:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Analysis Summary",
          "marks": [{ "type": "strong" }]
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Key findings from the investigation:"
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
                { "type": "text", "text": "Root cause identified in the authentication module" }
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
                { "type": "text", "text": "Performance regression introduced in release v2.4.1" }
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
                { "type": "text", "text": "Affected endpoint: " },
                {
                  "type": "text",
                  "text": "/api/v1/login",
                  "marks": [{ "type": "code" }]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "The fix has been applied in the hotfix branch. Please review and merge."
        }
      ]
    }
  ]
}
```

### Step 2: Send the Comment via the Jira REST API

```bash
curl -s -X POST \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-123/comment" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Analysis Summary",
              "marks": [{ "type": "strong" }]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Key findings from the investigation:"
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
                    { "type": "text", "text": "Root cause identified in the authentication module" }
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
                    { "type": "text", "text": "Performance regression introduced in release v2.4.1" }
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
                    { "type": "text", "text": "Affected endpoint: " },
                    {
                      "type": "text",
                      "text": "/api/v1/login",
                      "marks": [{ "type": "code" }]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "The fix has been applied in the hotfix branch. Please review and merge."
            }
          ]
        }
      ]
    }
  }'
```

### Step 3: Verify the Comment Was Created

Check the response for the comment ID and self URL:

```json
{
  "id": "10500",
  "self": "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-123/comment/10500",
  "body": { ... },
  "created": "2026-03-18T10:00:00.000+0000"
}
```

Then fetch the issue comments to confirm it rendered correctly:

```bash
curl -s -X GET \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-123/comment" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

Verify the latest comment contains the expected ADF structure with strong marks, bulletList nodes, and code marks.

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No stored credentials or instance URL | Cannot authenticate to the Jira API |
| No MCP tool access (Atlassian plugin not loaded) | Cannot use `addCommentToJiraIssue` or any helper tool |
| No marklassian / markdown-to-ADF converter | Must manually construct verbose ADF JSON instead of writing simple markdown |
| ADF is complex and error-prone | A simple 4-line markdown comment becomes ~70 lines of nested JSON; easy to make structural mistakes |
| No `curl`/`WebFetch` with auth headers | Cannot make raw REST calls from the agent environment |

## What a Skill Would Provide

With the atlassian-rest skill and its `jira.mjs` helper script:

1. **Automatic markdown-to-ADF conversion** via marklassian -- the agent would simply write:
   ```
   **Analysis Summary**

   Key findings from the investigation:
   - Root cause identified in the authentication module
   - Performance regression introduced in release v2.4.1
   - Affected endpoint: `/api/v1/login`

   The fix has been applied in the hotfix branch. Please review and merge.
   ```
   And marklassian would convert it to valid ADF automatically.

2. **Single command execution** -- e.g., `node jira.mjs comment DO-123 "<markdown body>"` handles auth, ADF conversion, and API call in one step.

3. **Pre-configured authentication** -- credentials are already set up in the environment.

## Conclusion

Without an Atlassian skill, MCP plugin, or pre-configured API credentials, this task **cannot be completed programmatically** by the agent. The agent can produce the exact API request payload (shown above) with correctly structured ADF JSON that includes bold text (`strong` marks), a bullet list (`bulletList` with `listItem` nodes), and inline code (`code` marks). However, executing that request requires valid credentials and network access to the Jira instance. The manual ADF construction is particularly burdensome compared to the simple markdown that a skill with marklassian would accept.
