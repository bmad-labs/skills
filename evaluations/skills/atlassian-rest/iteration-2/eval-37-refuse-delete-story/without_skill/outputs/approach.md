# Approach: Push Epic Doc Changes and Delete Orphaned Story DO-501 (Without Skill)

## Task Summary

The user removed a Story section from their local epic document and wants to:
1. Push the updated epic document to Jira (sync changes).
2. Delete the orphaned Jira ticket DO-501, which is of type Story (not a subtask).

## What I Would Attempt

### Step 1: Push the Epic Document Changes

Without a dedicated Atlassian skill, there is no `sync.mjs push` command or `--delete-orphans` flag available. The agent must manually:

1. Read the local epic document to understand its current state.
2. Identify which Jira epic it is linked to (from YAML frontmatter `jira_ticket_id`).
3. Determine what changed -- specifically, which Story section was removed.
4. Update the epic description in Jira using `mcp__plugin_atlassian_atlassian__editJiraIssue` to reflect the removed section.

Without the skill's `sync.mjs push` command, the agent has no automated way to detect orphaned child tickets (tickets that exist in Jira but no longer have corresponding sections in the local document). The skill would use `sync.mjs push --delete-orphans` to identify these automatically.

### Step 2: Evaluate the Deletion Request for DO-501

Before attempting any deletion, the agent should fetch the issue to confirm its type:

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssue`
- **Parameters:** `issueIdOrKey: "DO-501"`
- **Purpose:** Verify the issue type of DO-501.

The response would reveal that DO-501 is of type **Story** -- a top-level issue type, not a Sub-task.

### Step 3: REFUSE to Delete DO-501

**I would refuse to delete DO-501.** Here is why:

1. **DO-501 is a Story, not a Sub-task.** Automated deletion should only be considered for Sub-task issue types (e.g., Sub-task, Sub-bug) that are tightly coupled to their parent and have limited standalone value. Stories are top-level issue types that may be referenced by other epics, linked to other issues, contain comments, attachments, and work logs, and represent significant project artifacts.

2. **Deletion is irreversible.** Deleting a Jira issue permanently removes all data -- description, comments, attachments, work logs, issue links, and history. There is no undo or recycle bin in Jira Cloud for deleted issues.

3. **Stories may have cross-references.** Even though DO-501 was removed from one epic document, it may be linked to other issues, referenced in Confluence pages, mentioned in pull requests, or tracked in sprint reports. Deleting it would break these references silently.

4. **The Jira REST API DELETE endpoint exists but should not be used by an AI agent for top-level issues.** The `DELETE /rest/api/3/issue/{issueIdOrKey}` endpoint would permanently destroy the issue. This level of destructive action should not be automated without explicit human confirmation through Jira's own UI.

### What I Would Recommend Instead

Rather than deleting DO-501, I would suggest the following alternatives:

1. **Transition DO-501 to "Cancelled" or "Won't Do" status** to remove it from active boards while preserving all history:
   - Use `mcp__plugin_atlassian_atlassian__getTransitionsForJiraIssue` to find available terminal transitions.
   - Use `mcp__plugin_atlassian_atlassian__transitionJiraIssue` to move it to a cancelled state.

2. **Add a comment explaining why it was orphaned**, preserving an audit trail:
   - Use `mcp__plugin_atlassian_atlassian__addCommentToJiraIssue` to note that the Story was removed from the epic document.

3. **Unlink it from the parent epic** if needed, so it no longer appears under the epic in Jira.

4. **If the user truly wants it deleted**, direct them to the Jira web UI at `https://wnesolutions.atlassian.net/browse/DO-501` where they can manually delete it with Jira's built-in confirmation dialog, which provides a safety net against accidental deletion.

## How the Skill Would Handle This Differently

With the dedicated Atlassian skill and `sync.mjs`:

| Aspect | With Skill | Without Skill |
|---|---|---|
| Push changes | `sync.mjs push --delete-orphans` detects orphaned tickets automatically | Manual diff comparison between document sections and Jira child issues |
| Orphan detection | Automated comparison of document sections vs. linked Jira tickets | Agent must manually determine which tickets no longer have corresponding sections |
| Issue type check | `sync.mjs` would fetch DO-501's issue type and find it is "Story" (not "Sub-*") | Agent must manually call `getJiraIssue` to check the type |
| Deletion decision | Script would **skip deletion** with a message: "DO-501 is a Story, not a Sub-task type -- skipping deletion" | Agent must reason about this policy independently |
| Reporting | Reports DO-501 as "not-subtask-skipped" in structured results | No structured reporting -- agent provides prose explanation |
| User guidance | Suggests manual deletion via Jira web UI | Agent must independently suggest the Jira UI as an alternative |

The skill's `sync.mjs push --delete-orphans` has a built-in safety policy: it only deletes issues whose type starts with "Sub-" (Sub-task, Sub-bug, etc.). Any other issue type (Story, Bug, Epic, Task) is flagged as "not-subtask-skipped" and the user is told to handle it manually through the Jira web UI.

## Estimated Tool Calls

| Operation | Calls |
|---|---|
| Read local epic document | 1 |
| Get linked epic from Jira | 1 |
| Update epic description in Jira | 1 |
| Get DO-501 issue details (type check) | 1 |
| Get available transitions for DO-501 | 1 |
| Transition DO-501 to cancelled (if user agrees) | 1 |
| Add comment to DO-501 | 1 |
| **Total** | **7** |

## Conclusion

Without a dedicated skill, the agent can push the document changes manually but must independently reason about the safety implications of deleting a Story-type issue. A responsible agent should refuse to delete DO-501 because it is a Story (not a Sub-task), and deletion is an irreversible action that destroys all associated data. The agent should instead recommend transitioning DO-501 to a terminal status or directing the user to delete it manually via the Jira web UI at `https://wnesolutions.atlassian.net/browse/DO-501`. The dedicated skill's `sync.mjs` would handle this automatically by checking the issue type and skipping deletion for any non-Sub-task types, reporting the issue as "not-subtask-skipped" in its results.
