# Approach: Create Epic with 3 Child Stories in ENG Project

## Reference Files Consulted

- `SKILL.md` — Command syntax for `jira.mjs create`, `jira.mjs lookup-user`, `--parent` flag, `--priority` flag, `--assignee` flag
- `references/ticket-writing-guide.md` — Summary format (Verb + Object + Context), description structure (Context, Requirements, Acceptance Criteria, Technical Notes), priority guidelines (Medium = feature degraded or workaround exists, next 1-2 sprints)
- `references/epic-templates.md` — Epic description structure (Goal, Scope, Out of Scope, Success Criteria, Dependencies, Risks), story-level acceptance criteria patterns

---

## Step 1: Confirmation Plan Shown to User

Before executing any mutating operations, present the following plan to the user for approval (per SKILL.md: "Confirm before mutating"):

> **Plan: Create Epic + 3 Stories in ENG**
>
> 1. **Epic:** "Q2 Performance Initiative" in project ENG
>    - Type: Epic
>    - Priority: Medium
>    - Description: Covers Q2 performance improvements across database, caching, and monitoring
>
> 2. **Story 1:** "Optimize database query response times"
>    - Parent: the newly created Epic
>    - Priority: Medium
>    - Assignee: john.doe@company.com (will look up account ID first)
>
> 3. **Story 2:** "Implement Redis caching layer for API"
>    - Parent: the newly created Epic
>    - Priority: Medium
>
> 4. **Story 3:** "Set up performance monitoring dashboards"
>    - Parent: the newly created Epic
>    - Priority: Medium
>
> Shall I proceed?

---

## Step 2: Create the Epic (Capture Key)

```bash
node <skill-path>/scripts/jira.mjs create \
  --project ENG \
  --type Epic \
  --summary "Q2 Performance Initiative" \
  --description "## Goal\nImprove system performance across database queries, API response times, and observability to meet Q2 targets.\n\n## Scope\n- Optimize slow database queries and reduce average response times\n- Implement a Redis caching layer for frequently accessed API endpoints\n- Set up performance monitoring dashboards for ongoing visibility\n\n## Out of Scope\n- Infrastructure migration or cloud provider changes\n- Frontend performance optimizations (separate initiative)\n\n## Success Criteria\n- [ ] Average database query response time reduced by 40%\n- [ ] API cache hit rate exceeds 80% for eligible endpoints\n- [ ] Performance dashboards operational with real-time alerting\n\n## Dependencies\n- DevOps team for Redis infrastructure provisioning\n- Access to production-like performance testing environment\n\n## Risks\n- Cache invalidation complexity may require additional stories\n- Query optimization may surface schema issues requiring migration" \
  --priority Medium
```

**Expected output:** Issue key, e.g., `ENG-201`. This key is captured and used as `--parent` for all child stories.

---

## Step 3: User Lookup for john.doe@company.com

```bash
node <skill-path>/scripts/jira.mjs lookup-user "john.doe@company.com"
```

**Expected output:** Account ID, e.g., `5a1234bc567890abcdef1234`. This is required because the `--assignee` flag accepts an account ID, not an email address.

---

## Step 4: Create Story 1 — Optimize Database Query Response Times

```bash
node <skill-path>/scripts/jira.mjs create \
  --project ENG \
  --type Story \
  --summary "Optimize database query response times" \
  --description "## Context\nPart of the Q2 Performance Initiative (ENG-201). Several critical database queries have been identified as bottlenecks contributing to slow API response times.\n\n## Requirements\n- Profile and identify the top 10 slowest database queries in production\n- Add missing indexes based on query execution plans\n- Refactor N+1 query patterns to use batch fetching\n- Implement query result pagination where applicable\n\n## Acceptance Criteria\n- [ ] Top 10 slowest queries identified and documented\n- [ ] Average query response time reduced by 40% for identified queries\n- [ ] No N+1 query patterns remain in critical code paths\n- [ ] Query execution plans reviewed and indexes added where beneficial\n- [ ] Load test confirms improvements under production-like traffic\n\n## Technical Notes\nUse database slow query logs and APM tooling to identify bottlenecks. Consider read replicas for heavy reporting queries." \
  --priority Medium \
  --assignee <accountId-from-step-3> \
  --parent ENG-201
```

---

## Step 5: Create Story 2 — Implement Redis Caching Layer for API

```bash
node <skill-path>/scripts/jira.mjs create \
  --project ENG \
  --type Story \
  --summary "Implement Redis caching layer for API" \
  --description "## Context\nPart of the Q2 Performance Initiative (ENG-201). Frequently accessed API endpoints return data that changes infrequently, making them strong candidates for caching.\n\n## Requirements\n- Provision Redis instance for the application environment\n- Implement a caching middleware layer for eligible API endpoints\n- Define TTL strategies per resource type (e.g., user profiles: 5 min, config: 15 min)\n- Implement cache invalidation on write operations\n- Add cache hit/miss metrics to monitoring\n\n## Acceptance Criteria\n- [ ] Redis caching integrated for at least 5 high-traffic API endpoints\n- [ ] Cache hit rate exceeds 80% for eligible endpoints\n- [ ] Cache invalidation correctly triggers on data mutations\n- [ ] API response times for cached endpoints reduced by 60%+\n- [ ] Cache metrics (hit rate, latency, evictions) visible in monitoring\n\n## Technical Notes\nCoordinate with DevOps for Redis provisioning. Use a cache-aside pattern. Consider Redis Cluster for high availability." \
  --priority Medium \
  --parent ENG-201
```

---

## Step 6: Create Story 3 — Set Up Performance Monitoring Dashboards

```bash
node <skill-path>/scripts/jira.mjs create \
  --project ENG \
  --type Story \
  --summary "Set up performance monitoring dashboards" \
  --description "## Context\nPart of the Q2 Performance Initiative (ENG-201). The team currently lacks centralized visibility into system performance metrics, making it difficult to detect regressions and validate improvements.\n\n## Requirements\n- Create dashboards covering API response times, database query latency, cache performance, and error rates\n- Set up alerting thresholds for P95 response time and error rate spikes\n- Include historical trend views for before/after comparison\n- Ensure dashboards are accessible to the full engineering team\n\n## Acceptance Criteria\n- [ ] Dashboard displays real-time API response time percentiles (P50, P95, P99)\n- [ ] Database query latency metrics visible with per-query breakdown\n- [ ] Cache hit rate and eviction rate charts operational\n- [ ] Alerts trigger when P95 response time exceeds defined thresholds\n- [ ] Historical data retained for at least 30 days for trend analysis\n\n## Technical Notes\nEvaluate existing tooling (Grafana, Datadog, etc.) before introducing new tools. Ensure instrumentation covers both application and infrastructure layers." \
  --priority Medium \
  --parent ENG-201
```

---

## Summary of Description Quality

| Issue | Summary Pattern | Description Sections | Quality Notes |
|-------|----------------|---------------------|---------------|
| Epic | Noun phrase (initiative name) | Goal, Scope, Out of Scope, Success Criteria, Dependencies, Risks | Follows `epic-templates.md` structure exactly |
| Story 1 | Verb + Object + Context | Context, Requirements, Acceptance Criteria, Technical Notes | 5 measurable acceptance criteria; references parent epic |
| Story 2 | Verb + Object + Context | Context, Requirements, Acceptance Criteria, Technical Notes | 5 acceptance criteria with quantified targets (80%, 60%) |
| Story 3 | Verb + Object + Context | Context, Requirements, Acceptance Criteria, Technical Notes | 5 acceptance criteria; dashboard-specific metrics defined |

All summaries follow the "Verb + Object + Context" pattern from `ticket-writing-guide.md`. All descriptions use the Context / Requirements / Acceptance Criteria / Technical Notes structure. Each story cross-references the parent epic for traceability.

---

## Execution Order

1. Show confirmation plan to user (Step 1) -- **wait for approval**
2. Create Epic (Step 2) -- capture issue key
3. Lookup user `john.doe@company.com` (Step 3) -- capture account ID
4. Create Story 1 with `--parent` and `--assignee` (Step 4)
5. Create Story 2 with `--parent` (Step 5)
6. Create Story 3 with `--parent` (Step 6)
7. Report all created issue keys to user

Steps 2 and 3 could run in parallel since they are independent. Steps 4-6 depend on both Step 2 (for the parent key) and Step 3 (for the assignee account ID on Story 1).
