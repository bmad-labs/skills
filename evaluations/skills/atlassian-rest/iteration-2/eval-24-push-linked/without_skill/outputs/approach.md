# Approach: Push Linked Tech Spec to Jira (Without Atlassian Skill)

## Task

Push the latest local changes from a tech spec document (already linked to DO-200) to the Jira project DO at https://wnesolutions.atlassian.net.

## Outcome

**I cannot complete this task.** This requires both authentication credentials and knowledge of how the local document is linked/mapped to Jira fields. Without the Atlassian skill's sync tooling, there is no way to detect the link, determine the field mapping, or execute the push.

## Detailed Step-by-Step Approach

### Step 1: Locate the Linked Tech Spec

The user says the tech spec is "already linked" to DO-200, which implies:

- A local markdown file exists somewhere in the project with a reference to `DO-200` in its YAML frontmatter (e.g., `jira_ticket_id: DO-200`) or in the document title (e.g., `[DO-200]` prefix).
- Some sync state may exist that tracks what was previously pushed and what has changed since.

I would search the local filesystem for the linked document:

```bash
grep -r "DO-200" --include="*.md" .
```

**Blocker:** Even if I find the file, I have no way to determine which sections of the document map to which Jira fields without a field mapping configuration.

### Step 2: Read the Local Document and Determine Changes

Once the tech spec file is found, I would need to:

1. Parse the document content (markdown with possible YAML frontmatter)
2. Identify what changed since the last sync

Without a sync state file tracking the previous push, I cannot determine which sections have been modified. I would have to assume the entire document needs to be pushed.

### Step 3: Fetch the Current State of DO-200 from Jira

To understand what to update, I would fetch the current issue:

```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'user@example.com:JIRA_API_TOKEN' | base64)" \
  -H "Content-Type: application/json" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-200"
```

This would reveal the current field values and allow me to compare them with the local document.

**Blocker:** No Jira API token or authenticated email is available.

### Step 4: Map Document Sections to Jira Fields

A tech spec typically contains structured sections that need to map to specific Jira fields:

| Document Section | Likely Jira Field | Field Type |
|-----------------|-------------------|------------|
| Title / Summary | `summary` | String |
| Description / Overview | `description` | ADF (Atlassian Document Format) |
| Acceptance Criteria | Custom field | ADF or String |
| Tech Stack | Custom field or label | Varies |
| Files to Modify | Custom field | Varies |
| Implementation Notes | Comment or custom field | ADF |

**Blockers:**
- Without a field mapping configuration, I cannot know which custom fields exist on this Jira project or how document sections should map to them.
- Jira Cloud uses ADF (Atlassian Document Format) for rich text fields, not markdown. Converting markdown to ADF requires either a conversion library or manual construction of the ADF JSON tree.

### Step 5: Convert Markdown to Atlassian Document Format (ADF)

The Jira Cloud REST API v3 requires the `description` field (and other rich text fields) in ADF format. A simple paragraph in ADF looks like:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Content here"
        }
      ]
    }
  ]
}
```

Converting full markdown (headings, lists, code blocks, tables, links) to ADF is non-trivial and requires either:
- A library like `marklassian` (which the skill bundles)
- Manual ADF JSON construction for each markdown element

**Blocker:** No markdown-to-ADF conversion library is available without the skill.

### Step 6: Push Changes via PUT Request

Once I had the mapped and converted content, I would update the issue:

```bash
curl -s -X PUT \
  -H "Authorization: Basic $(echo -n 'user@example.com:JIRA_API_TOKEN' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "summary": "Updated Tech Spec Title",
      "description": {
        "type": "doc",
        "version": 1,
        "content": [...]
      }
    }
  }' \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-200"
```

For custom fields, the field IDs (e.g., `customfield_10050`) would need to be discovered first:

```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'user@example.com:JIRA_API_TOKEN' | base64)" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/createmeta/DO/issuetypes?expand=projects.issuetypes.fields"
```

**Blocker:** No credentials available to execute any of these API calls.

### Step 7: Update Sync State

After a successful push, the sync state would need to be updated to record:
- Timestamp of the push
- Hash or snapshot of the pushed content per field
- The Jira issue version/updated timestamp

This allows future diff operations to detect what changed since the last sync.

**Blocker:** Without the skill's sync state infrastructure, there is no mechanism to track sync history.

### Step 8: Report Results

I would present a summary of what was updated:

```
Push Results for DO-200:
  summary:    Updated (was "Old Title" -> "New Title")
  description: Updated (14 paragraphs synced)
  custom_10050: Updated (acceptance criteria)

All fields successfully pushed to DO-200.
```

## Alternative Approaches Considered

### Direct Jira REST API with curl

As described above, this is theoretically possible but requires:
1. Valid API credentials (email + token)
2. Knowledge of the project's custom field IDs
3. A markdown-to-ADF converter
4. Manual tracking of sync state

### Jira CLI Tools

Tools like `jira-cli` or `go-jira` could simplify authentication but still lack:
- Markdown-to-ADF conversion
- Document-to-field mapping logic
- Sync state tracking

**Blocker:** No Jira CLI tool is installed.

### MCP Atlassian Plugin

The environment lists MCP tools (e.g., `mcp__plugin_atlassian_atlassian__editJiraIssue`) that could edit the issue with pre-configured auth. However, this baseline evaluation excludes plugins, and even with the plugin, the document-to-field mapping and ADF conversion challenges remain.

## Blockers and Limitations

| Item | Detail |
|------|--------|
| **No credentials available** | No Jira API token or authenticated email for the Atlassian instance. |
| **No field mapping** | Cannot determine how tech spec sections map to Jira fields (especially custom fields). |
| **No ADF converter** | Jira v3 API requires Atlassian Document Format; converting markdown to ADF is non-trivial without a library. |
| **No sync state tracking** | Cannot determine what changed since last sync without a sync state mechanism. |
| **No sync.mjs script** | The skill's `sync.mjs` script handles status checking, diffing, field mapping, ADF conversion, and push execution -- none of this is available without the skill. |
| **No skill workflow** | The `sync-bmad-documents.md` workflow defines the exact 9-step process for this operation, unavailable without the skill. |

## Conclusion

Pushing a linked tech spec to Jira is a complex multi-step operation that requires: (1) finding the linked document, (2) determining what changed since the last sync, (3) mapping document sections to Jira fields per a stored configuration, (4) converting markdown content to ADF format, (5) authenticating with the Jira API, (6) executing PUT requests for each changed field, and (7) updating sync state for future operations.

Without the Atlassian skill, none of these steps can be completed. The skill provides:
- `sync.mjs status` to confirm the document is linked
- `sync.mjs diff` to detect per-section changes
- `sync.mjs push` to execute the push with automatic ADF conversion and field mapping
- Stored field mappings in `memory/jira-<docType>-field-mapping.json`
- Sync state tracking in `memory/sync-state/`
- The `marklassian` library for markdown-to-ADF conversion

This task requires either the Atlassian skill or manual credential setup plus significant custom scripting for field mapping and format conversion.
