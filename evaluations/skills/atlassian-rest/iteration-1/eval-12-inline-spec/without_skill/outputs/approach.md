# Approach: Breaking Requirements into Jira Tickets

## Task
Take the "User Profile Enhancement" requirements document and create individual Jira tickets in the FRONTEND project.

## Approach Without Atlassian Skill

Since no Atlassian skill or MCP plugin is available for this task, the tickets cannot be created directly in Jira. Instead, the approach is:

1. **Analyze the requirements document** - Identify each discrete requirement and classify it by type (feature, bug fix, documentation).
2. **Break into tickets** - Each requirement becomes one ticket with a clear title, description, acceptance criteria, and appropriate metadata (type, priority, labels).
3. **Output as structured files** - Write each ticket as a structured markdown file that could be manually entered into Jira or used as input for a future automation step.

## Ticket Breakdown

| # | Requirement | Ticket Type | Priority |
|---|------------|-------------|----------|
| 1 | Upload profile avatar (max 5MB, jpg/png) | Story | Medium |
| 2 | Add bio field (max 500 chars) | Story | Medium |
| 3 | Fix profile save bug on mobile Safari | Bug | High |
| 4 | Profile completion percentage indicator | Story | Low |
| 5 | Link social media accounts | Story | Medium |
| 6 | Update API documentation for new endpoints | Task | Medium |

## What Would Be Different With the Atlassian Skill

With the Atlassian MCP plugin, the workflow would be:
- Use `getVisibleJiraProjects` to confirm the FRONTEND project exists and get its key.
- Use `getJiraProjectIssueTypesMetadata` to discover available issue types (Story, Bug, Task).
- Use `getJiraIssueTypeMetaWithFields` to check required/available fields.
- Use `createJiraIssue` for each ticket, passing structured data (summary, description, type, priority, labels, acceptance criteria).
- Optionally use `createIssueLink` to link related tickets together.
- Return the created issue keys and URLs to the user.

## Limitations of This Approach
- Tickets are not actually created in Jira.
- No validation of project key, issue types, or custom fields.
- No issue links or epic assignment.
- No real issue keys generated.
