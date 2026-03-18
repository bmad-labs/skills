# Approach: Generate Weekly Status Report for DO Project and Publish to Confluence (Without Skill)

## Task

Generate a weekly status report for the DO project at https://wnesolutions.atlassian.net and publish it to Confluence in the ENG space.

## Outcome

**The task could not be fully completed.** The MCP Atlassian plugin is available but no specialized skill, helper scripts, report templates, or JQL pattern references were used. The agent attempted to execute the full workflow using only the raw MCP tools.

## Steps Taken

### Step 1: Resolve the Atlassian Cloud ID

The user specified `wnesolutions.atlassian.net`, so I first tried using that hostname as the `cloudId` parameter. All calls failed with:

> Cloud id: d9a30524-4228-474d-a0e7-0a8fcf2cd4ce isn't explicitly granted by the user.

I then called `getAccessibleAtlassianResources` to discover which sites are authorized. The only accessible site is:

- **Site:** `oneline.atlassian.net`
- **Cloud ID:** `983cd706-e88f-407a-88c0-75f957a662d7`
- **Scopes:** Jira read/write, Confluence read/write/search

The requested site (`wnesolutions.atlassian.net`) is not in the user's granted resources.

### Step 2: Attempt JQL Queries Against Available Site

Using the accessible cloud ID, I ran 6 JQL queries targeting the DO project. "DO" is a reserved JQL keyword, so it must be quoted:

1. **Completed issues (last 7 days):**
   ```
   project = "DO" AND statusCategory = Done AND resolved >= -7d
   ```
   Result: 0 issues

2. **In-progress issues:**
   ```
   project = "DO" AND statusCategory = "In Progress"
   ```
   Result: 0 issues

3. **Blocked / Blocker priority issues:**
   ```
   project = "DO" AND (status = Blocked OR priority = Blocker)
   ```
   Result: 0 issues

4. **Newly created issues (last 7 days):**
   ```
   project = "DO" AND created >= -7d
   ```
   Result: 0 issues

5. **Open unresolved bugs:**
   ```
   project = "DO" AND issuetype = Bug AND resolution = Unresolved ORDER BY priority ASC
   ```
   Result: 0 issues

6. **All non-done issues (fallback):**
   ```
   project = "DO" AND statusCategory != Done
   ```
   Result: 0 issues

### Step 3: Verify Project Existence

I called `getVisibleJiraProjects` to list all projects. The 26 visible projects on `oneline.atlassian.net` do not include a project with key "DO". The project simply does not exist on the accessible instance.

### Step 4: Check for ENG Confluence Space

I called `getConfluenceSpaces` with `keys: ["ENG"]`. Result: empty -- no space with key "ENG" exists on the accessible instance. A full listing of spaces confirmed this.

## JQL Note: "DO" as a Reserved Word

A key discovery: `DO` is a reserved JQL keyword. Any JQL query using `project = DO` without quoting will fail with:

> 'DO' is a reserved JQL word. You must surround it in quotation marks to use it in a query.

The correct syntax is `project = "DO"`. Without a skill providing this knowledge, the agent had to discover this through trial-and-error after the first set of queries failed.

## What Would Have Been Done With Access

If the DO project and ENG space existed on the accessible site, the full workflow would have been:

### 1. Run JQL Queries (at least 3)

| # | Query | Purpose |
|---|-------|---------|
| 1 | `project = "DO" AND statusCategory = Done AND resolved >= -7d` | Completed work this week |
| 2 | `project = "DO" AND statusCategory = "In Progress"` | Current active work |
| 3 | `project = "DO" AND (status = Blocked OR priority = Blocker)` | Blockers and critical risks |
| 4 | `project = "DO" AND created >= -7d` | New items entering backlog |
| 5 | `project = "DO" AND issuetype = Bug AND resolution = Unresolved` | Open bug count |

### 2. Aggregate Metrics

From the query results, derive:
- Items completed this week
- Items currently in progress
- Items blocked
- New items created this week
- Created vs. resolved ratio
- Open bug count
- Overall status (Green/Yellow/Red) based on blocker count and velocity

### 3. Format the Report

Build a structured report in markdown format with sections:
- **Executive Summary** -- overall status badge and 2-3 sentence overview
- **Completed This Week** -- table of done issues with key, summary, assignee
- **In Progress** -- table of active issues
- **Blockers & Risks** -- table of blocked items with details
- **Upcoming Work** -- newly created items
- **Metrics** -- summary table of all derived metrics

### 4. Look Up ENG Space ID

Call `getConfluenceSpaces` with `keys: ["ENG"]` to resolve the numeric space ID required by `createConfluencePage`.

### 5. Publish to Confluence

Call `createConfluencePage` with:
- `cloudId`: the resolved cloud ID
- `spaceId`: the ENG space's numeric ID
- `title`: "Weekly Status Report - DO - 2026-03-18"
- `body`: the report content
- `contentFormat`: "markdown"

### 6. Return Page URL

Provide the newly created Confluence page URL to the user for review.

## Barriers Encountered

| Barrier | Impact |
|---------|--------|
| Target site `wnesolutions.atlassian.net` not in granted resources | Cannot authenticate to the requested Atlassian instance |
| DO project does not exist on accessible site (`oneline.atlassian.net`) | All JQL queries return 0 results; no data to report on |
| ENG Confluence space does not exist on accessible site | No target space to publish the report to |
| "DO" is a reserved JQL keyword | Required quoting discovery via trial-and-error; first round of queries failed |
| No skill/templates available | No pre-built report templates, JQL pattern references, or Confluence storage format examples to guide report generation |

## Tools Used (MCP Atlassian Plugin -- No Skill)

1. `getAccessibleAtlassianResources` -- to discover available cloud IDs
2. `searchJiraIssuesUsingJql` -- 6 separate queries to gather project data (all returned 0)
3. `getVisibleJiraProjects` -- to verify DO project existence (not found)
4. `getConfluenceSpaces` -- to look up ENG space (not found)
5. `searchConfluenceUsingCql` -- attempted CQL search (query syntax issue)

## Conclusion

Without a specialized skill, the agent was able to use the raw MCP Atlassian tools to attempt the full workflow: resolve the cloud ID, run multiple JQL queries, check for the target project and Confluence space. However, the task could not be completed because the target Jira instance (`wnesolutions.atlassian.net`) is not in the user's granted Atlassian resources, and neither the DO project nor the ENG space exist on the accessible instance (`oneline.atlassian.net`). The agent also had to discover through error that "DO" is a reserved JQL keyword requiring quoting -- knowledge that a skill with JQL pattern references would have provided upfront.
