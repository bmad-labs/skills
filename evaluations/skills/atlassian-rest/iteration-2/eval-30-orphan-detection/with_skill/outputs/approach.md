# Approach: What Happens to the Jira Ticket When a Story Is Removed from the Epic Doc

## Scenario

You have an epic document (e.g., `epics/auth-epic.md`) that was previously synced to Jira. The epic has child stories including Story 1.3, each mapped to a child Jira ticket via the sync state's `childLinks` array. You remove the `### Story 1.3: ...` section from the local document and then run a sync (push).

## Step-by-Step Behavior

### 1. Check Current Sync Status

```bash
node <skill-path>/scripts/sync.mjs status epics/auth-epic.md
```

This confirms the document is linked and shows existing child links including Story 1.3's Jira ticket (e.g., PROJ-103).

### 2. Run Diff to See Changes

```bash
node <skill-path>/scripts/sync.mjs diff epics/auth-epic.md
```

The diff output will show Story 1.3 as a section that exists in the sync state (remote) but no longer exists in the local document. It appears as a push candidate (`->` local changed).

### 3. Push Without `--delete-orphans` (Default Behavior)

```bash
node <skill-path>/scripts/sync.mjs push epics/auth-epic.md
```

During push, the sync engine:

1. Extracts current story sections from the local document using the `childMapping.sectionPattern` regex (e.g., `^### Story (\d+\.\d+): (.+)`)
2. Compares the extracted section IDs against the existing `childLinks` in sync state
3. Detects that Story 1.3's `bmadSectionId` is no longer present in the local document
4. **Flags Story 1.3 as orphaned** but does NOT delete the Jira ticket
5. Returns a result with `action: "orphaned"`, `status: "needs-user-decision"` for the Story 1.3 ticket

**The Jira ticket (PROJ-103) is NOT deleted, NOT modified, and NOT transitioned.** It continues to exist in Jira exactly as it was. The sync engine only reports it as orphaned and leaves the decision to the user.

### 4. Push With `--delete-orphans` (Explicit Opt-In)

If the user decides orphaned tickets should be cleaned up:

```bash
node <skill-path>/scripts/sync.mjs push epics/auth-epic.md --delete-orphans
```

With this flag, the sync engine performs additional safety checks for each orphaned ticket:

1. **Issue type check**: Fetches the issue type of PROJ-103 from Jira. Only `Sub-*` issue types (e.g., Sub-task, Sub-bug, Sub-improvement) can be deleted. If Story 1.3 was created as a `Story` type (not a Sub-* type), deletion is **blocked** and the result is `status: "not-subtask-skipped"`.

2. **Interactive confirmation**: If the issue type passes the Sub-* check, the script prompts:
   ```
   Delete PROJ-103 [Sub-task] ("Story 1.3: Title") from Jira? (y/N):
   ```
   The user must explicitly type `y` to confirm deletion.

3. **Deletion or skip**: If confirmed, the ticket is deleted via the Jira REST API (`DELETE /rest/api/3/issue/PROJ-103`). If declined, it is kept and marked `status: "kept"`.

### 5. Sync State Update

After push completes:

- If the orphaned ticket was deleted: its entry is removed from `childLinks` in the sync state file
- If the orphaned ticket was kept or skipped: its entry remains in `childLinks` with an `orphaned: true` flag
- The sync state file (`memory/sync-state/<hash>.json`) is updated with new hashes

## Summary of Possible Outcomes for Story 1.3's Jira Ticket

| Push Command | Issue Type | User Confirms? | Outcome |
|---|---|---|---|
| `push <file>` (no flag) | Any | N/A | Ticket untouched, reported as `needs-user-decision` |
| `push <file> --delete-orphans` | Story (not Sub-*) | N/A | Ticket untouched, reported as `not-subtask-skipped` |
| `push <file> --delete-orphans` | Sub-task | No | Ticket untouched, reported as `kept` |
| `push <file> --delete-orphans` | Sub-task | Yes | Ticket deleted from Jira |

## Key Safety Guardrails

1. **No automatic deletion**: The default `push` never deletes anything. Orphans are only reported.
2. **`--delete-orphans` required**: Deletion is only attempted when explicitly requested via the flag.
3. **Sub-* type restriction**: Only subtask-type issues can be deleted via the script. Parent issues (Story, Epic, Task, Bug) are always skipped regardless of the flag. This prevents accidental deletion of significant work items.
4. **Interactive confirmation**: Even with the flag and a qualifying issue type, each deletion requires a `y/N` confirmation prompt.
5. **Skill-level "never delete" rule**: The SKILL.md states "This skill does not support delete operations" for the general `jira.mjs` and `confluence.mjs` scripts. The `sync.mjs --delete-orphans` is the sole exception, limited to Sub-* subtasks during orphan cleanup.
6. **Manual fallback**: The workflow documentation and troubleshooting guide both direct users to archive/delete orphaned tickets manually via the Jira web UI when the automated path is blocked.

## Recommended Workflow for the User

After removing Story 1.3 from the epic doc:

```bash
# 1. See what changed
node <skill-path>/scripts/sync.mjs diff epics/auth-epic.md

# 2. Push changes (orphan is flagged, not deleted)
node <skill-path>/scripts/sync.mjs push epics/auth-epic.md

# 3. Review the orphan report in the output, then decide:
#    Option A: Delete the Jira ticket via Jira web UI manually
#    Option B: If it's a Sub-* type, re-run with --delete-orphans
node <skill-path>/scripts/sync.mjs push epics/auth-epic.md --delete-orphans
```
