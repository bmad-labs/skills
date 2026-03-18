# Approach: Sync Unlinked Epic Document to Jira

## Overview

Sync the local epic document at `docs/epics/auth-epic.md` to the DO project at `wnesolutions.atlassian.net`. The document is not yet linked to any Jira ticket, so this is a first-time link + create operation.

The SKILL.md explicitly states: "Prefer sync.mjs for document-based operations" and directs to the `workflows/sync-bmad-documents.md` workflow for syncing local BMAD documents with Jira.

---

## Step 0: Read the Sync Workflow

Before executing any commands, load the workflow file for step-by-step guidance:

**File:** `<skill-path>/workflows/sync-bmad-documents.md`

This workflow defines a 9-step process for syncing BMAD documents. Also load the reference:

**File:** `<skill-path>/references/sync-mapping-guide.md`

---

## Step 1: Verify Setup

Run the setup check to confirm credentials are configured and the Atlassian domain is accessible.

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/setup.mjs
```

---

## Step 2: Identify Document Type (Workflow Step 1)

Read the document at `docs/epics/auth-epic.md` and determine its type using the detection rules from the workflow:

- **Epic:** Has `## Epic` headings or `### Story N.M:` patterns, or frontmatter with `inputDocuments` array

Given the file is located in `docs/epics/` and named `auth-epic.md`, this is almost certainly an **epic** document type. Confirm by inspecting the document for epic detection signals (story section headings, epic headings, or frontmatter structure).

**Target system:** Epic -> Jira

---

## Step 3: Check for Existing Link (Workflow Step 2)

Run the status check to see if this document is already linked to a Jira ticket:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs status docs/epics/auth-epic.md
```

**Expected result:** The document is unlinked (`linked: false`), since the task states "It's not linked to any ticket yet." Continue to link setup.

---

## Step 4: Confirm Sync Parameters with the User (Workflow Step 3)

The workflow requires asking the user three questions before proceeding:

1. **Direction:** Push (local -> remote) or Pull (remote -> local)?
   - Answer: **Push** -- we are creating from a local document.

2. **Target:** Which Jira project key?
   - Answer: **DO** -- specified in the task.

3. **Action:** Create new ticket/page, or link to existing one?
   - Answer: **Create new** -- "It's not linked to any ticket yet" implies creation.

Even though the task provides enough context to infer the answers, the workflow says to confirm with the user before mutating. Present these choices and get confirmation.

---

## Step 5: Check for Field Mapping (Workflow Step 4)

Check if an epic field mapping already exists:

```bash
ls /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/memory/jira-epic-field-mapping.json
```

**If the mapping file does NOT exist** (likely, since the `memory/` directory is empty), we need to create one.

### Step 5a: Find a Sample Epic Ticket

To auto-detect custom fields, we need an existing Epic ticket in the DO project. Search for one:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND issuetype = Epic ORDER BY created DESC' --max 1
```

If no existing Epic is found, ask the user to provide a sample ticket key, or check the available issue types:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs issue-types DO
```

### Step 5b: Run Setup Mapping

Using the sample Epic ticket key (e.g., `DO-50`):

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs setup-mapping --type epic --sample DO-50
```

This will:
1. Fetch the field list from Jira for the DO project
2. Auto-identify field meanings by name and type
3. Output a proposed mapping as JSON

### Step 5c: Review and Confirm Mapping

Present the proposed mapping table to the user. The mapping should define how epic document sections map to Jira fields, following the schema in `references/sync-mapping-guide.md`:

- `title` -> `summary` (direct)
- `Overview` section -> `description` (markdownToAdf)
- Story sections -> child Story tickets via `childMapping`

Allow the user to:
- Correct auto-detected mappings
- Add custom field mappings (e.g., acceptance criteria, labels)
- Adjust transform types

Save the confirmed mapping to:
`/Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/memory/jira-epic-field-mapping.json`

---

## Step 6: Link and Create the Epic (Workflow Step 3 execution)

With the field mapping in place, execute the link + create command:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs link docs/epics/auth-epic.md --type epic --project DO --create
```

This command will:
1. Parse the epic document using the field mapping
2. Create the parent Epic ticket in the DO project
3. Create child Story tickets for each `### Story N.M:` section in the document
4. Link all child stories to the parent Epic via the `parent` field
5. Update the local document's YAML frontmatter with `jira_ticket_id: 'DO-XXX'`
6. Create sync state in `memory/sync-state/<hash>.json`

If the mapping has `instructions`, they will be printed to stdout for the agent to follow.

---

## Step 7: Verify the Sync Result

After the link + create command completes, verify the results:

### Check the document was updated with the Jira link:

Read `docs/epics/auth-epic.md` and confirm `jira_ticket_id` was added to the frontmatter:

```yaml
---
title: 'User Authentication'
jira_ticket_id: 'DO-XXX'
status: '...'
---
```

### Check the created Epic on Jira:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-XXX
```

### Verify child stories were created:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND parent = DO-XXX ORDER BY created ASC'
```

### Check sync status:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs status docs/epics/auth-epic.md
```

**Expected:** `linked: true`, showing the Jira ticket key, last sync timestamp, and child link mappings.

---

## Step 8: Report Results (Workflow Step 9)

Present a summary table to the user:

| Action | Section/Field | Result |
|--------|--------------|--------|
| created | Epic (parent) | DO-XXX created with summary and description |
| created | Story 1.1: ... | DO-XXX+1 created as child of DO-XXX |
| created | Story 1.2: ... | DO-XXX+2 created as child of DO-XXX |
| linked | frontmatter | jira_ticket_id added to docs/epics/auth-epic.md |
| saved | sync state | memory/sync-state/<hash>.json created |

Include direct links to all created tickets on `https://wnesolutions.atlassian.net/browse/DO-XXX`.

---

## Summary of Commands (in order)

| Step | Command | Purpose |
|------|---------|---------|
| 0 | Read `workflows/sync-bmad-documents.md` | Load the sync workflow |
| 0 | Read `references/sync-mapping-guide.md` | Load field mapping reference |
| 1 | `setup.mjs` | Verify credentials |
| 2 | Read `docs/epics/auth-epic.md` | Identify document type as epic |
| 3 | `sync.mjs status docs/epics/auth-epic.md` | Check for existing link (expect unlinked) |
| 4 | Confirm with user: direction=push, project=DO, action=create new | Required by workflow before mutating |
| 5 | `ls memory/jira-epic-field-mapping.json` | Check for existing field mapping |
| 5a | `jira.mjs search 'project = DO AND issuetype = Epic' --max 1` | Find sample Epic for mapping setup |
| 5b | `sync.mjs setup-mapping --type epic --sample DO-50` | Auto-detect and create field mapping |
| 5c | Review mapping with user and save | Confirm field mapping before use |
| 6 | `sync.mjs link docs/epics/auth-epic.md --type epic --project DO --create` | Create Epic + child stories + update doc |
| 7 | `jira.mjs get DO-XXX` | Verify created Epic |
| 7 | `jira.mjs search 'project = DO AND parent = DO-XXX'` | Verify child stories |
| 7 | `sync.mjs status docs/epics/auth-epic.md` | Verify sync state shows linked |

## Key Skill Principles Applied

- **Use workflows for complex tasks** (SKILL.md rule 6): Loaded and followed `workflows/sync-bmad-documents.md` for the full sync process.
- **Prefer sync.mjs for document-based operations** (SKILL.md rule 5): Used `sync.mjs link` with `--create` instead of manually calling `jira.mjs create` for each ticket.
- **Read reference docs when needed** (SKILL.md rule 7): Consulted `references/sync-mapping-guide.md` for field mapping schema and configuration.
- **Resolve ambiguity first** (SKILL.md rule 1): Verified document type, checked link status, and confirmed project/issue types before creating anything.
- **Confirm before mutating** (SKILL.md rule 2): Asked the user to confirm sync direction, target project, and action (create new) before executing the link command.
- **Field mapping setup** (SKILL.md rule 5): Checked for existing mapping, and when not found, ran `setup-mapping` with a sample ticket to auto-detect custom fields.
