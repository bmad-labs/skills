# Test Categories by Project Type

Use this as a coverage checklist when planning test cases. For each project type, these are the areas that should be covered. Not every test suite needs all areas — pick what's relevant to the feature being tested.

## API / Backend

| Area | What to Test | Priority |
|------|-------------|----------|
| **Endpoints** | Each HTTP method returns correct status codes and response format | Critical |
| **Authentication** | Requests without auth return 401, invalid auth returns 403, valid auth succeeds | Critical |
| **Authorization (BOLA/IDOR)** | Users can't access other users' resources by manipulating IDs | Critical |
| **Input Validation** | Required fields, field types, max lengths, invalid values return 422. Reject oversized payloads. | High |
| **Error Handling** | Server errors return 500 with structured response, no stack traces leaked, no internal paths exposed | High |
| **Concurrency** | Simultaneous requests don't corrupt data, race conditions on shared resources handled | High |
| **Data Integrity** | Created data is retrievable, updates are applied atomically, deletes are complete and cascading | Critical |
| **Idempotency** | Same request sent twice produces same result (for POST/PUT operations that claim idempotency) | High |
| **Pagination** | List endpoints handle offset/limit, empty results, beyond-range offsets, page_size above max is clamped/rejected | Medium |
| **Rate Limiting** | Rate-limited endpoints return 429 after threshold. Multi-dimensional: per IP, per account, per API key | Medium |
| **Content Negotiation** | Correct content-type headers, accepts JSON/form-data as documented | Medium |
| **CORS / Headers** | Correct CORS headers, cache-control, security headers (X-Frame-Options, CSP) | Medium |
| **Query Parameters** | Filtering, sorting, searching work correctly. SQL injection in query params blocked. | High |
| **Webhook Delivery** | Webhooks fire on correct events, retry on failure, include correct payload and signature | Medium |
| **Versioning** | API version changes don't break existing clients | Medium |

## Frontend / UI

| Area | What to Test | Priority |
|------|-------------|----------|
| **Rendering** | Components render with expected content, empty states handled, loading skeletons shown | Critical |
| **User Interactions** | Clicks, form submissions, navigation, drag-and-drop produce correct behavior | Critical |
| **Responsive** | Layout works at mobile (375px), tablet (768px), desktop (1280px), ultrawide (1920px+) | High |
| **Accessibility** | Keyboard navigation, screen reader labels (aria-label), color contrast (4.5:1), focus management, skip links | High |
| **State Management** | Loading states, error states, empty states, stale data, optimistic updates, cache invalidation | High |
| **Form Validation** | Client-side messages, server error display, required fields, field-level vs form-level errors | High |
| **Navigation** | Routes resolve, back button works, deep links function, protected routes redirect to login | Medium |
| **Cross-Browser** | Chrome, Firefox, Safari, Edge. Prioritize by market share + customer segments. | High |
| **Performance** | Initial load time (LCP < 2.5s), lazy loading, image optimization, bundle size | Medium |
| **Offline / Network** | Graceful degradation on slow/no network, retry failed requests, show offline indicator | Medium |
| **Internationalization** | Text truncation with long translations, RTL layout, date/number formatting | Low |
| **Dark Mode** | Components render correctly in both themes, no invisible text or icons | Low |

## Pipeline / Workflow (ETL, Dream Processing, CI/CD)

| Area | What to Test | Priority |
|------|-------------|----------|
| **Happy Path** | Full pipeline runs end-to-end with valid input, produces expected output | Critical |
| **Error Path** | Each stage fails gracefully — no data loss, correct error status, structured error message | Critical |
| **Partial Completion** | Pipeline stops mid-way, resumes correctly, partial results are valid and marked as such | High |
| **Retry / Idempotency** | Failed stage can be retried without duplicate processing. Same input produces same output on re-run. | Critical |
| **Timeout** | Long-running stages timeout gracefully, don't hang forever, release resources | High |
| **Data Handover** | Output of stage N is valid input for stage N+1, schema is correct, no data truncation | Critical |
| **Skip Conditions** | Pipeline skips stages when preconditions aren't met (e.g., short session skip, empty input) | Medium |
| **Concurrency** | Multiple pipelines don't conflict on shared resources (files, DB rows, temp dirs) | High |
| **Backpressure** | Pipeline handles queue saturation gracefully, doesn't OOM or deadlock | Medium |
| **Telemetry** | Each stage records timing, token usage, tool calls, status, error messages | Medium |
| **Cleanup** | Temp files, workspace directories, lock files removed after completion (success AND failure) | High |
| **Data Validation** | Record counts match between stages, data types preserved, no silent truncation | High |
| **Dependency Management** | Pipeline handles missing dependencies (DB down, API unavailable) with clear error, not crash | High |
| **Scheduling** | Cron-triggered pipelines fire at correct time, don't overlap with previous run | Medium |
| **Rollback** | Failed pipeline can rollback changes, or at minimum doesn't leave partial state that corrupts next run | High |

## AI / LLM Agent

| Area | What to Test | Priority |
|------|-------------|----------|
| **Output Quality** | Agent output matches expected detail level (code refs, reasoning, structure) | Critical |
| **Prompt Compliance** | Agent follows prompt instructions (sections present, format correct, constraints honored) | Critical |
| **Tool Usage** | Agent calls expected tools with correct arguments, in logical order | High |
| **Non-Determinism Handling** | Run 3+ times, average scores to absorb variance. Verify structural compliance, not exact content. | Critical |
| **Token Budget** | Agent stays within token limits, handles UsageLimitExceeded gracefully with partial results | High |
| **Context Injection** | Injected data (MEMORY.md, vault guide, session metadata) is referenced and used by the agent | High |
| **Retry Logic** | Agent retried on missing required output (e.g., context retry, tool call retry) | Medium |
| **Fallback Behavior** | Agent degrades gracefully when external services unavailable (MemU, DB, etc.) | High |
| **Reasoning Quality** | Decisions include "Revisit if:", lessons include "Why this matters:", facts include "Matters because:" | High |
| **Dedup Awareness** | Agent checks existing knowledge before extracting duplicates | Medium |
| **Hallucination** | Agent doesn't fabricate information not present in the source transcript/context | Critical |
| **Faithfulness** | Agent's output is grounded in the provided context, not general knowledge | High |
| **Multi-Turn Consistency** | Agent maintains context across tool calls within a single session | Medium |
| **Output Schema** | Structured output (Pydantic models) validates correctly, no missing required fields | High |
| **History Compaction** | Long sessions compact correctly, recent messages preserved, old tool results summarized | Medium |

## Database / Data Layer

| Area | What to Test | Priority |
|------|-------------|----------|
| **CRUD Operations** | Create, Read, Update, Delete work correctly for each table | Critical |
| **Migrations** | Migrations run cleanly forward AND rollback (reversible) | Critical |
| **Constraints** | Foreign keys, unique constraints, NOT NULL enforced. Violations return clear errors. | High |
| **Indexes** | Queries on indexed columns are fast, composite indexes work as designed | Medium |
| **Transactions** | Multi-step operations are atomic — all succeed or all rollback | High |
| **Concurrent Writes** | Two writers on same row don't corrupt data (optimistic locking, upsert) | High |
| **Data Types** | Timestamps are UTC, strings handle unicode/emoji, JSON fields parse correctly | Medium |
| **Query Performance** | Slow queries identified, N+1 queries avoided, pagination doesn't scan full table | Medium |
| **Backup / Recovery** | Backup exists, can be restored, point-in-time recovery works | Medium |
| **Connection Pooling** | Pool handles high concurrency, connections released after use, no leaks | Medium |

## Security

| Area | What to Test | Priority |
|------|-------------|----------|
| **Injection** | SQL injection, NoSQL injection, command injection blocked on all inputs | Critical |
| **XSS** | Stored and reflected XSS blocked in all user-facing outputs | Critical |
| **CSRF** | State-changing requests require valid CSRF token | High |
| **Path Traversal** | File access restricted to allowed directories, `../` blocked | Critical |
| **Secrets** | No hardcoded API keys, passwords, or tokens in code, logs, or error responses | Critical |
| **TLS** | HTTPS enforced, valid certificates, no mixed content | High |
| **Session Management** | Sessions expire, tokens rotate, logout invalidates all sessions | High |
| **Dependency Vulnerabilities** | No known CVEs in dependencies (check with `npm audit`, `pip audit`, etc.) | High |
| **OWASP Top 10** | Review against current OWASP Top 10 checklist | High |

## Infrastructure / DevOps

| Area | What to Test | Priority |
|------|-------------|----------|
| **Health Checks** | Health endpoint returns 200, includes version, dependency status | Critical |
| **Graceful Degradation** | Service continues when optional dependency is down (MemU, search, cache) | Critical |
| **Recovery** | Service recovers after dependency comes back online without restart | High |
| **Resource Cleanup** | Temp files, DB connections, Redis connections, file handles properly released | High |
| **Configuration** | Environment variables are read correctly, defaults are sane, missing required vars fail fast | High |
| **Docker** | Container starts, health check passes, logs go to stdout, non-root user | Medium |
| **Scheduling** | Cron jobs fire at correct time, don't overlap, handle daylight saving time | Medium |
| **Monitoring** | Structured logs contain required fields (event, level, timestamp), events are traceable by request_id | Medium |
| **Scaling** | Horizontal scaling works, no shared mutable state between instances | Medium |
| **Graceful Shutdown** | SIGTERM triggers cleanup, in-flight requests complete, connections drain | High |

## Coverage Priority Guide

When time is limited, test in this order:

1. **Critical path** — the main user flow must work
2. **Error handling** — failures must be graceful, never crash
3. **Data integrity** — data must not be corrupted or lost
4. **Security** — authentication, authorization, injection prevention
5. **Integration points** — boundaries between systems are where bugs hide
6. **Edge cases** — boundary values, empty inputs, concurrent access
7. **Performance** — only if there are specific requirements or SLAs

## Testing Pyramid

Distribute test effort according to the testing pyramid:

| Level | Proportion | Speed | Scope | Who |
|-------|-----------|-------|-------|-----|
| **Unit** | ~70% | Fast (ms) | Single function/class | Developer |
| **Integration** | ~20% | Medium (s) | Module boundaries, DB, API | Developer + QA |
| **E2E / Manual** | ~10% | Slow (min) | Full user flow, cross-system | QA + Manual |

Manual tests should focus on what automation can't cover: exploratory testing, usability, visual correctness, and complex multi-system flows.

## Risk-Based Test Selection

When you can't test everything, prioritize by risk:

| Factor | Weight | Example |
|--------|--------|---------|
| **Business impact of failure** | High | Payment processing, authentication, data loss |
| **Likelihood of failure** | Medium | Recently changed code, complex logic, external dependencies |
| **User-facing visibility** | Medium | UI bugs vs backend logging bugs |
| **Regulatory/compliance** | High | PII handling, GDPR, SOC2 requirements |
| **Frequency of use** | Medium | Core features used daily vs admin features used monthly |

Score each feature: `Risk = Impact × Likelihood`. Test high-risk features first and most thoroughly.

Sources:
- [Manual Testing Checklist for QA Teams 2026](https://www.testmuai.com/blog/manual-testing-checklist-qa/)
- [20 QA Best Practices | BrowserStack](https://www.browserstack.com/guide/qa-best-practices)
- [Types of Software Testing | BrowserStack](https://www.browserstack.com/guide/types-of-testing)
- [API Security Testing Checklist](https://www.testingxperts.com/blog/api-security-testing/)
- [ETL Testing Best Practices | Datafold](https://www.datafold.com/blog/etl-testing)
- [Testing AI Agents: Non-Deterministic Evaluation | SitePoint](https://www.sitepoint.com/testing-ai-agents-deterministic-evaluation-in-a-non-deterministic-world/)
- [Demystifying Evals for AI Agents | Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [AI Agent Evaluation: Building Reliable Systems | Comet](https://www.comet.com/site/blog/ai-agent-evaluation/)
