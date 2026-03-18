# Approach: Orphan Detection When Story Removed from Epic Doc (Without Atlassian Skill)

## Task

The user removed Story 1.3 from their local epic document and wants to know what happens to the corresponding Jira ticket when they sync.

## Understanding the Scenario

This is a question about **sync behavior** between a local epic document (likely a markdown file defining an epic's stories) and Jira tickets that were previously created from that document. The user has edited the local document to remove a story section ("Story 1.3") and wants to understand the consequences of running a sync operation.

## What I Can Determine Without a Skill

Without a dedicated Atlassian skill or sync engine, I have **no knowledge of any sync mechanism** between local epic documents and Jira. There is no standard, built-in sync feature in Jira's REST API or in generic Atlassian tooling that watches local files and reconciles them with remote tickets. Therefore, I cannot give a definitive answer about what "sync" means in this context.

### General Reasoning About Possible Sync Behaviors

Based on general software engineering patterns, a document-to-Jira sync engine could handle a removed section in several ways:

1. **Ignore the removal (no orphan detection):** The sync only processes what is present in the document. Tickets that no longer have a corresponding section are simply left untouched in Jira. No notification, no flagging.

2. **Detect and flag orphans:** The sync engine compares the local document's story list against existing Jira tickets under the epic. Stories that exist in Jira but are missing from the document are flagged as "orphaned" for user review. The user is notified but no destructive action is taken automatically.

3. **Automatically delete the orphaned ticket:** The sync engine detects the missing story and deletes the corresponding Jira ticket. This is the most aggressive and least safe behavior.

4. **Automatically transition or archive the ticket:** The sync engine moves the orphaned ticket to a "Cancelled" or "Won't Do" status, or removes it from the epic without deleting it.

### What a Well-Designed Sync Engine Should Do

A responsible sync tool would:

- **Detect** that Story 1.3 no longer exists in the local document while a corresponding Jira ticket still exists remotely.
- **Flag** the orphaned ticket for manual review rather than taking any destructive action.
- **NOT delete** the Jira ticket automatically, because:
  - The ticket may have comments, attachments, work logs, or linked issues that should be preserved.
  - Deletion in Jira is permanent and cannot be undone.
  - The removal from the document may have been accidental.
  - Other team members may be actively working on that ticket.
- **Direct the user** to handle the orphaned ticket manually via the Jira web UI (archive, close, delete, or re-scope as needed).

### Delete Restrictions in Atlassian Integrations

Even if the sync engine wanted to delete the ticket, most Atlassian integration skills and tools restrict destructive operations:

- Jira's REST API supports `DELETE /rest/api/3/issue/{issueIdOrKey}`, but this is a permanent, irreversible operation.
- Well-designed integration skills typically **do not expose delete functionality** to prevent accidental data loss.
- The Jira permission scheme may further restrict who can delete issues (typically only project admins).
- Audit and compliance requirements in many organizations prohibit programmatic deletion of issue records.

## What I Would Tell the User

Without access to a specific sync engine or skill documentation, I would explain:

1. **The sync behavior depends entirely on the sync tool being used.** There is no standard Jira sync mechanism for local documents.

2. **The Jira ticket for Story 1.3 likely still exists** in Jira regardless of what happened in the local document. Removing a section from a local file does not automatically affect remote Jira tickets.

3. **If the sync tool has orphan detection**, it would ideally flag the ticket as orphaned and present it for review rather than deleting it.

4. **I would recommend manually handling the ticket** in Jira -- either closing it with a resolution of "Won't Do," moving it to a backlog, or deleting it via the Jira web UI if it is truly no longer needed.

## What I Cannot Do

| Limitation | Detail |
|---|---|
| **No sync engine available** | I have no sync tool, script, or skill that reconciles local documents with Jira tickets. |
| **No knowledge of the sync protocol** | I do not know the format of the epic document, how stories are mapped to Jira tickets, or what metadata tracks the mapping. |
| **No Jira access** | Without credentials or MCP plugin tools, I cannot check whether the Jira ticket for Story 1.3 exists, what its current status is, or what data it contains. |
| **No delete capability** | Even with access, deleting a Jira ticket programmatically would be inappropriate without explicit user confirmation and proper authorization. |
| **No orphan detection logic** | I have no mechanism to compare a local document against remote Jira state to identify orphaned tickets. |

## How a Sync Tool Could Implement Orphan Detection

For reference, a proper orphan detection implementation would involve:

1. **Parse the local epic document** to extract the list of story identifiers (e.g., section headings, story IDs, or Jira ticket keys embedded in the document).
2. **Query Jira** for all child issues under the epic using JQL: `"Epic Link" = <EPIC_KEY> OR parent = <EPIC_KEY>`.
3. **Compare** the two lists to find tickets that exist in Jira but have no corresponding section in the local document.
4. **Report orphans** to the user with details: ticket key, summary, current status, assignee, and any work logged against it.
5. **Prompt for action** -- let the user decide per-ticket whether to close, archive, re-add to the document, or leave as-is.
6. **Never auto-delete** -- deletion should be a manual, deliberate action performed in the Jira web UI.

## Conclusion

Without a dedicated Atlassian skill or sync engine, I cannot definitively answer what happens to the Jira ticket when the user syncs. I can only reason about expected behaviors: a well-designed sync tool should detect that Story 1.3 is orphaned (present in Jira but absent from the document), flag it for user review, and explicitly refuse to delete it. The user would need to archive or delete the orphaned ticket manually through the Jira web UI. Delete operations are destructive and irreversible, so any responsible integration tool would restrict them and require manual intervention.
