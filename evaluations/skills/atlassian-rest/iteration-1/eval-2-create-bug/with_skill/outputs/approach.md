# Approach: Create High-Priority Bug Ticket in PLATFORM Project

## Reference Files Consulted

- `skills/atlassian-rest/SKILL.md` -- Main skill instructions, command syntax, and workflow principles
- `skills/atlassian-rest/references/ticket-writing-guide.md` -- Summary format (Verb + Object + Context), description structure, priority guidelines, label conventions
- `skills/atlassian-rest/references/bug-report-templates.md` -- Standard bug template (Steps to Reproduce, Expected/Actual Behavior, Severity), priority assignment guide

---

## Multi-Step Operation Ordering

This task requires three sequential operations because the `--assignee` flag needs an account ID, not a display name.

### Step 1: Look up Sarah Chen's account ID

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs lookup-user "Sarah Chen"
```

This returns one or more matching accounts. Select the correct one and capture the `accountId` value (e.g., `5b10ac8d82e05b22cc7d4ef5`).

### Step 2: Confirm with the user before creating

Present the following to the user for confirmation:

> **I am about to create the following Jira issue:**
>
> | Field       | Value |
> |-------------|-------|
> | Project     | PLATFORM |
> | Type        | Bug |
> | Priority    | High |
> | Summary     | Fix login endpoint timeout when user has more than 50 active sessions |
> | Assignee    | Sarah Chen (`<accountId>`) |
> | Labels      | `backend`, `urgent` |
>
> **Description:**
>
> ## Description
> The login endpoint (`/api/auth/login`) times out after 30 seconds when the
> authenticating user has more than 50 active sessions. This blocks affected
> users from logging in entirely.
>
> ## Steps to Reproduce
> 1. Create or identify a user account with more than 50 active sessions.
> 2. Send a POST request to the login endpoint (`/api/auth/login`) with valid credentials for that user.
> 3. Observe the request hanging and eventually timing out after 30 seconds.
>
> ## Expected Behavior
> The login endpoint returns a successful authentication response within normal latency (under 2 seconds), regardless of the number of active sessions.
>
> ## Actual Behavior
> The request hangs for 30 seconds and then returns a timeout error. Users with more than 50 active sessions cannot log in.
>
> ## Severity
> - Frequency: Always (reproducible for any user exceeding 50 sessions)
> - User impact: High -- complete login failure with no workaround
> - Workaround: None (manually clearing sessions requires admin intervention)
>
> ## Technical Notes
> Likely cause: the login flow loads or validates all active sessions synchronously
> before issuing the new token. Investigate session lookup query performance and
> consider lazy loading, pagination, or capping the validation to recent sessions.
>
> **Shall I proceed?**

### Step 3: Create the issue

After user confirmation, execute:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project PLATFORM \
  --type Bug \
  --summary "Fix login endpoint timeout when user has more than 50 active sessions" \
  --description "## Description\nThe login endpoint (\`/api/auth/login\`) times out after 30 seconds when the authenticating user has more than 50 active sessions. This blocks affected users from logging in entirely.\n\n## Steps to Reproduce\n1. Create or identify a user account with more than 50 active sessions.\n2. Send a POST request to the login endpoint (\`/api/auth/login\`) with valid credentials for that user.\n3. Observe the request hanging and eventually timing out after 30 seconds.\n\n## Expected Behavior\nThe login endpoint returns a successful authentication response within normal latency (under 2 seconds), regardless of the number of active sessions.\n\n## Actual Behavior\nThe request hangs for 30 seconds and then returns a timeout error. Users with more than 50 active sessions cannot log in.\n\n## Severity\n- Frequency: Always (reproducible for any user exceeding 50 sessions)\n- User impact: High -- complete login failure with no workaround\n- Workaround: None (manually clearing sessions requires admin intervention)\n\n## Technical Notes\nLikely cause: the login flow loads or validates all active sessions synchronously before issuing the new token. Investigate session lookup query performance and consider lazy loading, pagination, or capping the validation to recent sessions." \
  --priority High \
  --assignee <accountId> \
  --labels "backend,urgent"
```

Replace `<accountId>` with the actual account ID returned from Step 1.

---

## Exact Ticket Content

**Summary:** `Fix login endpoint timeout when user has more than 50 active sessions`

**Description:**

```
## Description
The login endpoint (`/api/auth/login`) times out after 30 seconds when the
authenticating user has more than 50 active sessions. This blocks affected
users from logging in entirely.

## Steps to Reproduce
1. Create or identify a user account with more than 50 active sessions.
2. Send a POST request to the login endpoint (`/api/auth/login`) with valid credentials for that user.
3. Observe the request hanging and eventually timing out after 30 seconds.

## Expected Behavior
The login endpoint returns a successful authentication response within normal
latency (under 2 seconds), regardless of the number of active sessions.

## Actual Behavior
The request hangs for 30 seconds and then returns a timeout error. Users with
more than 50 active sessions cannot log in.

## Severity
- Frequency: Always (reproducible for any user exceeding 50 sessions)
- User impact: High -- complete login failure with no workaround
- Workaround: None (manually clearing sessions requires admin intervention)

## Technical Notes
Likely cause: the login flow loads or validates all active sessions synchronously
before issuing the new token. Investigate session lookup query performance and
consider lazy loading, pagination, or capping the validation to recent sessions.
```

---

## Design Decisions

1. **Priority set to High (not Highest):** Per the ticket-writing guide, "Highest" is reserved for production-down, data-loss, or security-breach scenarios. This bug blocks a subset of users (those with 50+ sessions) with no workaround, which aligns with "High" -- feature broken for many users, no workaround.

2. **Summary follows "Verb + Object + Context" pattern:** "Fix login endpoint timeout when user has more than 50 active sessions" starts with a verb, names the affected component, and provides the triggering condition.

3. **Description follows the standard bug template:** Includes Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Severity, and Technical Notes sections as prescribed by `references/bug-report-templates.md`.

4. **User lookup before create:** The SKILL.md explicitly states that assigning to a person requires looking up the account ID first (principle 3: "Compose operations naturally"). Display names are not accepted by the `--assignee` flag.

5. **Confirmation before mutation:** The SKILL.md requires confirmation before creating issues (principle 2: "Confirm before mutating").
