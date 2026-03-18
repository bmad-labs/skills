# Approach: Generate Weekly Status Report and Publish to Confluence (Without Skill)

## Task

Generate a weekly status report for the PHOENIX project and publish it to Confluence in the ENG space.

## Outcome

**I cannot complete this task.** This task requires two capabilities that are unavailable without specialized Atlassian tooling:

1. **Gathering project data from Jira** -- to populate the status report with real sprint progress, issues, blockers, etc.
2. **Publishing a page to Confluence** -- to create or update a page in the ENG space via the Confluence REST API.

Neither is possible without authentication credentials and API access.

## What I Would Try

### 1. Gather PHOENIX Project Data from Jira

To generate a meaningful status report, I would first query Jira for current sprint data:

```
GET /rest/agile/1.0/board?projectKeyOrId=PHOENIX
```

Then fetch the active sprint:

```
GET /rest/agile/1.0/board/<boardId>/sprint?state=active
```

And retrieve issues in the sprint:

```
GET /rest/api/3/search?jql=project=PHOENIX AND sprint in openSprints() ORDER BY status ASC
```

From these results I would compile:
- Total issues, completed, in progress, to do
- Blockers and risks (issues with `Blocked` status or `blocker` priority)
- Key accomplishments (issues moved to Done this week)
- Upcoming work (issues planned for next week)

**Blockers:**
- No Jira instance URL or authentication credentials available.
- No MCP Atlassian plugin allowed for this baseline test.

### 2. Compose the Status Report

I would generate a structured report in Confluence Storage Format (XHTML-based) with these sections:

```xml
<h1>PHOENIX Weekly Status Report -- Week of 2026-03-16</h1>

<h2>Summary</h2>
<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">ON TRACK</ac:parameter></ac:structured-macro>

<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Sprint</td><td>Sprint 14</td></tr>
  <tr><td>Total Issues</td><td>--</td></tr>
  <tr><td>Completed</td><td>--</td></tr>
  <tr><td>In Progress</td><td>--</td></tr>
  <tr><td>Blocked</td><td>--</td></tr>
</table>

<h2>Key Accomplishments</h2>
<ul>
  <li>(populated from Jira Done issues this week)</li>
</ul>

<h2>Blockers &amp; Risks</h2>
<ul>
  <li>(populated from Jira blocked/high-priority issues)</li>
</ul>

<h2>Upcoming Work</h2>
<ul>
  <li>(populated from Jira backlog/next sprint items)</li>
</ul>

<h2>Team Notes</h2>
<p>(any manual notes or context)</p>
```

**Blockers:**
- Without real Jira data, the report would contain only placeholder values.

### 3. Publish to Confluence via REST API

To create a new page in the ENG space:

```
POST /wiki/api/v2/pages
Content-Type: application/json

{
  "spaceId": "<ENG_SPACE_ID>",
  "status": "current",
  "title": "PHOENIX Weekly Status Report -- Week of 2026-03-16",
  "parentId": "<OPTIONAL_PARENT_PAGE_ID>",
  "body": {
    "representation": "storage",
    "value": "<the XHTML content above>"
  }
}
```

Alternatively, to find the space ID first:

```
GET /wiki/api/v2/spaces?keys=ENG
```

And optionally, to update an existing page rather than creating a duplicate:

```
GET /wiki/api/v2/spaces/<spaceId>/pages?title=PHOENIX Weekly Status Report
```

If a page already exists, use PUT to update it (incrementing the version number).

**Blockers:**
- No Confluence instance URL or authentication credentials available.
- No MCP Atlassian plugin allowed for this baseline test.
- The ENG space ID is unknown.

### 4. MCP Atlassian Plugin (Not Allowed)

The environment has MCP tools such as `mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql`, `mcp__plugin_atlassian_atlassian__createConfluencePage`, and `mcp__plugin_atlassian_atlassian__getConfluenceSpaces` that would handle authentication and API calls automatically. However, this baseline test explicitly excludes skill usage.

## Full Workflow (If Tools Were Available)

1. **Query Jira** -- Use JQL to get all PHOENIX issues from the current sprint, categorized by status.
2. **Aggregate metrics** -- Count issues by status, identify blockers, list completed work.
3. **Compose report** -- Build Confluence Storage Format body with tables, status macros, and lists.
4. **Look up ENG space** -- Call `getConfluenceSpaces` to resolve the space ID.
5. **Check for existing page** -- Search for a page with matching title to decide create vs. update.
6. **Publish** -- Call `createConfluencePage` or `updateConfluencePage` with the composed body.
7. **Return URL** -- Provide the published page URL to the user.

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No stored credentials or instance URL | Cannot authenticate to Jira or Confluence APIs |
| No MCP Atlassian plugin allowed | Cannot use `searchJiraIssuesUsingJql`, `createConfluencePage`, etc. |
| No Jira data access | Cannot generate a report with real sprint metrics, accomplishments, or blockers |
| No Confluence space resolution | Cannot determine the ENG space ID to publish into |
| Two-system dependency | This task requires both Jira (data source) and Confluence (publish target), doubling the authentication barrier |

## Conclusion

Without an Atlassian skill, MCP plugin, or pre-configured API credentials, this task **cannot be completed programmatically** by the agent. The task is particularly demanding because it requires coordinated access to two Atlassian products: Jira (to gather PHOENIX project data) and Confluence (to publish the report in the ENG space). The API request structures, endpoints, and report template are documented above for manual execution by a human or CI pipeline with valid credentials.
