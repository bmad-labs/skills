# Approach: Sync Story Document to Jira (Without Skill)

## Task Summary

Create a Jira story from the local document at `_bmad-output/user-story-2.md` in the DO project at `https://wnesolutions.atlassian.net`, then update the source document with the resulting Jira ticket link.

## What Is Needed

Without a dedicated Atlassian skill, there is no `sync.mjs` helper script, no `sync-mapping-guide.md` for field mapping, no `jira-story-field-mapping.json` configuration, and no automated workflow for reading a story document and creating a linked Jira issue. The agent must manually orchestrate every step of the process.

## Detailed Step-by-Step Approach

### Step 1: Read the Story Document

Read `_bmad-output/user-story-2.md` to extract its contents -- title, description, acceptance criteria, and any YAML frontmatter fields. Determine what structured data exists that can map to Jira fields.

Without a skill, the agent has no `sync.mjs status` command to check the document's sync state. Instead, the agent must manually inspect the frontmatter for a `jira_ticket_id` field. If none exists, the agent treats this as a new story that needs to be created in Jira.

### Step 2: Determine the Document Type

The agent must infer the document type from the file name (`user-story-2.md`) and content. Without a skill, there is no automated type detection -- the agent reasons from the file naming convention and content structure that this is a "story" document and should be synced as a Jira Story issue type.

A dedicated skill would use `sync.mjs link --type story` with automatic type detection from the document's frontmatter or naming conventions.

### Step 3: Check for Field Mapping Configuration

A skill-based approach would check for `memory/jira-story-field-mapping.json` to understand how document fields map to Jira fields. This file would define which markdown sections correspond to which Jira fields (summary, description, acceptance criteria, labels, priority, story points, etc.).

Without a skill, the agent has no knowledge of this mapping file and must guess the field mapping:

| Document Field | Jira Field | Notes |
|---|---|---|
| Title / H1 heading | Summary | Story title |
| Description section | Description | Converted to ADF format |
| Acceptance criteria | Description (appended) or custom field | No dedicated field without mapping |
| Labels in frontmatter | Labels | If present |
| Priority in frontmatter | Priority | If present |
| Story points in frontmatter | Story Points custom field | Likely missed without mapping guide |

A dedicated skill would run `sync.mjs setup-mapping` if no mapping exists, or use the existing mapping to correctly place all fields.

### Step 4: Get Project Metadata

Before creating the issue, confirm the Story issue type is available in the DO project:

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraProjectIssueTypesMetadata`
- **Parameters:** `cloudId`, `projectIdOrKey: "DO"`
- **Purpose:** Confirm the "Story" issue type exists and discover required fields.

Then optionally:
- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssueTypeMetaWithFields`
- **Purpose:** Discover which fields are required or optional for Story creation.

### Step 5: Convert Markdown Content to Jira-Compatible Format

The agent must manually convert the markdown document content into Atlassian Document Format (ADF) for the Jira description field. This involves:

1. Parsing headings, paragraphs, lists, code blocks from the markdown
2. Constructing the equivalent ADF JSON structure
3. Handling any edge cases (tables, links, images)

Without a skill, there is no `marklassian` or similar markdown-to-ADF conversion utility available. The agent must either:
- Construct ADF JSON manually (error-prone for complex documents)
- Use the `contentFormat: "markdown"` option if the MCP tool supports it
- Produce a simplified plain-text version and lose formatting

A skill would handle this conversion automatically via helper scripts.

### Step 6: Create the Story in Jira

- **Tool:** `mcp__plugin_atlassian_atlassian__createJiraIssue`
- **Parameters:**
  - `cloudId: "wnesolutions.atlassian.net"`
  - `projectKey: "DO"`
  - `issueTypeName: "Story"`
  - `summary: "[Title extracted from user-story-2.md]"`
  - `description: "[Converted description from markdown]"`
  - `contentFormat: "markdown"`

A skill would use `sync.mjs link --type story --project DO --create` to handle this in a single command with proper field mapping and error handling.

### Step 7: Update the Source Document with Jira Link

After creating the story (e.g., `DO-123`), the agent must update `_bmad-output/user-story-2.md` to record the Jira ticket reference. This could be done by:

1. Adding `jira_ticket_id: DO-123` to the YAML frontmatter, or
2. Prefixing the title with the ticket key (e.g., `[DO-123]`), or
3. Both

Without a skill, there is no standardized approach for where to place the link. The `sync.mjs link` command would automatically write the `jira_ticket_id` back to the document frontmatter and optionally prefix the title. The agent must manually edit the file, which risks formatting issues or frontmatter corruption.

### Step 8: Create Sync State File

A skill-based approach would also create a sync state file at `memory/sync-state/` to track the relationship between the local document and the Jira issue. This enables future syncs (push updates from the document to Jira, or pull updates from Jira back to the document).

Without a skill, the agent has no concept of sync state and will not create this file, meaning future syncs require re-establishing the link manually.

### Step 9: Print Instructions (If Applicable)

A skill-based approach would check if the field mapping has a non-empty `instructions` field and print those to stdout after creation. This allows project-specific post-creation instructions (e.g., "Remember to add the story to the current sprint" or "Notify the team in Slack").

Without a skill, this step is completely skipped.

### Step 10: Verify the Issue

Fetch the created issue to confirm all fields were mapped correctly:

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssue`
- **Parameters:** `issueIdOrKey: "DO-123"`

Verify:
- Issue type is "Story"
- Project is "DO"
- Summary matches the document title
- Description contains the document content

## Challenges Without the Skill

| Challenge | Impact |
|---|---|
| No `sync.mjs link` command | Must manually create the issue AND update the document as two separate, uncoordinated steps |
| No field mapping configuration (`jira-story-field-mapping.json`) | Must guess field mappings; may miss custom fields like Story Points or mismap document sections |
| No `sync.mjs setup-mapping` fallback | Cannot interactively configure field mappings if none exist |
| No automatic document type detection | Must infer type from file name and content rather than automated detection |
| No markdown-to-ADF conversion utility | Must construct ADF manually or rely on MCP tool's markdown support |
| No frontmatter update automation | Risk of corrupting YAML frontmatter when manually adding `jira_ticket_id` |
| No sync state tracking | No `memory/sync-state/` file created; future syncs cannot detect prior link |
| No idempotency checks | Running the process again could create duplicate Stories since there is no sync state |
| No post-creation instructions | Skips any project-specific guidance defined in the field mapping |

## Estimated Tool Calls

| Operation | Calls |
|---|---|
| Read local document | 1 |
| Get project issue types | 1 |
| Get Story field metadata | 1 |
| Create Story issue | 1 |
| Verify created issue | 1 |
| Edit local file (frontmatter update) | 1 |
| **Total** | **6** |

## Conclusion

Without a dedicated skill, the agent can likely complete the basic task -- creating a Jira story and updating the document -- but must manually orchestrate every step. The process lacks the dedicated skill's key advantages: automatic document type detection, configurable field mapping via `jira-story-field-mapping.json`, the `sync.mjs link --type story --project DO --create` single-command workflow, automatic frontmatter updates, sync state tracking for future syncs, and post-creation instructions. Without these, the process is fragile, risks field mapping errors, provides no idempotency, and leaves no sync state for future operations. The most significant gap is the missing field mapping configuration, which means custom fields and project-specific field requirements will likely be missed entirely.
