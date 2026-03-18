# Sync Mapping Guide

Reference for configuring field mappings between BMAD documents and Jira/Confluence.

## Overview

The sync system uses JSON mapping files to define how BMAD document sections map to Jira fields or Confluence page structure. These files are stored in `<skill-path>/memory/` and are created via the `setup-mapping` workflow or manually.

## File Locations

| File | Purpose |
|------|---------|
| `memory/jira-epic-field-mapping.json` | Epic doc ↔ Jira Epic mapping |
| `memory/jira-story-field-mapping.json` | Tech Spec doc ↔ Jira Story mapping |
| `memory/confluence-prd-field-mapping.json` | PRD doc ↔ Confluence Page mapping |
| `memory/confluence-architecture-field-mapping.json` | Architecture doc ↔ Confluence Page mapping |
| `memory/sync-state/<hash>.json` | Per-document sync state (auto-generated) |
| `memory/batch-sync-config.json` | Batch scan configuration (auto-generated from BMAD config) |

---

## Jira Field Mapping Schema

```json
{
  "$schema": "field-mapping-v1",
  "docType": "epic | story",
  "projectKey": "PROJ",
  "issueType": "Epic | Story | Task",
  "sampleTicket": "PROJ-100",
  "createdAt": "ISO-8601 timestamp",
  "fieldMappings": [
    {
      "bmadSource": "frontmatter.<key> | section | title",
      "bmadSectionHeading": "Section heading text (null for frontmatter/title)",
      "jiraField": "Human-readable field name",
      "jiraFieldId": "summary | description | customfield_NNNNN",
      "jiraFieldType": "string | adf | array | option",
      "transform": "direct | markdownToAdf"
    }
  ],
  "childMapping": {
    "enabled": true,
    "sectionPattern": "regex to match child sections",
    "issueType": "Story | Task | Sub-task",
    "parentLinkField": "parent",
    "fieldMappings": [ /* same structure as above */ ]
  }
}
```

### Field Mapping Properties

| Property | Required | Description |
|----------|----------|-------------|
| `bmadSource` | Yes | Where to read the value: `frontmatter.<key>`, `section`, `title` |
| `bmadSectionHeading` | If bmadSource=section | Exact heading text to extract |
| `jiraField` | Yes | Human-readable Jira field name (for display) |
| `jiraFieldId` | Yes | Jira API field ID (`summary`, `description`, or `customfield_NNNNN`) |
| `jiraFieldType` | Yes | Field data type: `string`, `adf`, `array`, `option` |
| `transform` | Yes | How to convert: `direct` (pass through) or `markdownToAdf` (convert markdown to ADF) |

### Transform Types

| Transform | Input | Output | Use For |
|-----------|-------|--------|---------|
| `direct` | Plain text | Plain text | summary, labels, simple custom fields |
| `markdownToAdf` | Markdown section content | Jira ADF JSON | description, comments, rich text custom fields |

### Child Mapping

The `childMapping` section enables automatic handling of child items within a parent document. For example, stories within an epic document become child Jira tickets.

| Property | Description |
|----------|-------------|
| `enabled` | Set to `true` to enable child extraction |
| `sectionPattern` | Regex pattern to identify child sections (e.g., `^### Story (\\d+\\.\\d+): (.+)`) |
| `issueType` | Jira issue type for child tickets |
| `parentLinkField` | How to link children to parent (`parent` for next-gen, `customfield_NNNNN` for classic epic link) |

### Example: Epic Mapping

```json
{
  "$schema": "field-mapping-v1",
  "docType": "epic",
  "projectKey": "PROJ",
  "issueType": "Epic",
  "sampleTicket": "PROJ-100",
  "createdAt": "2026-03-18T10:00:00Z",
  "fieldMappings": [
    {
      "bmadSource": "title",
      "bmadSectionHeading": null,
      "jiraField": "Summary",
      "jiraFieldId": "summary",
      "jiraFieldType": "string",
      "transform": "direct"
    },
    {
      "bmadSource": "section",
      "bmadSectionHeading": "Overview",
      "jiraField": "Description",
      "jiraFieldId": "description",
      "jiraFieldType": "adf",
      "transform": "markdownToAdf"
    },
    {
      "bmadSource": "section",
      "bmadSectionHeading": "Requirements Inventory",
      "jiraField": "Acceptance Criteria",
      "jiraFieldId": "customfield_10050",
      "jiraFieldType": "string",
      "transform": "direct"
    }
  ],
  "childMapping": {
    "enabled": true,
    "sectionPattern": "^### Story (\\d+\\.\\d+): (.+)",
    "issueType": "Story",
    "parentLinkField": "parent",
    "fieldMappings": [
      {
        "bmadSource": "storyTitle",
        "jiraField": "Summary",
        "jiraFieldId": "summary",
        "transform": "direct"
      },
      {
        "bmadSource": "storyBody",
        "jiraField": "Description",
        "jiraFieldId": "description",
        "jiraFieldType": "adf",
        "transform": "markdownToAdf"
      }
    ]
  }
}
```

### Example: Tech Spec → Story Mapping

```json
{
  "$schema": "field-mapping-v1",
  "docType": "story",
  "projectKey": "PROJ",
  "issueType": "Story",
  "sampleTicket": "PROJ-200",
  "createdAt": "2026-03-18T10:00:00Z",
  "fieldMappings": [
    {
      "bmadSource": "frontmatter.title",
      "bmadSectionHeading": null,
      "jiraField": "Summary",
      "jiraFieldId": "summary",
      "jiraFieldType": "string",
      "transform": "direct"
    },
    {
      "bmadSource": "frontmatter.status",
      "bmadSectionHeading": null,
      "jiraField": "Status Category",
      "jiraFieldId": "status",
      "jiraFieldType": "string",
      "transform": "direct"
    },
    {
      "bmadSource": "section",
      "bmadSectionHeading": "Overview",
      "jiraField": "Description",
      "jiraFieldId": "description",
      "jiraFieldType": "adf",
      "transform": "markdownToAdf"
    },
    {
      "bmadSource": "section",
      "bmadSectionHeading": "Acceptance Criteria",
      "jiraField": "Acceptance Criteria",
      "jiraFieldId": "customfield_10050",
      "jiraFieldType": "string",
      "transform": "direct"
    }
  ]
}
```

---

## Confluence Field Mapping Schema

```json
{
  "$schema": "field-mapping-v1",
  "docType": "prd | architecture",
  "spaceKey": "TEAM",
  "samplePageId": "12345",
  "createdAt": "ISO-8601 timestamp",
  "titleSource": "frontmatter.<key> | heading.1",
  "titleFallback": "heading.1",
  "bodyTransform": "markdownToStorage",
  "sectionMappings": [
    {
      "bmadSectionHeading": "Section heading in BMAD doc",
      "confluenceHeading": "Heading to use on Confluence page",
      "includeSubsections": true,
      "macroWrapper": "panel | info | note | warning | null",
      "macroParams": { "key": "value" }
    }
  ],
  "frontmatterAsMetadata": {
    "<frontmatter-key>": {
      "confluenceLocation": "statusLozenge | metadataTable | pageProperty",
      "position": "top | bottom"
    }
  }
}
```

### Confluence Mapping Properties

| Property | Description |
|----------|-------------|
| `titleSource` | Where to read page title from: `frontmatter.title`, `frontmatter.project_name`, or `heading.1` (first H1) |
| `titleFallback` | Fallback if titleSource is empty |
| `bodyTransform` | Always `markdownToStorage` for Confluence |
| `sectionMappings` | Controls how each BMAD section maps to the Confluence page structure |
| `macroWrapper` | Optionally wrap a section in a Confluence macro (panel, info, note, warning) |
| `frontmatterAsMetadata` | Map frontmatter values to Confluence page elements |

### Example: PRD Mapping

```json
{
  "$schema": "field-mapping-v1",
  "docType": "prd",
  "spaceKey": "TEAM",
  "samplePageId": "12345",
  "createdAt": "2026-03-18T10:00:00Z",
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

---

## Sync State Schema

Sync state files are auto-generated and stored at `memory/sync-state/<hash>.json`. The hash is the SHA-256 of the local file's absolute path.

```json
{
  "$schema": "sync-state-v1",
  "localFilePath": "/absolute/path/to/document.md",
  "docType": "epic | story | prd | architecture",
  "target": "jira | confluence",
  "linkId": "PROJ-100 or page-id-12345",
  "linkedAt": "ISO-8601 timestamp",
  "lastSyncedAt": "ISO-8601 timestamp",
  "lastSyncDirection": "local-to-remote | remote-to-local",
  "localHash": "sha256:<hash>",
  "remoteHash": "sha256:<hash>",
  "childLinks": [
    {
      "bmadSectionId": "Story 1.1: Title text",
      "remoteId": "PROJ-101",
      "localHash": "sha256:<hash>",
      "remoteHash": "sha256:<hash>"
    }
  ],
  "sectionHashes": {
    "Section Heading": "sha256:<hash>"
  }
}
```

### Sync State Properties

| Property | Description |
|----------|-------------|
| `localFilePath` | Absolute path to the local BMAD document |
| `docType` | Document type (epic, story, prd, architecture) |
| `target` | Remote system (jira, confluence) |
| `linkId` | Jira issue key or Confluence page ID |
| `localHash` | SHA-256 of the entire local document at last sync |
| `remoteHash` | SHA-256 of the remote content at last sync |
| `childLinks` | For epics: mapping of story sections to child Jira tickets |
| `sectionHashes` | Per-section hashes for granular change detection |

---

## Batch Config Schema

The batch config is auto-generated from `_bmad/bmm/config.yaml` by the `init-batch` command. It reads `planning_artifacts` and `implementation_artifacts` paths to discover document locations.

```json
{
  "bmadConfigPath": "_bmad/bmm/config.yaml",
  "projectRoot": "/path/to/project",
  "scanPaths": [
    {
      "glob": "relative/path/**/*.md",
      "docType": "epic | story | prd | architecture",
      "target": "jira | confluence"
    }
  ]
}
```

Typical auto-generated paths:
- `_bmad-output/planning-artifacts/epics/**/*.md` → epic (Jira)
- `_bmad-output/implementation-artifacts/**/*spec*.md` → story (Jira)
- `_bmad-output/planning-artifacts/prd/**/*.md` → prd (Confluence)
- `_bmad-output/planning-artifacts/architecture/**/*.md` → architecture (Confluence)

---

## Linking Strategy

### Documents with YAML Frontmatter

A `jira_ticket_id` or `confluence_page_id` property is added to the frontmatter:

```yaml
---
title: 'User Authentication'
jira_ticket_id: 'PROJ-100'
status: 'in-progress'
---
```

### Documents without YAML Frontmatter

The ticket key is prefixed to the document title:

```markdown
# [PROJ-101] Story 1.1: Build API endpoint
```

### Link Discovery Order

1. YAML frontmatter `jira_ticket_id` / `confluence_page_id`
2. Title pattern `[KEY-123]`
3. Sync state file in `memory/sync-state/`
4. If none found → document is unlinked

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "No mapping file found" | First time syncing this doc type | Run `setup-mapping` workflow |
| Field ID changed | Jira admin modified custom fields | Remove mapping file locally, re-run `setup-mapping` |
| "Permission denied" on custom field | API token lacks field access | Check Jira project permissions |
| Sync state hash mismatch | File modified outside of sync | Run `diff` to see changes, then push/pull |
| Child ticket orphaned | Story section removed from epic doc | Re-add the section or archive the ticket manually via Jira web UI |
| Confluence page version conflict | Someone else edited the page | Pull latest, resolve conflicts, then push |
| Batch scan finds no documents | Wrong paths in batch config | Check `_bmad/bmm/config.yaml` paths match actual structure |
