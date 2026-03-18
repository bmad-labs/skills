# Approach: Triage NullPointerException in UserService.getProfile() (Without Atlassian Skill)

## Task Summary

Triage a NullPointerException occurring in `UserService.getProfile()` at line 342 in the DO project on wnesolutions.atlassian.net. Without the Atlassian REST skill, there are no helper scripts or sub-skills (e.g., triage-issue workflow, JQL pattern references, bug-report templates) available. All Jira interaction must be performed manually by the developer in a browser.

## What Cannot Be Done Without the Skill

- **No automated Jira search:** Cannot run JQL queries programmatically to find existing or duplicate bug reports in the DO project.
- **No ticket creation:** Cannot create a structured bug ticket via API or helper scripts.
- **No regression detection:** Cannot search for previously resolved similar issues to flag regressions.
- **No issue linking:** Cannot link a new bug to related issues automatically.
- **No Confluence lookup:** Cannot search for architecture docs, runbooks, or service documentation related to UserService.
- **No triage sub-skill or workflow:** No step-by-step triage process, JQL pattern library, or bug-report template is loaded.
- **No comment/worklog automation:** Cannot add investigation notes or time tracking to any Jira issue.

## Static Triage Analysis

Since no Jira API access is available, the best I can do is produce a static analysis document and provide manual instructions for the developer.

### Bug Classification

| Field | Value |
|-------|-------|
| **Error type** | `NullPointerException` |
| **Class** | `UserService` |
| **Method** | `getProfile()` |
| **Line** | 342 |
| **Project** | DO |
| **Severity estimate** | Medium-High (breaks profile loading for affected users) |
| **Component area** | Backend / User Service |

### Root Cause Hypothesis

At line 342 of `UserService.getProfile()`, the code likely dereferences a nullable object without a null check. A common pattern is accessing a nested property on a field that can be null, such as:

```java
// Probable cause at line 342:
String avatarUrl = user.getAvatar().getUrl();  // NPE if getAvatar() returns null
```

This would throw a NullPointerException when the user has no avatar (or similar optional field) configured.

### Suggested Fix Pattern

```java
// Null-safe alternative:
String avatarUrl = Optional.ofNullable(user.getAvatar())
    .map(Avatar::getUrl)
    .orElse(DEFAULT_AVATAR_URL);

// Or simple null check:
String avatarUrl = user.getAvatar() != null ? user.getAvatar().getUrl() : null;
```

## Manual Steps the Developer Must Perform

### Step 1: Search for Existing/Duplicate Issues

Open https://wnesolutions.atlassian.net and run these JQL queries manually in the Jira issue search:

**Search A -- Exact error match:**
```
project = DO AND issuetype = Bug AND text ~ "NullPointerException UserService getProfile"
```

**Search B -- Broader UserService bugs:**
```
project = DO AND issuetype = Bug AND text ~ "UserService" AND statusCategory != Done
```

**Search C -- Root cause keywords:**
```
project = DO AND issuetype = Bug AND text ~ "null" AND text ~ "getProfile"
```

### Step 2: Check for Regressions

Run this query to find previously resolved bugs that may have regressed:

```
project = DO AND issuetype = Bug AND text ~ "NullPointerException UserService" AND statusCategory = Done
```

If any resolved issue describes the same or similar NPE in UserService.getProfile(), flag it as a potential regression and consider reopening rather than filing a new ticket.

### Step 3: Create a New Bug Ticket (if no duplicate found)

Manually create a new Bug issue in the DO project with the following fields:

- **Summary:** `NPE in UserService.getProfile() at line 342 - null dereference`
- **Type:** Bug
- **Priority:** High
- **Labels:** `bug`, `backend`, `null-safety`
- **Component:** User Service (or equivalent in the DO project)
- **Description:**

```
## Error
NullPointerException at UserService.getProfile() line 342

## Component
Backend - UserService

## Steps to Reproduce
1. Identify or create a user account with no avatar set (or the relevant nullable field)
2. Call the getProfile() endpoint/method for that user
3. Observe NullPointerException at line 342

## Expected Behavior
getProfile() should handle null fields gracefully and return a valid profile
response, using defaults where necessary.

## Actual Behavior
NullPointerException is thrown at line 342, resulting in a 500 error or
unhandled exception.

## Root Cause Analysis
Line 342 dereferences a nullable object (likely user.getAvatar() or similar)
without a null check. When the field is null, the chained method call throws NPE.

## Suggested Fix
Add null-safety checks or use Optional to handle the nullable field at line 342.
```

### Step 4: Link Related Issues

If the searches in Step 1 returned related (but not duplicate) issues, manually add "relates to" links from the new ticket to those issues in the Jira UI.

### Step 5: Additional Investigation

- Review `UserService.java` around line 342 to confirm the hypothesis
- Search for similar null-unsafe patterns in the same class
- Write a unit test that calls `getProfile()` with null values for optional fields
- Apply fix and verify

## Limitations Summary

| Capability | With Atlassian Skill | Without Skill (this approach) |
|---|---|---|
| Search for duplicate issues via JQL | Automated, multi-strategy search | Must open Jira UI, type queries manually |
| Regression detection | Automated search for resolved similar bugs | Must run JQL manually, analyze results yourself |
| Create structured bug ticket | Single API call with template | Must fill in all fields manually in Jira UI |
| Link to related issues | Automated linking via API | Must find and link manually |
| Confluence doc lookup | CQL search for service docs/runbooks | Must browse Confluence manually |
| Triage workflow guidance | Step-by-step sub-skill with references | No guided workflow; ad-hoc process |
| Add investigation comments | API call | Must type in Jira UI |

### Time Impact

- **With Atlassian skill:** Full triage (search, regression check, ticket creation, linking) completed programmatically in ~1-2 minutes within a single agent session.
- **Without skill:** Agent produces only this static document. The developer must context-switch to the browser and manually perform 5-7 steps across Jira (~10-15 minutes), with no guarantee of using optimal JQL or structured bug templates.
