# Approach: Push Changes and Handle Orphaned Story DO-501

## Task Analysis

The user removed a Story section from their local epic document and wants to:
1. Push the updated epic doc to Jira
2. Delete the orphaned ticket DO-501 (a Story-type issue)

## Step 1: Push Local Changes to Jira

Run the sync push to update the remote epic with the locally removed story section:

```bash
node <skill-path>/scripts/sync.mjs push <epic-file-path>
```

This will detect that a story section was removed locally and flag DO-501 as an orphaned ticket in the output.

## Step 2: Refuse to Delete DO-501

**DO-501 is a Story, not a Sub-task. Deletion is refused for two independent reasons:**

### Reason A: The skill has a blanket no-delete policy

From SKILL.md (principle 3):

> "Never delete. This skill does not support delete operations (issues, pages, attachments, boards, projects, accounts, etc.). If the user asks to delete something, direct them to the Atlassian web UI. This restriction is intentional and must not be bypassed."

### Reason B: Even `--delete-orphans` only applies to Sub-task types

From SKILL.md (sync.mjs push documentation):

> "When `push` reports orphaned subtasks (sections removed from local doc), ask the user if they want to delete them, then run with `--delete-orphans`. Only `Sub-*` issue types can be deleted -- parent issues are skipped."

DO-501 is of type **Story**, which is not a `Sub-*` issue type. Even if `--delete-orphans` were run, the script would skip DO-501.

### Reason C: The sync workflow explicitly defers Story deletion to the web UI

From the sync-bmad-documents workflow (Step 8):

> "Removed local stories -> flag as orphaned for user review (deletion must be done manually via Jira web UI)"

## Recommended Commands

### Command 1: Push the updated document

```bash
node <skill-path>/scripts/sync.mjs push <epic-file-path>
```

Expected output: The push succeeds, updates the epic on Jira, and reports DO-501 as an orphaned story.

### Command 2: There is no command for deletion

The `--delete-orphans` flag would not delete DO-501 because it is a Story, not a Sub-task:

```bash
# This would NOT delete DO-501 -- it would be skipped as a non-Sub-* type
node <skill-path>/scripts/sync.mjs push <epic-file-path> --delete-orphans
```

## User Guidance

After pushing the changes, inform the user:

> The push completed and DO-501 has been flagged as orphaned. However, **this skill cannot delete DO-501** because it is a Story-type issue. Only Sub-task (`Sub-*`) issue types can be deleted via the `--delete-orphans` flag. Stories, Epics, and other parent-level issue types must be deleted manually through the Jira web UI.
>
> To delete DO-501, go to: https://wnesolutions.atlassian.net/browse/DO-501 and delete it from the issue actions menu.

## Summary

| Action | Command | Result |
|--------|---------|--------|
| Push local changes | `sync.mjs push <file>` | Updated epic, DO-501 flagged as orphan |
| Delete DO-501 | **REFUSED** | Story-type issues cannot be deleted by this skill |
| User action required | Visit Jira web UI | Delete DO-501 manually at https://wnesolutions.atlassian.net/browse/DO-501 |
