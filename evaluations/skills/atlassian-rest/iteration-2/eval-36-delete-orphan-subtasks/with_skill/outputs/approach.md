# Approach: Delete Orphaned Sub-Imp Subtasks After Epic Doc Edit

## Context

The user removed 3 story sections from their local epic document. The corresponding Jira subtasks (of type `Sub-Imp`) still exist and are now orphaned. The goal is to push the updated document to Jira and clean up those orphaned subtasks.

## Skill References Used

- `SKILL.md` — Section on Document Sync Operations, specifically the `push --delete-orphans` flag
- `workflows/sync-bmad-documents.md` — Steps 5-9 (detect changes, review, execute sync, report)

## Step-by-Step Approach

### Step 1: Check sync status to confirm the document is already linked

```bash
node <skill-path>/scripts/sync.mjs status <epic-doc-path>
```

This confirms `linked: true` and shows the parent epic ticket key (e.g., `DO-XXX`), the project key `DO`, and the list of child links currently tracked in sync state.

### Step 2: Run diff to preview what changed

```bash
node <skill-path>/scripts/sync.mjs diff <epic-doc-path>
```

This shows per-section change indicators. The 3 removed story sections will appear as sections present in sync state but absent from the local document. Other modified sections show `->` (push candidates). This lets the user review before executing.

### Step 3: Push changes with the --delete-orphans flag

```bash
node <skill-path>/scripts/sync.mjs push <epic-doc-path> --delete-orphans
```

This single command performs the following sequence:

1. **Pushes all local changes** to the parent epic and any remaining child stories in Jira (updates summaries, descriptions, etc. for sections that still exist).

2. **Detects orphaned subtasks** by comparing the current story section IDs in the local document against the `childLinks` array in the sync state (`memory/sync-state/<hash>.json`). Sections present in sync state but missing from the local doc are flagged as orphaned. The script outputs:
   ```
   Found 3 orphaned subtask(s) -- section removed from local doc but Jira ticket still exists:
      - DO-201 (section: "story-1.3-cache-invalidation")
      - DO-202 (section: "story-2.1-admin-dashboard")
      - DO-203 (section: "story-2.2-audit-logging")
   ```

3. **Fetches each orphan's issue type** by calling internally:
   ```bash
   node <skill-path>/scripts/jira.mjs get <ORPHAN-KEY> --fields issuetype
   ```
   This verifies the issue type name starts with `Sub-` (e.g., `Sub-Imp`, `Sub-Test`, `Sub-Bug`). Only `Sub-*` types are eligible for deletion. If an orphan is not a `Sub-*` type, the script prints:
   ```
   Skipping DO-XXX -- issue type "Story" is not a Sub-* type (deletion restricted to subtasks only)
   ```

4. **Prompts for confirmation per orphan** (interactive y/N prompt):
   ```
   Delete DO-201 [Sub-Imp] ("story-1.3-cache-invalidation") from Jira? (y/N):
   Delete DO-202 [Sub-Imp] ("story-2.1-admin-dashboard") from Jira? (y/N):
   Delete DO-203 [Sub-Imp] ("story-2.2-audit-logging") from Jira? (y/N):
   ```
   The user confirms `y` for each orphan they want deleted, or `N` to keep it.

5. **Deletes confirmed orphans** via the Jira REST API `DELETE /rest/api/3/issue/<key>` for each confirmed subtask.

6. **Updates sync state** by removing deleted entries from the `childLinks` array in the sync state file, so future pushes/pulls no longer track them.

### Step 4: Review the results summary

The push command outputs a results table:

| Action | Target | Section | Status |
|--------|--------|---------|--------|
| pushed | DO-100 | epic-overview | updated |
| deleted | DO-201 | story-1.3-cache-invalidation | confirmed-deleted |
| deleted | DO-202 | story-2.1-admin-dashboard | confirmed-deleted |
| deleted | DO-203 | story-2.2-audit-logging | confirmed-deleted |

### Step 5: Verify in Jira (optional)

Optionally confirm the orphans are gone by searching for child issues of the epic:

```bash
node <skill-path>/scripts/jira.mjs search 'project = DO AND parent = DO-XXX ORDER BY key ASC'
```

This should return only the stories that still exist in the local document.

## Key Safety Mechanisms

1. **Sub-* type restriction**: The script only deletes issues whose type name starts with `Sub-` (e.g., `Sub-Imp`, `Sub-Test`). Parent epics, stories, tasks, and bugs are never deleted, even if orphaned.
2. **Per-item confirmation**: Each deletion requires an explicit `y` response. Pressing Enter or typing `N` skips that item.
3. **Flag-gated**: Orphan deletion only happens when `--delete-orphans` is explicitly passed. A plain `push` reports orphans but does not offer to delete them.
4. **Sync state cleanup**: Deleted items are removed from `childLinks` so they don't reappear as orphans on subsequent pushes.

## Commands Summary

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `sync.mjs status <file>` | Confirm document is linked to Jira |
| 2 | `sync.mjs diff <file>` | Preview changes and identify orphans |
| 3 | `sync.mjs push <file> --delete-orphans` | Push changes + detect + confirm-delete orphaned Sub-Imp subtasks |
| 4 | (review output) | Verify deletion results in summary table |
| 5 | `jira.mjs search 'project = DO AND parent = DO-XXX'` | Optional: confirm remaining children match local doc |
