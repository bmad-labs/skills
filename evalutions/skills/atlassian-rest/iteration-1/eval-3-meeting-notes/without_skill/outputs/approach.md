# Approach: Extracting Action Items and Creating Jira Tickets (Without Skill)

## Task Summary

Extract action items from sprint planning meeting notes and create Jira tickets in the PLATFORM project.

## Extracted Action Items

From the meeting notes, I identified **4 action items**:

| # | Action Item | Assignee | Priority | Due Date |
|---|------------|----------|----------|----------|
| 1 | Investigate database query optimization for the user search endpoint | Sarah Chen | Medium | - |
| 2 | Set up monitoring dashboards for API latency | Mike Rodriguez | Medium | March 20 (Friday) |
| 3 | Write integration tests for the new payment flow | Lisa Park | Medium | - |
| 4 | Fix the checkout bug | Mike Rodriguez | High | - |

## What I Would Need to Do (Without Specialized Tooling)

### Step 1: Identify the Jira Cloud Instance and Project

Without an Atlassian skill or MCP plugin, I have no way to:
- Discover the Jira cloud instance URL
- Authenticate against the Jira REST API
- Look up the PLATFORM project key or its issue type metadata

### Step 2: Look Up Required Metadata

Before creating tickets, I would need:
- **Project ID** for "PLATFORM"
- **Issue type IDs** (e.g., Task, Bug, Story)
- **User account IDs** for Sarah Chen, Mike Rodriguez, Lisa Park
- **Priority IDs** for "High", "Medium", etc.
- **Sprint ID** for the current sprint (to assign tickets to the active sprint)

### Step 3: Create Jira Tickets via REST API

I would need to call the Jira REST API (`POST /rest/api/3/issue`) for each ticket. Example payload for one ticket:

```json
{
  "fields": {
    "project": { "key": "PLATFORM" },
    "summary": "Investigate database query optimization for user search endpoint",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Investigate and optimize the database queries behind the user search endpoint to resolve API performance issues. Identified during sprint planning on March 18."
            }
          ]
        }
      ]
    },
    "issuetype": { "name": "Task" },
    "assignee": { "accountId": "<sarah-account-id>" },
    "priority": { "name": "Medium" }
  }
}
```

### Step 4: What Is Actually Blocked

Without the Atlassian MCP plugin or any REST client with stored credentials, I **cannot execute any of these steps**. Specifically:

1. **No authentication** -- I have no Jira API token, OAuth credentials, or session cookie.
2. **No instance URL** -- I do not know which Jira cloud site to target (e.g., `https://yourcompany.atlassian.net`).
3. **No user lookup** -- I cannot resolve display names ("Sarah Chen") to Jira account IDs.
4. **No project validation** -- I cannot confirm the PLATFORM project exists or what issue types it supports.
5. **No HTTP client with auth** -- Even if I had credentials, making raw `curl` calls requires manual token management and is error-prone.

## What the Atlassian Skill Would Provide

If the Atlassian MCP plugin were available, I could:

- `getAccessibleAtlassianResources` -- discover the Jira instance
- `getVisibleJiraProjects` -- confirm PLATFORM project exists
- `lookupJiraAccountId` -- resolve names to account IDs
- `getJiraProjectIssueTypesMetadata` -- get valid issue types
- `createJiraIssue` -- create each ticket with proper fields
- `searchJiraIssuesUsingJql` -- verify tickets were created

## Proposed Ticket Breakdown

If I could create the tickets, here is what I would create:

### Ticket 1: Investigate DB query optimization for user search endpoint
- **Type:** Task
- **Assignee:** Sarah Chen
- **Priority:** Medium
- **Labels:** api-performance, investigation
- **Description:** Investigate the database query optimization for the user search endpoint. Part of sprint goal to resolve API performance issues.

### Ticket 2: Set up monitoring dashboards for API latency
- **Type:** Task
- **Assignee:** Mike Rodriguez
- **Priority:** Medium
- **Due Date:** 2026-03-20
- **Labels:** monitoring, api-performance
- **Description:** Set up monitoring dashboards for API latency metrics. Due by Friday March 20.

### Ticket 3: Write integration tests for payment flow
- **Type:** Task
- **Assignee:** Lisa Park
- **Priority:** Medium
- **Labels:** testing, payment-v2
- **Description:** Write integration tests for the new payment flow. Part of sprint goal to ship payment v2.

### Ticket 4: Fix checkout bug
- **Type:** Bug
- **Assignee:** Mike Rodriguez
- **Priority:** High
- **Labels:** bug, checkout
- **Description:** Fix the checkout bug. Prioritized during sprint planning as high priority.

## Conclusion

Without the Atlassian skill/plugin, this task **cannot be completed**. The best I can do is extract and structure the action items (done above) and document the exact API calls that would be needed. A human would need to manually create these 4 tickets in Jira, or the Atlassian MCP plugin would need to be enabled.
