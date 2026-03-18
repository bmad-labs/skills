# Approach: Daily Standup Summary (Without Skill)

## Task

Generate a daily standup summary for project "BACKEND" showing what changed since yesterday, who is blocked, and what is coming up today. Output only -- do not publish to Confluence.

## Approach (Manual MCP Tool Calls)

### Step 1: Discover Atlassian Resources

- Used `getAccessibleAtlassianResources` to obtain the cloud ID.
- Result: Cloud ID `983cd706-e88f-407a-88c0-75f957a662d7` for site `oneline.atlassian.net`.

### Step 2: Locate the Project

- Used `getVisibleJiraProjects` to list all projects and search for "BACKEND".
- Result: **No project with key or name "BACKEND" exists** on this Jira instance.
- Available projects: ACCHORUS, APM, BB, BM, CAM, CHORUSSA, COM, DM, DTR, DYN, EDH, EFIN, FCM, FLAM, JMT, MOM, NCOP, NTPDP, ODSSM, OMPBLINK, PDP, RPGCFM, RPGLIS, SNBC, SPM, VSM.

### Step 3: Attempt JQL Queries (Planned)

The plan was to run multiple JQL queries to gather standup data:

1. **What changed since yesterday:**
   ```
   project = "BACKEND" AND updated >= -1d ORDER BY updated DESC
   ```
   Fields: summary, status, assignee, updated, issuetype, priority

2. **Who is blocked:**
   ```
   project = "BACKEND" AND status = "Blocked" OR (project = "BACKEND" AND labels = "blocked")
   ```
   Fields: summary, status, assignee, priority

3. **What's coming up today (In Progress / To Do items in current sprint):**
   ```
   project = "BACKEND" AND sprint in openSprints() AND status in ("To Do", "In Progress") ORDER BY priority DESC
   ```
   Fields: summary, status, assignee, priority, issuetype

4. **Recently completed (for "done yesterday" section):**
   ```
   project = "BACKEND" AND status changed to "Done" AFTER -1d ORDER BY updated DESC
   ```
   Fields: summary, assignee, updated

### Step 4: Compile Standup Report

Aggregate results into sections:
- **Done Yesterday** -- issues transitioned to Done in the last 24 hours
- **In Progress Today** -- issues currently in progress in the active sprint
- **Blocked** -- issues flagged or in Blocked status, with assignees highlighted
- **Coming Up** -- To Do items in the current sprint, sorted by priority

### Challenges Without a Skill

1. **Multiple manual tool calls required** -- each JQL query is a separate MCP invocation with its own parameter setup.
2. **No pre-built formatting** -- results come back as raw JSON; assembling a readable standup report requires manual parsing and structuring.
3. **No project validation upfront** -- had to discover that "BACKEND" doesn't exist through trial, rather than having a skill that validates inputs early.
4. **No template or convention** -- without a skill, there is no standardized standup format; each run must be hand-crafted.
5. **Field name guessing** -- status values like "Blocked", "To Do", "In Progress", "Done" may differ per project; a skill could adapt to the project's workflow scheme automatically.

### Outcome

The project "BACKEND" does not exist on the connected Jira instance (`oneline.atlassian.net`). The JQL query returned zero results. See `standup-summary.md` for the output report.
