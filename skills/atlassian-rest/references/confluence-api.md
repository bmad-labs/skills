# Confluence REST API Quick Reference

## Base URLs

| Version | Base URL | Use For |
|---------|----------|---------|
| V2 | `https://{domain}.atlassian.net/wiki/api/v2` | Pages, spaces, comments |
| V1 | `https://{domain}.atlassian.net/wiki/rest/api` | Search (CQL), content |

## Authentication

Same as Jira: Basic auth with `email:api-token` base64-encoded.

## Key Endpoints

### V2 Endpoints

| Action | Method | Path | Notes |
|--------|--------|------|-------|
| Get page | GET | `/pages/{id}` | `?body-format=storage` for HTML body |
| Create page | POST | `/pages` | Body: `{spaceId, title, body, ...}` |
| Update page | PUT | `/pages/{id}` | Must increment version number |
| Get page children | GET | `/pages/{id}/children` | Paginated |
| Get page descendants | GET | `/pages/{id}/descendants` | Deep children |
| Get footer comments | GET | `/pages/{id}/footer-comments` | Paginated |
| Create footer comment | POST | `/footer-comments` | `{pageId, body}` |
| Create inline comment | POST | `/inline-comments` | `{pageId, body, inlineCommentProperties}` |
| Get spaces | GET | `/spaces` | `?keys=SPACE1,SPACE2` |
| Get pages in space | GET | `/spaces/{id}/pages` | Paginated |

### V1 Endpoints (Search)

| Action | Method | Path | Notes |
|--------|--------|------|-------|
| Search content | GET | `/content/search` | `?cql=...&limit=25` |
| Search site | GET | `/search` | `?cql=...&limit=25` |

### V1 Attachment Endpoints

| Action | Method | Path | Notes |
|--------|--------|------|-------|
| Upload attachment | POST | `/content/{id}/child/attachment` | Multipart form-data, `X-Atlassian-Token: nocheck` required |
| List attachments | GET | `/content/{id}/child/attachment` | `?limit=25` for pagination |
| ~~Delete attachment~~ | — | — | **Restricted.** Use Atlassian web UI to delete attachments |

Upload requires multipart/form-data with a `file` field. Do NOT set `Content-Type` manually — let the HTTP client set the multipart boundary automatically. The `X-Atlassian-Token: nocheck` header is mandatory to bypass XSRF protection.

## Create Page Request

```json
{
  "spaceId": "123456",
  "status": "current",
  "title": "Page Title",
  "parentId": "789",
  "body": {
    "representation": "storage",
    "value": "<p>Page content in storage format</p>"
  }
}
```

## Update Page Request

Version must be incremented from current version:

```json
{
  "id": "page-id",
  "status": "current",
  "title": "Updated Title",
  "body": {
    "representation": "storage",
    "value": "<p>Updated content</p>"
  },
  "version": {
    "number": 3,
    "message": "Updated via API"
  }
}
```

## Storage Format Basics

Confluence uses XHTML-based storage format:

```html
<h1>Heading</h1>
<p>Paragraph with <strong>bold</strong> and <em>italic</em></p>
<ul><li>Bullet item</li></ul>
<ol><li>Numbered item</li></ol>
<table><tbody>
  <tr><th>Header</th></tr>
  <tr><td>Cell</td></tr>
</tbody></table>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">python</ac:parameter>
  <ac:plain-text-body><![CDATA[print("hello")]]></ac:plain-text-body>
</ac:structured-macro>
```

## Status Macros

```html
<ac:structured-macro ac:name="status">
  <ac:parameter ac:name="colour">Green</ac:parameter>
  <ac:parameter ac:name="title">DONE</ac:parameter>
</ac:structured-macro>
```

Colors: `Green`, `Yellow`, `Red`, `Blue`, `Grey`.

## Pagination

All list endpoints return:

```json
{
  "results": [...],
  "_links": {
    "next": "/wiki/api/v2/pages?cursor=..."
  }
}
```

Use the `next` link cursor for pagination. Default limit is 25, max is 250.
