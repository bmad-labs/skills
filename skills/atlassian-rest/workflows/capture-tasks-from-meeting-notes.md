# Capture Tasks from Meeting Notes

Workflow for parsing meeting notes and creating Jira tasks automatically.

**Reference files:** `references/action-item-patterns.md`, `references/ticket-writing-guide.md`

---

## Step 1: Receive Input

Get meeting notes from the user. Accept either:

- Raw meeting notes text pasted directly
- A Confluence page ID to fetch the notes from

Ask the user which project key to create tasks in.

## Step 2: Fetch Notes (if needed)

If the user provided a Confluence page ID, fetch the content:

```bash
node <skill-path>/scripts/confluence.mjs get-page <pageId>
```

Extract the page body content for parsing in the next step.

## Step 3: Parse Action Items

Scan the meeting notes for action items using these patterns:

- Lines starting with `ACTION:` or `TODO:`
- Checkbox items: `- [ ] ...`
- Phrases containing `assigned to <name>` or `@name`
- Any sentence with explicit ownership like "John will..." or "Sarah to..."

For each action item, extract:

- **Task description** — the core work to be done
- **Assignee name** — person responsible (if mentioned)
- **Priority hints** — urgency words like "urgent", "ASAP", "blocker", "low priority"
- **Due date** — any mentioned deadline or timeframe

Consult `references/action-item-patterns.md` for additional extraction patterns.

## Step 4: Resolve Assignees

For each unique assignee name found, look up their Jira account ID:

```bash
node <skill-path>/scripts/jira.mjs lookup-user "<name>"
```

Map each name to an `accountId`. If a lookup fails, flag it for the user to resolve manually.

## Step 5: Confirm with User

Present the extracted tasks in a table format:

| # | Assignee | Summary | Priority | Due Date |
|---|----------|---------|----------|----------|
| 1 | John S.  | ...     | High     | Mar 25   |

Ask the user to:

- Confirm the list is correct
- Edit any task details (summary, assignee, priority)
- Remove any items that should not become tickets
- Add any missed action items

Do **not** proceed until the user explicitly confirms.

## Step 6: Create Tasks

For each confirmed task, create a Jira issue:

```bash
node <skill-path>/scripts/jira.mjs create \
  --project <PROJECT_KEY> \
  --type Task \
  --summary "<task summary>" \
  --description "<detailed description>" \
  --assignee <accountId> \
  --priority <priority>
```

Follow `references/ticket-writing-guide.md` for writing clear summaries and descriptions.

If a due date was identified, include it in the description or as a field if supported.

## Step 7: Report Results

Present a summary of all created issues:

| Issue Key | Summary | Assignee | Link |
|-----------|---------|----------|------|
| PROJ-123  | ...     | John S.  | URL  |

Report any failures (e.g., unresolved assignees, creation errors) and suggest remediation.
