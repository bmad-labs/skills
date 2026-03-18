# Ticket Writing Best Practices

## Summary Patterns

Use the format: **Verb + Object + Context**

| Good | Bad |
|------|-----|
| Add password reset email template | Password stuff |
| Fix login timeout on slow connections | Login broken |
| Update user search to support wildcards | Search changes |
| Remove deprecated v1 API endpoints | Clean up |
| Migrate user table to new schema | Database work |

**Rules:**
- Start with a verb: Add, Fix, Update, Remove, Implement, Migrate, Refactor
- Keep under 80 characters
- Be specific enough to understand without reading description
- Include the component or area if not obvious from the project

## Description Structure

```
## Context
Why does this work need to happen? Link to epic, design doc, or customer request.

## Requirements
- {Specific requirement 1}
- {Specific requirement 2}
- {Specific requirement 3}

## Acceptance Criteria
- [ ] {Testable criterion 1}
- [ ] {Testable criterion 2}
- [ ] {Testable criterion 3}

## Technical Notes
Implementation hints, constraints, or relevant architecture decisions.
Not required for every ticket.

## References
- [Design doc](link)
- [Related ticket](PROJ-123)
```

## Priority Assignment Guidelines

| Priority | When to Use | Response Time |
|----------|------------|---------------|
| Highest | Production down, data loss, security breach | Immediate |
| High | Feature broken for many users, no workaround | This sprint |
| Medium | Feature degraded, workaround exists | Next 1-2 sprints |
| Low | Minor issue, cosmetic, nice-to-have | Backlog |
| Lowest | Trivial, polish, far-future ideas | When convenient |

## Label Conventions

| Category | Labels | Purpose |
|----------|--------|---------|
| Type | `tech-debt`, `refactor`, `spike` | Work classification |
| Area | `frontend`, `backend`, `infra`, `mobile` | Component area |
| Urgency | `urgent`, `quick-win` | Triage signals |
| Process | `needs-design`, `needs-review`, `blocked` | Workflow state |
| Source | `customer-reported`, `internal`, `automated` | Origin tracking |

## Component Conventions

Use components to map to code ownership:

- Name after service/module: `auth-service`, `payment-api`, `dashboard-ui`
- Assign default component leads for auto-routing
- Keep the list maintained; remove unused components quarterly

## Good vs Bad Ticket Examples

### Bad Ticket

> **Summary:** Fix the thing
>
> **Description:** It's broken. Please fix.
>
> **Priority:** High

Problems: vague summary, no reproduction steps, no acceptance criteria, unjustified priority.

### Good Ticket

> **Summary:** Fix CSV export truncating rows beyond 10,000
>
> **Description:**
>
> ## Context
> Customers with large datasets report that CSV exports from the Reports page
> are limited to 10,000 rows. The export should include all matching rows.
> Reported by: Acme Corp (Enterprise tier).
>
> ## Requirements
> - CSV export must handle up to 100,000 rows
> - Use streaming response to avoid memory issues
> - Show progress indicator for exports over 5,000 rows
>
> ## Acceptance Criteria
> - [ ] Export 50,000 rows successfully with correct data
> - [ ] Memory usage stays below 512MB during export
> - [ ] Progress bar shows percentage during large exports
> - [ ] Export completes within 30 seconds for 50k rows
>
> ## Technical Notes
> Current implementation loads all rows into memory before writing CSV.
> Switch to streaming with cursor-based pagination.
> See `ReportExporter.java` line 142.
>
> **Priority:** High (Enterprise customer, revenue impact)
> **Labels:** `backend`, `customer-reported`
> **Components:** `reporting-service`

## Estimation Tips

- If you cannot describe the work in acceptance criteria, it needs a spike first
- If a ticket has more than 5 acceptance criteria, consider splitting
- If the description exceeds one screen, extract details into linked docs
- Every ticket should be completable by one person in one sprint
