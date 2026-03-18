# Approach: Delete Orphaned Sub-Imp Subtasks After Removing Story Sections (Without Atlassian Skill)

## Task

The user removed 3 story sections from their local epic document. They want to push the changes and clean up the orphaned Sub-Imp subtasks in the Jira project DO at https://wnesolutions.atlassian.net.

"Orphaned" means sections that previously existed in the local epic doc (and had corresponding Jira subtasks created via sync) have been removed from the doc, but the Jira subtasks still exist.

## Outcome

**I cannot complete this task.** This requires the `sync.mjs push --delete-orphans` command from the Atlassian skill, which handles orphan detection, type-safe deletion guards, user confirmation prompts, and sync state cleanup. Without the skill, I have no sync state to compare against, no credentials to call the Jira API, and no automated way to identify which Jira subtasks correspond to the removed sections.

## Detailed Step-by-Step Approach

### Step 1: Identify the Epic Document and Its Sync State

The first step is to locate the epic document the user edited and determine which story sections were removed. With the skill, this would be:

```bash
node sync.mjs status docs/epics/<epic-file>.md
```

This command reads the document's YAML frontmatter (which contains a `jira_ticket_id` linking to the parent epic), loads the sync state from `memory/sync-state/`, and compares the current document sections against the stored `childLinks` array.

Without the skill, I would need to:
1. Find the epic document by searching for recently modified `.md` files in `docs/epics/`
2. Read its YAML frontmatter to find the linked Jira epic key (e.g., `DO-XXX`)
3. Locate the sync state file (stored in `memory/sync-state/` by the skill) which tracks `childLinks` -- an array mapping each local section ID (`bmadSectionId`) to a remote Jira issue key (`remoteId`)
4. Determine which `childLinks` entries no longer have corresponding sections in the document

**Blocker:** Without the skill's sync state infrastructure, there is no record of which local sections previously mapped to which Jira subtasks. The mapping between document sections and Jira issues is maintained entirely within the sync state file, which is created and managed by `sync.mjs`.

### Step 2: Push the Document Changes

Before cleaning up orphans, the document changes need to be pushed to update the parent epic in Jira. With the skill:

```bash
node sync.mjs push docs/epics/<epic-file>.md --delete-orphans
```

The `push` command does two things:
1. Pushes updated content for the parent epic and any remaining story sections
2. When `--delete-orphans` is passed, detects and offers to delete orphaned subtasks

Without the skill, pushing would require:
- Reading the document, converting markdown to ADF via `marklassian`
- Calling the Jira REST API `PUT /rest/api/3/issue/{key}` for the parent epic
- Creating/updating subtasks for remaining story sections
- All of which require API credentials that are not available

**Blocker:** No Jira API credentials (ATLASSIAN_API_TOKEN, ATLASSIAN_EMAIL, ATLASSIAN_DOMAIN) are configured.

### Step 3: Detect Orphaned Subtasks

The `sync.mjs push --delete-orphans` flag triggers orphan detection logic that:

1. Reads all current story sections from the local document (extracts section IDs)
2. Reads the `childLinks` array from the sync state
3. Filters `childLinks` to find entries where the `bmadSectionId` no longer exists in the current document
4. Reports each orphaned subtask with its Jira key and section ID

Example output from `sync.mjs`:
```
Found 3 orphaned subtask(s) -- section removed from local doc but Jira ticket still exists:
   - DO-301 (section: "story-user-login")
   - DO-302 (section: "story-password-reset")
   - DO-303 (section: "story-session-mgmt")
```

Without the skill, I would need to:
- Manually parse the sync state JSON file to find all `childLinks`
- Manually compare against current document sections
- Manually identify orphans

**Blocker:** The sync state file does not exist without prior use of the skill. Even if it did, there are no API credentials to interact with Jira.

### Step 4: Verify Each Orphan's Issue Type (Safety Guard)

For each orphaned subtask, the skill's sync engine fetches the issue from Jira to verify its issue type:

```bash
node jira.mjs get DO-301 --fields issuetype
```

It extracts `fields.issuetype.name` and checks that it starts with `Sub-` (e.g., `Sub-Imp`, `Sub-Test`, `Sub-Bug`). This is a critical safety guard: **only Sub-* issue types are eligible for deletion**. Stories, Epics, Tasks, and other parent-level issue types are never deleted by the orphan cleanup process.

If the issue type does not start with `Sub-`, the sync engine logs:
```
Skipping DO-301 -- issue type "Story" is not a Sub-* type (deletion restricted to subtasks only)
```

And marks the entry in results as `not-subtask-skipped`.

Without the skill, I would need to manually call the Jira REST API for each orphan:
```bash
curl -s \
  -H "Authorization: Basic $(echo -n 'user@example.com:TOKEN' | base64)" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-301?fields=issuetype"
```

**Blocker:** No API credentials available to fetch issue type information.

### Step 5: Prompt User for Confirmation Before Each Deletion

For each orphan that passes the Sub-* type check, the skill presents an interactive confirmation prompt:

```
Delete DO-301 [Sub-Imp] ("story-user-login") from Jira? (y/N):
```

The default is **N** (no), making this a conservative, opt-in deletion. Each orphan gets its own confirmation -- there is no "delete all" batch option. This ensures the user explicitly approves each deletion.

Without the skill, I would present the list of orphans and ask the user to confirm, but I cannot execute the actual deletion without API access.

### Step 6: Execute DELETE API Call for Confirmed Subtasks

For each confirmed deletion, the skill calls the Jira REST API:

```
DELETE https://wnesolutions.atlassian.net/rest/api/3/issue/DO-301
```

The `deleteIssue()` function in `sync.mjs` sends an authenticated DELETE request:
```javascript
const res = await fetch(url, {
  method: 'DELETE',
  headers: { Authorization: authHeader(), Accept: 'application/json' },
});
```

If the delete succeeds (HTTP 204), the orphan is removed. If it fails, the error is logged and the entry is marked as `delete-failed`.

Without the skill, I would need to use `curl`:
```bash
curl -s -X DELETE \
  -H "Authorization: Basic $(echo -n 'user@example.com:TOKEN' | base64)" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue/DO-301"
```

**Blocker:** No API credentials available.

### Step 7: Remove Deleted Entries from Sync State

After each successful deletion, the skill removes the orphan's entry from the `childLinks` array in the sync state:

```javascript
const idx = existingLinks.indexOf(o);
if (idx !== -1) existingLinks.splice(idx, 1);
```

The updated state is then written back to the sync state file. This prevents the same orphan from appearing in future push operations.

For orphans that were **not deleted** (either user declined or deletion failed), the entry remains in `childLinks` with an `orphaned: true` flag so it can be addressed later.

Without the skill, there is no sync state to update.

### Step 8: Report Results

The skill produces a summary of what happened to each orphan:

```
Orphan Cleanup Results:
  - DO-301 [Sub-Imp] ("story-user-login"): DELETED
  - DO-302 [Sub-Imp] ("story-password-reset"): DELETED
  - DO-303 [Sub-Imp] ("story-session-mgmt"): KEPT (user declined)
```

Each orphan gets one of these statuses:
- `deleted` -- successfully deleted from Jira and removed from sync state
- `kept` -- user declined deletion; entry remains in sync state marked as orphaned
- `not-subtask-skipped` -- issue type is not Sub-*; deletion was blocked by safety guard
- `delete-failed` -- API call failed; entry remains in sync state marked as orphaned

## Alternative Approaches Considered

### Manual Jira REST API with curl

Theoretically possible if the user provides:
1. Jira API token and email for authentication
2. The list of orphaned ticket keys (since there is no sync state to derive them from)
3. Confirmation for each deletion

Even then, the agent would need to:
- Fetch each issue's type to verify it is Sub-Imp
- Execute DELETE requests one by one
- There is no sync state to clean up since it does not exist

**Blocker:** No credentials available. No sync state to identify orphans.

### MCP Atlassian Plugin

The environment lists MCP tools including `mcp__plugin_atlassian_atlassian__getJiraIssue` and `mcp__plugin_atlassian_atlassian__fetchAtlassian`. However:
- There is no `deleteJiraIssue` MCP tool available -- the deferred tools list does not include a delete operation
- Even with MCP tools, there is no sync state to identify which subtasks are orphaned
- The `fetchAtlassian` tool could potentially make a raw DELETE request, but without knowing which tickets to delete, this is not actionable

**Blocker:** No MCP delete tool available, and no sync state to identify orphans.

### JQL Search for Child Issues

I could search for all subtasks under the epic using JQL:
```
parent = DO-XXX AND issuetype = Sub-Imp
```

Then compare the results against the remaining story sections in the document. But:
- I do not know the epic's Jira key without the sync state or frontmatter
- I do not know the naming convention that links Jira subtasks to document section IDs
- Even if I could identify orphans, I cannot delete them without credentials

**Blocker:** No way to correlate Jira subtasks with document sections without the sync state's `childLinks` mapping.

## Blockers and Limitations

| Item | Detail |
|------|--------|
| **No sync state available** | The `memory/sync-state/` directory and its `childLinks` mapping are created by `sync.mjs`. Without it, there is no record of which document sections map to which Jira subtasks. |
| **No credentials available** | No ATLASSIAN_API_TOKEN, ATLASSIAN_EMAIL, or ATLASSIAN_DOMAIN environment variables are configured. |
| **No `sync.mjs push --delete-orphans` command** | The skill provides this exact workflow: detect orphans, verify issue types, prompt for confirmation, execute deletions, update sync state. |
| **No `jira.mjs get` for type checking** | Cannot verify that each orphan is a Sub-* issue type before deletion, bypassing the critical safety guard. |
| **No markdown-to-ADF conversion** | Even the push step (updating the parent epic) requires converting markdown to ADF via the `marklassian` library. |
| **No MCP delete capability** | The available MCP Atlassian tools do not include a delete issue operation. |
| **No orphan identification without sync state** | Without the `childLinks` array tracking section-to-ticket mappings, there is no way to determine which Jira subtasks are orphaned. |

## Conclusion

Cleaning up orphaned subtasks after removing story sections from an epic document is a workflow that fundamentally depends on the Atlassian skill's sync state infrastructure. The `sync.mjs push --delete-orphans` command provides:

1. **Orphan detection** -- compares current document sections against stored `childLinks` to find removed sections
2. **Type-safe deletion** -- fetches each orphan's issue type via `jira.mjs get` and only allows deletion of Sub-* types (e.g., Sub-Imp, Sub-Test, Sub-Bug)
3. **Interactive confirmation** -- prompts the user for each deletion with a default-no (y/N) prompt
4. **API execution** -- sends authenticated DELETE requests to the Jira REST API
5. **State cleanup** -- removes deleted entries from `childLinks` in the sync state file
6. **Result reporting** -- summarizes which orphans were deleted, kept, or skipped

Without the skill, none of these steps can be performed. The sync state that tracks section-to-ticket mappings does not exist, API credentials are not configured, and there is no safe mechanism to identify or delete orphaned subtasks. This task requires either the Atlassian skill with its `sync.mjs` script and configured credentials, or manual identification and deletion of the specific Jira subtasks through the Jira UI.
