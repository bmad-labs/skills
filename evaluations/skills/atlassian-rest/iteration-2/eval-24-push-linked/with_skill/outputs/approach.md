# Approach: Push Latest Local Changes to Linked Jira Ticket DO-200

## Task Understanding

The user states they have already linked their tech spec to DO-200. They want to push the latest local changes from their document to Jira. Since the document is already linked, this is a sync push operation -- not a first-time link setup.

## Workflow Reference

This task follows the **Sync BMAD Documents** workflow (`workflows/sync-bmad-documents.md`), entering at **Step 2** (check existing link) and proceeding through Steps 5-9.

## Step-by-Step Approach

### Step 1: Identify the Linked Document

The user says the doc is linked to DO-200, but hasn't provided the file path. Ask the user which local file is linked to DO-200, or scan for it:

```bash
node <skill-path>/scripts/sync.mjs batch
```

This scans all known linked documents and would show which file maps to DO-200. Alternatively, search sync state files:

```bash
ls <skill-path>/memory/sync-state/
```

Then inspect the sync state files to find the one referencing DO-200.

### Step 2: Verify the Link Exists (Workflow Step 2)

Once the file path is known, confirm the link is active:

```bash
node <skill-path>/scripts/sync.mjs status <file-path>
```

Expected output: `linked: true`, ticket key `DO-200`. Since the user confirms the link already exists, this should return linked status. If it does, skip to Step 3 (diff).

### Step 3: Detect Changes (Workflow Step 5)

Run diff to see what changed locally vs. remotely since the last sync:

```bash
node <skill-path>/scripts/sync.mjs diff <file-path>
```

This produces per-section change indicators:
- `->` local changed, remote unchanged (push candidate)
- `<-` remote changed, local unchanged (pull candidate)
- `!!` both changed (conflict)
- `=` no changes

### Step 4: Review Changes with User (Workflow Step 6)

Present the diff output as a summary table to the user:

| Section | Local | Remote | Action |
|---------|-------|--------|--------|
| Overview | modified | unchanged | push |
| Implementation Details | modified | unchanged | push |
| ... | ... | ... | ... |

Ask the user to confirm which sections to push. Since the user explicitly said "push latest local changes," they likely want all local-changed sections pushed.

### Step 5: Handle Conflicts if Any (Workflow Step 7)

If any sections show both-sides-changed conflicts, show both versions and ask the user to choose per section:
- **Keep local** (push, overwriting remote)
- **Keep remote** (pull, overwriting local)
- **Skip** (defer)

### Step 6: Execute the Push (Workflow Step 8)

After user confirmation, execute the push:

```bash
node <skill-path>/scripts/sync.mjs push <file-path>
```

This command will:
- Read the field mapping from `<skill-path>/memory/jira-story-field-mapping.json` (since this is a tech spec linked as a story type)
- Convert each changed markdown section to the appropriate Jira field format (e.g., markdown to ADF for description fields)
- Update DO-200 on Jira via REST API with the changed fields
- If the document is an epic with child stories, also create/update child tickets as needed
- Update the local sync state in `<skill-path>/memory/sync-state/` with new hashes
- Print any `instructions` from the field mapping config for the agent to follow

If push reports orphaned subtasks (sections removed locally), ask the user whether to delete them, then optionally re-run:

```bash
node <skill-path>/scripts/sync.mjs push <file-path> --delete-orphans
```

### Step 7: Report Results (Workflow Step 9)

Present a summary table of what was synced:

| Action | Section/Field | Result |
|--------|--------------|--------|
| pushed | Overview | Updated DO-200 description |
| pushed | Implementation Details | Updated DO-200 custom field |
| ... | ... | ... |

Include a direct link to the updated ticket: `https://wnesolutions.atlassian.net/browse/DO-200`

## Key Commands Summary

| Step | Command | Purpose |
|------|---------|---------|
| Verify link | `node <skill-path>/scripts/sync.mjs status <file>` | Confirm document is linked to DO-200 |
| Detect changes | `node <skill-path>/scripts/sync.mjs diff <file>` | Show per-section diffs between local and remote |
| Push changes | `node <skill-path>/scripts/sync.mjs push <file>` | Push all local changes to Jira DO-200 |
| Push + cleanup | `node <skill-path>/scripts/sync.mjs push <file> --delete-orphans` | Push and remove orphaned subtasks (if any) |

## Assumptions

- The document is already linked to DO-200 (user confirmed), so no `sync.mjs link` step is needed.
- A field mapping already exists (was created during the initial link setup). If not, `setup-mapping` would be needed first.
- The skill path is the installed skill location, e.g., `/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest`.
- The user wants to push (local to remote), not pull (remote to local).
- The Atlassian domain is `wnesolutions.atlassian.net` and credentials are already configured.
