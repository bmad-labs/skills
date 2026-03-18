# Triage Approach: NullPointerException in UserService.getProfile()

## 1. Sub-Skill Loaded

Loaded the **Triage Issue** workflow from `skills/triage-issue.md`. This workflow defines a 6-step process: receive bug report, search for duplicates, analyze matches, present findings, take action, and confirm. It references two key documents: `references/bug-report-templates.md` and `references/jql-patterns.md`.

## 2. Key Information Extracted

| Field | Value |
|-------|-------|
| **Error type** | `NullPointerException` |
| **Class** | `UserService` |
| **Method** | `getProfile()` |
| **Line** | 342 |
| **Root cause** | User has no avatar set (null avatar field accessed without null check) |
| **Component area** | Backend / User Service |
| **Project** | BACKEND |

### Missing information to request from the reporter (per Step 1 of triage workflow)

- **Steps to reproduce:** Which endpoint or UI action triggers `getProfile()`? Is it viewing another user's profile, or your own?
- **Severity:** Does this block login/session, or just a profile view?
- **Environment:** Which deployment environment (staging, production)? Which version/build?
- **Frequency:** Does it affect all users without avatars, or only under certain conditions?

For the purpose of this simulation, we proceed with the information available.

## 3. Multiple Search Strategies with Exact JQL

Following the triage workflow's Step 2 (Search for Duplicates), three complementary search strategies are used. The `references/jql-patterns.md` and `references/search-patterns.md` informed the query construction.

### Strategy A: Search by error message keywords

```bash
node <skill-path>/scripts/jira.mjs search \
  'project = BACKEND AND issuetype = Bug AND text ~ "NullPointerException UserService getProfile"' \
  --max 10
```

**Rationale:** Full-text search across all fields catches any ticket that mentions this exact exception in the same class/method, regardless of how the summary was written.

### Strategy B: Search by component and class name

```bash
node <skill-path>/scripts/jira.mjs search \
  'project = BACKEND AND issuetype = Bug AND text ~ "UserService" AND statusCategory != Done' \
  --max 10
```

**Rationale:** Narrows to open bugs in UserService. A different NPE in the same class could indicate a broader null-safety problem, and the fix might overlap.

### Strategy C: Search by root cause (avatar/null)

```bash
node <skill-path>/scripts/jira.mjs search \
  'project = BACKEND AND issuetype = Bug AND text ~ "avatar" AND text ~ "null"' \
  --max 10
```

**Rationale:** The root cause is a null avatar. Someone may have filed the bug describing the symptom ("avatar not set") rather than the exception class name. This catches differently-worded reports of the same underlying defect.

### Strategy D: Broad NullPointerException search in the project

```bash
node <skill-path>/scripts/jira.mjs search \
  'project = BACKEND AND issuetype = Bug AND summary ~ "NullPointerException" ORDER BY created DESC' \
  --max 10
```

**Rationale:** Catches NPE bugs filed with the exception type in the summary, even if the description doesn't mention UserService. Useful for spotting patterns of missing null checks across the codebase.

## 4. Regression Check

Per Step 3 of the triage workflow, any match with status "Resolved" or "Closed" that describes a similar error is flagged as a **possible regression**. The specific JQL for regression detection:

### Check for previously resolved similar bugs

```bash
node <skill-path>/scripts/jira.mjs search \
  'project = BACKEND AND issuetype = Bug AND text ~ "NullPointerException UserService" AND statusCategory = Done' \
  --max 10
```

**Rationale:** If this exact exception was fixed before and is now recurring, it is a regression. The `references/jql-patterns.md` provides a dedicated regression pattern:

```sql
issuetype = Bug AND status CHANGED FROM Done TO Open
```

This could be combined with the component filter to find reopened bugs in UserService.

### Check for reopened bugs specifically

```bash
node <skill-path>/scripts/jira.mjs search \
  'project = BACKEND AND issuetype = Bug AND status CHANGED FROM Done TO Open AND text ~ "UserService"' \
  --max 10
```

### Analysis criteria for each match (from triage workflow Step 3)

For the top 5 results from all searches, fetch full details with `jira.mjs get <issueKey>` and evaluate:

- **Error messages** -- Is it the same `NullPointerException` at `UserService.getProfile():342`, or a different line/method?
- **Affected components** -- Same User Service / profile functionality?
- **Root cause** -- If resolved, was the fix a null check on avatar? Could it have been reverted or bypassed?
- **Status** -- Open = likely duplicate; Resolved = possible regression; Closed with "Won't Fix" = known limitation

Each match is rated as: **exact duplicate**, **likely related**, or **unrelated**.

## 5. Bug Report Format (If Creating New)

If no duplicate is found and the user confirms creating a new ticket, the **Error Message Bug Template** from `references/bug-report-templates.md` is used, combined with the summary format from `references/ticket-writing-guide.md` (Verb + Object + Context):

### Summary

```
Fix NullPointerException in UserService.getProfile() when user has no avatar
```

### Priority Assignment

Per the priority guide in `references/bug-report-templates.md`:

| Severity | Frequency | Resulting Priority |
|----------|-----------|-------------------|
| Feature broken (profile view fails), workaround exists (set an avatar) | Likely intermittent (only users without avatars) | **Medium** |

### Labels

`bug`, `backend` (per label conventions in `references/ticket-writing-guide.md`)

### Components

`user-service` (per component conventions: name after service/module)

### Description (following Error Message Bug Template)

```markdown
## Error
`NullPointerException` at `UserService.getProfile()` line 342

## Where
Backend - UserService.getProfile() method, triggered when loading a user profile.

## Stack Trace
[Full stack trace would be included here from the reporter's input]

## Trigger
Occurs when the target user has no avatar set. The code accesses the avatar
field without a null check, causing the NPE at line 342.

## Frequency
Reproducible for any user account that has no avatar configured.

## Expected Behavior
getProfile() should return the user profile with a default/placeholder avatar
when no custom avatar is set.

## Actual Behavior
NullPointerException thrown, causing a 500 error response.

## Environment
- Service: User Service (Backend)
- Version/Build: [to be filled by reporter]
- Environment: [to be filled by reporter]
```

### Create command

```bash
node <skill-path>/scripts/jira.mjs create \
  --project BACKEND \
  --type Bug \
  --summary "Fix NullPointerException in UserService.getProfile() when user has no avatar" \
  --description "<structured description above>" \
  --priority Medium \
  --labels "bug,backend" \
  --components "user-service"
```

If a related (but not duplicate) issue is found, also link them:

```bash
node <skill-path>/scripts/jira.mjs link <newKey> <relatedKey> --type "relates to"
```

## 6. Reference Files Consulted

| Reference File | Why Consulted | What Was Used |
|----------------|---------------|---------------|
| `skills/triage-issue.md` | Primary workflow -- defines the 6-step triage process | Full step-by-step process: receive, search, analyze, present, act, confirm |
| `references/jql-patterns.md` | JQL query patterns for bug tracking and regression detection | "Open bugs by priority", "Regressions (reopened bugs)", component/label query patterns |
| `references/bug-report-templates.md` | Bug description formatting and priority assignment | Error Message Bug Template, Regression Bug Template (if regression detected), Priority Assignment Guide |
| `references/query-languages.md` | JQL syntax reference for correct field names, operators, functions | `text ~` operator for full-text search, `statusCategory` field, `CHANGED FROM...TO` operator |
| `references/search-patterns.md` | Multi-source search strategies and refinement techniques | "Find related work for a bug" pattern, parallel search flow, broadening/narrowing techniques |
| `references/ticket-writing-guide.md` | Summary format, label/component conventions, description structure | "Verb + Object + Context" summary pattern, label categories, component naming conventions |
