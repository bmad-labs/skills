# Approach: Create Jira Story from Local Story Document via Sync Workflow

## Task

Create a Jira Story in project DO from the local document `_bmad-output/user-story-2.md`, and update the document with the Jira link.

## Skill References Used

- `SKILL.md` — Section 5 ("Prefer sync.mjs for document-based operations") and Section 6 ("Use workflows for complex tasks")
- `workflows/sync-bmad-documents.md` — Full sync workflow (Steps 1-9)
- `references/sync-mapping-guide.md` — Field mapping schema and linking strategy

## Step-by-Step Approach

### Step 1: Identify Document Type (Workflow Step 1)

Read the document to detect its type:

```bash
cat _bmad-output/user-story-2.md
```

Expected: The document is a **Story** type. Detection rule from workflow: "Has 'As a ..., I want ..., So that ...' pattern without frontmatter" OR has tech-spec frontmatter fields (`tech_stack`, `files_to_modify`, etc.) making it a Tech Spec → Story.

Target system: **Jira** (stories go to Jira per workflow rules).

### Step 2: Check for Existing Link (Workflow Step 2)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs status _bmad-output/user-story-2.md
```

Expected result: `linked: false` (new document, never synced before). Proceed to Step 3.

### Step 3: Check Field Mapping Exists (Workflow Step 4, done early per SKILL.md Section 5)

```bash
ls /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/memory/jira-story-field-mapping.json
```

**If mapping file does NOT exist:**

Need to create one first. This requires an existing Story ticket in the DO project as a sample:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs search 'project = DO AND issuetype = Story' --max 1
```

Then use that sample ticket to auto-detect fields:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs setup-mapping --type story --sample DO-<NUMBER>
```

This generates `memory/jira-story-field-mapping.json` with auto-detected field mappings. Present the mapping table to the user for review before proceeding.

**If mapping file DOES exist:** Load it and continue.

### Step 4: First-Time Link Setup — Create Jira Issue (Workflow Step 3)

Per SKILL.md Section 5 and workflow Step 3, use `sync.mjs link` with `--create` to both create the Jira issue and link the document:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs link _bmad-output/user-story-2.md --type story --project DO --create
```

This single command will:

1. Parse the document and extract fields per the story field mapping config
2. Map document sections to Jira fields (e.g., title → summary, Overview → description via markdownToAdf, Acceptance Criteria → custom field)
3. Create a new Story issue in the DO project via the Jira REST API
4. Update the source document `_bmad-output/user-story-2.md` with the Jira link:
   - If document has YAML frontmatter: adds `jira_ticket_id: 'DO-XXX'` to frontmatter
   - If no frontmatter: prefixes title with `[DO-XXX]`
5. Create initial sync state in `memory/sync-state/<hash>.json`
6. Print any `instructions` from the field mapping config for the agent to follow

### Step 5: Verify the Link Was Established

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/sync.mjs status _bmad-output/user-story-2.md
```

Expected: `linked: true`, showing the DO-XXX ticket key.

### Step 6: Verify Document Was Updated

```bash
cat _bmad-output/user-story-2.md
```

Confirm the document now contains the Jira ticket reference (either in frontmatter or title prefix).

### Step 7: Verify Jira Issue Was Created Correctly

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/jira.mjs get DO-<NUMBER>
```

Confirm the issue exists in the DO project with the correct summary, description, and any other mapped fields.

### Step 8: Report Results (Workflow Step 9)

Present summary to user:

| Action | Detail | Result |
|--------|--------|--------|
| created | Jira Story | DO-XXX created in DO project |
| linked | Document updated | `_bmad-output/user-story-2.md` now contains `jira_ticket_id: DO-XXX` |
| synced | Sync state saved | Initial sync state stored |

Include link: `https://wnesolutions.atlassian.net/browse/DO-XXX`

## Key Decisions

1. **Used `sync.mjs link --create` instead of raw `jira.mjs create`** — Per SKILL.md Section 5, sync.mjs is preferred for document-based operations because it automatically handles field mapping, document linking, and sync state.

2. **Field mapping setup is conditional** — Only needed if `memory/jira-story-field-mapping.json` doesn't already exist. The `setup-mapping` command requires a sample ticket from the DO project.

3. **Document update is automatic** — The `link --create` command handles both Jira creation AND updating the source document with the Jira link. No manual editing of the markdown file is needed.

4. **Confirmation before mutation** — Per SKILL.md Section 2, the agent should show what it's about to create and get user confirmation before executing the `link --create` command.
