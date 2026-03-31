# GitHub CLI Commands Reference for BMAD-to-GitHub Projects v2 Sync

Quick-reference for the `gh` CLI commands and GraphQL queries needed to sync BMAD artifacts to a GitHub Projects v2 board.

---

## 1. Prerequisites

Verify the CLI is installed and authenticated with the required `project` scope.

```bash
gh --version
```

```bash
gh auth status
```

```bash
gh auth refresh -s project
```

The `project` scope is **not** included in the default `gh auth login` scopes. You must add it explicitly.

---

## 2. Project Setup

### Get Owner Node ID

For an **organization**:

```bash
gh api graphql -f query='
  query {
    organization(login: "OWNER") {
      id
    }
  }
'
```

For a **user**:

```bash
gh api graphql -f query='
  query {
    user(login: "USERNAME") {
      id
    }
  }
'
```

### Create a Project

```bash
gh api graphql -f query='
  mutation {
    createProjectV2(input: {ownerId: "OWNER_NODE_ID" title: "PROJECT_TITLE"}) {
      projectV2 { id number }
    }
  }
'
```

### Get Project ID by Number

For an **organization**:

```bash
gh api graphql -f query='
  query {
    organization(login: "OWNER") {
      projectV2(number: PROJECT_NUM) { id }
    }
  }
'
```

For a **user**:

```bash
gh api graphql -f query='
  query {
    user(login: "USERNAME") {
      projectV2(number: PROJECT_NUM) { id }
    }
  }
'
```

---

## 3. Custom Field Creation

Supported data types: `TEXT`, `SINGLE_SELECT`, `DATE`, `NUMBER`.

> **Note:** The built-in **Status** field already exists on every project -- do not create it.
>
> **Note:** Iteration fields **cannot** be created via `gh project field-create`. Create them manually in the GitHub UI, then retrieve their IDs with the query in Section 4.

### Story ID (TEXT)

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Story ID" --data-type "TEXT"
```

### Epic (SINGLE_SELECT)

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Epic" --data-type "SINGLE_SELECT" \
  --single-select-options "1: Foundation,2: Navigation,3: Safety,4: Inspection,5: Reporting,6: Tablet,7: Audit Trail,8: Reliability,9: Reports Pro,10: Mission Planning,11: Security,12: Testing"
```

### Phase (SINGLE_SELECT)

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Phase" --data-type "SINGLE_SELECT" \
  --single-select-options "PoC,Hardening"
```

### Dev (SINGLE_SELECT)

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Dev" --data-type "SINGLE_SELECT" \
  --single-select-options "All,Dev 1,Dev 2,Dev 3"
```

### Priority (SINGLE_SELECT)

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Priority" --data-type "SINGLE_SELECT" \
  --single-select-options "Critical Path,Standard,Nice-to-Have"
```

### Sprint Start (DATE)

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Sprint Start" --data-type "DATE"
```

### Sprint End (DATE)

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Sprint End" --data-type "DATE"
```

### Story Points (NUMBER)

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Story Points" --data-type "NUMBER"
```

---

## 4. Field and Option ID Queries

Before editing any item field you need the field IDs and (for single-select fields) the option IDs. Run this once and cache the result.

```bash
gh api graphql -f query='
  query {
    node(id: "PROJECT_ID") {
      ... on ProjectV2 {
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field {
              id
              name
            }
            ... on ProjectV2IterationField {
              id
              name
              configuration {
                iterations { startDate id }
              }
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              options { id name }
            }
          }
        }
      }
    }
  }
'
```

The response includes every field with its `id`. For `ProjectV2SingleSelectField` entries, each `options[]` item contains the `id` you pass to `--single-select-option-id`. For `ProjectV2IterationField` entries, the `iterations[]` array gives the `id` you pass to `--iteration-id`.

---

## 5. Label Management

Labels live on the **repository**, not on the project. Use them to tag issues with epic, phase, and architecture-layer metadata.

### Pattern

```bash
gh label create "LABEL_NAME" --color "HEX_COLOR" --description "optional description"
```

### Epic Labels

```bash
gh label create "epic:1-foundation"       --color "0075ca"
gh label create "epic:2-navigation"        --color "008672"
gh label create "epic:3-safety"            --color "e4e669"
# ... one per epic, through epic:12-testing
```

### Phase Labels

```bash
gh label create "phase:poc"        --color "0075ca"
gh label create "phase:hardening"  --color "d73a4a"
```

### Layer Labels

```bash
gh label create "layer:{name}"       --color "{hex}"
# Example: gh label create "layer:frontend" --color "fbca04"
# Layer labels are optional and project-specific
```

---

## 6. Milestone Management

Milestones map to sprints. They live on the repository and are created via the REST API.

### Create a Milestone

```bash
gh api repos/{owner}/{repo}/milestones \
  --method POST \
  -f title="Sprint 1" \
  -f due_on="2026-04-14T00:00:00Z" \
  -f description="Sprint objective from sprint-plan.md"
```

The `due_on` field is ISO 8601 format. The `state` field defaults to `"open"`.

### Batch-Create All 12 Sprints (example loop)

```bash
for i in $(seq 1 12); do
  gh api repos/{owner}/{repo}/milestones \
    --method POST \
    -f title="Sprint $i" \
    -f state=open
done
```

---

## 7. Issue CRUD

Issues are the real work items that appear in the repository and get added to the project board.

### Create an Issue

```bash
gh issue create \
  --title "1.1 Short Story Title" \
  --body-file _bmad-output/implementation-artifacts/1-1-set-up-project-structure.md \
  --label "epic:1-foundation" --label "phase:poc" \
  --milestone "Sprint 1" \
  --assignee "dev1,dev2,dev3"
```

### Edit an Issue

```bash
gh issue edit 42 \
  --body-file _bmad-output/implementation-artifacts/1-1-set-up-project-structure.md \
  --add-label "epic:1-foundation" \
  --milestone "Sprint 1"
```

### View an Issue (JSON)

```bash
gh issue view 42 --json number,title,state,labels,milestone,assignees,body
```

> **Note:** Assignees, Labels, and Milestones are **issue properties** -- they cannot be set via `gh project item-edit`. Use `gh issue edit` instead.

---

## 8. Project Item Management

### Add an Issue to the Project

```bash
gh project item-add PROJECT_NUM --owner OWNER --url https://github.com/OWNER/REPO/issues/42 --format json
```

Returns a JSON object with the project item `id`.

### Edit Item Field Values

Each field type uses a different flag:

```bash
# Text field
gh project item-edit --id ITEM_ID --project-id PROJECT_ID \
  --field-id FIELD_ID --text "1.1"

# Number field
gh project item-edit --id ITEM_ID --project-id PROJECT_ID \
  --field-id FIELD_ID --number 5

# Date field (YYYY-MM-DD)
gh project item-edit --id ITEM_ID --project-id PROJECT_ID \
  --field-id FIELD_ID --date "2026-04-01"

# Single-select field
gh project item-edit --id ITEM_ID --project-id PROJECT_ID \
  --field-id FIELD_ID --single-select-option-id OPTION_ID

# Iteration field
gh project item-edit --id ITEM_ID --project-id PROJECT_ID \
  --field-id FIELD_ID --iteration-id ITERATION_ID

# Clear a field value
gh project item-edit --id ITEM_ID --project-id PROJECT_ID \
  --field-id FIELD_ID --clear
```

### List All Project Items

```bash
gh project item-list PROJECT_NUM --owner OWNER --format json --limit 100
```

---

## 9. GraphQL: Query All Items with Field Values

The `item-list` CLI command does not return custom field values. Use this GraphQL query to get the full picture.

```bash
gh api graphql -f query='
  query {
    node(id: "PROJECT_ID") {
      ... on ProjectV2 {
        items(first: 100) {
          nodes {
            id
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field { ... on ProjectV2FieldCommon { name } }
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field { ... on ProjectV2FieldCommon { name } }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2FieldCommon { name } }
                }
                ... on ProjectV2ItemFieldIterationValue {
                  title
                  startDate
                  duration
                  field { ... on ProjectV2FieldCommon { name } }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field { ... on ProjectV2FieldCommon { name } }
                }
              }
            }
            content {
              ... on Issue {
                title
                number
                state
                labels(first: 10) { nodes { name } }
                assignees(first: 5) { nodes { login } }
              }
              ... on DraftIssue {
                title
                body
              }
            }
          }
        }
      }
    }
  }
'
```

For projects with more than 100 items, add pagination using `after` cursor:

```bash
items(first: 100, after: "CURSOR") {
  pageInfo { hasNextPage endCursor }
  nodes { ... }
}
```

---

## 10. GraphQL: Mutations

### Add an Existing Issue to a Project

```bash
gh api graphql -f query='
  mutation {
    addProjectV2ItemById(input: {projectId: "PROJECT_ID" contentId: "ISSUE_NODE_ID"}) {
      item { id }
    }
  }
'
```

`ISSUE_NODE_ID` is the GraphQL node ID of the issue (not the issue number). Obtain it via `gh issue view 42 --json id`.

### Update a Field Value

**Text:**

```bash
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "PROJECT_ID"
      itemId: "ITEM_ID"
      fieldId: "FIELD_ID"
      value: { text: "1.1" }
    }) {
      projectV2Item { id }
    }
  }
'
```

**Number:**

```bash
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "PROJECT_ID"
      itemId: "ITEM_ID"
      fieldId: "FIELD_ID"
      value: { number: 5.0 }
    }) {
      projectV2Item { id }
    }
  }
'
```

**Date:**

```bash
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "PROJECT_ID"
      itemId: "ITEM_ID"
      fieldId: "FIELD_ID"
      value: { date: "2026-04-01" }
    }) {
      projectV2Item { id }
    }
  }
'
```

**Single-select:**

```bash
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "PROJECT_ID"
      itemId: "ITEM_ID"
      fieldId: "FIELD_ID"
      value: { singleSelectOptionId: "OPTION_ID" }
    }) {
      projectV2Item { id }
    }
  }
'
```

**Iteration:**

```bash
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "PROJECT_ID"
      itemId: "ITEM_ID"
      fieldId: "FIELD_ID"
      value: { iterationId: "ITERATION_ID" }
    }) {
      projectV2Item { id }
    }
  }
'
```

### Delete an Item from a Project

```bash
gh api graphql -f query='
  mutation {
    deleteProjectV2Item(input: {projectId: "PROJECT_ID" itemId: "ITEM_ID"}) {
      deletedItemId
    }
  }
'
```

> **Important:** `updateProjectV2ItemFieldValue` cannot set Assignees, Labels, or Milestones. Those are issue properties -- use `gh issue edit` instead.

---

## 11. Rate Limits

| Limit | Value |
|-------|-------|
| Primary rate limit | 5,000 points/hour (user token) |
| Secondary rate limit | 2,000 points/minute |
| Enterprise Cloud apps | 10,000 points/hour |
| Pagination max per page | 100 items (`first` or `last` argument) |

**Project size estimate:** For a typical BMAD project (dozens of stories across multiple epics), a full initial push (create issue + add to project + set fields per story) uses roughly 1-2 API points per story -- well within the hourly limit. The sync can run hundreds of times per hour without hitting rate limits.
