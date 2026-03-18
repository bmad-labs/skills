# Sync BMAD Documents

Workflow for bidirectional sync between local BMAD documents (epics, tech specs, PRDs, architecture docs) and Jira/Confluence.

**Reference files:** `references/sync-mapping-guide.md`, `references/jira-api.md`, `references/confluence-api.md`

---

## Step 1: Identify Document Type

Parse the file to detect document type. Detection rules:

- **Epic:** Has `## Epic` headings or `### Story N.M:` patterns, or frontmatter with `inputDocuments` array
- **Tech Spec (Story):** Frontmatter has `tech_stack`, `files_to_modify`, `code_patterns`, or title starts with "Tech-Spec:"
- **PRD:** Frontmatter has `workflowType: 'prd'`
- **Architecture:** Content has `## Architecture` or `## Technical Design` headings, or user confirms
- **Story:** Has "As a ..., I want ..., So that ..." pattern without frontmatter

If auto-detection is ambiguous, ask the user which type this document is.

Determine target system:

- Epic, Tech Spec, Story → Jira
- PRD, Architecture → Confluence

## Step 2: Check for Existing Link

Run status check:

```bash
node <skill-path>/scripts/sync.mjs status <file-path>
```

If linked (returns `linked: true`), skip to Step 5.
If unlinked, continue to Step 3.

## Step 3: First-Time Link Setup

Ask the user:

1. **Direction:** Push (local → remote) or Pull (remote → local)?
2. **Target:** Which Jira project key or Confluence space key?
3. **Action:** Create new ticket/page, or link to existing one?

For creating new:

```bash
node <skill-path>/scripts/sync.mjs link <file> --type <docType> --project <KEY> --create
# or for Confluence:
node <skill-path>/scripts/sync.mjs link <file> --type <docType> --space <KEY> --create
```

For linking to existing:

```bash
node <skill-path>/scripts/sync.mjs link <file> --type <docType> --ticket <KEY>
# or for Confluence:
node <skill-path>/scripts/sync.mjs link <file> --type <docType> --page-id <ID>
```

The link command will:

- Add `jira_ticket_id` or `confluence_page_id` to YAML frontmatter (if frontmatter exists)
- Or prefix the title with `[KEY-123]` (if no frontmatter)
- Create initial sync state in `memory/sync-state/`

## Step 4: Field Mapping Setup

Check if `memory/jira-<type>-field-mapping.json` (or `confluence-<type>-field-mapping.json`) exists.

If it exists, load and use it.

If not, run the setup workflow:

```bash
node <skill-path>/scripts/sync.mjs setup-mapping --type <docType> --sample <TICKET-KEY-or-PAGE-ID>
```

This will:

1. Ask the user for a sample ticket/page that represents the target format
2. Fetch field list from Jira/Confluence
3. Auto-identify field meanings by name and type
4. Output a proposed mapping as JSON

Fields marked with `_needsReview: true` are auto-detected custom fields — highlight these to the user and ask them to verify the mapping is correct.

Present the mapping table to the user for review. Allow them to:

- Correct auto-detected mappings
- Add custom field mappings
- Adjust transform types (`direct`, `markdownToAdf`, `markdownToStorage`)

Save the confirmed mapping to the JSON file.

## Step 5: Detect Changes

Run diff to see what changed on each side since last sync:

```bash
node <skill-path>/scripts/sync.mjs diff <file-path>
```

The output shows per-section change indicators:

- `→` local changed, remote unchanged (push candidate)
- `←` remote changed, local unchanged (pull candidate)
- `⚡` both changed (conflict)
- `=` no changes

## Step 6: Review Changes

Present the change summary to the user as a table:

| Section | Local | Remote | Action |
|---------|-------|--------|--------|
| Overview | modified | unchanged | → push |
| Story 1.2 | unchanged | modified | ← pull |
| Story 1.3 | modified | modified | ⚡ conflict |

Ask the user to confirm which changes to sync. Allow them to skip specific sections.

## Step 7: Resolve Conflicts

For sections marked with `⚡` (both sides changed):

Show both versions side-by-side:

- **Local version:** the current content in the local file
- **Remote version:** the current content on Jira/Confluence

Ask the user to choose per section:

- **Keep local** — push local version, overwriting remote
- **Keep remote** — pull remote version, overwriting local
- **Skip** — leave both unchanged for now

## Step 8: Execute Sync

Execute the resolved sync operations:

For push operations:

```bash
node <skill-path>/scripts/sync.mjs push <file-path>
```

For pull operations:

```bash
node <skill-path>/scripts/sync.mjs pull <file-path>
```

For epic documents, the push/pull handles child stories automatically:

- New local story sections → create child Jira tickets
- Changed local stories → update existing child tickets
- Removed local stories → flag as orphaned for user review (deletion must be done manually via Jira web UI)
- New remote child tickets → append story sections to local doc
- Changed remote tickets → update local story sections

## Step 9: Report Results

Present a summary table:

| Action | Section/Field | Result |
|--------|--------------|--------|
| pushed | Overview | ✓ Updated PROJ-100 description |
| pushed | Story 1.1 | ✓ Created PROJ-101 |
| pulled | Story 1.2 | ✓ Updated local section |
| skipped | Story 1.3 | — Conflict deferred |

Include links to all created/updated tickets or pages.

---

## Batch Mode

When the user wants to sync multiple documents at once (e.g., "sync all my epics"):

### Step B1: Initialize Batch Config

Check for `memory/batch-sync-config.json`. If missing:

```bash
node <skill-path>/scripts/sync.mjs init-batch
```

This reads `_bmad/bmm/config.yaml` to auto-discover document locations from `planning_artifacts` and `implementation_artifacts` paths, scans for BMAD documents, and generates the batch config. Present to the user for review before saving.

### Step B2: Scan and Report

```bash
node <skill-path>/scripts/sync.mjs batch
```

Shows a summary table of all discovered documents and their sync status:

| File | Type | Linked | Status |
|------|------|--------|--------|
| epics/auth-epic.md | epic | PROJ-100 | → 2 sections changed |
| specs/login-spec.md | story | PROJ-101 | = up to date |
| prd/platform-prd.md | prd | Page 12345 | ⚡ 1 conflict |

### Step B3: Process

Process each file that needs syncing, following Steps 5-9 above. Pause on conflicts for user input.
