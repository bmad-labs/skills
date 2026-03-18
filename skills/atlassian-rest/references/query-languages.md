# JQL & CQL Syntax Reference

## JQL (Jira Query Language)

### Fields

| Field | Example | Notes |
|-------|---------|-------|
| `project` | `project = PROJ` | Key or name |
| `status` | `status = "In Progress"` | Quote multi-word values |
| `assignee` | `assignee = currentUser()` | accountId or function |
| `reporter` | `reporter = "user@email.com"` | |
| `priority` | `priority = High` | Highest, High, Medium, Low, Lowest |
| `issuetype` | `issuetype = Bug` | Bug, Task, Story, Epic, Sub-task |
| `created` | `created >= -7d` | Relative or absolute dates |
| `updated` | `updated >= "2024-01-01"` | |
| `labels` | `labels = backend` | |
| `sprint` | `sprint in openSprints()` | |
| `fixVersion` | `fixVersion = "1.0"` | |
| `component` | `component = API` | |
| `resolution` | `resolution = Unresolved` | |
| `statusCategory` | `statusCategory = "In Progress"` | To Do, In Progress, Done |
| `text` | `text ~ "search term"` | Full text search |

### Operators

| Operator | Usage | Example |
|----------|-------|---------|
| `=`, `!=` | Exact match | `status = Done` |
| `IN`, `NOT IN` | Set membership | `status IN (Open, "In Progress")` |
| `~`, `!~` | Contains text | `summary ~ "login"` |
| `IS EMPTY` | Field is null | `assignee IS EMPTY` |
| `IS NOT EMPTY` | Field has value | `labels IS NOT EMPTY` |
| `>`, `>=`, `<`, `<=` | Comparison | `created >= -7d` |
| `WAS`, `WAS NOT` | Historical value | `status WAS "In Progress"` |
| `CHANGED` | Field changed | `status CHANGED FROM "Open" TO "Done"` |

### Functions

| Function | Returns |
|----------|---------|
| `currentUser()` | Logged-in user |
| `openSprints()` | Active sprints |
| `closedSprints()` | Completed sprints |
| `startOfDay()`, `endOfDay()` | Day boundaries |
| `startOfWeek()`, `endOfWeek()` | Week boundaries |
| `startOfMonth()`, `endOfMonth()` | Month boundaries |
| `membersOf("group")` | Group members |

### JQL Examples

```
project = PROJ AND status != Done ORDER BY priority DESC
assignee = currentUser() AND resolution = Unresolved
project = PROJ AND sprint in openSprints()
status CHANGED TO "Done" DURING (startOfWeek(), now())
priority = Blocker AND statusCategory != Done
issuetype = Bug AND created >= -7d ORDER BY created DESC
labels IN (urgent, critical) AND assignee IS EMPTY
project IN (PROJ1, PROJ2) AND fixVersion = "2.0"
summary ~ "login" AND issuetype = Bug
assignee WAS currentUser() AND status = Done AND updated >= -30d
status = "In Progress" AND updated < -14d
issuetype = Epic AND statusCategory != Done ORDER BY rank ASC
```

---

## CQL (Confluence Query Language)

### Fields

| Field | Example |
|-------|---------|
| `type` | `type = page` (page, blogpost, comment, attachment) |
| `space` | `space = DEV` |
| `title` | `title = "Meeting Notes"` |
| `text` | `text ~ "search term"` |
| `label` | `label = "architecture"` |
| `ancestor` | `ancestor = 123456` (page ID) |
| `creator` | `creator = "user@email.com"` |
| `contributor` | `contributor = currentUser()` |
| `created` | `created >= "2024-01-01"` |
| `lastmodified` | `lastmodified >= now("-7d")` |

### CQL Examples

```
type = page AND space = DEV AND title ~ "architecture"
text ~ "deployment" AND space IN (DEV, OPS)
label = "meeting-notes" AND created >= now("-30d")
type = page AND ancestor = 123456
creator = currentUser() AND lastmodified >= now("-7d")
type = page AND space = PROJ AND title = "Sprint Review"
label IN ("adr", "decision") AND space = ARCH
text ~ "API endpoint" AND type = page ORDER BY lastmodified DESC
type = page AND space = TEAM AND label = "runbook"
contributor = currentUser() AND type = page AND space = DEV
```
