# Approach: Get Issue Status, Assignee, and Priority for PROJ-123

## Task

The user asked: "What's the current status of PROJ-123? Also tell me who's assigned to it and what priority it is."

## Reference Files Consulted

- `skills/atlassian-rest/SKILL.md` — Main skill instructions, including all available Jira commands and usage patterns.
- `skills/atlassian-rest/scripts/jira.mjs` — The Jira CLI script used for all Jira operations.

No additional reference files (e.g., `references/jira-api.md` or `references/query-languages.md`) are needed for this task since it is a straightforward issue lookup, not a search or query composition.

## Step-by-Step Approach

### Step 1: Verify Credentials (First-Use Only)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

This checks that the required environment variables (`ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, `ATLASSIAN_DOMAIN`) are configured. If they are not, the script prints setup instructions for the user.

### Step 2: Fetch Issue Details

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get PROJ-123 --fields summary,status,assignee,priority
```

This retrieves PROJ-123 with only the fields needed to answer the user's question: `status`, `assignee`, and `priority`. Including `summary` as well so the response has context about what the issue is.

The `--fields` flag limits the response to the requested fields, keeping the output concise.

### Step 3: Present Results to the User

Based on the JSON response from the script, I would present the information in a clear, conversational format. Example:

> **PROJ-123: Implement user authentication**
>
> | Field    | Value         |
> |----------|---------------|
> | Status   | In Progress   |
> | Assignee | Jane Smith    |
> | Priority | High          |

If the assignee field is `null`/unassigned, I would report "Unassigned" instead.

If the command returns a 404 error, I would inform the user that the issue key may be incorrect or that they lack access to the project.

## Why This Approach

- This is a **read-only** operation, so no confirmation is needed before executing (per SKILL.md: "Read operations (search, get, list) don't need confirmation").
- A single `get` command with `--fields` is the most efficient way to retrieve specific issue details -- no search or multi-step workflow required.
- No workflow sub-skills apply here; this is a direct issue lookup.

## Commands Summary

| # | Command | Purpose |
|---|---------|---------|
| 1 | `node <skill-path>/scripts/setup.mjs` | Verify credentials are configured |
| 2 | `node <skill-path>/scripts/jira.mjs get PROJ-123 --fields summary,status,assignee,priority` | Fetch the issue details |
