# Approach: Creating Jira Tickets from Messy Meeting Notes (Without Skill)

## Task Summary

Parse unstructured product review meeting notes and create corresponding Jira tickets in the ENG project.

## Step 1: Parse and Extract Action Items

From the raw meeting notes, I identified 4 distinct action items:

| # | Raw Text | Assignee | Action |
|---|----------|----------|--------|
| 1 | "Sarah mentioned she'll handle the PRD for mobile push notifications" | Sarah | Write PRD for mobile push notifications |
| 2 | "John: needs to fix the flaky test suite - been blocking CI for 2 days now" | John | Fix flaky test suite blocking CI |
| 3 | "Also someone should update the API docs but nobody volunteered" | Unassigned | Update API documentation |
| 4 | "Mike said he'd look into the Stripe webhook failures over the weekend" | Mike | Investigate Stripe webhook failures |

## Step 2: Structure as Jira Tickets

Each action item maps to a Jira ticket with appropriate type, priority, and details:

### Ticket 1: ENG-??? — Write PRD for mobile push notifications
- **Type:** Task
- **Priority:** Medium
- **Assignee:** Sarah
- **Description:** Create the Product Requirements Document (PRD) for the mobile push notifications feature. Identified during Q1 product review meeting.

### Ticket 2: ENG-??? — Fix flaky test suite blocking CI
- **Type:** Bug
- **Priority:** High
- **Assignee:** John
- **Description:** The test suite has been flaky and blocking CI for 2 days. This is a blocker for the team and needs immediate attention.

### Ticket 3: ENG-??? — Update API documentation
- **Type:** Task
- **Priority:** Low
- **Assignee:** Unassigned
- **Description:** API documentation needs to be updated. No volunteer was identified during the Q1 product review meeting. Needs someone to pick this up.

### Ticket 4: ENG-??? — Investigate Stripe webhook failures
- **Type:** Bug
- **Priority:** High
- **Assignee:** Mike
- **Description:** Stripe webhook failures have been occurring. Mike will investigate. Identified during Q1 product review meeting.

## Step 3: Create Tickets via Jira API (Manual Approach)

Without the Atlassian skill, ticket creation would require direct REST API calls. The process for each ticket:

1. **Look up the ENG project metadata** to get valid issue type IDs and field schemas:
   ```
   GET /rest/api/3/project/ENG
   GET /rest/api/3/issue/createmeta?projectKeys=ENG
   ```

2. **Resolve assignee account IDs** by searching for each user:
   ```
   GET /rest/api/3/user/search?query=Sarah
   ```

3. **Create each issue** via POST:
   ```
   POST /rest/api/3/issue
   {
     "fields": {
       "project": { "key": "ENG" },
       "summary": "Write PRD for mobile push notifications",
       "issuetype": { "name": "Task" },
       "priority": { "name": "Medium" },
       "assignee": { "accountId": "<resolved-id>" },
       "description": { ... ADF content ... }
     }
   }
   ```

4. **Verify** each created ticket by confirming the response contains a valid issue key.

## Limitations Without the Atlassian Skill

- **No API access:** Cannot actually create tickets, look up user account IDs, or validate project/field metadata.
- **Assignee resolution:** "Sarah", "John", "Mike" are display names; Jira requires account IDs which need API lookup.
- **Issue type validation:** Cannot confirm which issue types (Bug, Task, Story) are available in the ENG project.
- **Priority validation:** Cannot confirm the exact priority names configured in the Jira instance.
- **No ticket keys returned:** Cannot provide actual ENG-XXX ticket numbers.

## What the Atlassian Skill Would Provide

With the skill available, the workflow would be:
1. Call `getJiraProjectIssueTypesMetadata` to get valid issue types for ENG.
2. Call `lookupJiraAccountId` for each assignee name.
3. Call `createJiraIssue` four times with fully validated payloads.
4. Return the created ticket keys (e.g., ENG-101, ENG-102, etc.).
