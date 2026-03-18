# Approach: Sync Epic Doc to Jira (Without Skill)

## Task Summary

Sync the local epic document at `docs/epics/auth-epic.md` to the DO Jira project at `https://wnesolutions.atlassian.net`. The document is not yet linked to any Jira ticket.

## What Is Needed

Without a dedicated Atlassian skill, there is no sync sub-skill, no `sync.mjs` helper script, no `sync-mapping-guide.md` for field mapping, and no automated workflow for detecting document types or managing frontmatter-based ticket links. The agent must manually piece together the entire sync process.

## Detailed Step-by-Step Approach

### Step 1: Read the Epic Document

Read `docs/epics/auth-epic.md` to understand its contents -- title, description, scope, acceptance criteria, and any YAML frontmatter fields. Determine what structured data exists that can map to Jira fields.

Without a skill, the agent has no `sync.mjs status` command to check the document's sync state. Instead, the agent must manually inspect the frontmatter for a `jira_ticket_id` field. Since the task states "It's not linked to any ticket yet," the agent expects no such field exists.

### Step 2: Determine the Document Type

The agent must infer the document type from the file path (`docs/epics/`) and content. Without a skill, there is no automated type detection -- the agent reasons from directory naming conventions that this is an "epic" document and should be synced as a Jira Epic issue type.

A dedicated skill would have a `sync.mjs status` command that automatically detects the document type and reports sync state.

### Step 3: Ask the User Which Jira Project to Sync To

The task specifies the DO project, but a well-behaved agent should confirm this with the user before proceeding. Without a skill enforcing a confirmation step, the agent may skip this and assume DO directly from the prompt context.

**Ideal interaction:**
> "I see this is an epic document at `docs/epics/auth-epic.md`. Which Jira project should I sync it to?"
> User: "DO"

### Step 4: Ask Whether to Create a New Epic or Link to Existing

Since the document has no `jira_ticket_id` in its frontmatter, the agent should ask:
> "This document isn't linked to any Jira ticket. Should I create a new Epic in the DO project, or link it to an existing Epic ticket?"

Without a skill, there is no guided flow that presents these options. The agent may skip this question and assume "create new" based on the prompt saying "It's not linked to any ticket yet."

### Step 5: Map Document Fields to Jira Epic Fields

The agent must manually determine which parts of the markdown document map to which Jira fields. Without a `sync-mapping-guide.md` reference, the agent must guess the mapping:

| Document Field | Jira Field | Notes |
|---|---|---|
| Title / H1 heading | Summary | Epic title |
| Description section | Description | Converted to ADF format |
| Labels in frontmatter | Labels | If present |
| Priority in frontmatter | Priority | If present |
| Acceptance criteria | Description (appended) | No dedicated field |

A dedicated skill would reference `sync-mapping-guide.md` for precise field-to-field mappings, including custom fields like Epic Name.

### Step 6: Get Project Metadata

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraProjectIssueTypesMetadata`
- **Parameters:** `cloudId`, `projectIdOrKey: "DO"`
- **Purpose:** Confirm the "Epic" issue type exists and discover required fields.

Then optionally:
- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssueTypeMetaWithFields`
- **Purpose:** Discover which fields are required for Epic creation (e.g., Epic Name custom field).

### Step 7: Create the Epic in Jira

- **Tool:** `mcp__plugin_atlassian_atlassian__createJiraIssue`
- **Parameters:**
  - `cloudId: "wnesolutions.atlassian.net"`
  - `projectKey: "DO"`
  - `issueTypeName: "Epic"`
  - `summary: "[Title from auth-epic.md]"`
  - `description: "[Full epic description converted from markdown]"`
  - `contentFormat: "markdown"`

A skill would use `sync.mjs link --type epic --project DO --create` to handle this in a single command, with proper field mapping and error handling built in.

### Step 8: Update the Document Frontmatter

After creating the Epic (e.g., `DO-50`), the agent should update `docs/epics/auth-epic.md` to add the Jira ticket reference in the YAML frontmatter:

```yaml
---
jira_ticket_id: DO-50
---
```

Without a skill, there is no guarantee this step happens. The `sync.mjs link` command would automatically write the `jira_ticket_id` back to the document frontmatter. The agent must manually edit the file, which risks formatting issues or frontmatter corruption.

### Step 9: Verify the Sync

Fetch the created issue to confirm all fields were mapped correctly:

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssue`
- **Parameters:** `issueIdOrKey: "DO-50"`

## Challenges Without the Skill

| Challenge | Impact |
|---|---|
| No `sync.mjs status` command | Cannot programmatically check document sync state; must manually parse frontmatter |
| No automatic document type detection | Must infer type from file path and content rather than automated detection |
| No user confirmation workflow | May skip asking which project or whether to create vs. link, leading to incorrect actions |
| No `sync.mjs link` command | Must manually create the issue AND update the document frontmatter as two separate steps |
| No `sync-mapping-guide.md` reference | Must guess field mappings; may miss custom fields like Epic Name or mismap document sections |
| No frontmatter update automation | Risk of corrupting YAML frontmatter when manually adding `jira_ticket_id` |
| No idempotency checks | Running the process again could create duplicate Epics since there is no sync state tracking |

## Estimated Tool Calls

| Operation | Calls |
|---|---|
| Read local document | 1 |
| Get project issue types | 1 |
| Get Epic field metadata | 1 |
| Create Epic issue | 1 |
| Verify created issue | 1 |
| Edit local file (frontmatter) | 1 |
| **Total** | **6** |

## Conclusion

Without a dedicated skill, the agent can complete the sync but must manually orchestrate every step: reading the document, inferring its type, asking the user for project and create-vs-link decisions, mapping fields without a guide, creating the Jira issue via MCP tools, and updating the local frontmatter by hand. The dedicated skill's `sync.mjs` script and `sync-mapping-guide.md` reference would automate type detection, field mapping, issue creation, and frontmatter updates in a single coordinated workflow with built-in confirmation steps and idempotency. Without these, the process is fragile, error-prone, and lacks guardrails against duplicate syncs or incorrect field mappings.
