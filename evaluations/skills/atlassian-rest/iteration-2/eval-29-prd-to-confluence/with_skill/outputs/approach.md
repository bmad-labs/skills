# Approach: Link PRD Document to Confluence and Push

## Task
Link the local PRD document at `docs/prd/platform-prd.md` to Confluence and push its content.

## Skill References Used
- `SKILL.md` — main skill instructions (Section: Document Sync Operations, Confluence Operations)
- `workflows/sync-bmad-documents.md` — full sync workflow (Steps 1-9)
- `references/sync-mapping-guide.md` — Confluence field mapping schema and PRD mapping example

## Step-by-Step Approach

### Step 1: Identify Document Type

The workflow's detection rules state: a document is classified as **PRD** if its frontmatter contains `workflowType: 'prd'`.

Per the workflow, PRD documents target **Confluence** (not Jira).

**Action:** Read the file to confirm it has PRD frontmatter. If ambiguous, ask the user.

```bash
# Read the document to confirm type
cat docs/prd/platform-prd.md | head -30
```

### Step 2: Check for Existing Link

Run the sync status check to determine if this document is already linked to a Confluence page.

```bash
node <skill-path>/scripts/sync.mjs status docs/prd/platform-prd.md
```

- If `linked: true` — skip to Step 5 (diff and push).
- If unlinked — continue to Step 3.

### Step 3: First-Time Link Setup

Since this is a PRD going to Confluence, ask the user:

1. **Which Confluence space key?** (e.g., `TEAM`, `ENG`, `PROD`)
2. **Create a new page, or link to an existing page?**
3. **Optional: parent page ID** if the page should be nested under an existing page.

#### Option A: Create New Confluence Page

```bash
node <skill-path>/scripts/sync.mjs link docs/prd/platform-prd.md \
  --type prd \
  --space <SPACE_KEY> \
  --create
```

This command will:
- Parse the PRD markdown document
- Convert markdown content to Confluence storage format
- Create a new Confluence page in the specified space
- Add `confluence_page_id` to the document's YAML frontmatter (or prefix the title with `[PageID]` if no frontmatter)
- Create sync state in `<skill-path>/memory/sync-state/`

#### Option B: Link to Existing Confluence Page

```bash
node <skill-path>/scripts/sync.mjs link docs/prd/platform-prd.md \
  --type prd \
  --page-id <PAGE_ID>
```

### Step 4: Field Mapping Setup

Check if a Confluence PRD field mapping already exists:

```bash
ls <skill-path>/memory/confluence-prd-field-mapping.json
```

**If the mapping file exists:** Load and use it. No action needed.

**If the mapping file does NOT exist:** Run the setup-mapping command with a sample Confluence page that represents the desired format:

```bash
node <skill-path>/scripts/sync.mjs setup-mapping \
  --type prd \
  --sample <EXISTING_PAGE_ID>
```

This will:
1. Fetch the sample page structure from Confluence
2. Auto-detect how sections should map
3. Output a proposed mapping JSON

Present the mapping to the user for review. The mapping controls:
- **titleSource**: Where the page title comes from (e.g., `frontmatter.project_name` or `heading.1`)
- **bodyTransform**: Always `markdownToStorage` for Confluence
- **sectionMappings**: How each markdown section heading maps to a Confluence heading, with optional macro wrappers (`panel`, `info`, `note`, `warning`)
- **frontmatterAsMetadata**: How frontmatter fields render (status lozenges, metadata tables, page properties)

Example mapping that would be generated (per `references/sync-mapping-guide.md`):

```json
{
  "$schema": "field-mapping-v1",
  "docType": "prd",
  "spaceKey": "<SPACE_KEY>",
  "samplePageId": "<PAGE_ID>",
  "titleSource": "frontmatter.project_name",
  "titleFallback": "heading.1",
  "bodyTransform": "markdownToStorage",
  "sectionMappings": [
    { "bmadSectionHeading": "Executive Summary", "confluenceHeading": "Executive Summary", "includeSubsections": true },
    { "bmadSectionHeading": "Success Criteria", "confluenceHeading": "Success Criteria", "includeSubsections": true },
    { "bmadSectionHeading": "Product Scope", "confluenceHeading": "Product Scope", "includeSubsections": true },
    { "bmadSectionHeading": "User Journeys", "confluenceHeading": "User Journeys", "includeSubsections": true },
    { "bmadSectionHeading": "Functional Requirements", "confluenceHeading": "Functional Requirements", "macroWrapper": "panel", "macroParams": { "borderStyle": "solid" } },
    { "bmadSectionHeading": "Non-Functional Requirements", "confluenceHeading": "Non-Functional Requirements", "macroWrapper": "panel", "macroParams": { "borderStyle": "solid" } }
  ],
  "frontmatterAsMetadata": {
    "status": { "confluenceLocation": "statusLozenge", "position": "top" },
    "created": { "confluenceLocation": "metadataTable" },
    "workflowType": { "confluenceLocation": "metadataTable" }
  }
}
```

Save confirmed mapping to `<skill-path>/memory/confluence-prd-field-mapping.json`.

### Step 5: Detect Changes (Diff)

Run the diff command to see what needs to be pushed:

```bash
node <skill-path>/scripts/sync.mjs diff docs/prd/platform-prd.md
```

Output shows per-section change indicators:
- `->` local changed, remote unchanged (push candidate)
- `<-` remote changed, local unchanged (pull candidate)
- `!` both changed (conflict)
- `=` no changes

For a first-time link+push, all sections will show as push candidates.

### Step 6: Review Changes with User

Present a change summary table to the user, e.g.:

| Section | Local | Remote | Action |
|---------|-------|--------|--------|
| Executive Summary | new | — | -> push |
| Success Criteria | new | — | -> push |
| Product Scope | new | — | -> push |
| ... | ... | ... | ... |

Ask the user to confirm which sections to sync. Allow skipping specific sections.

### Step 7: Resolve Conflicts (if any)

For first-time push this is typically not needed. If any sections show conflicts (`!`), show both versions side-by-side and ask the user to choose per section:
- **Keep local** — push local version
- **Keep remote** — pull remote version
- **Skip** — leave unchanged

### Step 8: Execute Push

Push the local document content to the Confluence page:

```bash
node <skill-path>/scripts/sync.mjs push docs/prd/platform-prd.md
```

This will:
- Convert each markdown section to Confluence storage format (HTML with Confluence macros)
- Apply section mappings from the field mapping config
- Render frontmatter metadata as status lozenges / metadata tables per the mapping
- Update the Confluence page (auto-incrementing version number)
- Update the sync state hashes in `<skill-path>/memory/sync-state/`

### Step 9: Report Results

Present a summary to the user:

| Action | Section/Field | Result |
|--------|--------------|--------|
| pushed | Executive Summary | Updated page <PAGE_ID> |
| pushed | Success Criteria | Updated page <PAGE_ID> |
| pushed | Product Scope | Updated page <PAGE_ID> |
| pushed | Functional Requirements | Updated page <PAGE_ID> (panel macro) |
| pushed | Non-Functional Requirements | Updated page <PAGE_ID> (panel macro) |

Include the direct link to the Confluence page: `https://<ATLASSIAN_DOMAIN>/wiki/spaces/<SPACE_KEY>/pages/<PAGE_ID>`

## Key Decisions and Rationale

1. **Used sync.mjs instead of raw confluence.mjs** — The SKILL.md explicitly states "Prefer sync.mjs for document-based operations" (point 5). Using sync.mjs provides automatic frontmatter updates, sync state tracking, and field mapping support.

2. **PRD targets Confluence, not Jira** — The workflow document type detection rules (Step 1) explicitly map PRD documents to Confluence.

3. **Confirm before mutating** — SKILL.md rule 2 requires showing the user what will happen before creating/updating pages.

4. **Field mapping setup is required** — The workflow (Step 4) checks for `confluence-prd-field-mapping.json` and runs `setup-mapping` if it does not exist. This ensures sections map correctly to Confluence structure with appropriate macro wrappers.

5. **markdownToStorage transform** — Confluence uses HTML-based storage format, not markdown. The sync system handles this conversion automatically via the `markdownToStorage` body transform defined in the mapping config.

## Complete Command Sequence (Happy Path)

```bash
# 1. Verify setup
node <skill-path>/scripts/setup.mjs

# 2. Check if already linked
node <skill-path>/scripts/sync.mjs status docs/prd/platform-prd.md

# 3. Check for existing field mapping
ls <skill-path>/memory/confluence-prd-field-mapping.json

# 4a. (If no mapping) Setup mapping from sample page
node <skill-path>/scripts/sync.mjs setup-mapping --type prd --sample <EXISTING_PAGE_ID>

# 5. Link and create new Confluence page
node <skill-path>/scripts/sync.mjs link docs/prd/platform-prd.md --type prd --space <SPACE_KEY> --create

# 6. Verify diff (should show all sections as push candidates)
node <skill-path>/scripts/sync.mjs diff docs/prd/platform-prd.md

# 7. Push content to Confluence
node <skill-path>/scripts/sync.mjs push docs/prd/platform-prd.md

# 8. Verify final status
node <skill-path>/scripts/sync.mjs status docs/prd/platform-prd.md
```
