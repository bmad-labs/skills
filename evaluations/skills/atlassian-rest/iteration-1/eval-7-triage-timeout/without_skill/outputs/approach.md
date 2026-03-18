# Approach: Triage "Connection Timeout" Errors in Payment Service

## Task Summary

Investigate production "Connection timeout" errors on the payment service affecting user checkout, check if the issue has already been reported in Jira, and file a new bug if needed.

## Why This Cannot Be Completed

Without the Atlassian skill (or direct Jira/Confluence API access), I have no way to:

1. **Search existing Jira issues** to determine if this bug has already been reported.
2. **Create a new Jira issue** if no existing report is found.
3. **Query Confluence** for any related incident runbooks or architecture documentation on the payment service.

## Manual Steps Required

A human operator would need to perform the following:

### Step 1: Search for Existing Reports

1. Open Jira and navigate to the project that owns the payment service.
2. Run a JQL search to find potentially matching issues:
   ```
   project = <PAYMENT_PROJECT_KEY>
     AND (
       summary ~ "connection timeout"
       OR summary ~ "checkout timeout"
       OR summary ~ "payment timeout"
       OR description ~ "connection timeout"
     )
     AND status NOT IN (Done, Closed, Cancelled)
   ORDER BY created DESC
   ```
3. Also search resolved/closed issues to see if this is a regression:
   ```
   project = <PAYMENT_PROJECT_KEY>
     AND (summary ~ "connection timeout" OR description ~ "connection timeout")
     AND status IN (Done, Closed, Resolved)
     AND resolved >= -90d
   ORDER BY resolved DESC
   ```
4. Review any matching issues for relevance (same symptom, same service, same user flow).

### Step 2: File a Bug (If No Existing Report Found)

If no matching issue exists, create a new Jira bug with the following suggested fields:

- **Project**: (payment service project key)
- **Issue Type**: Bug
- **Priority**: High (production impact, user-facing)
- **Summary**: `Connection timeout errors during checkout on payment service`
- **Description**:
  ```
  ## Problem
  Users are encountering "Connection timeout" errors in production when
  attempting to complete checkout via the payment service.

  ## Impact
  - User-facing: customers cannot complete purchases
  - Frequency: reported as occurring frequently ("a lot")
  - Environment: Production

  ## Expected Behavior
  Checkout requests to the payment service should complete successfully
  within acceptable response times.

  ## Actual Behavior
  Requests are timing out, resulting in "Connection timeout" errors
  presented to users.

  ## Investigation Notes
  Potential areas to investigate:
  - Payment service resource utilization (CPU, memory, connections)
  - Database connection pool saturation
  - Downstream dependency health (payment gateway, third-party APIs)
  - Network configuration / firewall changes
  - Recent deployments to the payment service
  - Load patterns (traffic spike vs. steady state)
  ```
- **Labels**: `production-issue`, `timeout`, `payment`
- **Components**: Payment Service (if available)

### Step 3: Follow-Up

- Link the new bug to any related incidents or monitoring alerts.
- Add relevant log snippets, dashboard links, or error traces if available.
- Notify the on-call or payment service team owner.

## What the Atlassian Skill Would Provide

With the Atlassian skill, the following could be automated directly from Claude Code:

| Action | API / Tool |
|---|---|
| Search existing Jira issues by JQL | `searchJiraIssuesUsingJql` |
| Read issue details to confirm relevance | `getJiraIssue` |
| Create a new bug with all fields populated | `createJiraIssue` |
| Search Confluence for runbooks/architecture docs | `searchConfluenceUsingCql` |
| Add comments with investigation findings | `addCommentToJiraIssue` |
| Look up team members for assignment | `lookupJiraAccountId` |

The entire triage-and-file workflow could be completed in a single agent session rather than requiring manual Jira interaction.
