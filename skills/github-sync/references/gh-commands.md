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
  --single-select-options "1: {Epic1Name},2: {Epic2Name},3: {Epic3Name},..."
```

Derive epic names from `epics.md`. Format each option as `{N}: {Short Name}`.

### Phase (SINGLE_SELECT)

> **Note:** No longer used as a custom field. Phase is expressed through the milestone
> (PoC / Production Hardening). Do NOT create a Phase field during onboarding.

### Sprint (SINGLE_SELECT)

The Sprint field enables board grouping by sprint. It is separate from Sprint Start/Sprint End
DATE fields. Create with 12 options then apply rainbow colors (see Section 13).

```bash
gh project field-create PROJECT_NUM --owner OWNER --name "Sprint" --data-type "SINGLE_SELECT" \
  --single-select-options "Sprint 01,Sprint 02,Sprint 03,Sprint 04,Sprint 05,Sprint 06,Sprint 07,Sprint 08,Sprint 09,Sprint 10,Sprint 11,Sprint 12"
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

Milestones represent **project phases**, not individual sprints.

### Create Phase Milestones

```bash
gh api repos/{owner}/{repo}/milestones --method POST \
  -f title="{phase_name}" \
  -f due_on="{phase_end_date}T00:00:00Z" \
  -f description="{phase_description}"
```

Derive phase names, due dates, and descriptions from `sprint-plan.md`.
Milestone `number` is returned in the response — save it to `.github-sync.yaml` under `milestones`.

---

## 7. Issue CRUD

Issues are the real work items that appear in the repository and get added to the project board.

### Create an Issue

```bash
gh issue create \
  --title "1.1 Short Story Title" \
  --body-file /tmp/issue-1.1.md \
  --label "epic:1-foundation" --label "phase:poc" \
  --milestone "PoC" \
  --assignee "dev1,dev2,dev3"
```

### Edit an Issue

```bash
gh issue edit 42 \
  --body-file /tmp/issue-1.1.md \
  --add-label "epic:1-foundation" \
  --milestone "PoC"
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
  --field-id FIELD_ID --date "YYYY-MM-DD"

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
      value: { date: "YYYY-MM-DD" }
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

---

## 12. Issue Relationships

GitHub issues support three native relationship types accessible via GraphQL:
- **Parent/child** (sub-issues): epic tracking issue → story issues
- **Blocked by**: story A is blocked by story B
- **Blocking**: inverse — shown automatically when "blocked by" is set

### Get Issue Node IDs

```bash
gh api graphql -f query='
  query {
    repository(owner:"{owner}", name:"{repo}") {
      issues(first:50, orderBy:{field:CREATED_AT, direction:ASC}) {
        nodes { number id title }
      }
    }
  }
'
```

### Set Parent Issue (addSubIssue)

Makes a story issue a child of its epic tracking issue. Results in the "Add parent" relationship
shown in the GitHub issue sidebar.

```bash
gh api graphql -f query='
mutation {
  addSubIssue(input: {
    issueId: "{epic_tracking_issue_node_id}"
    subIssueId: "{story_issue_node_id}"
    replaceParent: true
  }) {
    issue { number }
    subIssue { number }
  }
}
'
```

- `issueId`: the **parent** (epic tracking issue)
- `subIssueId`: the **child** (story issue)
- `replaceParent: true`: replaces any existing parent assignment

### Set Blocked-by Relationship (addBlockedBy)

Marks story A as blocked by story B. Results in "Mark as blocked by" in the GitHub issue sidebar.

```bash
gh api graphql -f query='
mutation {
  addBlockedBy(input: {
    issueId: "{story_A_node_id}"
    blockingIssueId: "{story_B_node_id}"
  }) {
    issue { number }
    blockingIssue { number }
  }
}
'
```

- `issueId`: the issue being blocked (depends on the other)
- `blockingIssueId`: the issue doing the blocking (must be completed first)

> **Common mistakes:**
> - Field is `blockingIssueId` (not `blockedByIssueId` or `blockedBy`)
> - Return payload field is `blockingIssue` (not `blockedByIssue`)

### Remove Relationships

```bash
# Remove sub-issue
gh api graphql -f query='
mutation {
  removeSubIssue(input: {issueId: "{parent_id}", subIssueId: "{child_id}"}) {
    issue { number }
  }
}
'

# Remove blocked-by
gh api graphql -f query='
mutation {
  removeBlockedBy(input: {issueId: "{blocked_id}", blockingIssueId: "{blocking_id}"}) {
    issue { number }
  }
}
'
```

---

## 13. Single-Select Field: Update Colors and Descriptions

Use this mutation to apply rainbow colors and goal descriptions to the Sprint and Epic fields.

> **Warning:** This mutation REPLACES the entire options list and issues NEW option IDs.
> The old option IDs in `.github-sync.yaml` become invalid immediately. Re-query and update
> the config after every call.

```bash
gh api graphql -f query='
mutation {
  updateProjectV2Field(input: {
    fieldId: "{field_id}"
    singleSelectOptions: [
      {name: "Sprint 01", color: RED,    description: "{sprint_1_objective_from_sprint_plan}"},
      {name: "Sprint 02", color: ORANGE, description: "{sprint_2_objective}"},
      {name: "Sprint 03", color: YELLOW, description: "{sprint_3_objective}"},
      {name: "Sprint 04", color: GREEN,  description: "{sprint_4_objective}"},
      {name: "Sprint 05", color: BLUE,   description: "{sprint_5_objective}"},
      {name: "Sprint 06", color: PURPLE, description: "{sprint_6_objective}"},
      {name: "Sprint 07", color: PINK,   description: "{sprint_7_objective}"},
      {name: "Sprint 08", color: RED,    description: "{sprint_8_objective}"},
      {name: "Sprint 09", color: ORANGE, description: "{sprint_9_objective}"},
      {name: "Sprint 10", color: YELLOW, description: "{sprint_10_objective}"},
      {name: "Sprint 11", color: GREEN,  description: "{sprint_11_objective}"},
      {name: "Sprint 12", color: BLUE,   description: "{sprint_12_objective}"}
    ]
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        name
        options { id name color description }
      }
    }
  }
}
'
```

Sprint descriptions come from the **Objective** line in each sprint section of `sprint-plan.md`.
Adjust the number of options to match the actual sprint count in the project.

### Input Rules

| Rule | Detail |
|------|--------|
| `fieldId` only | Do NOT pass `projectId` — not accepted by this mutation |
| Options: `name`, `color`, `description` only | Do NOT pass `id` — not accepted |
| Color values | Must be enum: `GRAY`, `BLUE`, `GREEN`, `YELLOW`, `ORANGE`, `RED`, `PINK`, `PURPLE` |
| Description | Optional free text shown on hover in the board |

### Rainbow Color Schemes

**Sprint field (12 options, two cycles of 6):**
01:RED, 02:ORANGE, 03:YELLOW, 04:GREEN, 05:BLUE, 06:PURPLE,
07:PINK, 08:RED, 09:ORANGE, 10:YELLOW, 11:GREEN, 12:BLUE

**Epic field (12 options):**
1:RED, 2:ORANGE, 3:YELLOW, 4:GREEN, 5:BLUE, 6:PURPLE,
7:PINK, 8:RED, 9:ORANGE, 10:YELLOW, 11:GREEN, 12:BLUE

### After the Mutation: Re-query New IDs

```bash
gh api graphql -f query='
  query {
    node(id: "{PROJECT_ID}") {
      ... on ProjectV2 {
        fields(first: 30) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id name
              options { id name color description }
            }
          }
        }
      }
    }
  }
' | python3 -c "
import sys,json
d=json.load(sys.stdin)
for f in d['data']['node']['fields']['nodes']:
    if f and f.get('name') in ('Sprint','Epic'):
        print(f['name'], f['id'])
        for o in f['options']:
            print(f'  {o[\"name\"]}: {o[\"id\"]}')
"
```

Update `option_ids.sprint` and `option_ids.epic` in `.github-sync.yaml` with the new IDs,
then re-apply all Sprint and Epic field values to existing project items.
