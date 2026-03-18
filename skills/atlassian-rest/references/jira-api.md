# Jira REST API v3 Quick Reference

## Base URL

```
https://{domain}.atlassian.net/rest/api/3
```

## Authentication

Basic auth header with `email:api-token` base64-encoded:

```
Authorization: Basic {base64(email:token)}
```

## Key Endpoints

| Action | Method | Path | Notes |
|--------|--------|------|-------|
| Search issues | POST | `/search` | JQL in body `{"jql": "...", "fields": [...]}` |
| Get issue | GET | `/issue/{issueKey}` | `?fields=summary,status,assignee` |
| Create issue | POST | `/issue` | Body: `{fields: {project, issuetype, summary, ...}}` |
| Update issue | PUT | `/issue/{issueKey}` | Body: `{fields: {...}}` or `{update: {...}}` |
| Get transitions | GET | `/issue/{issueKey}/transitions` | Returns available transitions |
| Transition issue | POST | `/issue/{issueKey}/transitions` | Body: `{transition: {id}}` |
| Add comment | POST | `/issue/{issueKey}/comment` | Body in ADF format |
| Get comments | GET | `/issue/{issueKey}/comment` | Paginated |
| Add worklog | POST | `/issue/{issueKey}/worklog` | `{timeSpentSeconds, started}` |
| Get projects | GET | `/project` | `?expand=description` |
| Get issue types | GET | `/issuetype` | Or `/project/{key}/statuses` |
| Create issue link | POST | `/issueLink` | `{type, inwardIssue, outwardIssue}` |
| Search users | GET | `/user/search` | `?query=name` |
| Get myself | GET | `/myself` | Current authenticated user |

## Search Request Shape

```json
{
  "jql": "project = PROJ AND status = 'In Progress'",
  "fields": ["summary", "status", "assignee", "priority", "created"],
  "maxResults": 50,
  "startAt": 0
}
```

## Search Response Shape

```json
{
  "startAt": 0,
  "maxResults": 50,
  "total": 120,
  "issues": [
    {
      "key": "PROJ-123",
      "fields": {
        "summary": "Issue title",
        "status": {"name": "In Progress"},
        "assignee": {"displayName": "John", "accountId": "..."},
        "priority": {"name": "High"}
      }
    }
  ]
}
```

## Create Issue Request

```json
{
  "fields": {
    "project": {"key": "PROJ"},
    "issuetype": {"name": "Task"},
    "summary": "Issue title",
    "description": { "type": "doc", "version": 1, "content": [...] },
    "assignee": {"accountId": "..."},
    "priority": {"name": "High"},
    "labels": ["backend"]
  }
}
```

## Common Query Parameters

| Param | Used On | Description |
|-------|---------|-------------|
| `fields` | GET /issue | Comma-separated field list |
| `expand` | Most endpoints | `changelog`, `renderedFields`, `transitions` |
| `maxResults` | Search/list | Page size (default 50, max 100) |
| `startAt` | Search/list | Pagination offset |

## ADF (Atlassian Document Format) Basics

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "Hello world"}
      ]
    }
  ]
}
```

Node types: `paragraph`, `heading` (attrs.level), `bulletList`, `orderedList`, `listItem`, `codeBlock` (attrs.language), `table`, `tableRow`, `tableHeader`, `tableCell`, `mention` (attrs.id).
