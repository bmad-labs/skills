# Approach: Resolve Conflict Between Local Epic Doc and Jira Description (Without Skill)

## Task Summary

The user has an epic document stored locally (e.g., `docs/epics/auth-epic.md`) that is linked to a Jira Epic ticket. Both the local Overview section and the remote Jira description have been modified independently since the last sync, creating a conflict. The user wants help identifying and resolving this conflict.

## What Is Needed

Without a dedicated Atlassian skill, there is no `sync.mjs` helper script, no sync-state tracking, no per-section diff engine, and no interactive conflict-resolution workflow. The agent must manually fetch the remote content, compare it against the local document, present differences to the user, and execute whichever resolution the user chooses -- all through individual MCP tool calls and file reads.

## Detailed Step-by-Step Approach

### Step 1: Read the Local Epic Document

Read the local epic document to extract its current Overview section content and any sync-related frontmatter (e.g., `jira_ticket_id`).

Without a skill, there is no `sync.mjs status` command to check sync state or determine the linked Jira ticket key. The agent must manually parse the YAML frontmatter to find a `jira_ticket_id` field. If no such field exists, the agent cannot determine which Jira ticket to compare against and must ask the user for the ticket key.

### Step 2: Fetch the Remote Jira Epic

- **Tool:** `mcp__plugin_atlassian_atlassian__getJiraIssue`
- **Parameters:** `issueIdOrKey: "<ticket-key from frontmatter>"`
- **Purpose:** Retrieve the current Jira Epic description (the remote version of the Overview section).

The response contains the description in Atlassian Document Format (ADF). Without a skill, the agent has no `sync.mjs` script that automatically converts ADF back to markdown for comparison. The agent must either:
1. Interpret the raw ADF JSON structure visually, or
2. Attempt a rough manual conversion of ADF to plain text for comparison.

Neither approach produces a clean, reliable markdown representation. A dedicated skill's `sync.mjs diff` command handles ADF-to-markdown conversion automatically using a shared library.

### Step 3: Manually Compare the Two Versions

Without a per-section diff engine, the agent must manually compare:
- **Local version:** The Overview section extracted from the markdown file.
- **Remote version:** The Jira description content extracted from the ADF response.

The agent has no stored "last synced" baseline, so it cannot distinguish which specific lines changed on each side. It can only show the two current versions and let the user compare them visually.

A dedicated skill would:
- Store per-section hashes in `memory/sync-state/<hash>.json` from the last sync.
- Run `sync.mjs diff <file>` to compute a three-way comparison (local, remote, baseline).
- Display a conflict indicator (`!!!` or equivalent) for the Overview section specifically.
- Show the exact lines that differ on each side relative to the baseline.

### Step 4: Present Both Versions to the User

Display the local and remote versions side by side and ask the user how to resolve:

**Presentation format (best effort without skill):**

```
=== LOCAL VERSION (Overview section from docs/epics/auth-epic.md) ===
[paste local Overview content here]

=== REMOTE VERSION (Jira description from PROJ-100) ===
[paste interpreted ADF content here -- may lose formatting]

Both versions have been modified since the last sync.
How would you like to resolve this conflict?
1. Keep local -- push local Overview to Jira (overwrites remote)
2. Keep remote -- pull Jira description into local doc (overwrites local)
3. Skip -- leave both as-is and resolve manually later
```

Without a skill, the agent has no structured conflict indicator (like the `!!!` symbol), no formatted diff view, and no guarantee that the ADF-to-text conversion accurately represents the remote content. The user must judge the comparison based on imperfect representations.

### Step 5: Execute the User's Choice

**If "Keep local" (push):**

- **Tool:** `mcp__plugin_atlassian_atlassian__editJiraIssue`
- **Parameters:**
  - `issueIdOrKey: "<ticket-key>"`
  - `description: "<local Overview content>"`
  - `contentFormat: "markdown"`
- **Purpose:** Overwrite the Jira description with the local Overview section.

Without a skill, there is no `sync.mjs push` command that handles field mapping, ADF conversion, and sync-state updates in one step. The agent must manually construct the edit call and hope that the `contentFormat: "markdown"` flag properly converts the content to ADF.

**If "Keep remote" (pull):**

- Read the ADF description from the Jira response.
- Convert the ADF content back to markdown (manual, lossy process).
- Edit the local file to replace the Overview section with the converted remote content.

Without a skill, there is no `sync.mjs pull` command that handles ADF-to-markdown conversion and precise section replacement. The agent must manually:
1. Parse the ADF JSON to reconstruct markdown.
2. Identify the exact start and end boundaries of the Overview section in the local file.
3. Replace only that section without disturbing other content.

This is error-prone -- ADF contains rich formatting (tables, panels, inline cards) that may not round-trip cleanly to markdown, and section boundary detection requires parsing markdown headings correctly.

**If "Skip":**

- No action taken. Inform the user the conflict remains unresolved.

### Step 6: Update Sync State (Not Possible Without Skill)

A dedicated skill would update `memory/sync-state/<hash>.json` with new hashes for the resolved section, preventing the same conflict from being flagged again on the next diff. Without a skill, there is no sync-state file to update, so:
- The agent has no way to record that the conflict was resolved.
- The next time the user asks about sync status, the same conflict will appear again (or worse, the agent has no mechanism to detect conflicts at all without re-fetching and re-comparing everything from scratch).

## Challenges Without the Skill

| Challenge | Impact |
|---|---|
| No `sync.mjs diff` command | Cannot automatically detect which sections have conflicts; must manually fetch and compare everything |
| No stored sync-state baseline | Cannot perform three-way diff; can only show current local vs. current remote, not what changed on each side |
| No ADF-to-markdown conversion | Remote Jira content is in ADF format; converting it back to readable markdown is lossy and manual |
| No per-section change indicators | Cannot show `!!!` conflict markers or `->` / `<-` direction indicators; user sees raw content dumps |
| No `sync.mjs push` or `pull` commands | Must manually construct MCP tool calls for each mutation, handle format conversion, and edit local files by hand |
| No sync-state update after resolution | Resolution is not recorded; future diff checks will re-detect the same "conflict" |
| No field mapping reference | Agent must guess which Jira field corresponds to the Overview section (likely `description`, but could differ for custom setups) |
| No section boundary detection | Replacing only the Overview section in the local file requires manual markdown parsing; risk of corrupting adjacent sections |

## Estimated Tool Calls

| Operation | Calls |
|---|---|
| Read local epic document | 1 |
| Fetch Jira issue (remote content) | 1 |
| Present comparison to user | 0 (text output) |
| Wait for user choice | 0 (interactive) |
| Edit Jira issue (if push) OR edit local file (if pull) | 1 |
| Verify result (re-fetch or re-read) | 1 |
| **Total** | **4** |

## Conclusion

Without a dedicated skill, the agent can attempt conflict resolution but the process is fundamentally limited. The absence of `sync.mjs diff` means there is no automatic conflict detection -- the agent must manually fetch the Jira issue and eyeball-compare it against the local file. The lack of a stored sync-state baseline means no three-way merge is possible; the agent can only present "here is local, here is remote" without showing what specifically changed on each side. ADF-to-markdown conversion is lossy, making the remote version difficult to compare accurately. After resolution, there is no sync-state update, so the conflict is not recorded as resolved. The dedicated skill's `sync.mjs diff` command with `!!!` conflict indicators, side-by-side section display, interactive keep-local/keep-remote/skip prompts, and automatic sync-state updates would handle this entire workflow in a structured, reliable, and repeatable manner.
