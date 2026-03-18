# Task Breakdown Examples

## Feature to Epic to Stories

### Example: User Notification Preferences

**Epic:** Enable user notification preferences

**Stories:**

| # | Summary | Type | Points | Dependencies |
|---|---------|------|--------|--------------|
| 1 | Design notification preferences data model | Spike | 2 | - |
| 2 | Create notification_preferences DB table and migration | Task | 3 | 1 |
| 3 | Build preferences API endpoints (GET/PUT) | Story | 5 | 2 |
| 4 | Add notification preferences UI page | Story | 5 | 3 |
| 5 | Integrate email service with preference checks | Story | 3 | 3 |
| 6 | Integrate push service with preference checks | Story | 3 | 3 |
| 7 | Add preference checks to in-app notifications | Story | 2 | 3 |
| 8 | Write E2E tests for notification preferences | Task | 3 | 4,5,6,7 |
| 9 | Update user onboarding to set default preferences | Story | 2 | 3 |

**Total:** 28 points across ~3 sprints

---

## API Endpoint Breakdown

### Example: POST /api/v2/reports/export

| # | Summary | Type | Points |
|---|---------|------|--------|
| 1 | Define export API contract and OpenAPI spec | Task | 2 |
| 2 | Implement export endpoint with streaming response | Story | 5 |
| 3 | Add input validation and error handling | Task | 2 |
| 4 | Add rate limiting for export endpoint | Task | 2 |
| 5 | Write unit tests for export logic | Task | 3 |
| 6 | Write integration tests for export endpoint | Task | 3 |
| 7 | Update API documentation | Task | 1 |
| 8 | Add monitoring and alerts for export failures | Task | 2 |

---

## UI Feature Breakdown

### Example: Dashboard Analytics Widget

| # | Summary | Type | Points |
|---|---------|------|--------|
| 1 | Create AnalyticsWidget component skeleton | Story | 2 |
| 2 | Implement chart data fetching and state management | Story | 3 |
| 3 | Build line chart visualization with D3 | Story | 5 |
| 4 | Add date range picker and filter controls | Story | 3 |
| 5 | Implement loading and error states | Task | 2 |
| 6 | Add responsive layout and mobile support | Task | 3 |
| 7 | Write component unit tests | Task | 3 |
| 8 | Write Cypress E2E tests for widget interactions | Task | 3 |
| 9 | Accessibility audit and fixes | Task | 2 |

---

## Migration Task Breakdown

### Example: Migrate from PostgreSQL 12 to 15

| # | Summary | Type | Points |
|---|---------|------|--------|
| 1 | Audit current DB usage and identify incompatibilities | Spike | 3 |
| 2 | Set up PG15 in staging environment | Task | 2 |
| 3 | Run full test suite against PG15 staging | Task | 3 |
| 4 | Fix identified query incompatibilities | Bug | 5 |
| 5 | Performance benchmark: PG12 vs PG15 on staging | Task | 3 |
| 6 | Create migration runbook and rollback plan | Task | 3 |
| 7 | Execute migration on staging, run smoke tests | Task | 2 |
| 8 | Schedule and execute production migration | Task | 3 |
| 9 | Monitor production for 1 week post-migration | Task | 1 |
| 10 | Decommission PG12 instances | Task | 1 |

---

## Breakdown Principles

| Principle | Guideline |
|-----------|-----------|
| **Independence** | Each story should be deployable on its own when possible |
| **Testability** | Every story has clear acceptance criteria |
| **Size** | No story exceeds 8 points; split larger items |
| **Vertical slicing** | Prefer thin end-to-end slices over horizontal layers |
| **Spike first** | Add a spike story when unknowns exceed 30% of effort |
| **Dependencies** | Minimize; sequence dependent stories in the same sprint |

## Estimation Patterns

| Pattern | Points | Rationale |
|---------|--------|-----------|
| CRUD endpoint | 3-5 | Well-understood, templated work |
| New UI component | 3-5 | Design + implement + test |
| Third-party integration | 5-8 | External API unknowns |
| Data migration | 5-8 | Risk of data issues |
| Spike / research | 2-3 | Timeboxed investigation |
| Config / infra change | 1-2 | Low complexity, high caution |
| Bug fix (known cause) | 1-3 | Fix + test + verify |
| Bug fix (unknown cause) | 3-5 | Investigation time |
