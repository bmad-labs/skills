# Approach: Push Epic Doc to Jira with Mapping Config Instructions (Without Atlassian Skill)

## Task

Push a local epic document to Jira. The field mapping configuration file (`memory/jira-epic-field-mapping.json`) contains custom instructions: "Always add label qa-review and set component to Backend". These instructions must be read, printed, and followed during the push operation.

## Outcome

**This task cannot be reliably completed.** Without the Atlassian skill, there is no `sync.mjs` script to load field mapping configurations, no workflow to interpret mapping instructions, and no mechanism to automatically apply config-driven rules (like adding labels and components) during push operations. The agent must manually orchestrate every step, including discovering that a mapping config exists, parsing its instructions, and ensuring those instructions are applied alongside standard field mappings.

## Detailed Step-by-Step Approach

### Step 1: Locate the Epic Document

Search for the epic document in the local project. Without a skill providing document detection logic, the agent must guess typical locations:

```bash
find docs/ -name "*epic*" -type f
ls docs/epics/
```

Read the document to understand its content structure -- title, description, stories, acceptance criteria, and YAML frontmatter (including any `jira_ticket_id` or `jira_key` linking field).

**Without skill:** No `sync.mjs status` command to check sync state or detect document type automatically.

### Step 2: Locate and Load the Field Mapping Configuration

The task references a "mapping config" with instructions. Without the skill, the agent must know or guess that field mappings are stored at `memory/jira-epic-field-mapping.json`.

```bash
cat memory/jira-epic-field-mapping.json
```

Expected structure (hypothetical):

```json
{
  "docType": "epic",
  "instructions": "Always add label qa-review and set component to Backend",
  "fieldMappings": {
    "summary": "title",
    "description": "body",
    "labels": ["from-frontmatter"],
    "components": []
  }
}
```

**Critical step:** The agent must print the instructions to stdout so the user can see them:

```
Mapping instructions: "Always add label qa-review and set component to Backend"
```

**Without skill:** The `sync.mjs` script would automatically load the mapping config for the detected document type, print any instructions to the agent, and apply them during the push. Without it, the agent must manually find, read, parse, and act on the instructions. There is a significant risk the agent never looks for a mapping config at all, since there is no workflow directing it to do so.

### Step 3: Parse the Mapping Instructions

The agent must interpret the natural language instructions from the config:

1. **"Always add label qa-review"** -- The `labels` field on the Jira issue must include `qa-review` in addition to any labels derived from the document itself.
2. **"Set component to Backend"** -- The `components` field must be set to `[{"name": "Backend"}]`.

Without a skill, the agent must manually translate these instructions into the correct Jira API field format. This requires knowing:
- Labels are an array of strings: `"labels": ["qa-review", ...]`
- Components are an array of objects with a `name` field: `"components": [{"name": "Backend"}]`

**Risk:** An agent without domain knowledge may format components incorrectly (e.g., as a string instead of an object), causing the API call to fail.

### Step 4: Map Document Fields to Jira Fields

The agent must manually determine field mappings without a `sync-mapping-guide.md` reference:

| Document Field | Jira Field | Format |
|---|---|---|
| Title / H1 heading | `summary` | String |
| Description section | `description` | ADF (Atlassian Document Format) |
| Labels in frontmatter | `labels` | Array of strings |
| Priority in frontmatter | `priority` | Object with `name` |
| **Config instruction** | `labels` | Append `qa-review` |
| **Config instruction** | `components` | Set `[{"name": "Backend"}]` |

**Without skill:** The `sync-mapping-guide.md` reference would provide exact field-to-field mappings including custom fields like Epic Name. Without it, the agent must guess and may miss fields.

### Step 5: Get Project Metadata and Validate Fields

Before pushing, the agent should verify the target project supports the required fields:

**Tool:** `mcp__plugin_atlassian_atlassian__getJiraProjectIssueTypesMetadata`
- Confirm "Epic" issue type exists
- Discover required fields

**Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssueTypeMetaWithFields`
- Verify that `labels` and `components` fields are available
- Confirm "Backend" is a valid component in the project

**Without skill:** The `sync.mjs` script would validate field availability and component existence before pushing. Without it, the agent may push with an invalid component name, causing an API error.

### Step 6: Convert Markdown to Atlassian Document Format (ADF)

The Jira Cloud REST API v3 requires the `description` field in ADF format. Converting markdown (headings, lists, code blocks, tables, links) to ADF is non-trivial.

The atlassian-rest skill bundles the `marklassian` library for this conversion. Without it, the agent must either:
- Construct ADF JSON manually for each markdown element
- Send plain text (losing all formatting)
- Use the `contentFormat: "markdown"` parameter if the MCP tool supports it

**Blocker:** No markdown-to-ADF conversion library is available without the skill.

### Step 7: Create or Update the Epic in Jira

Depending on whether the document is already linked to a Jira ticket:

**If creating new:**
- **Tool:** `mcp__plugin_atlassian_atlassian__createJiraIssue`
- **Parameters:**
  - `projectKey: "DO"` (or whatever project is configured)
  - `issueTypeName: "Epic"`
  - `summary: "[Title from epic doc]"`
  - `description: "[Converted description]"`
  - `labels: ["qa-review"]` (from mapping instructions)
  - `components: [{"name": "Backend"}]` (from mapping instructions)

**If updating existing (linked via frontmatter):**
- **Tool:** `mcp__plugin_atlassian_atlassian__editJiraIssue`
- **Parameters:**
  - `issueIdOrKey: "[from frontmatter]"`
  - `fields` including the mapped content plus instruction-driven labels and components

**Critical:** The `qa-review` label and `Backend` component must be included in the push payload per the mapping config instructions.

### Step 8: Update Local Document Frontmatter

After a successful create/push, update the local document's YAML frontmatter with:
- `jira_ticket_id` (if newly created)
- `last_synced` timestamp

Without the skill's `sync.mjs link` command, the agent must manually edit the file, risking YAML frontmatter corruption.

### Step 9: Report Push Results

Present a summary of what was pushed:

```
Push Results for DO-XX:
  summary:     Set to "Auth Epic Title"
  description: Updated (converted from markdown)
  labels:      Added "qa-review" (per mapping instructions)
  components:  Set to "Backend" (per mapping instructions)

Mapping instructions applied:
  - "Always add label qa-review" -> labels: ["qa-review"]
  - "Set component to Backend" -> components: [{"name": "Backend"}]

All fields successfully pushed.
```

## Challenges Without the Skill

| Challenge | Impact |
|---|---|
| **No mapping config loading** | The agent has no workflow directing it to look for `memory/jira-epic-field-mapping.json`; it must guess that mapping configs exist and where they are stored |
| **No instruction parsing logic** | The skill's `sync.mjs` script automatically reads and applies instructions from the mapping config; without it, the agent must manually interpret natural language instructions and translate them to API field formats |
| **No instruction printing** | The skill prints mapping instructions to stdout so the agent can see and follow them; without the skill, the agent must manually read and surface the instructions |
| **No field validation** | Cannot verify that "Backend" is a valid component or that the label field accepts "qa-review" before pushing |
| **No ADF conversion** | No `marklassian` library for markdown-to-ADF conversion |
| **No sync state tracking** | No mechanism to track what was pushed or detect future changes |
| **No standard field mappings** | Must guess which document sections map to which Jira fields without `sync-mapping-guide.md` |
| **Risk of ignoring instructions** | Without a structured workflow, the agent may read the mapping config but fail to apply the instructions, or may never look for the config at all |

## Estimated Tool Calls

| Operation | Calls |
|---|---|
| Read local epic document | 1 |
| Read mapping config file | 1 |
| Get project issue types metadata | 1 |
| Get Epic field metadata | 1 |
| Create or edit Jira issue | 1 |
| Verify created/updated issue | 1 |
| Edit local file (frontmatter) | 1 |
| **Total** | **7** |

## Conclusion

Without a dedicated skill, the most significant risk in this task is that the agent never discovers or applies the mapping config instructions. The prompt mentions a "mapping config" with instructions, but without the skill's `sync.mjs` workflow that automatically loads `memory/jira-<docType>-field-mapping.json`, prints instructions to stdout, and applies them during push, the agent must:

1. Know that mapping configs exist at a specific path
2. Manually read and parse the config file
3. Interpret the natural language instructions ("add label qa-review", "set component to Backend")
4. Translate those instructions into correct Jira API field formats (labels as string array, components as object array)
5. Include those fields in the push payload alongside standard field mappings

The skill's `sync.mjs push` command handles all of this automatically -- it loads the mapping config for the document type, prints instructions for visibility, applies instruction-driven field values, performs standard field mapping, converts markdown to ADF, and executes the push with proper error handling. Without this orchestration, each step must be manually discovered and executed, with high risk of missing the instructions entirely or applying them incorrectly.
