# Approach: Create Epic with 3 Stories in ENG Project

## Task Summary

Create an Epic called "Q2 Performance Initiative" in the ENG project, then create 3 child stories linked to it. Assign story 1 to john.doe@company.com and set all stories to Medium priority.

## Execution Plan

### Step 1: Discover Cloud ID

**Tool:** `getAccessibleAtlassianResources`
**Purpose:** Retrieve the Atlassian Cloud ID needed for all subsequent API calls.
**Parameters:** None required.

### Step 2: Validate Project and Get Issue Types

**Tool:** `getJiraProjectIssueTypesMetadata`
**Purpose:** Confirm the ENG project exists and retrieve the issue type IDs for "Epic" and "Story".
**Parameters:**
- `cloudId`: (from Step 1)
- `projectIdOrKey`: `ENG`

This step is critical because the `createJiraIssue` tool requires the exact `issueTypeName` string (e.g., "Epic", "Story") and the project must support these types.

### Step 3: Lookup Assignee Account ID

**Tool:** `lookupJiraAccountId`
**Purpose:** Resolve `john.doe@company.com` to a Jira account ID for assignment.
**Parameters:**
- `cloudId`: (from Step 1)
- `searchString`: `john.doe@company.com`

This can run in parallel with Step 2 since they are independent.

### Step 4: Create the Epic

**Tool:** `createJiraIssue`
**Purpose:** Create the parent Epic.
**Parameters:**
- `cloudId`: (from Step 1)
- `projectKey`: `ENG`
- `issueTypeName`: `Epic`
- `summary`: `Q2 Performance Initiative`
- `additional_fields`: `{ "priority": { "name": "Medium" } }`
- `contentFormat`: `markdown`

**Output:** The Epic's issue key (e.g., `ENG-100`) is needed as the parent for the stories.

### Step 5: Create 3 Stories Under the Epic

**Tool:** `createJiraIssue` (called 3 times)

All 3 stories use:
- `cloudId`: (from Step 1)
- `projectKey`: `ENG`
- `issueTypeName`: `Story`
- `parent`: (Epic key from Step 4)
- `additional_fields`: `{ "priority": { "name": "Medium" } }`
- `contentFormat`: `markdown`

**Story 1:**
- `summary`: `Optimize database query response times`
- `assignee_account_id`: (account ID from Step 3)

**Story 2:**
- `summary`: `Implement Redis caching layer for API`

**Story 3:**
- `summary`: `Set up performance monitoring dashboards`

All 3 stories can be created in parallel since they are independent of each other (they only depend on the Epic key from Step 4).

## Dependency Graph

```
Step 1 (Cloud ID)
├── Step 2 (Issue Types)  ──┐
└── Step 3 (Lookup User)  ──┼── Step 4 (Create Epic) ── Step 5 (Create 3 Stories in parallel)
                             │
                             └── (validate Epic/Story types exist, get account ID)
```

## Key Considerations

1. **Priority field:** Jira uses `{ "priority": { "name": "Medium" } }` in `additional_fields`. The exact allowed values depend on the Jira instance configuration. If "Medium" is not valid, Step 2's field metadata (via `getJiraIssueTypeMetaWithFields`) can be used to discover valid priority names.

2. **Parent linking:** The `parent` parameter on `createJiraIssue` accepts the Epic's issue key. This is the standard way to link stories to an Epic in next-gen/team-managed projects. For company-managed projects, the Epic Link custom field may be needed instead, which would go in `additional_fields` (e.g., `{ "customfield_10014": "ENG-100" }`). If `parent` does not work, use `getJiraIssueTypeMetaWithFields` to find the correct Epic Link field ID.

3. **Assignee lookup:** The email search may return multiple results. The correct account must be selected by matching the email exactly.

4. **Parallelization:** Steps 2 and 3 can run in parallel. The 3 story creations in Step 5 can also run in parallel. This minimizes total API calls to 7 sequential-equivalent steps (1 + max(2,3) + 4 + 5) but only 4 sequential rounds of calls.

## Total API Calls

| Call | Tool | Count |
|------|------|-------|
| Get Cloud ID | `getAccessibleAtlassianResources` | 1 |
| Get Issue Types | `getJiraProjectIssueTypesMetadata` | 1 |
| Lookup User | `lookupJiraAccountId` | 1 |
| Create Epic | `createJiraIssue` | 1 |
| Create Stories | `createJiraIssue` | 3 |
| **Total** | | **7** |
