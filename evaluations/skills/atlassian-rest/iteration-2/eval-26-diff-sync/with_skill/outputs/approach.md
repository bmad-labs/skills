# Approach: Check What's Changed Between Local Epic Doc and Jira Since Last Sync

## Task Understanding

The user wants to compare their local epic document against the corresponding Jira ticket to see what has diverged since the last sync. This is a read-only diff/status operation -- no mutations needed.

## Workflow Reference

This task maps to the **Sync BMAD Documents** workflow (`workflows/sync-bmad-documents.md`), specifically Steps 1-2 (identify document, check link) and Step 5 (detect changes). No push/pull is needed -- just the diff report.

## Detailed Approach

### Step 1: Verify Setup

Run the setup script to ensure Atlassian credentials are configured:

```bash
node <skill-path>/scripts/setup.mjs
```

### Step 2: Identify the Local Epic Document

Ask the user for the path to their local epic document, e.g.:

```
Which local epic file do you want to check? (e.g., _bmad-output/planning-artifacts/epics/my-epic.md)
```

For this approach, assume the file is at `<epic-file-path>`.

### Step 3: Check Sync Status

Run the status command to confirm the document is already linked to a Jira ticket:

```bash
node <skill-path>/scripts/sync.mjs status <epic-file-path>
```

**Expected output:** The status command returns sync metadata including:
- Whether the document is linked (`linked: true/false`)
- The linked Jira ticket key (e.g., `PROJ-100`)
- Last sync timestamp
- Last sync direction
- Local hash vs. remote hash (whether either side has changed)

**If unlinked:** The document has never been synced. Inform the user there is no previous sync to compare against. Offer to set up linking via `sync.mjs link`.

**If linked:** Proceed to Step 4.

### Step 4: Run the Diff

Execute the diff command to get a per-section comparison of local vs. remote changes since the last sync:

```bash
node <skill-path>/scripts/sync.mjs diff <epic-file-path>
```

**Expected output:** Per-section change indicators:
- `=` -- no changes (section is identical on both sides)
- `->` -- local changed, remote unchanged (push candidate)
- `<-` -- remote changed, local unchanged (pull candidate)
- `!!!` -- both sides changed (conflict)

For epic documents, this also covers child story sections, comparing each local story section against its linked child Jira ticket.

### Step 5: Present the Change Summary

Format the diff output as a readable table for the user:

| Section | Local | Remote | Direction | Notes |
|---------|-------|--------|-----------|-------|
| Overview | modified | unchanged | -> push | Local description updated |
| Story 1.1: Build API | unchanged | unchanged | = | In sync |
| Story 1.2: Auth Flow | unchanged | modified | <- pull | Remote ticket updated |
| Story 1.3: Dashboard | modified | modified | !!! conflict | Both sides changed |
| Story 1.4: New Story | new locally | -- | -> push | Not yet in Jira |

### Step 6: Provide Actionable Next Steps

Based on the diff results, inform the user of their options:

- **For `->` (local changed):** "Run `sync.mjs push <file>` to push local changes to Jira."
- **For `<-` (remote changed):** "Run `sync.mjs pull <file>` to pull Jira changes into your local doc."
- **For `!!!` (conflict):** "Both sides changed. You'll need to decide per section whether to keep local or remote. Running push or pull will prompt you to resolve conflicts."
- **For `=` (no changes):** "This section is in sync -- no action needed."

No mutations are executed at this point. The user only asked to *check* what changed, not to sync.

## Complete Command Sequence

```bash
# 1. Verify credentials
node <skill-path>/scripts/setup.mjs

# 2. Check if doc is linked and get sync metadata
node <skill-path>/scripts/sync.mjs status <epic-file-path>

# 3. Get per-section diff between local and remote
node <skill-path>/scripts/sync.mjs diff <epic-file-path>
```

## Key Skill Features Used

- `sync.mjs status` -- Reads sync state from `memory/sync-state/<hash>.json` to determine link status and last sync hashes
- `sync.mjs diff` -- Fetches current remote content from Jira, computes per-section hashes, and compares against both the local file and the stored sync-state hashes to determine change direction
- The diff is non-destructive: it only reads from Jira (GET requests) and the local filesystem; nothing is modified
- For epic documents, the diff includes child story sections mapped via `childLinks` in the sync state

## Error Scenarios

| Scenario | Resolution |
|----------|------------|
| Document not linked | Inform user; offer to run `sync.mjs link` to establish the connection first |
| No field mapping exists | Run `sync.mjs setup-mapping --type epic --sample <TICKET-KEY>` before diffing |
| 401/403 from Jira | Credentials expired or insufficient permissions; re-run `setup.mjs` |
| Sync state file missing but doc has frontmatter link | The diff command can still work by fetching remote and comparing; it will regenerate sync state |
