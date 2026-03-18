# Approach: Parse Messy Meeting Notes and Create Jira Tickets (Without Atlassian Skill)

## Task

Parse unstructured meeting notes with mixed action item formats and unassigned items, then create corresponding Jira tickets in the DO project at https://wnesolutions.atlassian.net.

## Input: Raw Meeting Notes

```
Team sync 3/18
sarah - needs to finish the PRD for the new dashboard feature asap
John said he'd look into why tests are flaky on the auth module
@mike will handle the Stripe webhook integration
someone should really update the API docs before the release (nobody volunteered)
```

## Outcome

**I cannot complete this task.** Without Atlassian skill/plugin access or API credentials, I cannot look up Jira user account IDs, validate project metadata, or create issues. Below is my detailed approach for what I would do.

## Step 1: Parse and Extract Action Items

The notes contain four distinct action items in four different formats. Each requires pattern recognition:

| # | Pattern Type | Raw Text | Extracted Assignee | Extracted Action | Priority Signal |
|---|-------------|----------|-------------------|-----------------|-----------------|
| 1 | `name - verb phrase` | "sarah - needs to finish the PRD for the new dashboard feature asap" | Sarah | Finish PRD for new dashboard feature | High ("asap") |
| 2 | `Name said he'd verb` | "John said he'd look into why tests are flaky on the auth module" | John | Investigate flaky tests on auth module | Medium (no urgency signal) |
| 3 | `@name will verb` | "@mike will handle the Stripe webhook integration" | Mike | Handle Stripe webhook integration | Medium (no urgency signal) |
| 4 | Unassigned / passive | "someone should really update the API docs before the release (nobody volunteered)" | **Unassigned** | Update API docs before release | Medium ("before the release" implies a deadline) |

**Key parsing challenges handled:**
- Mixed capitalization ("sarah" vs "John" vs "@mike")
- Different attribution patterns (dash-separated, "said he'd", @-mention, passive voice)
- Urgency keywords ("asap", "before the release")
- Explicit note that nobody volunteered for item 4

## Step 2: Handle the Unassigned Item

Item 4 has no assignee and explicitly notes "nobody volunteered." In a real workflow, I would:

1. **Flag this to the user** before creating tickets: "The API docs update task has no assignee. Would you like to assign it to someone, leave it unassigned, or skip creating this ticket?"
2. Proceed based on user response -- either assign to a named person, create as unassigned, or omit.

For this approach document, I will assume the user wants it created as unassigned.

## Step 3: Structure as Jira Tickets

### Ticket 1: DO-??? -- Finish PRD for new dashboard feature
- **Type:** Task
- **Priority:** High (based on "asap")
- **Assignee:** Sarah
- **Summary:** Finish PRD for new dashboard feature
- **Description:** From team sync 3/18: Sarah needs to finish the PRD for the new dashboard feature. Marked as urgent (asap).

### Ticket 2: DO-??? -- Investigate flaky tests on auth module
- **Type:** Bug
- **Priority:** Medium
- **Assignee:** John
- **Summary:** Investigate flaky tests on auth module
- **Description:** From team sync 3/18: John will look into why tests are flaky on the auth module. Flaky tests may be causing CI instability.

### Ticket 3: DO-??? -- Implement Stripe webhook integration
- **Type:** Task
- **Priority:** Medium
- **Assignee:** Mike
- **Summary:** Handle Stripe webhook integration
- **Description:** From team sync 3/18: Mike will handle the Stripe webhook integration.

### Ticket 4: DO-??? -- Update API docs before release
- **Type:** Task
- **Priority:** Medium
- **Assignee:** Unassigned
- **Summary:** Update API documentation before release
- **Description:** From team sync 3/18: API documentation needs to be updated before the release. No volunteer was identified during the meeting -- needs someone to pick this up.

## Step 4: Present Extracted Tasks for User Confirmation

Before creating any tickets, I would present the full list above to the user and ask:

1. "I extracted 4 action items from your meeting notes. Here they are -- please confirm or adjust before I create the tickets."
2. "Item 4 (Update API docs) has no assignee since nobody volunteered. Would you like to assign it to someone?"
3. "Are the issue types, priorities, and summaries accurate?"

Only after confirmation would I proceed to ticket creation.

## Step 5: Create Tickets via Jira REST API

### 5a. Look up project metadata

```
GET https://wnesolutions.atlassian.net/rest/api/3/project/DO
```

This confirms valid issue types, priorities, and field requirements for the DO project.

### 5b. Resolve assignee account IDs

Jira Cloud requires `accountId` (not display names) for assignees. For each named assignee:

```bash
curl -s -u "user@example.com:JIRA_API_TOKEN" \
  "https://wnesolutions.atlassian.net/rest/api/3/user/search?query=sarah" \
  | jq '.[0].accountId'
```

Repeat for "john" and "mike". If multiple results are returned, present options to the user.

### 5c. Create each issue

For each confirmed ticket:

```bash
curl -s -X POST \
  -u "user@example.com:JIRA_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://wnesolutions.atlassian.net/rest/api/3/issue" \
  -d '{
    "fields": {
      "project": { "key": "DO" },
      "summary": "Finish PRD for new dashboard feature",
      "issuetype": { "name": "Task" },
      "priority": { "name": "High" },
      "assignee": { "accountId": "<resolved-sarah-id>" },
      "description": {
        "type": "doc",
        "version": 1,
        "content": [
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "From team sync 3/18: Sarah needs to finish the PRD for the new dashboard feature. Marked as urgent (asap)."
              }
            ]
          }
        ]
      }
    }
  }'
```

For the unassigned ticket (Ticket 4), the `assignee` field would be omitted entirely.

### 5d. Verify creation

Check each response for a valid `key` field (e.g., `DO-101`). Report back all created ticket keys to the user.

## Blockers and Limitations

| Item | Detail |
|------|--------|
| **No credentials available** | No Jira API token or user email with access to this instance. |
| **No skill/plugin allowed** | MCP Atlassian plugin tools are explicitly excluded for this baseline test. |
| **Assignee resolution requires API** | "sarah", "John", "mike" are display names; Jira requires account IDs from `/user/search`. |
| **Issue type validation needed** | Cannot confirm which issue types (Bug, Task, Story) exist in the DO project without an API call. |
| **No user confirmation loop** | Cannot interactively confirm extracted tasks with the user before creation. |
| **Ambiguous priority** | Priority inference from keywords like "asap" is heuristic; the user may disagree. |

## What the Atlassian Skill Would Provide

With the skill available, the workflow would be:

1. Load the **capture-tasks-from-meeting-notes** sub-skill for structured parsing logic.
2. Parse the notes and extract action items using the skill's pattern matching for varied formats.
3. Present extracted tasks for user confirmation, specifically flagging the unassigned API docs task.
4. Call `lookupJiraAccountId` to resolve "sarah", "john", "mike" to Jira account IDs.
5. Call `getJiraProjectIssueTypesMetadata` to validate available issue types for DO.
6. Call `createJiraIssue` for each confirmed ticket with fully validated payloads.
7. Return the created ticket keys (e.g., DO-201, DO-202, DO-203, DO-204).

## Conclusion

The core challenge here is NLP-style extraction of action items from unstructured text with inconsistent formatting. The four items use four different attribution patterns (dash, "said he'd", @-mention, passive/unassigned). Without API access, I can demonstrate the parsing logic and correct API calls, but cannot execute the creation. The key workflow gap is also the inability to interactively confirm the extracted tasks with the user before creating tickets, which is important given the ambiguity in messy notes.
