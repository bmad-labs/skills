# Approach: Parse Messy Meeting Notes with Mixed Action Item Formats

## Skill References Used

1. **SKILL.md** -- Identified this as a "Capture Tasks from Meeting Notes" workflow scenario.
2. **Workflow:** `workflows/capture-tasks-from-meeting-notes.md` -- Followed the 7-step process.
3. **Reference:** `references/action-item-patterns.md` -- Used extraction patterns for name/priority/due date parsing.
4. **Reference:** `references/ticket-writing-guide.md` -- Applied "Verb + Object + Context" summary format and description structure.

## Workflow Execution

### Step 1: Receive Input

Raw meeting notes provided directly. Target project: **DO** (at wnesolutions.atlassian.net).

### Step 2: Fetch Notes

Skipped -- notes were provided inline, not from a Confluence page.

### Step 3: Parse Action Items

Applied patterns from `references/action-item-patterns.md` to the messy notes:

**Raw notes:**
```
Team sync 3/18
sarah - needs to finish the PRD for the new dashboard feature asap
John said he'd look into why tests are flaky on the auth module
@mike will handle the Stripe webhook integration
someone should really update the API docs before the release (nobody volunteered)
```

**Parsing analysis:**

1. **"sarah - needs to finish the PRD for the new dashboard feature asap"**
   - Pattern matched: `{name} needs to {action}` (Medium confidence)
   - Assignee: Sarah
   - Task: Finish the PRD for the new dashboard feature
   - Priority hint: "asap" maps to **High** priority (per priority indicators table)
   - Due date: ASAP = Today (2026-03-18)

2. **"John said he'd look into why tests are flaky on the auth module"**
   - Pattern matched: Implicit ownership -- "John said he'd..." is equivalent to "John will..." (Medium confidence; the phrasing "said he'd" implies agreed ownership)
   - Assignee: John
   - Task: Investigate flaky tests on the auth module
   - Priority hint: None explicit, default **Medium**
   - Due date: None

3. **"@mike will handle the Stripe webhook integration"**
   - Pattern matched: `@{name} will {action}` (High confidence)
   - Assignee: Mike
   - Task: Handle the Stripe webhook integration
   - Priority hint: None explicit, default **Medium**
   - Due date: None

4. **"someone should really update the API docs before the release (nobody volunteered)"**
   - Pattern matched: `should` (Medium confidence) -- action item indicator
   - Assignee: **Unassigned** -- "someone" and "nobody volunteered" explicitly indicate no owner
   - Task: Update the API docs before the release
   - Priority hint: "should" maps to **Medium** priority; "before the release" suggests time sensitivity but no specific date
   - Due date: Before release (unspecified)

### Step 4: Resolve Assignees

Ran `jira.mjs lookup-user` for each named assignee:

| Name   | Lookup Command                        | Result                  |
|--------|---------------------------------------|-------------------------|
| Sarah  | `jira.mjs lookup-user "sarah"`        | No matching users found |
| John   | `jira.mjs lookup-user "john"`         | No matching users found |
| Mike   | `jira.mjs lookup-user "mike"`         | No matching users found |

**All three lookups returned empty arrays.** Per the workflow (Step 4): "If a lookup fails, flag it for the user to resolve manually." All assignee fields would be flagged.

### Step 5: Confirm with User

Per the workflow, the following table would be presented to the user for confirmation before creating any tickets:

| # | Assignee     | Summary                                          | Priority | Due Date         |
|---|--------------|--------------------------------------------------|----------|------------------|
| 1 | Sarah (unresolved) | Finish PRD for the new dashboard feature   | High     | 2026-03-18 (ASAP)|
| 2 | John (unresolved)  | Investigate flaky tests on auth module     | Medium   | --               |
| 3 | Mike (unresolved)  | Implement Stripe webhook integration       | Medium   | --               |
| 4 | Unassigned         | Update API documentation before release    | Medium   | Before release   |

**User confirmation required before proceeding.** The workflow explicitly states: "Do not proceed until the user explicitly confirms."

Key items to confirm with user:
- Resolve Sarah, John, and Mike to actual Jira accounts (provide full names or email addresses)
- Confirm summaries are accurate (rewrote using Verb + Object + Context pattern from ticket-writing-guide.md)
- Confirm priorities (especially task #1 marked High due to "asap")
- Decide on assignee for task #4 (API docs -- nobody volunteered)
- Clarify "before the release" due date for task #4

### Step 6: Create Tasks (Blocked)

Would execute the following commands upon user confirmation (shown with placeholder assignee IDs):

```bash
# Task 1
node <skill-path>/scripts/jira.mjs create \
  --project DO --type Task \
  --summary "Finish PRD for the new dashboard feature" \
  --description "## Context\nAction item from Team Sync 3/18. Sarah needs to finish this ASAP.\n\n## Requirements\n- Complete the PRD for the new dashboard feature\n- Priority: ASAP per meeting discussion\n\n## Acceptance Criteria\n- [ ] PRD document is complete and shared with the team" \
  --priority High \
  --assignee <sarah-account-id>

# Task 2
node <skill-path>/scripts/jira.mjs create \
  --project DO --type Task \
  --summary "Investigate flaky tests on auth module" \
  --description "## Context\nAction item from Team Sync 3/18. John agreed to look into why tests are flaky on the auth module.\n\n## Requirements\n- Identify root cause of flaky tests in the auth module\n- Propose fix or stabilization approach\n\n## Acceptance Criteria\n- [ ] Root cause identified and documented\n- [ ] Fix applied or follow-up ticket created" \
  --priority Medium \
  --assignee <john-account-id>

# Task 3
node <skill-path>/scripts/jira.mjs create \
  --project DO --type Task \
  --summary "Implement Stripe webhook integration" \
  --description "## Context\nAction item from Team Sync 3/18. Mike will handle the Stripe webhook integration.\n\n## Requirements\n- Implement Stripe webhook handling\n- Ensure proper event processing and error handling\n\n## Acceptance Criteria\n- [ ] Stripe webhooks received and processed correctly\n- [ ] Error handling and retry logic in place" \
  --priority Medium \
  --assignee <mike-account-id>

# Task 4
node <skill-path>/scripts/jira.mjs create \
  --project DO --type Task \
  --summary "Update API documentation before release" \
  --description "## Context\nAction item from Team Sync 3/18. No volunteer identified -- needs assignment.\n\n## Requirements\n- Update API documentation to reflect current state\n- Must be completed before the upcoming release\n\n## Acceptance Criteria\n- [ ] All API endpoints documented with current request/response formats\n- [ ] Documentation reviewed by at least one team member" \
  --priority Medium
```

### Step 7: Report Results

Blocked pending Step 5 confirmation. Would present created issue keys, summaries, assignees, and links in a summary table after creation.

## Key Observations

1. **Mixed formats handled well**: The skill's `action-item-patterns.md` reference covers all four formats encountered:
   - Informal ownership: "sarah - needs to" matched `{name} needs to {action}`
   - Reported speech: "John said he'd" interpreted as implicit ownership agreement
   - @-mention: "@mike will" matched `@{name} will {action}` (highest confidence)
   - Unassigned: "someone should" matched `should` pattern with no extractable assignee

2. **Priority extraction**: "asap" correctly mapped to High priority using the priority indicators table. Other items defaulted to Medium.

3. **Assignee resolution failure**: All three user lookups failed (empty arrays). The workflow correctly handles this by flagging for manual resolution rather than silently dropping assignees.

4. **Confirmation gate**: The workflow enforces a mandatory user confirmation step before creating any tickets, preventing incorrect ticket creation from ambiguous notes.

5. **Ticket quality**: Summaries were rewritten to follow the "Verb + Object + Context" pattern from `ticket-writing-guide.md`, and descriptions follow the structured template (Context, Requirements, Acceptance Criteria).
