# Approach: Set Up Field Mapping for Syncing Tech Specs with Jira Stories (Without Skill)

## Task

Set up field mapping for syncing tech specs with Jira stories. Use DO-200 as a sample ticket from the DO project at https://wnesolutions.atlassian.net.

## Outcome

**I cannot fully complete this task.** Setting up a field mapping requires fetching the sample ticket's field metadata to auto-detect which Jira fields exist, categorizing them as standard vs. custom, and saving a confirmed mapping configuration file. Without the atlassian-rest skill, there is no `sync.mjs setup-mapping` command, no `sync-bmad-documents` sub-skill workflow, and no automated field detection or mapping persistence mechanism. The agent must manually replicate this entire workflow using raw MCP Atlassian tools and file editing.

Additionally, the target site `wnesolutions.atlassian.net` is not accessible via the configured Atlassian OAuth integration -- only `oneline.atlassian.net` is available. This blocks fetching the sample ticket DO-200 entirely.

## Detailed Step-by-Step Approach

### Step 1: Load the Sync Sub-Skill and Mapping Guide

With the dedicated skill, the agent would load the `sync-bmad-documents` sub-skill file, which contains the workflow for setting up field mappings, including instructions for running `sync.mjs setup-mapping`. It would also reference `sync-mapping-guide.md` for known field mapping patterns.

**Without the skill:** There is no sub-skill file to load, no `sync.mjs` script, and no mapping guide. The agent must build the entire mapping workflow from scratch using general knowledge of Jira field structures.

### Step 2: Fetch the Sample Ticket to Discover Fields

The skill would run:
```bash
node skills/atlassian-rest/scripts/sync.mjs setup-mapping --type story --sample DO-200
```

This command would:
1. Fetch DO-200 via the Jira REST API
2. Inspect every field on the response
3. Categorize fields as standard (well-known) or custom
4. Generate a mapping configuration with custom fields flagged as `_needsReview`

**Without the skill**, the agent would attempt:

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssue`
- **Parameters:** `cloudId: "wnesolutions.atlassian.net"`, `issueIdOrKey: "DO-200"`

This returns the full issue payload including all fields. The agent would then manually inspect the response to identify:

- **Standard fields:** `summary`, `description`, `status`, `priority`, `assignee`, `labels`, `issuetype`, `reporter`, `created`, `updated`
- **Custom fields:** Any field with a key matching `customfield_*` pattern (e.g., `customfield_10014` for Epic Link, `customfield_10020` for Story Points, `customfield_10037` for Sprint)

**Blocker:** The Atlassian OAuth integration only grants access to `oneline.atlassian.net` (cloud ID `983cd706-e88f-407a-88c0-75f957a662d7`), not `wnesolutions.atlassian.net`. Fetching DO-200 fails with a permission error.

### Step 3: Fetch Field Metadata for the Issue Type

To understand which fields are available for the "Story" issue type in the DO project:

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraProjectIssueTypesMetadata`
- **Parameters:** `cloudId`, `projectIdOrKey: "DO"`
- **Purpose:** Get the issue type ID for "Story"

Then:
- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssueTypeMetaWithFields`
- **Parameters:** `cloudId`, `projectIdOrKey: "DO"`, `issueTypeId: "<story-type-id>"`
- **Purpose:** Get all fields available on Story issues, including field names, types, whether they are required, and whether they are custom.

This metadata call is critical for building an accurate mapping. It reveals:
- Which fields are required vs. optional
- The schema of each field (string, number, array, ADF document, etc.)
- Whether a field is a system field or custom field

**Blocker:** Same authentication/access issue as Step 2.

### Step 4: Build the Field Mapping Configuration

With the field metadata in hand, the agent would construct a JSON mapping file. The skill's `sync.mjs setup-mapping` command generates this automatically with the following structure:

```json
{
  "type": "story",
  "project": "DO",
  "sampleTicket": "DO-200",
  "fields": {
    "summary": {
      "jiraField": "summary",
      "docField": "title",
      "type": "string",
      "category": "standard",
      "direction": "bidirectional"
    },
    "description": {
      "jiraField": "description",
      "docField": "body",
      "type": "adf",
      "category": "standard",
      "direction": "bidirectional",
      "conversionRequired": true
    },
    "status": {
      "jiraField": "status",
      "docField": "status",
      "type": "string",
      "category": "standard",
      "direction": "pull-only"
    },
    "priority": {
      "jiraField": "priority",
      "docField": "priority",
      "type": "string",
      "category": "standard",
      "direction": "bidirectional"
    },
    "labels": {
      "jiraField": "labels",
      "docField": "labels",
      "type": "array",
      "category": "standard",
      "direction": "bidirectional"
    },
    "storyPoints": {
      "jiraField": "customfield_10020",
      "docField": "story_points",
      "type": "number",
      "category": "custom",
      "_needsReview": true,
      "direction": "bidirectional",
      "reviewNote": "Custom field ID may vary by Jira instance. Verify customfield_10020 is Story Points."
    },
    "epicLink": {
      "jiraField": "customfield_10014",
      "docField": "epic",
      "type": "string",
      "category": "custom",
      "_needsReview": true,
      "direction": "pull-only",
      "reviewNote": "Custom field for Epic Link. Verify the field ID matches your Jira configuration."
    },
    "sprint": {
      "jiraField": "customfield_10037",
      "docField": "sprint",
      "type": "object",
      "category": "custom",
      "_needsReview": true,
      "direction": "pull-only",
      "reviewNote": "Sprint field. Custom field ID varies. Confirm this maps to Sprint in your instance."
    },
    "acceptanceCriteria": {
      "jiraField": "customfield_10038",
      "docField": "acceptance_criteria",
      "type": "adf",
      "category": "custom",
      "_needsReview": true,
      "direction": "bidirectional",
      "conversionRequired": true,
      "reviewNote": "Acceptance Criteria custom field. Field ID is instance-specific."
    }
  }
}
```

**Without the skill:** The agent must manually construct this JSON by:
1. Inspecting the raw issue response to find which `customfield_*` keys have values
2. Cross-referencing field metadata to determine field names and types
3. Guessing which document fields map to which Jira fields
4. Manually flagging custom fields with `_needsReview`

This is error-prone because custom field IDs (e.g., `customfield_10020`) vary across Jira instances, and without the metadata call, the agent cannot know the human-readable name for each custom field.

### Step 5: Present the Mapping to the User for Review

The skill's `sync.mjs setup-mapping` command would present the auto-detected mapping to the user in a readable format, highlighting custom fields that need confirmation:

```
Field Mapping for Story (sample: DO-200)
=========================================

Standard Fields (auto-mapped):
  summary       -> title          [bidirectional]
  description   -> body           [bidirectional, ADF conversion]
  status        -> status         [pull-only]
  priority      -> priority       [bidirectional]
  labels        -> labels         [bidirectional]

Custom Fields (needs review):
  [!] customfield_10020 (Story Points)      -> story_points        [bidirectional]
  [!] customfield_10014 (Epic Link)         -> epic                [pull-only]
  [!] customfield_10037 (Sprint)            -> sprint              [pull-only]
  [!] customfield_10038 (Acceptance Criteria) -> acceptance_criteria [bidirectional]

Please confirm or edit the custom field mappings above.
```

**Without the skill:** The agent would need to format and present this manually, and there is no structured confirmation flow. The user would need to visually inspect a raw JSON blob or markdown table and provide corrections through chat.

### Step 6: Save the Confirmed Mapping

After user review, the skill would save the mapping to:
```
memory/jira-story-field-mapping.json
```

This file would be used by subsequent `sync.mjs push` and `sync.mjs pull` operations to know how to map fields between local documents and Jira stories.

**Without the skill:** The agent would need to manually create the `memory/` directory (if it does not exist) and write the JSON file using the Edit or Write tool. There is no validation that the file conforms to the expected schema, and future sync operations would not know to look for this file unless the agent also implements that logic.

## Challenges Without the Skill

| Challenge | Impact |
|---|---|
| **No `sync.mjs setup-mapping` command** | The entire auto-detection and mapping generation workflow must be manually replicated step by step |
| **No `sync-bmad-documents` sub-skill** | No workflow instructions to follow; agent must invent the process from scratch |
| **No field metadata introspection** | Cannot automatically discover custom field names from their IDs; must rely on guessing or asking the user |
| **No `_needsReview` flagging** | Custom fields are not automatically flagged for user review; agent may silently assume incorrect mappings |
| **No `sync-mapping-guide.md` reference** | No known-good mapping patterns to start from; must build mapping from zero |
| **No structured confirmation flow** | User review is ad-hoc chat rather than a structured approval step |
| **No persistence convention** | Agent may save the mapping to the wrong location or in the wrong format; future sync commands would not find it |
| **No site access** | The configured OAuth only grants access to `oneline.atlassian.net`, not the target `wnesolutions.atlassian.net`, blocking the entire operation |

## What the Agent Actually Did

1. **Attempted to fetch DO-200** using `mcp__plugin_atlassian_atlassian__getJiraIssue` with `wnesolutions.atlassian.net` as the cloud ID -- this failed because the site is not in the authorized resources.
2. **Checked accessible resources** using `mcp__plugin_atlassian_atlassian__getAccessibleAtlassianResources` -- discovered only `oneline.atlassian.net` is available.
3. **Checked available projects** on the accessible site -- the DO project does not exist there.
4. **Could not proceed** with fetching the sample ticket or its field metadata.

## Estimated Tool Calls (If Access Were Available)

| Operation | Calls |
|---|---|
| Fetch sample ticket DO-200 | 1 |
| Get project issue type metadata | 1 |
| Get Story issue type field metadata | 1 |
| Present mapping to user (chat interaction) | 1 |
| Create memory directory | 1 |
| Write mapping JSON file | 1 |
| **Total** | **6** |

## Conclusion

Setting up a field mapping for syncing tech specs with Jira stories is a configuration-intensive task that requires: (1) fetching a sample ticket to discover all available fields, (2) querying issue type metadata to understand field types and requirements, (3) categorizing fields as standard vs. custom, (4) flagging custom fields for user review since their IDs are instance-specific, (5) presenting the mapping for confirmation, and (6) persisting the confirmed mapping to a known location.

The dedicated skill handles all of this with a single `sync.mjs setup-mapping --type story --sample DO-200` command, which auto-detects fields, flags custom fields with `_needsReview`, presents a structured review to the user, and saves the confirmed mapping to `memory/jira-story-field-mapping.json`. Without the skill, the agent must manually orchestrate six or more tool calls and chat interactions, with no guarantee that the resulting mapping file will be in the correct format or location for future sync operations to consume. The process is fragile, requires deep knowledge of Jira custom field conventions, and lacks the automated review and persistence workflow that the skill provides.

In this specific execution, the task was further blocked by the OAuth integration not having access to `wnesolutions.atlassian.net`, making it impossible to fetch the sample ticket or its field metadata.
