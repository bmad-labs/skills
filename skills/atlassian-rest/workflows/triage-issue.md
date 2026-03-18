# Triage Issue

Workflow for triaging bug reports with duplicate detection before creating or updating Jira tickets.

**Reference files:** `references/bug-report-templates.md`, `references/jql-patterns.md`

---

## Step 1: Receive Bug Report

Gather bug details from the user:

- **Error message** — exact error text or exception
- **Steps to reproduce** — how to trigger the bug
- **Component** — affected area of the product
- **Severity** — user's assessment of impact (critical, major, minor)
- **Environment** — browser, OS, version, or deployment context

If any critical details are missing, ask follow-up questions before proceeding.

If the user has not specified a Jira project, either ask which project to search in, or search broadly across all projects by omitting `project = X` from JQL. Do not assume a default project.

## Step 2: Search for Duplicates

Run multiple searches to find potential duplicates or related issues.

**By error message:**

```bash
node <skill-path>/scripts/jira.mjs search 'text ~ "error message keywords" AND type = Bug' --max 10
```

**By component:**

```bash
node <skill-path>/scripts/jira.mjs search 'component = "ComponentName" AND type = Bug AND statusCategory != Done' --max 10
```

**By summary keywords:**

```bash
node <skill-path>/scripts/jira.mjs search 'summary ~ "relevant keywords" AND type = Bug' --max 10
```

See `references/jql-patterns.md` for additional search strategies and field-specific queries.

## Step 3: Analyze Matches

For each potential duplicate (top 5 results), fetch full details:

```bash
node <skill-path>/scripts/jira.mjs get <issueKey>
```

Compare each match against the new report:

- **Error messages** — are they the same or similar?
- **Affected components** — same area of the product?
- **Root cause** — if resolved, was the fix related?
- **Status** — open (likely duplicate), resolved (possible regression), closed (might be different)

Rate each match as: exact duplicate, likely related, or unrelated.

## Step 4: Present Findings

Show the user a summary of findings:

- **Potential duplicates** with similarity assessment and current status
- **Previously fixed bugs** that may indicate a regression
- **Recommendation**: create new ticket, comment on existing, or link as related

Example output:

> Found 2 potential matches:
> - **BUG-234** (Open) — "Login fails with 500 error" — likely duplicate
> - **BUG-189** (Resolved) — "Auth timeout on login" — possible regression

## Step 5: Take Action

Based on the user's decision:

**Create a new ticket:**

```bash
node <skill-path>/scripts/jira.mjs create \
  --project <PROJECT_KEY> \
  --type Bug \
  --summary "<clear bug summary>" \
  --description "<structured bug report>" \
  --priority <priority>
```

Follow `references/bug-report-templates.md` for description formatting.

**Comment on an existing ticket:**

```bash
node <skill-path>/scripts/jira.mjs comment <issueKey> "Additional report: <details>"
```

**Link to a related issue:**

```bash
node <skill-path>/scripts/jira.mjs link <newKey> <existingKey> --type "relates to"
```

## Step 6: Confirm

Report the outcome to the user:

- Issue key and direct link for the created or updated ticket
- Any links established between issues
- Suggested next steps (assign to team, escalate, add watchers)
