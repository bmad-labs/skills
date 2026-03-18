# Meeting Notes Action Item Parsing Patterns

## Action Item Indicators

Scan for these patterns in meeting notes text:

| Pattern | Confidence | Example |
|---------|------------|---------|
| `ACTION:` | High | "ACTION: John to update the API docs" |
| `@name will` | High | "@Sarah will schedule the review" |
| `TODO:` | High | "TODO: migrate the database" |
| `- [ ]` | High | "- [ ] Deploy to staging" |
| `assigned to @name` | High | "Fix login bug, assigned to @Mike" |
| `AI:` or `A/I:` | High | "AI: Team to review proposal" |
| `needs to` | Medium | "John needs to fix the tests" |
| `should` | Medium | "We should update the runbook" |
| `take ownership` | Medium | "Lisa will take ownership of..." |
| `follow up on` | Medium | "Follow up on the vendor contract" |
| `by [date]` | Medium | "Complete review by Friday" |

## Name Extraction Patterns

```
@{name} will {action}
ACTION: {name} to {action}
{action}, assigned to {name}
{name} needs to {action}
{name} is responsible for {action}
{name} agreed to {action}
Owner: {name}
```

## Priority Indicators

| Keyword | Suggested Priority |
|---------|-------------------|
| urgent, critical, ASAP, blocker | Highest / High |
| important, soon, this week | High / Medium |
| should, nice to have, eventually | Medium / Low |
| when possible, backlog, stretch | Low / Lowest |

## Due Date Patterns

| Pattern | Parse As |
|---------|----------|
| `by Friday`, `by end of week` | Next Friday |
| `by EOD`, `by end of day` | Today |
| `next week` | Next Monday |
| `by [date]` | Specific date |
| `this sprint` | Sprint end date |
| `before release` | Release date |
| `ASAP` | Today |

## Example: Raw Meeting Notes

```
Sprint Planning - March 15

Discussed the auth module refactor.
ACTION: @john to create the design doc by Friday
@sarah will handle the database migration this sprint
TODO: Update API documentation for v3 endpoints
- [ ] Deploy feature flags to staging (assigned to @mike)
We need to follow up on the performance issues - Lisa agreed to investigate

The login bug is critical - @john needs to fix by EOD
Nice to have: update the dashboard charts (@sarah)
```

## Example: Extracted Items

| Summary | Assignee | Priority | Due |
|---------|----------|----------|-----|
| Create auth module design doc | john | Medium | Friday |
| Handle database migration | sarah | Medium | Sprint end |
| Update API documentation for v3 endpoints | Unassigned | Medium | - |
| Deploy feature flags to staging | mike | Medium | - |
| Investigate performance issues | lisa | Medium | - |
| Fix login bug | john | High | Today |
| Update dashboard charts | sarah | Low | - |

## Mapping to Jira Fields

| Extracted | Jira Field | Notes |
|-----------|-----------|-------|
| Summary | `summary` | Verb + object, max 80 chars |
| Assignee | `assignee.accountId` | Resolve name to accountId via user search |
| Priority | `priority.name` | Map keywords to Jira priority levels |
| Due date | `duedate` | Format as `YYYY-MM-DD` |
| Source | `description` | Link back to meeting notes |
