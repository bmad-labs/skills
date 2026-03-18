# Approach: Push Epic Doc to Jira with Mapping Instructions

## Task Summary

Push a local epic document to Jira. The field mapping config (`memory/jira-epic-field-mapping.json`) contains an `instructions` field that says: "Always add label qa-review and set component to Backend." The agent must detect and follow these instructions during the push operation.

## Workflow Identified

**Sync BMAD Documents** workflow (`workflows/sync-bmad-documents.md`), specifically the push path for an already-linked epic document.

## Step-by-Step Approach

### Step 1: Identify Document Type

Parse the epic document to confirm it is an epic (has `## Epic` headings or `### Story N.M:` patterns, or frontmatter with `inputDocuments` array).

- **Doc type:** `epic`
- **Target system:** Jira

### Step 2: Check for Existing Link

```bash
node <skill-path>/scripts/sync.mjs status <epic-file-path>
```

- If `linked: true` with an existing Jira ticket key (e.g., `PROJ-100`), skip to Step 5.
- If unlinked, proceed to Step 3 for first-time link setup.

### Step 3: First-Time Link Setup (if unlinked)

Ask the user for the Jira project key, then:

```bash
node <skill-path>/scripts/sync.mjs link <epic-file-path> --type epic --project PROJ --create
```

This creates the epic ticket in Jira, updates the local document with `jira_ticket_id` in frontmatter (or `[PROJ-100]` prefix), and creates sync state.

### Step 4: Verify Field Mapping Exists

Check if the epic field mapping config exists:

```bash
ls <skill-path>/memory/jira-epic-field-mapping.json
```

If it exists, load it and inspect the `instructions` field. If not, run setup:

```bash
node <skill-path>/scripts/sync.mjs setup-mapping --type epic --sample PROJ-100
```

The mapping config in this scenario already exists and contains:

```json
{
  "instructions": "Always add label qa-review and set component to Backend.",
  "docType": "epic",
  "projectKey": "PROJ",
  "issueType": "Epic",
  "fieldMappings": [ ... ],
  "childMapping": { ... }
}
```

### Step 5: Detect Changes (Diff)

```bash
node <skill-path>/scripts/sync.mjs diff <epic-file-path>
```

Review the per-section change indicators to understand what will be pushed:
- `->` local changed, remote unchanged (push candidate)
- `=` no changes

Present the change summary table to the user for confirmation.

### Step 6: Review Changes with User

Present a table like:

| Section | Local | Remote | Action |
|---------|-------|--------|--------|
| Overview | modified | unchanged | push |
| Story 1.1 | new | - | create |
| Story 1.2 | modified | unchanged | push |

Ask user to confirm which changes to sync.

### Step 7: Execute Push

```bash
node <skill-path>/scripts/sync.mjs push <epic-file-path>
```

The `push` command will:
1. Read the field mapping config from `memory/jira-epic-field-mapping.json`
2. **Print the `instructions` field to stdout** so the agent can read and follow them
3. Map local document sections to Jira fields per the `fieldMappings` array
4. Create/update child story tickets per the `childMapping` configuration
5. Update sync state hashes

### Step 8: Follow Mapping Instructions

The `instructions` field says: **"Always add label qa-review and set component to Backend."**

After the push creates/updates tickets, the agent must apply these instructions to every created or updated issue. The push command outputs the instructions to stdout; the agent reads them and executes the additional edits.

**For the parent epic ticket (e.g., PROJ-100):**

```bash
node <skill-path>/scripts/jira.mjs edit PROJ-100 --labels "qa-review" --components "Backend"
```

**For each child story ticket created or updated during the push (e.g., PROJ-101, PROJ-102, PROJ-103):**

```bash
node <skill-path>/scripts/jira.mjs edit PROJ-101 --labels "qa-review" --components "Backend"
node <skill-path>/scripts/jira.mjs edit PROJ-102 --labels "qa-review" --components "Backend"
node <skill-path>/scripts/jira.mjs edit PROJ-103 --labels "qa-review" --components "Backend"
```

The agent must iterate over all ticket keys reported in the push output and apply the label and component to each one.

### Step 9: Report Results

Present a summary table:

| Action | Section/Field | Result |
|--------|--------------|--------|
| pushed | Overview | Updated PROJ-100 description |
| pushed | Story 1.1 | Created PROJ-101 |
| pushed | Story 1.2 | Updated PROJ-102 |
| instruction | PROJ-100 | Added label `qa-review`, component `Backend` |
| instruction | PROJ-101 | Added label `qa-review`, component `Backend` |
| instruction | PROJ-102 | Added label `qa-review`, component `Backend` |

Include links to all created/updated tickets.

## Key Skill Features Used

1. **sync.mjs push** - Handles the document-to-Jira field mapping and sync state automatically
2. **instructions field** - The mapping config's `instructions` field is printed to stdout during push/link operations; the agent reads and follows these natural-language instructions
3. **jira.mjs edit** - Used post-push to apply the instruction-mandated label (`qa-review`) and component (`Backend`) to all affected tickets
4. **Confirm before mutating** - Per SKILL.md principle #2, the agent shows the diff and gets user confirmation before executing the push
5. **childMapping** - Epic push automatically handles child story creation/updates, and the instructions apply to children as well

## Commands Summary (in execution order)

| # | Command | Purpose |
|---|---------|---------|
| 1 | `node <skill-path>/scripts/sync.mjs status <file>` | Check if document is already linked |
| 2 | `node <skill-path>/scripts/sync.mjs link <file> --type epic --project PROJ --create` | First-time link (if needed) |
| 3 | `ls <skill-path>/memory/jira-epic-field-mapping.json` | Verify mapping config exists |
| 4 | `node <skill-path>/scripts/sync.mjs diff <file>` | Show what changed locally vs remotely |
| 5 | `node <skill-path>/scripts/sync.mjs push <file>` | Push local changes to Jira |
| 6 | `node <skill-path>/scripts/jira.mjs edit <KEY> --labels "qa-review" --components "Backend"` | Apply mapping instructions to each affected ticket |
