# Approach: Extract Action Items from Meeting Notes and Create Jira Tickets

## Skill Used

The `atlassian-rest` skill, specifically the **Capture Tasks from Meeting Notes** workflow (`workflows/capture-tasks-from-meeting-notes.md`), with supporting references `references/action-item-patterns.md` and `references/ticket-writing-guide.md`.

## Step-by-Step Approach

### Step 1: Verify Setup

Run the setup script to confirm Atlassian credentials are configured:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

This checks that `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_DOMAIN` (wnesolutions.atlassian.net) are set.

### Step 2: Confirm Project and Issue Types

Verify the DO project exists and determine available issue types:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs projects
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs issue-types DO
```

This confirms the project key DO is valid and that "Task" is an available issue type.

### Step 3: Parse Action Items from Meeting Notes

Following the workflow's Step 3 and the patterns from `references/action-item-patterns.md`, scan the raw meeting notes for action items:

**Raw notes:**
```
Sprint Planning - March 18, 2026
- Sarah will finalize the payment integration by Friday
- Mike needs to fix the flaky CI pipeline tests
- Lisa volunteered to write the API documentation for v2
- We agreed someone needs to update the deployment runbook (unassigned)
- John: investigate the memory leak in the worker service
```

**Extraction using pattern matching:**

| # | Raw Text | Pattern Matched | Assignee | Summary | Priority | Due Date |
|---|----------|-----------------|----------|---------|----------|----------|
| 1 | "Sarah will finalize the payment integration by Friday" | `{name} will {action}` + `by {date}` | Sarah | Finalize payment integration | Medium | 2026-03-20 (Friday) |
| 2 | "Mike needs to fix the flaky CI pipeline tests" | `{name} needs to {action}` | Mike | Fix flaky CI pipeline tests | Medium | - |
| 3 | "Lisa volunteered to write the API documentation for v2" | `{name} volunteered to {action}` (ownership pattern) | Lisa | Write API documentation for v2 | Medium | - |
| 4 | "We agreed someone needs to update the deployment runbook (unassigned)" | `needs to {action}` + explicit "(unassigned)" | Unassigned | Update deployment runbook | Medium | - |
| 5 | "John: investigate the memory leak in the worker service" | `{name}: {action}` (implicit ownership) | John | Investigate memory leak in worker service | Medium | - |

**Priority reasoning:** No urgency keywords (urgent, critical, ASAP, blocker) were found in any item, so all default to Medium per the action-item-patterns reference.

**Due date reasoning:** Only item 1 has a date indicator ("by Friday"). Given the meeting date of March 18, 2026 (Wednesday), "Friday" resolves to 2026-03-20.

### Step 4: Resolve Assignees

For each unique assignee name, look up their Jira account ID:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Sarah"
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Mike"
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Lisa"
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "John"
```

Each call returns an `accountId` (e.g., `5f1234abcdef567890`). If any lookup fails or returns multiple matches, flag it for the user to resolve before proceeding.

Item 4 is explicitly unassigned, so no lookup is needed -- the `--assignee` flag will be omitted.

### Step 5: Present Confirmation Table to User

Per the workflow, present extracted tasks and wait for explicit user confirmation before creating anything:

| # | Assignee | Summary | Priority | Due Date |
|---|----------|---------|----------|----------|
| 1 | Sarah | Finalize payment integration | Medium | 2026-03-20 |
| 2 | Mike | Fix flaky CI pipeline tests | Medium | - |
| 3 | Lisa | Write API documentation for v2 | Medium | - |
| 4 | Unassigned | Update deployment runbook | Medium | - |
| 5 | John | Investigate memory leak in worker service | Medium | - |

Ask user to confirm, edit, remove, or add items. Do **not** proceed until explicit confirmation.

### Step 6: Create Jira Issues

After user confirmation, create each task. Descriptions follow the ticket-writing-guide structure (Context, Requirements, Acceptance Criteria):

**Task 1: Sarah -- Finalize payment integration**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Task \
  --summary "Finalize payment integration" \
  --description "## Context\nAction item from Sprint Planning meeting on March 18, 2026.\n\n## Requirements\n- Complete and finalize the payment integration\n\n## Acceptance Criteria\n- [ ] Payment integration is complete and tested\n- [ ] Code reviewed and merged\n\n## Due Date\n2026-03-20 (Friday)" \
  --assignee <sarah-account-id> \
  --priority Medium
```

**Task 2: Mike -- Fix flaky CI pipeline tests**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Task \
  --summary "Fix flaky CI pipeline tests" \
  --description "## Context\nAction item from Sprint Planning meeting on March 18, 2026.\n\n## Requirements\n- Identify and fix the root cause of flaky tests in the CI pipeline\n\n## Acceptance Criteria\n- [ ] Flaky tests identified and fixed\n- [ ] CI pipeline runs green consistently" \
  --assignee <mike-account-id> \
  --priority Medium
```

**Task 3: Lisa -- Write API documentation for v2**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Task \
  --summary "Write API documentation for v2" \
  --description "## Context\nAction item from Sprint Planning meeting on March 18, 2026.\n\n## Requirements\n- Write comprehensive API documentation for the v2 endpoints\n\n## Acceptance Criteria\n- [ ] All v2 API endpoints are documented\n- [ ] Documentation reviewed by the team" \
  --assignee <lisa-account-id> \
  --priority Medium
```

**Task 4: Unassigned -- Update deployment runbook**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Task \
  --summary "Update deployment runbook" \
  --description "## Context\nAction item from Sprint Planning meeting on March 18, 2026.\nNote: This task is currently unassigned -- needs an owner.\n\n## Requirements\n- Update the deployment runbook with current procedures\n\n## Acceptance Criteria\n- [ ] Deployment runbook reflects current deployment process\n- [ ] Reviewed and approved by the team" \
  --priority Medium
```

**Task 5: John -- Investigate memory leak in worker service**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Task \
  --summary "Investigate memory leak in worker service" \
  --description "## Context\nAction item from Sprint Planning meeting on March 18, 2026.\n\n## Requirements\n- Investigate the root cause of the memory leak in the worker service\n- Document findings and propose a fix\n\n## Acceptance Criteria\n- [ ] Root cause of the memory leak identified\n- [ ] Findings documented\n- [ ] Fix proposed or implemented" \
  --assignee <john-account-id> \
  --priority Medium
```

### Step 7: Report Results

After all tickets are created, present a summary table with the returned issue keys:

| Issue Key | Summary | Assignee | Link |
|-----------|---------|----------|------|
| DO-XX | Finalize payment integration | Sarah | https://wnesolutions.atlassian.net/browse/DO-XX |
| DO-XX | Fix flaky CI pipeline tests | Mike | https://wnesolutions.atlassian.net/browse/DO-XX |
| DO-XX | Write API documentation for v2 | Lisa | https://wnesolutions.atlassian.net/browse/DO-XX |
| DO-XX | Update deployment runbook | Unassigned | https://wnesolutions.atlassian.net/browse/DO-XX |
| DO-XX | Investigate memory leak in worker service | John | https://wnesolutions.atlassian.net/browse/DO-XX |

Report any failures (unresolved assignees, API errors) and suggest next steps such as assigning the unassigned task or adjusting priorities.

## Key Workflow Principles Applied

1. **Used the workflow file** (`workflows/capture-tasks-from-meeting-notes.md`) to follow the 7-step structured process.
2. **Consulted reference docs**: `action-item-patterns.md` for extraction patterns and priority/date mapping; `ticket-writing-guide.md` for summary format (Verb + Object + Context) and description structure.
3. **Resolved ambiguity first**: Verified project and issue types before creating anything.
4. **Confirmed before mutating**: Presented the full task table and required explicit user confirmation before creating any tickets.
5. **Composed operations naturally**: Combined `lookup-user` calls to resolve names to account IDs, then fed those into `create` commands.
6. **Wrote quality descriptions**: Each ticket has Context, Requirements, and Acceptance Criteria sections per the ticket-writing-guide.
