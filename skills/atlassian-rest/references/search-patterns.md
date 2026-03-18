# Search Strategy Patterns

## Multi-Source Search Strategy

When searching across Atlassian, query both Jira and Confluence in parallel for comprehensive results.

### Parallel Search Flow

```
1. Parse user query → extract keywords, project hints, date range
2. Execute in parallel:
   a. Jira: POST /search with JQL (text ~ "keyword")
   b. Confluence: GET /content/search?cql=text ~ "keyword"
3. Normalize results into common format
4. Deduplicate and rank
5. Return merged results
```

### Jira Search Request

```json
{
  "jql": "text ~ \"deployment pipeline\" ORDER BY updated DESC",
  "fields": ["summary", "status", "assignee", "updated", "description"],
  "maxResults": 20
}
```

### Confluence Search Request

```
GET /wiki/rest/api/content/search?cql=text ~ "deployment pipeline" AND type = page&limit=20
```

## Result Normalization

Map both sources to a common shape:

| Field | Jira Source | Confluence Source |
|-------|------------|-------------------|
| title | `issue.fields.summary` | `content.title` |
| url | `{domain}/browse/{key}` | `{domain}/wiki{content._links.webui}` |
| type | `issue.fields.issuetype.name` | `content.type` |
| updated | `issue.fields.updated` | `content.version.when` |
| author | `issue.fields.assignee.displayName` | `content.version.by.displayName` |
| excerpt | `issue.fields.description` (truncated) | `content.excerpt` |
| source | `"jira"` | `"confluence"` |

## Relevance Scoring Heuristics

Apply weights to rank combined results:

| Signal | Weight | Logic |
|--------|--------|-------|
| Title match | +3 | Keyword appears in title/summary |
| Exact phrase match | +2 | Full phrase found, not just individual words |
| Recency | +1 to +3 | Updated within 7d (+3), 30d (+2), 90d (+1) |
| Status active | +1 | Jira: not Done; Confluence: current status |
| Author relevance | +1 | Created/assigned to the requesting user |
| Project match | +2 | Matches a specified project/space |

## Search Refinement Techniques

### Narrowing Results

| Technique | JQL | CQL |
|-----------|-----|-----|
| Project scope | `project = PROJ AND text ~ "term"` | `space = PROJ AND text ~ "term"` |
| Date range | `created >= -30d AND text ~ "term"` | `created >= now("-30d") AND text ~ "term"` |
| Type filter | `issuetype = Bug AND text ~ "term"` | `type = page AND text ~ "term"` |
| Status filter | `statusCategory != Done` | N/A |
| Label filter | `labels = api` | `label = "api"` |

### Broadening Results

| Technique | Example |
|-----------|---------|
| Synonyms | Search "auth" AND "authentication" AND "login" |
| Wildcards | JQL: `summary ~ "deploy*"` |
| Remove project scope | Search across all projects |
| Extend date range | Remove date filters |

## Combined Search Patterns

### Find all docs about a feature

```
Jira:  project = PROJ AND text ~ "feature name" AND issuetype IN (Epic, Story)
CQL:   space = PROJ AND text ~ "feature name" AND type = page
```

### Find decision context

```
Jira:  text ~ "decision" AND labels = adr AND project = PROJ
CQL:   label = "adr" AND space = PROJ
CQL:   text ~ "decided" AND ancestor = {decisions-page-id}
```

### Find related work for a bug

```
Jira:  text ~ "error message" OR summary ~ "component name"
CQL:   text ~ "error message" AND type = page
Jira:  issueFunction in linkedIssuesOf("key = BUG-123")  (if ScriptRunner)
```

### Incident investigation

```
Jira:  issuetype IN (Bug, Incident) AND text ~ "service name" AND created >= -7d
CQL:   label = "postmortem" AND text ~ "service name"
```
