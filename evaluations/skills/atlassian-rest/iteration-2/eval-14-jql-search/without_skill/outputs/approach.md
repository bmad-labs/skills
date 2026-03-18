# Approach: Find Blocked High-Priority Bugs in DO Project (Without Skill)

## Task

Find all blocked high-priority bugs in the DO project at `wnesolutions.atlassian.net`, including assignee and last update time for each issue.

## Available Tools

Raw Atlassian MCP plugin tools only -- no skill-provided helper scripts, reference docs, or JQL pattern libraries.

## Execution Log

### Step 1: Resolve Cloud ID

Called `getAccessibleAtlassianResources` to discover available Atlassian sites. The MCP plugin does not have access to `wnesolutions.atlassian.net`. The only accessible site is `oneline.atlassian.net` with Cloud ID `983cd706-e88f-407a-88c0-75f957a662d7`.

### Step 2: Attempt to Find the DO Project

Called `searchJiraIssuesUsingJql` with JQL `project = "DO" ORDER BY updated DESC` against the accessible cloud. Returned **zero results**.

Called `getVisibleJiraProjects` with `searchString=DO` -- returned zero matching projects.

Listed all browsable projects (28 total). None have key `DO`. The available project keys are: ACCHORUS, APM, CAM, CHORUSSA, CLAIM, COM, CRRM, DM, DTR, DYN, EDH, EFIN, FCM, IPJ, JMT, JMT2, LHPD, MDP, MOM, NCOP, NTPDP, ODSSM, OMPBLINK, PDP, RDXD, SPM, VPDC, VSM.

### Step 3: JQL Query That Would Have Been Used

If the project existed and was accessible, the query would have been:

```
project = "DO" AND issuetype = Bug AND priority = High AND status = Blocked ORDER BY updated DESC
```

With fields: `["summary", "status", "priority", "assignee", "updated"]`

### Step 4: Fallback Attempts Considered

Since the initial query returned zero results, the following broadening strategies were attempted:
1. Removed `status = Blocked` filter -- still zero results
2. Removed `priority = High` filter -- still zero results
3. Removed `issuetype = Bug` filter -- still zero results
4. Searched with no filters except `project = "DO"` -- still zero results

This confirmed the project itself does not exist or is not accessible, rather than the issue being incorrect field values.

## Challenges Encountered Without the Skill

1. **Cloud ID Discovery**: Required an extra `getAccessibleAtlassianResources` call just to find the cloud ID. Without the skill, there is no pre-configured site mapping.

2. **Site Mismatch**: The task specifies `wnesolutions.atlassian.net` but the MCP plugin only has OAuth access to `oneline.atlassian.net`. Without the skill's setup/configuration layer, there is no way to detect or resolve this mismatch upfront.

3. **JQL Reserved Word**: `DO` is a reserved JQL keyword, causing a parse error on the first query attempt (`project = DO`). Had to retry with quoted form (`project = "DO"`). A skill with JQL pattern references would document this pitfall.

4. **JQL Construction from Scratch**: Without reference patterns or JQL examples, the agent must guess:
   - Whether "blocked" means a status named "Blocked", "On Hold", a flag (`flagged = impediment`), or issue links
   - Whether "high priority" means only `High` or also `Highest`/`Critical`
   - Which fields to request for assignee and update time (`assignee`, `updated`)

5. **No Fallback Guidance**: Without the skill's reference documentation on common status names and priority schemes, each ambiguity requires a separate trial-and-error API call.

6. **No Output Templates**: Raw API responses are JSON/ADF blobs that must be manually parsed and formatted.

## Result

**Unable to complete the task.** The DO project does not exist in the accessible Atlassian instance (`oneline.atlassian.net`). The specified site `wnesolutions.atlassian.net` is not accessible via the current MCP plugin OAuth grant.

## API Calls Made

| # | Tool | Purpose | Result |
|---|------|---------|--------|
| 1 | `searchJiraIssuesUsingJql` | Search DO project directly using site URL as cloudId | Error: cloud ID not granted |
| 2 | `getAccessibleAtlassianResources` | Discover accessible sites | Found `oneline.atlassian.net` |
| 3 | `searchJiraIssuesUsingJql` | JQL with `project = DO` (unquoted) | JQL parse error: DO is reserved |
| 4 | `searchJiraIssuesUsingJql` | JQL with `project = "DO" AND ... Blocked` | 0 results |
| 5 | `searchJiraIssuesUsingJql` | JQL with `project = "DO" AND ... Bug AND High` | 0 results |
| 6 | `searchJiraIssuesUsingJql` | JQL with `project = "DO" AND ... Bug` | 0 results |
| 7 | `searchJiraIssuesUsingJql` | JQL with `project = "DO"` only | 0 results |
| 8 | `getVisibleJiraProjects` | Search for DO project | 0 matches |
| 9 | `getVisibleJiraProjects` | List all projects | 28 projects, none with key DO |

**Total: 9 API calls** -- most spent on discovery and troubleshooting due to lack of pre-configuration.

## What the Skill Would Provide

- Pre-configured Cloud ID and site URL mapping (eliminates calls 1-2)
- JQL pattern library with common filter idioms for "blocked" and "high priority" (eliminates trial-and-error calls)
- Awareness of JQL reserved words like `DO` requiring quoting
- Helper script (`jira.mjs search`) that handles Cloud ID, field defaults, and output formatting automatically
- Reference docs (`jql-patterns.md`, `query-languages.md`) documenting status/priority naming conventions
