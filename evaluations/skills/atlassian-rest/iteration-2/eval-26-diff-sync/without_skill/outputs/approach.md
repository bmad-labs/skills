# Approach: Diff Local Epic Doc Against Jira Ticket Since Last Sync (Without Skill)

## Task

Check what's changed between my local epic doc and the Jira ticket since the last sync.

## Outcome

**I cannot complete this task.** Without the Atlassian skill (specifically the `sync-bmad-documents` sub-skill and `sync.mjs` helper script), there is no built-in mechanism to compare local document state against a remote Jira ticket, track sync timestamps, or produce a per-section diff with directional change indicators.

## Detailed Step-by-Step Approach

### Step 1: Locate and Read the Local Epic Document

Find the epic document in the project (typically under `docs/epics/` or a similar path). The document should be a Markdown file with YAML frontmatter containing sync metadata:

```yaml
---
title: "Authentication Epic"
jira_ticket_id: PROJ-42
last_synced: "2025-01-15T10:30:00Z"
type: epic
---
```

**Key fields needed:**
- `jira_ticket_id` -- the linked Jira issue key (e.g., `PROJ-42`)
- `last_synced` -- ISO timestamp of the last successful sync operation
- `type` -- confirms this is an epic document

**Blocker:** Without the skill, there is no standardized way to know which document the user is referring to, or whether sync metadata exists in the frontmatter at all.

### Step 2: Fetch the Current Jira Ticket State

Using the Jira REST API v3, fetch the epic ticket with all relevant fields:

```bash
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://<INSTANCE>.atlassian.net/rest/api/3/issue/PROJ-42?expand=changelog&fields=summary,description,status,priority,assignee,labels,components,fixVersions,updated"
```

**Key response fields:**
- `fields.summary` -- epic title
- `fields.description` -- epic description (in Atlassian Document Format / ADF)
- `fields.status.name` -- current status
- `fields.priority.name` -- priority level
- `fields.assignee.displayName` -- assignee
- `fields.labels` -- labels array
- `fields.updated` -- last modification timestamp on the Jira side

**Blockers:**
- No stored credentials or instance URL available
- No MCP Atlassian plugin access for this baseline evaluation
- The ADF description format requires conversion to Markdown for meaningful comparison

### Step 3: Convert ADF Description to Markdown

Jira Cloud stores issue descriptions in Atlassian Document Format (ADF), a JSON-based rich text format. To compare against the local Markdown document, the ADF content must be converted:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Epic description content..." }
      ]
    }
  ]
}
```

This conversion requires either:
- A library like `marklassian` (used by the skill's `sync.mjs` script) to convert ADF to Markdown
- Manual parsing of ADF JSON nodes into Markdown equivalents

**Blocker:** Without the `sync.mjs` helper or an equivalent ADF-to-Markdown converter, accurate bidirectional comparison is not feasible.

### Step 4: Determine What Changed Locally Since Last Sync

Parse the local epic document into sections (e.g., title, description, acceptance criteria, status, priority) and compare each section against the state that was last synced. This requires:

1. Knowing the exact document state at `last_synced` time -- typically stored by the sync tool as a snapshot or hash
2. Diffing the current local file against that snapshot

Without a sync tool maintaining a baseline snapshot, there is no way to determine which sections the user modified locally versus which were already different at last sync time.

### Step 5: Determine What Changed Remotely Since Last Sync

Compare the Jira ticket's current state against its state at the `last_synced` timestamp. The Jira changelog (fetched via `expand=changelog`) can help:

```bash
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://<INSTANCE>.atlassian.net/rest/api/3/issue/PROJ-42?expand=changelog"
```

Filter changelog entries where `created` > `last_synced` to identify remote changes:

```json
{
  "changelog": {
    "histories": [
      {
        "created": "2025-01-16T14:00:00.000+0000",
        "items": [
          {
            "field": "status",
            "fromString": "To Do",
            "toString": "In Progress"
          }
        ]
      }
    ]
  }
}
```

**Limitation:** The changelog tracks field-level changes but does not provide granular section-level diffs for the description body. A full description change appears as a single changelog entry without inline diff detail.

### Step 6: Classify Each Section's Sync Direction

For each mapped section/field, compare local vs remote changes to classify:

| Indicator | Meaning | Condition |
|-----------|---------|-----------|
| `->` (push) | Local changed, remote unchanged | Section modified locally since last sync; remote matches last-synced state |
| `<-` (pull) | Remote changed, local unchanged | Jira field updated since last sync; local matches last-synced state |
| `!` (conflict) | Both changed | Both local section and Jira field modified since last sync |
| `=` (unchanged) | Neither changed | Both match the last-synced state |

### Step 7: Present a Summary Table

The expected output format would be a per-section status table:

```
Sync Status for docs/epics/auth-epic.md <-> PROJ-42
Last synced: 2025-01-15T10:30:00Z

| Section           | Status    | Direction |
|-------------------|-----------|-----------|
| Title             | unchanged | =         |
| Description       | conflict  | !         |
| Status            | pull      | <-        |
| Priority          | unchanged | =         |
| Acceptance Crit.  | push      | ->        |
| Labels            | unchanged | =         |

Summary: 1 push, 1 pull, 1 conflict, 3 unchanged
```

### Step 8: Offer Conflict Resolution (If Applicable)

If any sections are marked as conflicts, offer the user options:
- Keep local version (force push)
- Accept remote version (force pull)
- Manual merge (show both versions side by side)

## Barriers Without a Skill

| Barrier | Impact |
|---------|--------|
| No `sync.mjs` helper script | Cannot run `sync.mjs diff` to perform the automated comparison |
| No `sync-bmad-documents` sub-skill | No sync workflow, field mapping rules, or section classification logic |
| No stored sync baseline/snapshot | Cannot determine what changed locally vs remotely since last sync without a recorded baseline state |
| No credentials or MCP plugin | Cannot authenticate to fetch the current Jira ticket state |
| No ADF-to-Markdown converter | Cannot meaningfully compare Jira's ADF description against local Markdown content |
| No field mapping configuration | No knowledge of which local document sections map to which Jira fields (e.g., does "Acceptance Criteria" map to a custom field or a description subsection?) |
| No `last_synced` timestamp tracking | Without the sync tool maintaining this metadata, there is no reference point for "since the last sync" |

## Conclusion

This task requires a full bidirectional sync infrastructure: a recorded baseline from the last sync, authenticated Jira API access, ADF-to-Markdown conversion, field mapping between document sections and Jira fields, and change classification logic. Without the `sync-bmad-documents` sub-skill and its `sync.mjs diff` command -- which encapsulates all of this into a single operation producing per-section change indicators and a summary table -- the task **cannot be completed programmatically** by the agent. The manual approach would require the user to provide API credentials, and even then, building the diff logic from scratch (especially ADF conversion and three-way merge detection using the changelog) is a substantial engineering effort that goes well beyond a single agent interaction.
