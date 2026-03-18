---
name: atlassian-rest
description: >
  Interact with Atlassian Jira and Confluence using REST APIs — no MCP server needed.
  Use this skill whenever the user mentions Jira, Confluence, Atlassian, tickets, issues,
  sprints, backlogs, epics, stories, or any project management task that involves
  creating/editing/searching/transitioning Jira issues, writing or reading Confluence pages,
  generating status reports, triaging bugs, converting specs to backlogs, capturing tasks
  from meeting notes, searching company knowledge, syncing local BMAD documents with Jira
  or Confluence, pushing docs to Jira, pulling from Jira, or linking documents to tickets.
  Also trigger when the user says things like "move that ticket to done",
  "what's the status of PROJ-123", "create a bug for X", "search our wiki for Y",
  "file a ticket", "check for duplicates", "write a status update",
  "break this spec into stories", "sync this doc", "push to jira", "pull from jira",
  "sync to confluence", "link this to jira", or "sync my epics". If there is even a chance
  the user wants to interact with Jira or Confluence, use this skill.
---

# Atlassian REST API Skill

Portable Jira & Confluence integration via REST APIs. Works in any agent environment with Node.js 18+ — zero dependencies, no MCP server required.

## First-Use Setup

Before any operation, verify the user has credentials configured. Run:

```bash
node <skill-path>/scripts/setup.mjs
```

If it fails, guide the user through the setup — the script prints step-by-step instructions.

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ATLASSIAN_API_TOKEN` | API token | *(generated at Atlassian)* |
| `ATLASSIAN_EMAIL` | Account email | `user@company.com` |
| `ATLASSIAN_DOMAIN` | Atlassian site domain | `company.atlassian.net` |

---

## How to Use This Skill

When the user asks you to do something with Jira or Confluence, follow these principles:

1. **Resolve ambiguity first.** If the user says "create a ticket" but hasn't specified a project, run `node <skill-path>/scripts/jira.mjs projects` to list available projects, then ask which one. Same for issue types — run `node <skill-path>/scripts/jira.mjs issue-types <projectKey>` if unsure.

2. **Confirm before mutating.** Before creating issues, transitioning tickets, or publishing Confluence pages, show the user what you're about to do and get confirmation. Read operations (search, get, list) don't need confirmation.

3. **Never delete.** This skill does not support delete operations (issues, pages, attachments, boards, projects, accounts, etc.). If the user asks to delete something, direct them to the Atlassian web UI. This restriction is intentional and must not be bypassed.

4. **Compose operations naturally.** Many user requests require multiple script calls. For example, "assign PROJ-123 to Sarah" requires: (a) `lookup-user "Sarah"` to get the account ID, then (b) `edit PROJ-123 --assignee <accountId>`.

5. **Prefer sync.mjs for document-based operations.** When creating Jira issues from a local markdown file (story docs, specs, epics), use the sync workflow instead of raw `jira.mjs create`:
   - First check if a field mapping exists: `ls <skill-path>/memory/jira-<docType>-field-mapping.json`
   - If no mapping exists, create one: `node <skill-path>/scripts/sync.mjs setup-mapping --type <docType> --sample <EXISTING-TICKET-KEY>` (uses an existing ticket to auto-detect custom fields)
   - Then link & create: `node <skill-path>/scripts/sync.mjs link <file> --type <docType> --project <KEY> --create`
   - This automatically: (a) maps doc sections to Jira fields per the mapping config, (b) updates the source document with the Jira link, (c) stores sync state for future push/pull
   - Only use `jira.mjs create` for ad-hoc issues not backed by a local document.

6. **Use workflows for complex tasks.** If the user's request matches one of the workflows below, read the corresponding file and follow its step-by-step process.

7. **Read reference docs when needed.** Before writing JQL/CQL queries, consult `references/query-languages.md`. Before creating tickets, consult `references/ticket-writing-guide.md`. The reference docs exist to help you produce high-quality output — use them.

---

## Jira Operations

Script: `node <skill-path>/scripts/jira.mjs <command> [args]`

### Search Issues
```bash
jira.mjs search 'project = PROJ AND status = "In Progress"' --max 20
```

### Get Issue Details
```bash
jira.mjs get PROJ-123
jira.mjs get PROJ-123 --fields summary,status,assignee
```

### Create Issue
```bash
jira.mjs create --project PROJ --type Task --summary "Implement feature X" \
  --description "Details here" --priority High --assignee <accountId> \
  --labels "backend,urgent" --components "API,Auth"
jira.mjs create --project PROJ --type Story --summary "User login" --parent PROJ-100
```
When creating child stories under an Epic, include `--priority Medium` unless the user specifies a different priority.

### Edit Issue
```bash
jira.mjs edit PROJ-123 --summary "Updated title" --priority Medium
jira.mjs edit PROJ-123 --labels "backend,v2" --components "API"
```

### Comments
```bash
jira.mjs comment PROJ-123 "Fixed in PR #456"
```

### Transitions (move ticket status)
```bash
jira.mjs transitions PROJ-123          # List available transitions first
jira.mjs transition PROJ-123 31        # Then transition by ID
```
Always list transitions first to get the correct ID — don't guess.

### Projects & Issue Types
```bash
jira.mjs projects                      # List all visible projects
jira.mjs issue-types PROJ              # List issue types for a project
```

### Issue Links
```bash
jira.mjs link-types                    # List available link types first
jira.mjs link PROJ-1 PROJ-2 --type "relates to"
```

### User Lookup
```bash
jira.mjs lookup-user "john"            # Returns account ID needed for --assignee
```

### Worklog
```bash
jira.mjs worklog PROJ-123 --time 2h --comment "Code review"
```

---

## Document Sync Operations

Script: `node <skill-path>/scripts/sync.mjs <command> [args]`

When creating Jira/Confluence items from local markdown documents, prefer sync.mjs over raw jira.mjs/confluence.mjs — it auto-updates the source document with links and maintains sync state.

### Setup Field Mapping (first time per doc type)
```bash
sync.mjs setup-mapping --type story --sample PROJ-200   # Auto-detect fields from existing ticket
sync.mjs setup-mapping --type epic --sample PROJ-100    # Creates memory/jira-epic-field-mapping.json
```
Field mappings are stored in `<skill-path>/memory/` and define how markdown sections map to Jira fields. See `references/sync-mapping-guide.md` for the full schema.

### Link & Create from Document
```bash
sync.mjs link <file> --type story --project PROJ --create    # Create Jira issue + update doc
sync.mjs link <file> --type epic --project PROJ --create     # Create epic + child stories
sync.mjs link <file> --type story --ticket PROJ-123          # Link to existing ticket
```

### Push/Pull Changes
```bash
sync.mjs push <file>                    # Push local changes to Jira/Confluence
sync.mjs push <file> --delete-orphans   # Push + prompt to delete orphaned Sub-* subtasks
sync.mjs pull <file>                    # Pull remote changes to local
sync.mjs diff <file>                    # Show per-section diff
sync.mjs status <file>                  # Show sync status
```
When `push` reports orphaned subtasks (sections removed from local doc), ask the user if they want to delete them, then run with `--delete-orphans`. Only `Sub-*` issue types can be deleted — parent issues are skipped.

### Custom Instructions in Mapping Config
The field mapping JSON (`memory/jira-<docType>-field-mapping.json`) supports an `instructions` field for additional agent guidance:
```json
{
  "instructions": "Always set priority to High. Add label 'team-alpha'. Use Sub-Imp type for child items."
}
```
When present, instructions are printed to stdout during `push` and `link` operations so the calling agent can follow them.

### Batch Operations
```bash
sync.mjs batch                # Scan all linked docs and report status
```

---

## Confluence Operations

Script: `node <skill-path>/scripts/confluence.mjs <command> [args]`

### Search Pages
```bash
confluence.mjs search 'type = page AND text ~ "architecture"' --max 10
```

### Get Page
```bash
confluence.mjs get-page 12345
confluence.mjs get-page 12345 --format view
```

### Create Page
```bash
confluence.mjs create-page --space TEAM --title "Sprint Report" --body "Report content"
confluence.mjs create-page --space TEAM --title "Sub Page" \
  --body "<h2>Heading</h2><p>Content</p>" --parent 12345
confluence.mjs create-page --space TEAM --title "Full Doc" --body-file /tmp/body.html
```
The `--body` flag accepts **markdown** (recommended), plain text, or raw HTML storage format (if it starts with `<`). The script automatically converts markdown to Confluence storage format — headings, lists, tables, and code blocks (converted to `ac:structured-macro ac:name="code"` with language detection) are all handled. Prefer writing markdown and letting the script handle conversion rather than manually constructing storage format XHTML. Use `--body-file` for long documents that would exceed shell argument limits.

### Update Page
```bash
confluence.mjs update-page 12345 --title "Updated Title" --body "New content"
confluence.mjs update-page 12345 --title "Updated Title" --body-file /tmp/body.html
```
Version is auto-incremented — no need to track it manually. Use `--body-file` for large page updates.

### Comments
```bash
confluence.mjs comment 12345 "Reviewed and approved"
```

### Attachments
```bash
confluence.mjs attach 12345 ./screenshot.png --comment "Architecture diagram"
confluence.mjs list-attachments 12345 --max 10
```
Use `attach` to upload local files (images, PDFs, etc.) to a page. After uploading, embed images in the page body using `<ac:image><ri:attachment ri:filename="screenshot.png" /></ac:image>` — see `references/confluence-formatting.md` for sizing guidelines.

### Spaces & Navigation
```bash
confluence.mjs spaces --max 20
confluence.mjs descendants 12345       # Get child pages
```

---

## Workflows

For complex multi-step operations, read the corresponding workflow file and follow its process:

| Workflow | When to use | File |
|----------|-------------|------|
| **Capture Tasks from Meeting Notes** | User provides meeting notes and wants Jira tasks created from action items | `workflows/capture-tasks-from-meeting-notes.md` |
| **Generate Status Report** | User wants a project status report, sprint summary, or weekly update | `workflows/generate-status-report.md` |
| **Search Company Knowledge** | User wants to find information across Confluence pages and Jira issues | `workflows/search-company-knowledge.md` |
| **Spec to Backlog** | User has a Confluence spec and wants it broken into an Epic + child tickets | `workflows/spec-to-backlog.md` |
| **Triage Issue** | User reports a bug and wants duplicate checking before filing | `workflows/triage-issue.md` |
| **Create Confluence Document** | User wants a professional Confluence page with macros, images, and structured formatting | `workflows/create-confluence-document.md` |
| **Sync BMAD Documents** | User wants to sync local BMAD docs (epics, tech specs, PRDs, architecture) with Jira or Confluence, or link a document to a ticket/page | `workflows/sync-bmad-documents.md` |

---

## Error Handling

| Error | Likely Cause | Resolution |
|-------|-------------|------------|
| `401 Unauthorized` | Bad or expired API token | Regenerate at Atlassian security settings |
| `403 Forbidden` | Insufficient permissions | Check project/space permissions for the user's account |
| `404 Not Found` | Wrong issue key, page ID, or domain | Verify the resource exists and `ATLASSIAN_DOMAIN` is correct |
| `429 Too Many Requests` | Rate limited | Wait briefly and retry; reduce batch sizes |
| Missing env vars | Not configured | Run `node <skill-path>/scripts/setup.mjs` |

---

## Reference Documentation

Load these as needed — don't read them all upfront:

| Reference | When to consult |
|-----------|-----------------|
| `references/jira-api.md` | Need details on Jira API endpoints or request shapes |
| `references/confluence-api.md` | Need details on Confluence API endpoints or storage format |
| `references/confluence-formatting.md` | Building professional pages with macros, layouts, images, and document templates |
| `references/query-languages.md` | Writing JQL or CQL queries |
| `references/jql-patterns.md` | Need common JQL patterns for reports, searches, filters |
| `references/action-item-patterns.md` | Parsing meeting notes for action items |
| `references/report-templates.md` | Generating status reports |
| `references/bug-report-templates.md` | Creating well-structured bug reports |
| `references/search-patterns.md` | Multi-source search strategies |
| `references/epic-templates.md` | Writing epic descriptions |
| `references/ticket-writing-guide.md` | Writing clear ticket summaries and descriptions |
| `references/breakdown-examples.md` | Breaking specs into stories and tasks |
| `references/sync-mapping-guide.md` | Configuring field mappings and sync state for BMAD document sync |
