# Approach: Set Up Field Mapping for Epic Docs Syncing to DO with Custom Instructions

## Task Summary

Set up a Jira field mapping for epic document type targeting the DO project, using DO-100 as the sample ticket, and add custom instructions: "Always set priority to High and add label team-oms".

## Step-by-Step Approach

### Step 1: Verify Credentials

Run setup to confirm Atlassian credentials are configured and the DO project is accessible:

```bash
node <skill-path>/scripts/setup.mjs
```

### Step 2: Confirm DO-100 Exists and Is an Epic

Fetch the sample ticket to verify it exists and inspect its fields (which will be used to auto-detect the field mapping):

```bash
node <skill-path>/scripts/jira.mjs get DO-100
```

This confirms DO-100 is a valid epic in the DO project and lets us see which fields are populated on a real ticket. The `setup-mapping` command will use this ticket to auto-detect custom fields.

### Step 3: Run setup-mapping to Auto-Detect Fields from DO-100

```bash
node <skill-path>/scripts/sync.mjs setup-mapping --type epic --sample DO-100
```

This command will:
1. Fetch all fields from DO-100 via the Jira API
2. Auto-identify field meanings by name and type (summary, description, custom fields like acceptance criteria, epic name, etc.)
3. Output a proposed mapping as a JSON structure
4. Save the mapping to `<skill-path>/memory/jira-epic-field-mapping.json`

The generated mapping file will follow this structure:

```json
{
  "$schema": "field-mapping-v1",
  "docType": "epic",
  "projectKey": "DO",
  "issueType": "Epic",
  "sampleTicket": "DO-100",
  "createdAt": "<ISO-8601 timestamp>",
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
    }
  ],
  "childMapping": {
    "enabled": true,
    "sectionPattern": "^### Story (\\d+\\.\\d+): (.+)",
    "issueType": "Story",
    "parentLinkField": "parent",
    "fieldMappings": [...]
  }
}
```

### Step 4: Review the Generated Mapping

Present the auto-detected mapping table to the user for review. Allow corrections to:
- Auto-detected field mappings (e.g., which markdown sections map to which Jira fields)
- Custom field IDs (customfield_NNNNN values specific to the DO project)
- Transform types (direct vs. markdownToAdf)
- Child mapping configuration (story section pattern, child issue type, parent link field)

### Step 5: Add Custom Instructions to the Mapping File

After the mapping is confirmed, edit the saved mapping file at `<skill-path>/memory/jira-epic-field-mapping.json` to add the `instructions` field:

```json
{
  "$schema": "field-mapping-v1",
  "docType": "epic",
  "projectKey": "DO",
  "issueType": "Epic",
  "sampleTicket": "DO-100",
  "createdAt": "<timestamp>",
  "instructions": "Always set priority to High and add label team-oms",
  "fieldMappings": [...],
  "childMapping": {...}
}
```

The `instructions` field is a top-level property in the mapping JSON. Per the sync-mapping-guide.md schema, it accepts natural-language instructions that are printed to stdout during `push` and `link` operations, so the calling agent can follow them.

This means that on every subsequent `sync.mjs push` or `sync.mjs link` operation using this epic mapping, the agent will be reminded to:
- Set `--priority High` on created/updated issues
- Add `--labels "team-oms"` to created/updated issues

### Step 6: Verify the Mapping File Was Saved

```bash
cat <skill-path>/memory/jira-epic-field-mapping.json
```

Confirm the file contains:
- `"projectKey": "DO"`
- `"sampleTicket": "DO-100"`
- `"instructions": "Always set priority to High and add label team-oms"`
- Correct field mappings auto-detected from DO-100

## How the Instructions Take Effect

When subsequently running sync operations like:

```bash
node <skill-path>/scripts/sync.mjs link my-epic.md --type epic --project DO --create
node <skill-path>/scripts/sync.mjs push my-epic.md
```

The sync script will:
1. Load `memory/jira-epic-field-mapping.json`
2. Print the `instructions` value to stdout
3. The agent reads the instructions and applies them: setting priority to High and adding the label `team-oms` on every issue it creates or updates

For example, when creating the parent epic, the agent would effectively run:

```bash
node <skill-path>/scripts/jira.mjs create --project DO --type Epic --summary "..." \
  --description "..." --priority High --labels "team-oms"
```

And for each child story created from the epic doc:

```bash
node <skill-path>/scripts/jira.mjs create --project DO --type Story --summary "..." \
  --description "..." --parent DO-100 --priority High --labels "team-oms"
```

## Commands Summary

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `node <skill-path>/scripts/setup.mjs` | Verify Atlassian credentials |
| 2 | `node <skill-path>/scripts/jira.mjs get DO-100` | Confirm sample ticket exists and inspect fields |
| 3 | `node <skill-path>/scripts/sync.mjs setup-mapping --type epic --sample DO-100` | Auto-detect fields and generate mapping file |
| 4 | Review mapping output | User confirms/adjusts the proposed mapping |
| 5 | Edit `memory/jira-epic-field-mapping.json` to add `"instructions"` | Add custom instructions for priority and label |
| 6 | Verify saved file | Confirm mapping file is correct |
