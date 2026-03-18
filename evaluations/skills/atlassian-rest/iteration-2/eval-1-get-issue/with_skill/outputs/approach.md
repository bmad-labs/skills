# Approach: Get Issue Status, Assignee, and Priority for DO-123

## Task

Retrieve the current status, assignee, and priority of Jira issue DO-123 in the project DO at `wnesolutions.atlassian.net`.

## Skill Used

`atlassian-rest` — located at `<skill-path>` = `/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest`

## Step-by-Step Approach

### Step 1: Verify Credentials

Before any API call, confirm that environment variables are set:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

This checks that `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_DOMAIN` are configured. If any are missing, the script prints setup instructions. The domain should be `wnesolutions.atlassian.net`.

### Step 2: Fetch Issue Details (Single Command)

Use the `jira.mjs get` command with `--fields` to retrieve only the three fields we need:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-123 --fields status,assignee,priority
```

This calls the Jira REST API `GET /rest/api/3/issue/DO-123?fields=status,assignee,priority` and returns the issue data as JSON.

### Step 3: Interpret the Response

The JSON response will contain:

- **Status**: Found at `fields.status.name` (e.g., "To Do", "In Progress", "Done")
- **Assignee**: Found at `fields.assignee.displayName` (e.g., "John Smith") — will be `null` if unassigned
- **Priority**: Found at `fields.priority.name` (e.g., "High", "Medium", "Low")

### Step 4: Report to User

Present the findings in plain language, e.g.:

> **DO-123 Status:**
> - **Status:** In Progress
> - **Assignee:** Jane Doe
> - **Priority:** High

## Why This Approach

- **Single command**: The `jira.mjs get` command with `--fields` is the most direct way to retrieve specific issue details. No search query or JQL is needed since we already know the exact issue key.
- **No confirmation needed**: This is a read-only operation, so per the skill instructions, no user confirmation is required before executing.
- **No workflow needed**: This is a simple lookup — none of the defined workflows (triage, status report, etc.) apply here.
- **No reference docs needed**: No JQL or CQL queries are being constructed, so `references/query-languages.md` is not required.

## Alternative Approach (Without --fields)

If broader context is desired, omit the `--fields` flag to get the full issue payload:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-123
```

This returns all fields (summary, description, labels, components, etc.) but is more data than needed for this specific question.
