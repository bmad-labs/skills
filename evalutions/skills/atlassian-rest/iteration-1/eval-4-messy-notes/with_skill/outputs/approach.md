# Approach: Capture Tasks from Messy Meeting Notes

## 1. Sub-Skill Loaded

**Workflow:** `skills/capture-tasks-from-meeting-notes.md` (Capture Tasks from Meeting Notes)

This workflow was selected because the user provided raw meeting notes and wants Jira tasks created. The SKILL.md routes to this sub-skill for any request that involves "capturing tasks from meeting notes."

**Reference files consulted:**
- `references/action-item-patterns.md` -- for extraction patterns, priority indicators, and name extraction rules
- `references/ticket-writing-guide.md` -- for summary format (Verb + Object + Context), description structure, and priority assignment guidelines

---

## 2. Parsing Each Action Item

**Input text (messy notes):**
```
Product Review Q1
Sarah mentioned she'll handle the PRD for mobile push notifications
John: needs to fix the flaky test suite - been blocking CI for 2 days now
Also someone should update the API docs but nobody volunteered
Mike said he'd look into the Stripe webhook failures over the weekend
```

### Parsing logic per line:

**Line: "Sarah mentioned she'll handle the PRD for mobile push notifications"**
- Pattern matched: `{name} ... she'll handle {action}` -- ownership phrase (Medium confidence, similar to "{name} agreed to {action}")
- Assignee: **Sarah**
- Task: Write PRD for mobile push notifications
- Priority hints: None explicit -> **Medium**
- Due date: None

**Line: "John: needs to fix the flaky test suite - been blocking CI for 2 days now"**
- Pattern matched: `{name} needs to {action}` (Medium confidence from action-item-patterns.md)
- Priority keyword: "blocking" maps to **High** (blocker-adjacent language per priority indicators table)
- Assignee: **John**
- Task: Fix flaky test suite blocking CI
- Due date: Implied urgency ("2 days now") but no explicit date

**Line: "Also someone should update the API docs but nobody volunteered"**
- Pattern matched: `should` (Medium confidence from action-item-patterns.md)
- Assignee: **Unassigned** -- "someone" and "nobody volunteered" indicate no owner
- Task: Update API documentation
- Priority hints: "should" -> **Medium / Low**
- Due date: None

**Line: "Mike said he'd look into the Stripe webhook failures over the weekend"**
- Pattern matched: `{name} said he'd {action}` -- ownership phrase (similar to "{name} agreed to {action}")
- Assignee: **Mike**
- Task: Investigate Stripe webhook failures
- Priority hints: None explicit -> **Medium**
- Due date: "over the weekend" -- not a hard deadline, note in description

---

## 3. Handling the Unassigned Item

The action item "update the API docs" has no assignee ("someone should... nobody volunteered").

Per the workflow (Step 5: Confirm with User), unassigned items are presented in the confirmation table with "Unassigned" in the Assignee column. The user is asked to:
- Assign someone to it, OR
- Remove it from the list if it should not become a ticket, OR
- Leave it unassigned (the `--assignee` flag is simply omitted from the create command)

The `--assignee` parameter is optional in the `jira.mjs create` command, so the ticket can be created without one. The ticket would appear in the backlog unassigned for the team to claim.

---

## 4. Exact Commands

### Step 4a: Resolve Assignees (user lookups)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Sarah"
```

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "John"
```

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Mike"
```

These return account IDs (e.g., `5a1234abc567def890123456`). If any lookup fails or returns multiple matches, flag it for the user to resolve.

### Step 6: Create Tasks (after user confirmation)

Assuming resolved account IDs: Sarah=`<sarahAccountId>`, John=`<johnAccountId>`, Mike=`<mikeAccountId>`

**Ticket 1: Sarah's PRD task**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project ENG \
  --type Task \
  --summary "Write PRD for mobile push notifications" \
  --description "## Context\nAction item from Product Review Q1 meeting.\n\nSarah mentioned she will handle writing the PRD for mobile push notifications.\n\n## Requirements\n- Draft PRD covering mobile push notification feature\n- Include scope, user stories, and success metrics\n\n## Acceptance Criteria\n- [ ] PRD document created and shared with team\n- [ ] Stakeholder review completed" \
  --assignee <sarahAccountId> \
  --priority Medium
```

**Ticket 2: John's CI fix**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project ENG \
  --type Task \
  --summary "Fix flaky test suite blocking CI pipeline" \
  --description "## Context\nAction item from Product Review Q1 meeting.\n\nThe flaky test suite has been blocking CI for 2 days. John needs to fix it.\n\n## Requirements\n- Identify and fix flaky tests causing CI failures\n- Ensure CI pipeline runs green consistently\n\n## Acceptance Criteria\n- [ ] Flaky tests identified and fixed or quarantined\n- [ ] CI pipeline passes reliably on main branch\n- [ ] No test failures unrelated to code changes" \
  --assignee <johnAccountId> \
  --priority High
```

**Ticket 3: Unassigned API docs update**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project ENG \
  --type Task \
  --summary "Update API documentation" \
  --description "## Context\nAction item from Product Review Q1 meeting.\n\nIt was noted that the API docs need updating, but no one volunteered to take this on.\n\n## Requirements\n- Review current API documentation for accuracy\n- Update endpoints, request/response schemas as needed\n\n## Acceptance Criteria\n- [ ] API docs reflect current API behavior\n- [ ] Reviewed by at least one team member" \
  --priority Low
```
Note: No `--assignee` flag -- ticket is created unassigned.

**Ticket 4: Mike's webhook investigation**
```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project ENG \
  --type Task \
  --summary "Investigate Stripe webhook failures" \
  --description "## Context\nAction item from Product Review Q1 meeting.\n\nMike said he would look into the Stripe webhook failures over the weekend.\n\n## Requirements\n- Investigate root cause of Stripe webhook failures\n- Determine if data was lost or if webhooks can be replayed\n- Propose a fix or workaround\n\n## Acceptance Criteria\n- [ ] Root cause identified and documented\n- [ ] Fix or remediation plan proposed\n- [ ] Stripe webhooks processing successfully" \
  --assignee <mikeAccountId> \
  --priority Medium
```

---

## 5. Confirmation Shown to User (Step 5 of Workflow)

Before creating any tickets, present this table and wait for explicit approval:

```
I extracted 4 action items from the Product Review Q1 meeting notes.
Here is what I plan to create in the ENG project:

| # | Summary                                  | Assignee   | Priority | Due Date |
|---|------------------------------------------|------------|----------|----------|
| 1 | Write PRD for mobile push notifications  | Sarah      | Medium   | -        |
| 2 | Fix flaky test suite blocking CI pipeline| John       | High     | -        |
| 3 | Update API documentation                 | Unassigned | Low      | -        |
| 4 | Investigate Stripe webhook failures      | Mike       | Medium   | -        |

Notes:
- Item #2 marked High priority because the flaky tests have been blocking CI for 2 days.
- Item #3 has no assignee -- "nobody volunteered." Would you like to assign someone?
- Item #4: Mike mentioned "over the weekend" but this is not a hard deadline.

Please confirm, edit, or remove any items before I create the tickets.
```

The workflow explicitly states: "Do **not** proceed until the user explicitly confirms."

---

## 6. Reference Files Consulted

| File | Purpose |
|------|---------|
| `SKILL.md` | Entry point; identified the capture-tasks workflow; provided jira.mjs command syntax |
| `skills/capture-tasks-from-meeting-notes.md` | Step-by-step workflow: receive input -> parse -> resolve users -> confirm -> create -> report |
| `references/action-item-patterns.md` | Extraction patterns (`{name} needs to`, `should`, ownership phrases), priority keyword mapping, name extraction templates |
| `references/ticket-writing-guide.md` | Summary format (Verb + Object + Context), description structure (Context/Requirements/Acceptance Criteria), priority guidelines |
