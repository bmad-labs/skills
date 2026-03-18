# Approach: Triage NullPointerException in UserService.getProfile()

## Task Summary

Triage a NullPointerException occurring at `UserService.getProfile()` line 342 in the DO project at `wnesolutions.atlassian.net`. Following the `workflows/triage-issue.md` workflow with reference to `references/bug-report-templates.md` and `references/jql-patterns.md`.

---

## Step 1: Receive Bug Report (Gather Details)

The bug report details extracted from the user request:

| Field | Value |
|-------|-------|
| **Error message** | `NullPointerException` in `UserService.getProfile()` at line 342 |
| **Component** | UserService (user profile functionality) |
| **Severity** | High (exception crash, likely blocks user profile access) |
| **Steps to reproduce** | Not provided -- would ask user for specifics |
| **Environment** | Not provided -- would ask user for specifics |

Per the workflow, if critical details are missing, we ask follow-up questions. In this case we would ask:
- What triggers the NPE? (e.g., viewing a specific user profile, all profiles, new users only?)
- What environment? (production, staging, specific version?)
- Is there a workaround?
- How frequent is it? (always, intermittent, specific conditions?)

For this evaluation, we proceed with available information.

---

## Step 2: Search for Duplicates

The workflow calls for three parallel JQL searches to find potential duplicates. The skill path is `/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest`.

### Search 2a: By error message keywords

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND issuetype = Bug AND text ~ "NullPointerException UserService getProfile"' --max 10
```

### Search 2b: By component (UserService / user-related)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND issuetype = Bug AND text ~ "UserService" AND statusCategory != Done' --max 10
```

### Search 2c: By summary keywords (NullPointerException + profile)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND issuetype = Bug AND summary ~ "NullPointerException"' --max 10
```

### Search 2d: Broader NPE search across the project

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND issuetype = Bug AND text ~ "NullPointerException" AND statusCategory != Done' --max 10
```

### Search 2e: Profile-related bugs (catch different error messages in the same component)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND issuetype = Bug AND text ~ "getProfile" AND statusCategory != Done' --max 10
```

---

## Step 3: Analyze Matches

For each potential duplicate returned from the searches above (top 5 results), fetch full details:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get <issueKey>
```

For example, if searches return DO-45, DO-78, DO-112:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-45
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-78
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-112
```

**Comparison criteria per the workflow:**

| Criterion | What to Check |
|-----------|---------------|
| Error messages | Same `NullPointerException`? Same class (`UserService`)? Same method (`getProfile`)? Same line (342)? |
| Affected components | Same user profile area? |
| Root cause | If resolved, was the fix in `UserService.getProfile()` or related code? |
| Status | Open = likely duplicate; Resolved = possible regression; Closed = may be different issue |

Rate each match as: **exact duplicate**, **likely related**, or **unrelated**.

---

## Step 4: Present Findings

Present a summary table to the user, for example:

> **Duplicate Search Results for NullPointerException in UserService.getProfile() at line 342:**
>
> | Issue | Status | Summary | Assessment |
> |-------|--------|---------|------------|
> | DO-45 | Open | NPE in UserService when profile is null | Likely duplicate |
> | DO-78 | Resolved | Profile page crash for new users | Possible regression |
> | DO-112 | Open | getProfile returns null for deleted accounts | Likely related |
>
> **Recommendation:** If DO-45 is an exact match, comment on it with the new occurrence details. If it's a regression of DO-78, create a new ticket and link it. If no matches found, create a new Bug ticket.

---

## Step 5: Take Action

### Option A: Create New Bug Ticket (if no duplicates found)

Following the **Error Message Bug Template** from `references/bug-report-templates.md`:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Bug \
  --summary "[UserService] NullPointerException in getProfile() at line 342" \
  --description "## Error\n\`NullPointerException\` in \`UserService.getProfile()\` at line 342\n\n## Where\nUserService.getProfile() method - occurs when loading user profile data.\n\n## Stack Trace\n\`\`\`\njava.lang.NullPointerException\n    at com.example.service.UserService.getProfile(UserService.java:342)\n\`\`\`\n\n## Trigger\nCalling getProfile() - exact trigger conditions to be determined.\n\n## Frequency\nTo be confirmed by reporter.\n\n## Severity\n- User impact: High (blocks profile access)\n- Workaround: Unknown\n\n## Additional Context\nNeeds investigation to determine if the null reference is the user object, a profile field, or a dependency injection issue." \
  --priority High \
  --labels "bug,user-service,npe"
```

### Option B: Comment on Existing Duplicate (if duplicate found, e.g., DO-45)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs comment DO-45 "Additional occurrence reported: NullPointerException in UserService.getProfile() at line 342. This appears to be the same issue. Confirming this bug is still active."
```

### Option C: Create New Ticket and Link as Regression (if previously fixed, e.g., DO-78)

First create the new ticket:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs create \
  --project DO \
  --type Bug \
  --summary "[UserService] Regression: NullPointerException in getProfile() at line 342" \
  --description "## Regression\nThis appears to be a regression of DO-78 which was previously resolved.\n\n## Error\n\`NullPointerException\` in \`UserService.getProfile()\` at line 342\n\n## Where\nUserService.getProfile() method - occurs when loading user profile data.\n\n## Stack Trace\n\`\`\`\njava.lang.NullPointerException\n    at com.example.service.UserService.getProfile(UserService.java:342)\n\`\`\`\n\n## Trigger\nSame scenario as DO-78. Needs verification.\n\n## Verification\nConfirm that the original fix from DO-78 is still in place and identify what reintroduced the null reference." \
  --priority High \
  --labels "bug,regression,user-service,npe"
```

Then get available link types:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs link-types
```

Then link the new ticket to the previously resolved one:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs link DO-<newKey> DO-78 --type "relates to"
```

### Option D: Create New Ticket and Link as Related (if related but not duplicate)

Create the ticket (same as Option A), then link:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs link DO-<newKey> DO-112 --type "relates to"
```

---

## Step 6: Confirm

Report to the user:
- The issue key and URL (e.g., `DO-150` at `https://wnesolutions.atlassian.net/browse/DO-150`)
- Any links established between issues
- Suggested next steps:
  - Assign to the UserService team lead
  - Add stack trace and reproduction steps once available
  - Escalate if this is blocking production users

---

## Skill Features Used

| Feature | How Used |
|---------|----------|
| `jira.mjs search` | 5 JQL searches for duplicate detection (error text, component, summary, broader NPE, getProfile method) |
| `jira.mjs get` | Fetch full details of each potential duplicate for comparison |
| `jira.mjs create` | Create new Bug ticket with structured description following bug-report-templates.md |
| `jira.mjs comment` | Add occurrence details to existing duplicate ticket |
| `jira.mjs link-types` | Discover available link types before linking |
| `jira.mjs link` | Link related or regression tickets |
| `references/bug-report-templates.md` | Error Message Bug Template for description structure; Priority Assignment Guide for severity |
| `references/query-languages.md` | JQL syntax for text search (~), field matching, statusCategory filters |
| `references/jql-patterns.md` | Bug tracking patterns for duplicate searches |
| `workflows/triage-issue.md` | Full 6-step triage workflow followed end-to-end |

## Key Decisions

1. **Priority: High** -- Per the Priority Assignment Guide, a feature broken (profile access) with no known workaround warrants High priority. Not Highest because no data loss or security impact is indicated.
2. **Multiple search strategies** -- Used 5 different JQL queries to maximize duplicate detection coverage: exact error text, component-scoped, summary keywords, broader NPE search, and method-specific search.
3. **Error Message Bug Template** chosen over Standard Bug Template because the bug is triggered by a specific exception with a known class and line number.
4. **Confirm before mutating** -- Per SKILL.md principle #2, all create/comment/link operations require user confirmation before execution.
