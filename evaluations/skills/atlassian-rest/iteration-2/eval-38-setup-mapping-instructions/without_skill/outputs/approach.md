# Approach: Set Up Field Mapping with Custom Instructions (Without Atlassian Skill)

## Task

Set up field mapping for epic docs syncing to the DO project at wnesolutions.atlassian.net. Use DO-100 as a sample issue. Add custom instructions: "Always set priority to High and add label team-oms".

## Outcome

**I cannot complete this task.** Without a specialized Atlassian skill or helper scripts (such as `sync.mjs setup-mapping`), I have no automated way to generate a field mapping configuration, sample a Jira issue for field discovery, or persist a mapping file with custom instructions.

## What I Would Try

### 1. Fetch the Sample Issue to Discover Fields

The first step would be to retrieve DO-100 to inspect its field schema:

```
GET /rest/api/3/issue/DO-100?expand=names,schema
```

This would return the issue's fields along with their metadata (field IDs, types, and names). From this, I would identify:
- **Standard fields**: `summary`, `description`, `status`, `priority`, `labels`, `issuetype`, `assignee`, `reporter`
- **Custom fields**: Any `customfield_XXXXX` entries (e.g., story points, epics, sprints)

**Blockers:**
- I do not have access to the `wnesolutions.atlassian.net` Jira instance (my authenticated account only has access to `oneline.atlassian.net`).
- Even with the MCP Atlassian plugin available, the cloud ID for this site is not granted.

### 2. Fetch Issue Type Field Metadata for Epics

To know which fields are available for the Epic issue type in the DO project:

```
GET /rest/api/3/issue/createmeta/DO/issuetypes/<epicIssueTypeId>
```

This would return all fields the Epic issue type accepts, including required vs. optional status and allowed values. This metadata is essential for building an accurate field mapping.

**Blockers:**
- Same authentication/access issue as above.

### 3. Generate a Field Mapping JSON File

With skill tooling (e.g., `sync.mjs setup-mapping --type epic --sample DO-100`), the expected output would be a mapping file saved to `memory/jira-epic-field-mapping.json` with a structure like:

```json
{
  "type": "epic",
  "project": "DO",
  "sampleIssue": "DO-100",
  "instructions": "Always set priority to High and add label team-oms",
  "fields": {
    "summary": {
      "jiraFieldId": "summary",
      "type": "string",
      "required": true,
      "mapped": true
    },
    "description": {
      "jiraFieldId": "description",
      "type": "adf",
      "required": false,
      "mapped": true
    },
    "priority": {
      "jiraFieldId": "priority",
      "type": "priority",
      "required": false,
      "mapped": true,
      "defaultValue": "High"
    },
    "labels": {
      "jiraFieldId": "labels",
      "type": "array<string>",
      "required": false,
      "mapped": true,
      "defaultValue": ["team-oms"]
    },
    "status": {
      "jiraFieldId": "status",
      "type": "status",
      "required": false,
      "mapped": true
    },
    "customfield_10001": {
      "jiraFieldId": "customfield_10001",
      "type": "string",
      "required": false,
      "mapped": false,
      "_needsReview": true,
      "detectedName": "Epic Name"
    }
  }
}
```

Key aspects of this mapping:
- **`instructions` field**: Contains the user's custom instructions as a string, which downstream sync operations would interpret when pushing/pulling data.
- **Standard fields** (`summary`, `description`, `status`, `priority`, `labels`): Auto-detected and mapped.
- **Custom fields**: Flagged with `_needsReview: true` so the user can confirm or exclude them before syncing.

### 4. Save the Mapping

The mapping would be saved to `memory/jira-epic-field-mapping.json` in the project workspace, making it available for subsequent sync operations (`push`, `pull`, `diff`).

## Barriers Without a Skill

| Barrier | Impact |
|---|---|
| No access to `wnesolutions.atlassian.net` | Cannot fetch DO-100 or project metadata |
| No `sync.mjs` helper script available | Cannot run `setup-mapping` command to auto-generate the mapping |
| No field discovery automation | Cannot auto-detect standard vs. custom fields from the sample issue |
| No persistent mapping storage | Cannot save mapping to `memory/jira-epic-field-mapping.json` with proper structure |
| No instructions field handling | Cannot wire custom instructions into the mapping for downstream operations |

## What the Custom Instructions Would Do

The instructions string `"Always set priority to High and add label team-oms"` would be interpreted during sync operations:

1. **On push (doc to Jira)**: Before creating or updating a Jira issue, the sync engine would apply the instructions -- setting `priority` to `"High"` and ensuring `"team-oms"` is in the `labels` array.
2. **On pull (Jira to doc)**: The instructions would not typically alter pulled data, but could add metadata annotations.
3. **On diff**: The instructions-driven defaults would be factored into the expected state when computing differences.

## Conclusion

Without the Atlassian skill and its `sync.mjs setup-mapping` tooling, this task cannot be completed programmatically. The agent can describe the expected mapping structure and how custom instructions integrate into it, but cannot:
1. Authenticate to the target Jira instance
2. Fetch the sample issue DO-100 for field discovery
3. Auto-detect and classify fields (standard vs. custom)
4. Generate and persist the mapping JSON file with the `instructions` field

A configured skill with stored authentication and the sync helper scripts would handle all of these steps automatically through a single `setup-mapping` command.
