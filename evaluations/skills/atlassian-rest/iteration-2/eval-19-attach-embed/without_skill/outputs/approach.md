# Approach: Upload and Embed Architecture Diagram on Confluence Page (Without Skill)

## Task

Upload the architecture diagram at `./docs/arch-diagram.png` to Confluence page 54321, then update the page body to embed the image at 600px width, centered.

## Outcome

**I cannot complete this task.** Without a configured Atlassian skill, MCP plugin, or stored API credentials, there is no way to authenticate with the Confluence instance to upload the attachment or update the page.

## Detailed Step-by-Step Approach

### Step 1: Upload the Attachment to Confluence Page 54321

The Confluence REST API endpoint for adding an attachment to a page is:

```
POST /wiki/rest/api/content/54321/child/attachment
```

The request must use `multipart/form-data` to upload the binary file:

```bash
curl -s -X POST \
  "https://<INSTANCE>.atlassian.net/wiki/rest/api/content/54321/child/attachment" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "X-Atlassian-Token: nocheck" \
  -F "file=@./docs/arch-diagram.png" \
  -F "comment=Architecture diagram upload"
```

**Key notes:**
- The `X-Atlassian-Token: nocheck` header is required to bypass Confluence's XSRF token check for attachment uploads.
- The `Content-Type` header should NOT be set manually -- `curl` will set it to `multipart/form-data` with the correct boundary automatically when using `-F`.
- If the attachment already exists, use a PUT to the same endpoint to update it instead.

**Expected response (extract the filename):**

```json
{
  "results": [
    {
      "id": "att12345",
      "type": "attachment",
      "title": "arch-diagram.png",
      "extensions": {
        "mediaType": "image/png",
        "fileSize": 204800
      },
      "_links": {
        "download": "/wiki/download/attachments/54321/arch-diagram.png"
      }
    }
  ]
}
```

Confirm `title` is `arch-diagram.png` -- this is the filename needed for the embed macro in Step 3.

### Step 2: Fetch the Current Page Content

Before updating the page body, retrieve the current page content and version number:

```bash
curl -s -X GET \
  "https://<INSTANCE>.atlassian.net/wiki/rest/api/content/54321?expand=body.storage,version" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected response (key fields):**

```json
{
  "id": "54321",
  "type": "page",
  "title": "Architecture Overview",
  "version": {
    "number": 5
  },
  "body": {
    "storage": {
      "value": "<p>Existing page content here...</p>",
      "representation": "storage"
    }
  }
}
```

Save two things:
- **`version.number`** -- required for the update call (must be incremented by 1).
- **`body.storage.value`** -- the existing page content to which the image embed will be appended.

### Step 3: Update the Page Body with the Embedded Image

Construct the `ac:image` macro in Confluence storage format to embed the uploaded attachment at 600px width, centered:

```xml
<p style="text-align: center;">
  <ac:image ac:align="center" ac:width="600">
    <ri:attachment ri:filename="arch-diagram.png" />
  </ac:image>
</p>
```

**Macro breakdown:**
- `ac:image` -- the Confluence image macro
- `ac:align="center"` -- centers the image horizontally
- `ac:width="600"` -- sets the display width to 600 pixels
- `ri:attachment ri:filename="arch-diagram.png"` -- references the attachment uploaded in Step 1 by its exact filename

Append this to the existing page body and issue the update:

```bash
curl -s -X PUT \
  "https://<INSTANCE>.atlassian.net/wiki/rest/api/content/54321" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "id": "54321",
  "type": "page",
  "title": "Architecture Overview",
  "version": {
    "number": 6
  },
  "body": {
    "storage": {
      "value": "<EXISTING_BODY_CONTENT><p style=\"text-align: center;\"><ac:image ac:align=\"center\" ac:width=\"600\"><ri:attachment ri:filename=\"arch-diagram.png\" /></ac:image></p>",
      "representation": "storage"
    }
  }
}'
```

**Important details:**
- The `version.number` must be the current version + 1 (in this example, 5 + 1 = 6).
- The `title` field must match the existing page title exactly, or the page will be renamed.
- The existing body content (`<EXISTING_BODY_CONTENT>`) must be preserved -- only append the new image macro.

### Step 4: Verify the Update

Fetch the page again to confirm the image is embedded:

```bash
curl -s -X GET \
  "https://<INSTANCE>.atlassian.net/wiki/rest/api/content/54321?expand=body.storage" \
  -H "Authorization: Basic <BASE64_EMAIL:API_TOKEN>" \
  -H "Content-Type: application/json"
```

Verify:
- The `body.storage.value` contains the `ac:image` macro
- The `ri:filename` is `arch-diagram.png`
- The `ac:width` is `600`
- The `ac:align` is `center`

## Barriers Without a Skill

| Barrier | Impact |
|---------|--------|
| No stored credentials or instance URL | Cannot authenticate to the Confluence API |
| No MCP tool access (Atlassian plugin not loaded) | Cannot use `createConfluencePage`, `updateConfluencePage`, `getConfluencePage`, or attachment tools |
| Multipart file upload required | Even with credentials, uploading binary files via `curl` requires careful handling of multipart boundaries |
| Page version tracking required | Must fetch current version before updating to avoid conflicts |
| Storage format XML knowledge needed | The `ac:image` and `ri:attachment` macros use Confluence-specific XML namespaces that are not standard HTML |

## Conclusion

Without an Atlassian skill, MCP plugin, or pre-configured API credentials, this task **cannot be completed programmatically** by the agent. The task involves two distinct API operations -- a multipart file upload (attachment) followed by a page content update with Confluence storage format XML -- both requiring authenticated access. The complete API request payloads, including the correct `ac:image` macro structure with `ac:align="center"` and `ac:width="600"` referencing `ri:attachment ri:filename="arch-diagram.png"`, are documented above for manual execution.
