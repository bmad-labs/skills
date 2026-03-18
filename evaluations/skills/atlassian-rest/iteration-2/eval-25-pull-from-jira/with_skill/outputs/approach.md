# Approach: Pull Latest Changes from Jira Ticket DO-100 into Local Epic Doc

## Task

Pull the latest changes from Jira ticket DO-100 into the local epic document at `docs/epics/platform-epic.md`.

## Skill Reference

- **Skill:** `atlassian-rest`
- **Workflow:** `workflows/sync-bmad-documents.md` (bidirectional sync between local BMAD docs and Jira/Confluence)
- **Key script:** `sync.mjs` for pull/push/diff/status operations
- **Mapping reference:** `references/sync-mapping-guide.md`

## Step-by-Step Approach

### Step 1: Verify Setup

Run the setup check to ensure Atlassian credentials are configured:

```bash
node <skill-path>/scripts/setup.mjs
```

This verifies `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_DOMAIN` (should be `wnesolutions.atlassian.net`) are set.

### Step 2: Identify Document Type (Workflow Step 1)

Read the local file `docs/epics/platform-epic.md` and detect the document type. Per the workflow detection rules:

- **Epic:** Has `## Epic` headings or `### Story N.M:` patterns, or frontmatter with `inputDocuments` array

Given the file is named `platform-epic.md` and lives in an `epics/` directory, it is an **epic** document. The target system is **Jira**.

### Step 3: Check for Existing Link (Workflow Step 2)

Check if the document is already linked to DO-100:

```bash
node <skill-path>/scripts/sync.mjs status docs/epics/platform-epic.md
```

**If linked (`linked: true`):** The document already has a sync state with DO-100. Skip to Step 5 (diff).

**If unlinked:** The document needs to be linked first (proceed to Step 4).

### Step 4: First-Time Link Setup (Workflow Step 3 -- only if unlinked)

Since the user specified ticket DO-100 already exists, link the local doc to the existing ticket:

```bash
node <skill-path>/scripts/sync.mjs link docs/epics/platform-epic.md --type epic --ticket DO-100
```

This will:
- Add `jira_ticket_id: 'DO-100'` to the document's YAML frontmatter (or prefix the title with `[DO-100]` if no frontmatter exists)
- Create initial sync state in `<skill-path>/memory/sync-state/`

### Step 4b: Ensure Field Mapping Exists (Workflow Step 4)

Check if the epic field mapping exists:

```bash
ls <skill-path>/memory/jira-epic-field-mapping.json
```

**If it does not exist**, set up the mapping using DO-100 as the sample ticket:

```bash
node <skill-path>/scripts/sync.mjs setup-mapping --type epic --sample DO-100
```

This will:
1. Fetch the field list from Jira for DO-100
2. Auto-identify field meanings (summary, description, custom fields)
3. Output a proposed mapping as JSON

Review the mapping table and confirm. The mapping file is saved to `<skill-path>/memory/jira-epic-field-mapping.json`.

### Step 5: Detect Changes (Workflow Step 5)

Run the diff command to see what changed on each side since the last sync:

```bash
node <skill-path>/scripts/sync.mjs diff docs/epics/platform-epic.md
```

The output shows per-section change indicators:
- `->` local changed, remote unchanged (push candidate)
- `<-` remote changed, local unchanged (pull candidate)
- `!!!` both changed (conflict)
- `=` no changes

### Step 6: Review Changes (Workflow Step 6)

Present the change summary to the user as a table, e.g.:

| Section | Local | Remote | Action |
|---------|-------|--------|--------|
| Overview | unchanged | modified | <- pull |
| Story 1.1 | unchanged | modified | <- pull |
| Story 1.2 | unchanged | unchanged | = skip |
| Story 1.3 | modified | modified | conflict |

Ask the user to confirm which changes to pull. Allow skipping specific sections.

### Step 7: Resolve Conflicts (Workflow Step 7 -- only if conflicts exist)

For any sections marked with both-sides-changed conflicts:
- Show the local version and the remote (Jira) version side-by-side
- Ask the user to choose per section: **Keep local**, **Keep remote**, or **Skip**

### Step 8: Execute Pull (Workflow Step 8)

Execute the pull operation to bring remote (Jira) changes into the local document:

```bash
node <skill-path>/scripts/sync.mjs pull docs/epics/platform-epic.md
```

For an epic document, the pull handles child stories automatically:
- New remote child tickets (stories added in Jira under DO-100) are appended as new story sections in the local doc
- Changed remote tickets update existing local story sections
- The sync state file is updated with new hashes

### Step 9: Report Results (Workflow Step 9)

Present a summary table of what was pulled, e.g.:

| Action | Section/Field | Result |
|--------|--------------|--------|
| pulled | Overview | Updated local section from DO-100 description |
| pulled | Story 1.1 | Updated local section from DO-105 |
| pulled | Story 1.4 | New section appended from DO-112 |
| skipped | Story 1.3 | Conflict deferred |

Include links to all updated Jira tickets.

## Complete Command Sequence (Happy Path)

```bash
# 1. Verify credentials
node <skill-path>/scripts/setup.mjs

# 2. Check if already linked
node <skill-path>/scripts/sync.mjs status docs/epics/platform-epic.md

# 3. Link to existing ticket (if not already linked)
node <skill-path>/scripts/sync.mjs link docs/epics/platform-epic.md --type epic --ticket DO-100

# 4. Ensure field mapping exists (if not, set it up)
node <skill-path>/scripts/sync.mjs setup-mapping --type epic --sample DO-100

# 5. Show diff to review what changed
node <skill-path>/scripts/sync.mjs diff docs/epics/platform-epic.md

# 6. Pull remote changes into local doc (after user confirms)
node <skill-path>/scripts/sync.mjs pull docs/epics/platform-epic.md
```

## Key Decisions

1. **Direction is Pull:** The user explicitly said "pull the latest changes from Jira," so this is a remote-to-local sync (`pull`), not a `push`.
2. **Document type is Epic:** Based on filename, directory location, and the reference to a Jira ticket. Epics target Jira (not Confluence).
3. **Link to existing ticket:** The user specified DO-100, so we use `--ticket DO-100` rather than `--create`.
4. **Diff before pull:** The workflow requires showing the user what will change and getting confirmation before executing the sync, especially for conflict resolution.
5. **Child story handling:** For epic docs, pull automatically handles child stories -- new remote children get appended, changed ones get updated locally.
