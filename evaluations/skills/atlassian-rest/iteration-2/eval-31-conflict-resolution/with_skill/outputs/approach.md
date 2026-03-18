# Approach: Resolve Epic Doc Conflict (Overview Section)

## Scenario

The user's local epic document has a modified Overview section, and someone also updated the Jira epic's description (which maps to the Overview section). This is a classic bidirectional conflict that the sync-bmad-documents workflow handles via its conflict resolution flow (Steps 5-8).

## Prerequisite: Verify Link Exists

The epic doc must already be linked to a Jira epic. Confirm with:

```bash
node <skill-path>/scripts/sync.mjs status <epic-doc-path>
```

Expected output: `linked: true` with a `linkId` like `PROJ-100`. If unlinked, the conflict scenario doesn't apply — we'd need to do initial link setup first (workflow Step 3).

## Step 1: Detect Changes with Diff

Run the diff command to get per-section change indicators:

```bash
node <skill-path>/scripts/sync.mjs diff <epic-doc-path>
```

Expected output shows per-section change indicators:
- `=` — no changes (sections untouched on both sides)
- `->` — local changed, remote unchanged (push candidate)
- `<-` — remote changed, local unchanged (pull candidate)
- Lightning bolt — both changed (conflict)

For this scenario, the Overview section should show the lightning bolt conflict indicator because:
- The local Overview section hash differs from the hash stored at last sync (user edited it)
- The remote Jira description hash also differs from the stored hash (someone updated Jira)

## Step 2: Present Change Summary to User

Display the diff results as a table for the user:

| Section | Local | Remote | Action |
|---------|-------|--------|--------|
| Overview | modified | modified | CONFLICT |
| Story 1.1 | unchanged | unchanged | = no action |
| Story 1.2 | unchanged | unchanged | = no action |
| ... | ... | ... | ... |

The key finding: the Overview section is in conflict.

## Step 3: Show Both Versions Side-by-Side

Per workflow Step 7, retrieve and display both versions of the conflicting section.

**Get the remote (Jira) version** by fetching the current epic:

```bash
node <skill-path>/scripts/jira.mjs get PROJ-100 --fields description
```

This returns the Jira description field (in ADF format). Present it to the user as readable text.

**Get the local version** by reading the Overview section from the local epic document file directly (the agent reads the local file and extracts the `## Overview` section content).

Present both versions to the user:

> **Local version (your changes):**
> [contents of the Overview section from the local markdown file]
>
> **Remote version (Jira changes):**
> [contents of the description field from Jira, converted from ADF back to readable text]

## Step 4: Ask User to Choose Resolution

Per workflow Step 7, offer three options per conflicting section:

1. **Keep local** — push your local Overview to Jira, overwriting the remote description
2. **Keep remote** — pull the Jira description into your local file, overwriting your local Overview
3. **Skip** — leave both unchanged for now, defer the conflict

Ask the user:
> "The Overview section has conflicting changes. Which version would you like to keep?"

## Step 5: Execute the Chosen Resolution

### If user chooses "Keep local" (push local Overview to Jira):

```bash
node <skill-path>/scripts/sync.mjs push <epic-doc-path>
```

This pushes the local Overview section content to the Jira epic's description field, converting markdown to ADF via the `markdownToAdf` transform defined in the field mapping (`memory/jira-epic-field-mapping.json`). The sync state hashes are updated after the push.

### If user chooses "Keep remote" (pull Jira description to local):

```bash
node <skill-path>/scripts/sync.mjs pull <epic-doc-path>
```

This pulls the current Jira description and overwrites the local Overview section in the epic document. The sync state hashes are updated after the pull.

### If user chooses "Skip":

No sync commands are executed for the Overview section. The conflict remains for future resolution. Other non-conflicting sections (if any have changes) can still be synced independently.

## Step 6: Report Results

Present a summary table:

| Action | Section/Field | Result |
|--------|--------------|--------|
| pushed (or pulled) | Overview | Updated PROJ-100 description (or Updated local section) |

Include the Jira link: `https://<domain>.atlassian.net/browse/PROJ-100`

## Key Skill Commands Used

| Command | Purpose |
|---------|---------|
| `sync.mjs status <file>` | Verify the document is linked to Jira |
| `sync.mjs diff <file>` | Detect per-section changes and identify conflicts |
| `jira.mjs get PROJ-100 --fields description` | Fetch remote version for side-by-side comparison |
| `sync.mjs push <file>` | Push local changes to Jira (if keeping local) |
| `sync.mjs pull <file>` | Pull remote changes to local (if keeping remote) |

## Workflow Reference

This approach follows the **Sync BMAD Documents** workflow (`workflows/sync-bmad-documents.md`), specifically:
- **Step 5** (Detect Changes) — run `diff` to find the conflict
- **Step 6** (Review Changes) — present the change summary table
- **Step 7** (Resolve Conflicts) — show both versions, ask user to choose
- **Step 8** (Execute Sync) — run `push` or `pull` based on user choice
- **Step 9** (Report Results) — summarize what was done

## Field Mapping Context

The Overview section maps to the Jira Description field per the epic field mapping:

```json
{
  "bmadSource": "section",
  "bmadSectionHeading": "Overview",
  "jiraField": "Description",
  "jiraFieldId": "description",
  "jiraFieldType": "adf",
  "transform": "markdownToAdf"
}
```

The `markdownToAdf` transform handles converting the local markdown Overview content into Jira's Atlassian Document Format when pushing, and the reverse conversion when pulling.
