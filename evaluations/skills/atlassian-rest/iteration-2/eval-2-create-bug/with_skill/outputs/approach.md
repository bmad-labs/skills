# Approach: Create High-Priority Bug Ticket in DO Project

## Task Summary

Create a high-priority bug ticket in the DO project at wnesolutions.atlassian.net for the API team. The login endpoint times out after 30 seconds when users have more than 50 active sessions. Assign to Sarah Chen with labels 'backend' and 'urgent'.

## Skill References Used

- **SKILL.md** — primary command reference for `jira.mjs` CLI
- **references/bug-report-templates.md** — structured bug description template and priority guide
- **references/ticket-writing-guide.md** — summary format (Verb + Object + Context), description structure, label conventions
- **workflows/triage-issue.md** — triage workflow (duplicate checking before creation)

## Step-by-Step Approach

### Step 1: Verify Environment Setup

Run the setup script to confirm credentials are configured and the Atlassian domain is reachable.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

This checks that `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_DOMAIN` (wnesolutions.atlassian.net) are set.

### Step 2: Verify Project and Issue Types

Confirm the DO project exists and that "Bug" is a valid issue type.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs projects
```

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs issue-types DO
```

This ensures we use the correct issue type name (e.g., "Bug" vs "Defect") for the DO project.

### Step 3: Search for Duplicate Issues

Per the triage workflow (`workflows/triage-issue.md`) and skill principle "resolve ambiguity first," search for existing tickets that may already describe this issue before creating a new one.

**Search by error keywords (timeout + login):**

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND type = Bug AND text ~ "login timeout" AND statusCategory != Done' --max 10
```

**Search by related keywords (session limit):**

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND type = Bug AND text ~ "active sessions" AND statusCategory != Done' --max 10
```

**Search by endpoint reference:**

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND type = Bug AND text ~ "login endpoint" AND statusCategory != Done' --max 10
```

If duplicates are found, present them to the user and ask whether to proceed with creating a new ticket or update an existing one. If no duplicates are found, proceed to Step 4.

### Step 4: Look Up Sarah Chen's Account ID

The `--assignee` flag requires an Atlassian account ID, not a display name. Use the user lookup command.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Sarah Chen"
```

This returns a JSON result with the `accountId` field. Record the account ID for use in the create command (e.g., `5abcdef1234567890abcdef0`).

### Step 5: Compose the Bug Description

Following the **Standard Bug Template** from `references/bug-report-templates.md` and the **Description Structure** from `references/ticket-writing-guide.md`, compose the description:

```
## Description
The login endpoint (/api/auth/login) times out after 30 seconds when the authenticating user has more than 50 active sessions. This blocks affected users from logging in entirely.

## Steps to Reproduce
1. Ensure a user account has more than 50 active sessions (e.g., via concurrent device logins or session accumulation without expiry).
2. Attempt to log in with that user account via the login endpoint.
3. Observe that the request hangs and times out after 30 seconds.

## Expected Behavior
The login endpoint should authenticate the user and return a session token within normal response times (< 2 seconds), regardless of the number of existing active sessions.

## Actual Behavior
The login endpoint times out after 30 seconds with no response when the user has more than 50 active sessions.

## Environment
- Endpoint: /api/auth/login
- Trigger threshold: > 50 active sessions per user

## Severity
- Frequency: Always (reproducible when session count exceeds 50)
- User impact: High (users are completely locked out)
- Workaround: No (unless active sessions are manually cleared)

## Technical Notes
Likely cause is an unoptimized session validation query or session list iteration during login that scales poorly with session count. Consider adding pagination or a session count check before full session enumeration.
```

### Step 6: Confirm with the User Before Creating

Per the skill principle "confirm before mutating," present the full ticket details to the user:

- **Project:** DO
- **Type:** Bug
- **Summary:** Fix login endpoint timeout when user has more than 50 active sessions
- **Priority:** High
- **Assignee:** Sarah Chen (account ID from Step 4)
- **Labels:** backend, urgent
- **Description:** (as composed above)

Ask: "I'm about to create this bug ticket in DO. Does everything look correct?"

### Step 7: Create the Bug Ticket

Once the user confirms, execute the create command. Replace `<accountId>` with the actual account ID retrieved in Step 4.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Bug \
  --summary "Fix login endpoint timeout when user has more than 50 active sessions" \
  --description "## Description\nThe login endpoint (/api/auth/login) times out after 30 seconds when the authenticating user has more than 50 active sessions. This blocks affected users from logging in entirely.\n\n## Steps to Reproduce\n1. Ensure a user account has more than 50 active sessions (e.g., via concurrent device logins or session accumulation without expiry).\n2. Attempt to log in with that user account via the login endpoint.\n3. Observe that the request hangs and times out after 30 seconds.\n\n## Expected Behavior\nThe login endpoint should authenticate the user and return a session token within normal response times (< 2 seconds), regardless of the number of existing active sessions.\n\n## Actual Behavior\nThe login endpoint times out after 30 seconds with no response when the user has more than 50 active sessions.\n\n## Environment\n- Endpoint: /api/auth/login\n- Trigger threshold: > 50 active sessions per user\n\n## Severity\n- Frequency: Always (reproducible when session count exceeds 50)\n- User impact: High (users are completely locked out)\n- Workaround: No (unless active sessions are manually cleared)\n\n## Technical Notes\nLikely cause is an unoptimized session validation query or session list iteration during login that scales poorly with session count. Consider adding pagination or a session count check before full session enumeration." \
  --priority High \
  --assignee <accountId> \
  --labels "backend,urgent"
```

### Step 8: Verify the Created Ticket

After creation, the script returns the new issue key (e.g., `DO-456`). Fetch it to confirm all fields were set correctly.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-456
```

Verify:
- **Summary** matches the intended title
- **Priority** is High
- **Assignee** is Sarah Chen
- **Labels** include both `backend` and `urgent`
- **Description** contains the full bug report structure
- **Issue Type** is Bug

### Step 9: Report Back to the User

Provide the user with:
- The new issue key and URL (e.g., `https://wnesolutions.atlassian.net/browse/DO-456`)
- Confirmation that all fields (priority, assignee, labels) were set as requested
- A note about any duplicate search results found in Step 3 (if any)

## Commands Summary

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `setup.mjs` | Verify credentials |
| 2 | `jira.mjs projects` | Confirm DO project exists |
| 2 | `jira.mjs issue-types DO` | Confirm Bug is a valid type |
| 3 | `jira.mjs search '...'` (x3) | Check for duplicates |
| 4 | `jira.mjs lookup-user "Sarah Chen"` | Get assignee account ID |
| 7 | `jira.mjs create --project DO --type Bug ...` | Create the ticket |
| 8 | `jira.mjs get DO-456` | Verify created ticket |

## Skill Principles Applied

1. **Resolve ambiguity first** — verified project exists and issue types before creating
2. **Confirm before mutating** — presented ticket details to user before creation
3. **Compose operations naturally** — chained lookup-user + create for assignee resolution
4. **Read reference docs** — consulted bug-report-templates.md for description structure and ticket-writing-guide.md for summary format and label conventions
5. **Triage workflow** — performed duplicate search before filing a new bug
