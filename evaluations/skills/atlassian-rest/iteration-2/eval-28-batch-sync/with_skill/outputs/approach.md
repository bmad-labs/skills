# Approach: Sync All BMAD Documents to Jira and Confluence

## Task Understanding

The user wants to sync **all** BMAD documents in the project to their corresponding remote systems (Jira for epics/stories/tech-specs, Confluence for PRDs/architecture docs). This is a batch operation that follows the "Sync BMAD Documents" workflow in batch mode (Steps B1-B3).

## Workflow Followed

`workflows/sync-bmad-documents.md` -- Batch Mode (Steps B1 through B3), with per-document processing via Steps 1-9.

## Step-by-Step Approach

### Phase 1: Environment Verification

Run setup to confirm credentials are configured:

```bash
node <skill-path>/scripts/setup.mjs
```

This verifies `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_DOMAIN` are set and valid.

### Phase 2: Initialize Batch Configuration (Step B1)

Check if `memory/batch-sync-config.json` already exists:

```bash
ls <skill-path>/memory/batch-sync-config.json
```

If missing, initialize it:

```bash
node <skill-path>/scripts/sync.mjs init-batch
```

This reads `_bmad/bmm/config.yaml` to auto-discover document locations from `planning_artifacts` and `implementation_artifacts` paths. It scans for all BMAD documents and generates a batch config with entries like:

| Scan Path | Doc Type | Target |
|-----------|----------|--------|
| `_bmad-output/planning-artifacts/epics/**/*.md` | epic | Jira |
| `_bmad-output/implementation-artifacts/**/*spec*.md` | story | Jira |
| `_bmad-output/planning-artifacts/prd/**/*.md` | prd | Confluence |
| `_bmad-output/planning-artifacts/architecture/**/*.md` | architecture | Confluence |

Present the discovered config to the user for review before proceeding.

### Phase 3: Scan and Report Status (Step B2)

Run batch scan to see all documents and their current sync status:

```bash
node <skill-path>/scripts/sync.mjs batch
```

This produces a summary table showing every discovered document, its type, whether it is linked to a remote resource, and its current sync status (up to date, changes pending, conflicts). Example output:

| File | Type | Linked | Status |
|------|------|--------|--------|
| epics/auth-epic.md | epic | PROJ-100 | -> 2 sections changed |
| specs/login-spec.md | story | PROJ-101 | = up to date |
| prd/platform-prd.md | prd | Page 12345 | conflict: 1 conflict |
| architecture/system-arch.md | architecture | (unlinked) | new |

Present this table to the user and ask for confirmation to proceed.

### Phase 4: Ensure Field Mappings Exist (Step 4 from per-document flow)

For each unique doc type discovered in the batch, check if a field mapping exists:

**For Jira doc types (epic, story):**

```bash
ls <skill-path>/memory/jira-epic-field-mapping.json
ls <skill-path>/memory/jira-story-field-mapping.json
```

If any mapping is missing, create it using an existing sample ticket:

```bash
node <skill-path>/scripts/sync.mjs setup-mapping --type epic --sample PROJ-100
node <skill-path>/scripts/sync.mjs setup-mapping --type story --sample PROJ-200
```

**For Confluence doc types (prd, architecture):**

```bash
ls <skill-path>/memory/confluence-prd-field-mapping.json
ls <skill-path>/memory/confluence-architecture-field-mapping.json
```

If any mapping is missing, create it:

```bash
node <skill-path>/scripts/sync.mjs setup-mapping --type prd --sample 12345
node <skill-path>/scripts/sync.mjs setup-mapping --type architecture --sample 67890
```

Present each proposed mapping to the user for review. Allow corrections to auto-detected field mappings, custom field additions, and transform type adjustments.

### Phase 5: Link Unlinked Documents (Step 3 from per-document flow)

For each document shown as "unlinked" in the batch report, ask the user:

1. **Direction:** Push (local to remote) or Pull (remote to local)?
2. **Target:** Which Jira project key or Confluence space key?
3. **Action:** Create new ticket/page, or link to an existing one?

Then execute the link command per document. For new Jira items:

```bash
node <skill-path>/scripts/sync.mjs link <file-path> --type epic --project PROJ --create
node <skill-path>/scripts/sync.mjs link <file-path> --type story --project PROJ --create
```

For new Confluence pages:

```bash
node <skill-path>/scripts/sync.mjs link <file-path> --type prd --space TEAM --create
node <skill-path>/scripts/sync.mjs link <file-path> --type architecture --space TEAM --create
```

For linking to existing resources:

```bash
node <skill-path>/scripts/sync.mjs link <file-path> --type epic --ticket PROJ-100
node <skill-path>/scripts/sync.mjs link <file-path> --type prd --page-id 12345
```

### Phase 6: Diff and Sync Each Linked Document (Steps 5-9 from per-document flow)

For each document that is already linked and has pending changes, process sequentially:

**6a. Run diff to detect changes:**

```bash
node <skill-path>/scripts/sync.mjs diff <file-path>
```

**6b. Present change summary to user:**

Show per-section change indicators:
- `->` local changed, remote unchanged (push candidate)
- `<-` remote changed, local unchanged (pull candidate)
- `conflict` both changed (conflict requiring resolution)
- `=` no changes

**6c. Resolve conflicts (if any):**

For sections with conflicts, show both local and remote versions side-by-side. Ask the user per section:
- **Keep local** -- push local version, overwriting remote
- **Keep remote** -- pull remote version, overwriting local
- **Skip** -- leave both unchanged for now

**6d. Execute sync:**

For documents where the user wants to push local changes:

```bash
node <skill-path>/scripts/sync.mjs push <file-path>
```

For documents where the user wants to pull remote changes:

```bash
node <skill-path>/scripts/sync.mjs pull <file-path>
```

For epic documents, push/pull automatically handles child stories (creating new child tickets for new story sections, updating existing ones, flagging orphaned sections).

If push reports orphaned subtasks (story sections removed from the local doc), ask the user if they want to delete them, then re-run with:

```bash
node <skill-path>/scripts/sync.mjs push <file-path> --delete-orphans
```

### Phase 7: Final Report (Step 9)

After all documents are processed, present a comprehensive summary table:

| Action | File | Section/Field | Result |
|--------|------|--------------|--------|
| linked | epics/auth-epic.md | -- | Created PROJ-100 |
| pushed | epics/auth-epic.md | Overview | Updated PROJ-100 description |
| pushed | epics/auth-epic.md | Story 1.1 | Created PROJ-101 |
| pushed | specs/login-spec.md | Overview | Updated PROJ-200 description |
| linked | prd/platform-prd.md | -- | Created Page 12345 |
| pushed | prd/platform-prd.md | Full document | Published to Confluence |
| pulled | architecture/system-arch.md | Technical Design | Updated local section |
| skipped | specs/api-spec.md | Acceptance Criteria | Conflict deferred |

Include clickable links to all created/updated Jira tickets and Confluence pages.

## Key Decisions and Considerations

1. **Batch mode is used** (`sync.mjs init-batch` + `sync.mjs batch`) rather than manually discovering and syncing files one by one. This leverages the BMAD config to auto-discover all documents.

2. **Field mappings are checked once per doc type**, not per document. If `jira-epic-field-mapping.json` exists, all epic documents share it.

3. **Conflicts require user input** -- the workflow pauses on each conflicted document to ask the user which version to keep per section.

4. **Orphaned subtask deletion is opt-in** -- only runs with `--delete-orphans` flag after explicit user confirmation, and only `Sub-*` issue types can be deleted.

5. **Document type auto-detection** uses the heuristics from Step 1 of the workflow (frontmatter keys, heading patterns, content patterns). Ambiguous documents prompt the user.

6. **No deletions of parent issues or pages** -- the skill explicitly does not support deleting Jira issues (except Sub-* subtasks via `--delete-orphans`) or Confluence pages. Users are directed to the Atlassian web UI for that.

## Scripts Used

| Script | Purpose |
|--------|---------|
| `scripts/setup.mjs` | Verify credentials |
| `scripts/sync.mjs init-batch` | Generate batch config from BMAD config |
| `scripts/sync.mjs batch` | Scan all docs and report sync status |
| `scripts/sync.mjs setup-mapping` | Create field mapping for a doc type |
| `scripts/sync.mjs link` | Link a local doc to Jira/Confluence |
| `scripts/sync.mjs diff` | Show per-section changes |
| `scripts/sync.mjs push` | Push local changes to remote |
| `scripts/sync.mjs pull` | Pull remote changes to local |
| `scripts/sync.mjs status` | Check sync status of a single file |

## References Consulted

| Reference | Why |
|-----------|-----|
| `references/sync-mapping-guide.md` | Field mapping schema, sync state schema, batch config schema |
