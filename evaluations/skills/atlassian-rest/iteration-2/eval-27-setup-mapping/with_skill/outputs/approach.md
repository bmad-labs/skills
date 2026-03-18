# Approach: Set Up Field Mapping for Syncing Tech Specs with Jira Stories

## Task Context

Set up field mapping so local BMAD tech spec documents can be synced with Jira Story issues in the DO project at wnesolutions.atlassian.net. The task specified DO-200 as a sample ticket, but DO-200 does not exist (the project only has DO-1 through DO-6). DO-5 was used instead as a representative Story-type ticket.

## Skills and References Used

- **SKILL.md** (Section 5: "Prefer sync.mjs for document-based operations") -- directs to use `setup-mapping` before any sync
- **Workflow:** `workflows/sync-bmad-documents.md` (Step 4: Field Mapping Setup)
- **Reference:** `references/sync-mapping-guide.md` (Jira Field Mapping Schema, Tech Spec -> Story example)

## Step-by-Step Approach

### Step 1: Verify Environment and Project Access

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

Confirms `ATLASSIAN_API_TOKEN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_DOMAIN` are set.

### Step 2: Confirm the Target Project and Issue Types

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs issue-types DO
```

**Result:** DO project supports: Task, Bug, Story, Epic, Subtask. Tech specs map to the **Story** issue type (id: 10178).

### Step 3: Identify a Sample Ticket

The task specified DO-200, but it does not exist. Search for available Story-type tickets:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = "DO" AND issuetype = Story ORDER BY key DESC' --max 5
```

**Result:** DO-5 ("Implement caching layer for API responses") is a Story with parent epic DO-3. Use DO-5 as the sample.

### Step 4: Fetch Sample Ticket Fields

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-5
```

**Key fields discovered on DO-5:**

| Field | Field ID | Type | Current Value |
|-------|----------|------|---------------|
| Summary | `summary` | string | "Implement caching layer for API responses" |
| Description | `description` | adf (null on this ticket) | null |
| Status | `status` | object | "To Do" |
| Priority | `priority` | object | "Medium" |
| Labels | `labels` | array | [] |
| Components | `components` | array | [] |
| Parent (Epic) | `parent` | object | DO-3 "Q2 Platform Improvements" |
| Issue Type | `issuetype` | object | Story |
| customfield_10020 | `customfield_10020` | string | "0|i014f7:" (Rank field -- internal, skip) |
| customfield_10000 | `customfield_10000` | string | "{}" (Development field -- internal, skip) |
| customfield_10019 | `customfield_10019` | null | null (likely Story Points or Sprint) |
| customfield_10014 | `customfield_10014` | null | null (likely Epic Name or Epic Link) |
| customfield_10015 | `customfield_10015` | null | null |
| customfield_10027 | `customfield_10027` | null | null |

### Step 5: Run setup-mapping to Auto-Generate the Mapping

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs setup-mapping --type story --sample DO-5
```

**Raw output (proposed mapping):**

```json
{
  "$schema": "field-mapping-v1",
  "docType": "story",
  "projectKey": "DO",
  "issueType": "Story",
  "sampleTicket": "DO-5",
  "createdAt": "2026-03-18T10:48:37.323Z",
  "instructions": "",
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
      "bmadSectionHeading": "?",
      "jiraField": "customfield_10020",
      "jiraFieldId": "customfield_10020",
      "jiraFieldType": "string",
      "transform": "direct",
      "_detectedValue": "0|i014f7:",
      "_needsReview": true
    },
    {
      "bmadSource": "section",
      "bmadSectionHeading": "?",
      "jiraField": "customfield_10000",
      "jiraFieldId": "customfield_10000",
      "jiraFieldType": "string",
      "transform": "direct",
      "_detectedValue": "{}",
      "_needsReview": true
    }
  ]
}
```

### Step 6: Review and Refine the Proposed Mapping

The auto-detected mapping needs refinement:

1. **Remove internal fields** -- `customfield_10020` (Rank) and `customfield_10000` (Development) are Jira-internal and should not be synced from documents.
2. **Add tech-spec-specific mappings** -- A BMAD tech spec typically has sections like "Acceptance Criteria", "Tech Stack", "Files to Modify", and "Code Patterns" that should map to Jira fields.
3. **Add frontmatter mappings** -- Tech specs have frontmatter keys (`title`, `status`, `tech_stack`) that should map to corresponding fields.

**Refined mapping to save:**

```json
{
  "$schema": "field-mapping-v1",
  "docType": "story",
  "projectKey": "DO",
  "issueType": "Story",
  "sampleTicket": "DO-5",
  "createdAt": "2026-03-18T10:48:37.323Z",
  "instructions": "Tech specs synced as Stories. The description field gets the Overview section converted to ADF. Acceptance Criteria goes into the description appendix since no custom AC field exists on this project.",
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
      "bmadSource": "section",
      "bmadSectionHeading": "Overview",
      "jiraField": "Description",
      "jiraFieldId": "description",
      "jiraFieldType": "adf",
      "transform": "markdownToAdf"
    }
  ]
}
```

Note: The DO project does not appear to have a custom "Acceptance Criteria" field (no non-null custom fields were detected on DO-5). If one exists but was null on the sample, it would need to be identified via `jira.mjs get DO-5 --fields customfield_10027` or by checking Jira admin field configuration, then added as:

```json
{
  "bmadSource": "section",
  "bmadSectionHeading": "Acceptance Criteria",
  "jiraField": "Acceptance Criteria",
  "jiraFieldId": "customfield_NNNNN",
  "jiraFieldType": "string",
  "transform": "direct"
}
```

### Step 7: Save the Mapping File

The mapping file should be saved to:

```
/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/memory/jira-story-field-mapping.json
```

This is done automatically by confirming the reviewed mapping. The agent would write the final JSON to that path.

### Step 8: Verify the Mapping is Loadable

After saving, verify by checking file existence:

```bash
ls /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/memory/jira-story-field-mapping.json
```

And test a dry run by checking status on a linked doc (once one exists):

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs status <tech-spec-file.md>
```

## Additional: Epic Mapping (for completeness)

If also setting up epic mapping (since DO-3 is an Epic parent), run:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs setup-mapping --type epic --sample DO-3
```

This produces a mapping with `childMapping` enabled, using `"parentLinkField": "parent"` (next-gen project style, confirmed by DO-5 having `parent.key: DO-3`). The child section pattern `^### Story (\\d+\\.\\d+): (.+)` extracts story sections from epic docs and creates child Story tickets linked to the epic.

## Key Findings

1. **DO-200 does not exist** -- The DO project only has 6 issues (DO-1 through DO-6). DO-5 was used as a representative Story sample.
2. **Minimal custom fields** -- The DO project has very few custom fields with values. The two detected (`customfield_10020` = Rank, `customfield_10000` = Development) are Jira-internal and should be excluded from sync mappings.
3. **Next-gen project** -- DO uses the `parent` field for epic-story linking (not classic `customfield_NNNNN` epic link), confirmed by DO-5's parent reference to DO-3.
4. **No Acceptance Criteria custom field detected** -- The mapping defaults to putting only Overview into the description. If the project later adds an AC field, the mapping JSON can be updated.
5. **Mapping file location** -- `<skill-path>/memory/jira-story-field-mapping.json` per the sync-mapping-guide.md convention.
