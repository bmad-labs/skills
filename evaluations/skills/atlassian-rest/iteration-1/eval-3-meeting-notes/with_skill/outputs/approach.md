# Approach: Capture Tasks from Meeting Notes

## 1. Sub-Skill / Workflow File Loaded

**Primary workflow:** `skills/capture-tasks-from-meeting-notes.md`

This is the dedicated 7-step workflow for parsing meeting notes and creating Jira tasks. It was selected because the user's request exactly matches the trigger: "User provides meeting notes and wants Jira tasks created from action items."

The workflow defines these steps:
1. Receive Input
2. Fetch Notes (if from Confluence -- not needed here, notes were pasted directly)
3. Parse Action Items
4. Resolve Assignees
5. Confirm with User
6. Create Tasks
7. Report Results

---

## 2. How Action Items Were Parsed

### Patterns Applied (from `references/action-item-patterns.md`)

The meeting notes were scanned using these pattern matches:

| Pattern | Match in Notes |
|---------|---------------|
| `ACTION: @name` (High confidence) | "ACTION: @Sarah will investigate the database query optimization for the user search endpoint" |
| `TODO:` (High confidence) | "TODO: Mike to set up monitoring dashboards for API latency by Friday" |
| `{name} volunteered to {action}` (Medium -- ownership pattern) | "Lisa volunteered to write integration tests for the new payment flow" |
| `assign to @name` (High confidence) | "assign to @Mike, high priority" -- the checkout bug fix |

### Priority Indicators Applied

| Keyword Found | Mapped Priority |
|---------------|----------------|
| "high priority" (explicit, on checkout bug) | High |
| "by Friday" (deadline implies importance) | Medium |
| No urgency keywords (Sarah's task) | Medium |
| No urgency keywords (Lisa's task) | Medium |

### Due Date Patterns Applied

| Pattern Found | Parsed Date |
|---------------|-------------|
| "by Friday" (on Mike's monitoring task) | 2026-03-20 (next Friday from March 18) |
| No date (other items) | None |

### Extracted Action Items

| # | Task Description | Assignee | Priority | Due Date | Source Line |
|---|-----------------|----------|----------|----------|-------------|
| 1 | Investigate database query optimization for the user search endpoint | Sarah Chen | Medium | -- | "ACTION: @Sarah will investigate..." |
| 2 | Set up monitoring dashboards for API latency | Mike Rodriguez | Medium | 2026-03-20 (Friday) | "TODO: Mike to set up monitoring dashboards..." |
| 3 | Write integration tests for the new payment flow | Lisa Park | Medium | -- | "Lisa volunteered to write integration tests..." |
| 4 | Fix checkout bug | Mike Rodriguez | High | -- | "prioritize the checkout bug fix - assign to @Mike, high priority" |

---

## 3. Exact Commands for User Lookup and Ticket Creation

### Step 4: Resolve Assignees

Three unique names to resolve. The skill path is `/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest`.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Sarah Chen"
```

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Mike Rodriguez"
```

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Lisa Park"
```

Each command returns an `accountId` (e.g., `5a1234bc56789de0f1234567`). These are mapped as:
- Sarah Chen -> `<sarah_account_id>`
- Mike Rodriguez -> `<mike_account_id>`
- Lisa Park -> `<lisa_account_id>`

### Step 6: Create Tasks

**Ticket 1: Sarah's database investigation**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project PLATFORM \
  --type Task \
  --summary "Investigate database query optimization for user search endpoint" \
  --description "## Context\nAPI performance issues were raised during Sprint Planning (March 18). The user search endpoint has been identified as a target for database query optimization.\n\n## Requirements\n- Profile and analyze current database queries for the user search endpoint\n- Identify slow queries and missing indexes\n- Propose optimization plan\n\n## Acceptance Criteria\n- [ ] Root cause of slow queries identified\n- [ ] Optimization recommendations documented\n- [ ] Performance benchmarks captured (before/after)\n\n## References\n- Source: Sprint Planning meeting notes, March 18" \
  --assignee <sarah_account_id> \
  --priority Medium
```

**Ticket 2: Mike's monitoring dashboards**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project PLATFORM \
  --type Task \
  --summary "Set up monitoring dashboards for API latency" \
  --description "## Context\nSprint Planning (March 18) identified the need for API latency monitoring to support ongoing performance investigations.\n\n## Requirements\n- Create monitoring dashboards covering API latency metrics\n- Include key endpoints (especially user search)\n- Dashboard should be accessible to the team\n\n## Acceptance Criteria\n- [ ] Dashboard created and accessible\n- [ ] API latency metrics visible per endpoint\n- [ ] Alerting thresholds configured for degraded performance\n\n## Due Date\n2026-03-20 (Friday)\n\n## References\n- Source: Sprint Planning meeting notes, March 18" \
  --assignee <mike_account_id> \
  --priority Medium
```

**Ticket 3: Lisa's integration tests**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project PLATFORM \
  --type Task \
  --summary "Write integration tests for new payment flow" \
  --description "## Context\nAs part of the Sprint goal to ship payment v2, integration test coverage for the new payment flow is needed.\n\n## Requirements\n- Write integration tests covering the new payment flow end-to-end\n- Cover happy path and key error scenarios\n- Integrate with CI pipeline\n\n## Acceptance Criteria\n- [ ] Integration tests cover complete payment flow (initiate, process, confirm)\n- [ ] Error scenarios tested (declined card, timeout, duplicate payment)\n- [ ] Tests pass in CI pipeline\n\n## References\n- Source: Sprint Planning meeting notes, March 18" \
  --assignee <lisa_account_id> \
  --priority Medium
```

**Ticket 4: Mike's checkout bug fix (High priority)**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project PLATFORM \
  --type Bug \
  --summary "Fix checkout bug" \
  --description "## Context\nCheckout bug was identified and prioritized during Sprint Planning (March 18). The team agreed this should be high priority.\n\n## Requirements\n- Investigate and fix the checkout bug\n- Verify fix does not regress other checkout scenarios\n\n## Acceptance Criteria\n- [ ] Bug root cause identified\n- [ ] Fix implemented and tested\n- [ ] No regression in existing checkout tests\n\n## References\n- Source: Sprint Planning meeting notes, March 18" \
  --assignee <mike_account_id> \
  --priority High
```

Note: Ticket 4 uses `--type Bug` instead of `Task` because the notes explicitly call it a "bug fix."

---

## 4. What Would Be Presented to the User for Confirmation

Per Step 5 of the workflow, the following confirmation prompt would be shown **before** any tickets are created:

---

> I extracted 4 action items from your Sprint Planning notes. Here is what I plan to create in the **PLATFORM** project:
>
> | # | Type | Summary | Assignee | Priority | Due Date |
> |---|------|---------|----------|----------|----------|
> | 1 | Task | Investigate database query optimization for user search endpoint | Sarah Chen | Medium | -- |
> | 2 | Task | Set up monitoring dashboards for API latency | Mike Rodriguez | Medium | Mar 20 (Fri) |
> | 3 | Task | Write integration tests for new payment flow | Lisa Park | Medium | -- |
> | 4 | Bug | Fix checkout bug | Mike Rodriguez | High | -- |
>
> Before I create these tickets, please:
> - Confirm the list is correct
> - Let me know if any summaries, assignees, priorities, or types should be changed
> - Tell me if any items should be removed or if I missed anything
>
> I will also need to look up each assignee's Jira account ID. Should I proceed?

---

The workflow explicitly states: **"Do not proceed until the user explicitly confirms."** This is a mutating operation (creating issues), which also aligns with the SKILL.md principle: "Confirm before mutating."

---

## 5. Reference Files Consulted

| File | Path | Purpose |
|------|------|---------|
| SKILL.md | `skills/atlassian-rest/SKILL.md` | Master skill instructions, script commands, workflow index, operating principles |
| Capture Tasks Workflow | `skills/atlassian-rest/skills/capture-tasks-from-meeting-notes.md` | Step-by-step workflow for this exact task (7 steps) |
| Action Item Patterns | `skills/atlassian-rest/references/action-item-patterns.md` | Parsing patterns (ACTION, TODO, @name, assigned to), priority keywords, due date patterns |
| Ticket Writing Guide | `skills/atlassian-rest/references/ticket-writing-guide.md` | Summary format (Verb + Object + Context), description structure template, priority guidelines |

The workflow file explicitly lists `references/action-item-patterns.md` and `references/ticket-writing-guide.md` as its reference files. Both were consulted and applied as documented above.
