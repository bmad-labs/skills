# Approach: Pull Latest Changes from Jira Ticket into Local Epic Doc (Without Atlassian Skill)

## Task

Pull the latest changes from Jira ticket DO-100 into the local epic document at `docs/epics/platform-epic.md`, using the Jira project DO at https://wnesolutions.atlassian.net.

## Outcome

**I cannot complete this task.** This task requires authenticated access to Jira to fetch the remote issue data, a sync mechanism to map Jira fields to the local markdown document structure, and handling of child story tickets linked to the epic. Without the Atlassian skill, its sync tooling, or valid API credentials, none of these operations can be performed.

## Detailed Step-by-Step Approach

### Step 1: Verify the Local Epic Document Exists and Is Linked to DO-100

Before pulling, I would need to confirm that `docs/epics/platform-epic.md` exists and contains metadata linking it to the Jira ticket DO-100. Typically, BMAD-style documents include YAML frontmatter with a sync identifier:

```yaml
---
jira_key: DO-100
jira_type: Epic
last_synced: 2025-12-01T10:00:00Z
---
```

I would read the file and check for this linkage. If no link exists, the pull operation cannot proceed without first establishing the relationship.

**Blocker:** The file `docs/epics/platform-epic.md` does not currently exist in the repository. There is no document to pull into.

### Step 2: Fetch the Epic Issue from Jira REST API

The Jira Cloud REST API v3 endpoint for retrieving the epic issue is:

```
GET https://wnesolutions.atlassian.net/rest/api/3/issue/DO-100
```

Using `curl` with Basic Auth:

```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'user@example.com:JIRA_API_TOKEN' | base64)" \
  -H "Content-Type: application/json" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-100"
```

Key fields to extract from the response:
- `.fields.summary` -- epic title
- `.fields.description` -- epic description (in Atlassian Document Format / ADF)
- `.fields.status.name` -- current status
- `.fields.priority.name` -- priority
- `.fields.assignee.displayName` -- assignee
- `.fields.labels` -- labels
- `.fields.customfield_10014` -- epic name (custom field, varies by instance)

**Blocker:** No Jira API token or user credentials are available.

### Step 3: Convert ADF Description to Markdown

Jira Cloud v3 returns the description in Atlassian Document Format (ADF), a JSON-based rich text format. To update the local markdown document, the ADF content must be converted to Markdown.

This would require either:
- A library like `marklassian` (which is available in the atlassian-rest skill's `package.json`) to perform ADF-to-Markdown conversion
- Manual traversal of the ADF JSON tree, mapping node types (`paragraph`, `heading`, `bulletList`, `codeBlock`, etc.) to their Markdown equivalents

Example ADF structure:
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "This epic covers..." }
      ]
    }
  ]
}
```

**Blocker:** Without running the conversion script or library, I cannot transform ADF to Markdown.

### Step 4: Fetch Child Story Tickets Under the Epic

Epics in Jira have child issues (stories, tasks, bugs) linked to them. To fully sync the epic doc, I would need to fetch all child issues using JQL:

```
GET https://wnesolutions.atlassian.net/rest/api/3/search?jql=parent=DO-100 OR "Epic Link"=DO-100&fields=key,summary,status,assignee,issuetype,priority
```

Using `curl`:

```bash
curl -s \
  -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data-urlencode 'jql=parent=DO-100 OR "Epic Link"=DO-100' \
  "https://wnesolutions.atlassian.net/rest/api/3/search?fields=key,summary,status,assignee,issuetype,priority"
```

This would return all stories/tasks/bugs belonging to the epic, which should be reflected in the local document (e.g., as a table or checklist of child tickets).

**Blocker:** Same authentication blocker as Step 2.

### Step 5: Update the Local Epic Document

With the fetched data, I would update `docs/epics/platform-epic.md` by:

1. **Updating frontmatter** -- refresh `last_synced` timestamp, update status, assignee, priority
2. **Updating the description section** -- replace the body content with the converted Markdown from the ADF description
3. **Updating the child stories section** -- rebuild a table of linked stories:

```markdown
## Child Stories

| Key | Summary | Status | Assignee | Type |
|-----|---------|--------|----------|------|
| DO-101 | Implement auth service | In Progress | Jane Doe | Story |
| DO-102 | Add rate limiting | To Do | Unassigned | Task |
| DO-103 | Fix login timeout | Done | John Smith | Bug |
```

4. **Preserving local-only sections** -- any sections in the local doc that are not synced from Jira (e.g., local notes, implementation details) should be preserved rather than overwritten.

### Step 6: Report What Changed

After the update, I would diff the previous and new versions to report which sections/fields were updated:

```
Updated fields in docs/epics/platform-epic.md:
  - Status: "To Do" -> "In Progress"
  - Description: updated (content changed)
  - Child stories: 2 added (DO-104, DO-105), 1 status changed (DO-101: "To Do" -> "In Progress")
  - Last synced: 2025-12-01T10:00:00Z -> 2026-03-18T14:30:00Z
```

## Alternative Approaches Considered

### Using the Atlassian Skill's sync.mjs Script

The atlassian-rest skill provides a `sync.mjs` script at `skills/atlassian-rest/scripts/sync.mjs` designed for exactly this purpose. The expected workflow would be:

```bash
# Check sync status
node skills/atlassian-rest/scripts/sync.mjs status docs/epics/platform-epic.md

# Pull remote changes
node skills/atlassian-rest/scripts/sync.mjs pull docs/epics/platform-epic.md
```

This script handles authentication (via configured credentials), ADF-to-Markdown conversion (via `marklassian`), child issue fetching, and selective field updates automatically. It also includes the sync-bmad-documents workflow (`skills/atlassian-rest/workflows/sync-bmad-documents.md`) which orchestrates multi-step sync operations.

**Blocker:** This baseline evaluation explicitly excludes using the skill or its scripts.

### MCP Atlassian Plugin

The environment lists MCP Atlassian tools such as `mcp__plugin_atlassian_atlassian__getJiraIssue` and `mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql` which could fetch the issue data with pre-configured OAuth authentication. However, this baseline evaluation excludes using any skill or plugin.

### Manual curl with User-Provided Token

If the user provided their Jira API token directly, I could execute the curl commands from Steps 2-4 and then manually construct the updated markdown file. This would work but requires:
- The user to supply credentials (security concern)
- Manual ADF-to-Markdown conversion logic
- Manual child issue table construction

## Blockers and Limitations

| Item | Detail |
|------|--------|
| **No credentials available** | No Jira API token, OAuth token, or session cookie is available to authenticate API requests. |
| **No local document exists** | The file `docs/epics/platform-epic.md` does not exist in the repository, so there is nothing to pull into. |
| **No sync tooling available** | The `sync.mjs` script and `sync-bmad-documents` workflow are part of the atlassian-rest skill, which is excluded. |
| **ADF conversion required** | Jira v3 returns descriptions in ADF format, which requires a conversion library or custom logic to transform to Markdown. |
| **Child issue handling** | Epics require fetching linked child stories via JQL, adding a second API call and additional data mapping. |
| **No skill/plugin allowed** | MCP Atlassian plugin tools are explicitly excluded for this baseline test. |
| **Field mapping complexity** | Mapping Jira fields to the correct sections of a structured Markdown document requires knowledge of the document schema. |

## Conclusion

Pulling Jira epic data into a local markdown document is a multi-step operation that involves: (1) authenticating with Jira, (2) fetching the epic issue and its child stories, (3) converting ADF rich text to Markdown, (4) mapping Jira fields to the local document structure, and (5) merging changes while preserving local-only content. Each of these steps requires either the atlassian-rest skill's sync tooling (which handles all of this automatically via `sync.mjs pull`) or valid API credentials combined with custom conversion logic. Without either of these, the task cannot be executed. This task would require:

1. The atlassian-rest skill with its `sync.mjs` script and `marklassian` dependency configured
2. Or a configured MCP Atlassian plugin with stored OAuth credentials
3. Or a valid API token provided by the user, plus custom ADF-to-Markdown conversion logic
