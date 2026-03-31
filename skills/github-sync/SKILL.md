---
name: github-sync
description: >
  Bidirectional sync between BMAD planning artifacts and GitHub Projects v2.
  Use this skill whenever the user says "sync to github", "push stories",
  "pull status from github", "set up github project", "github sync",
  "onboard github project", "create github issues from stories",
  "update stories from github", "sync status", or wants to manage
  BMAD artifacts in GitHub Projects. Also trigger when user mentions
  "gh project", "github board", "sprint board", or "project roadmap"
  in the context of BMAD artifacts. Trigger on implicit cues like
  "I want to track stories in github", "let's set up a project board",
  "what's out of sync", "push the sprint to github".
---

# GitHub Sync — BMAD to GitHub Projects v2

Bidirectional sync between BMAD planning artifacts (epics, stories, sprint plan) stored as
markdown files and GitHub Projects v2 for visual project tracking.

> **Quick navigation**
> - `gh` CLI commands, GraphQL queries → `references/gh-commands.md`
> - Issue body template, field mapping, labels, milestones → `references/content-mapping.md`
> - Config file format → `references/config-schema.md`
> - Artifact parser script → `scripts/parse-artifacts.py`

---

## Three Rules (Never Break These)

1. **Never sync automatically.** Every mutating operation (create issues, update fields, modify
   files) requires generating a sync report first, presenting it to the user, and waiting for
   explicit approval before executing. The user must see exactly what will change.

2. **Field-level source of truth.** Each field has one owner — either BMAD files or GitHub.
   During sync, the owner side always wins. Never overwrite the owner's data.
   - **BMAD owns:** story body, acceptance criteria, tasks, sprint assignment, epic grouping, dependencies
   - **GitHub owns:** status, dev assignment, task checkbox completion, story points, priority

3. **Idempotent operations.** Running the same sync twice produces the same result. Link-back
   identifiers (H1 title links in story files, `gh_item_url` in planning frontmatter) prevent
   duplicate creation. Always check for existing sync state before creating.

---

## Flow Detection

| User Says | Workflow | Config Required? |
|-----------|----------|-----------------|
| "set up github project", "onboard", "initialize github" | **Onboarding** | No (creates config) |
| "push to github", "sync push", "create issues" | **Push** | Yes |
| "pull from github", "sync pull", "update from github" | **Pull** | Yes |
| "sync status", "what's out of sync" | **Status Check** | Yes |

**If no `.github-sync.yaml` exists at project root, always route to Onboarding first.**

---

## Prerequisite Check (Run Before Every Workflow)

Before any workflow, verify these in order. Stop at first failure.

```
Step 1: gh --version
        → If missing: "Install GitHub CLI: https://cli.github.com/"

Step 2: gh auth status
        → If not authenticated: "Run: gh auth login"

Step 3: gh auth status (check for "project" in scopes)
        → If missing: "Run: gh auth refresh -s project"

Step 4: (For push/pull/status only) Check .github-sync.yaml exists
        → If missing: "Run onboarding first: say 'set up github project'"
```

---

## Onboarding Workflow

This is the first-time setup. It creates the GitHub Project, custom fields, labels, and milestones.

### Step 1: Detect BMAD Artifacts

Run the parser to discover what exists:

```bash
python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode scan \
  --stories-dir _bmad-output/implementation-artifacts
```

Also check that these files exist:
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/sprint-plan.md`

Report the count: "Found N story files, M epics, K sprints."

### Step 2: Gather GitHub Details

Ask the user for:
- **Owner**: GitHub user or organization login
- **Repository**: Repository name

Try to auto-detect from the current repo:
```bash
gh repo view --json owner,name --jq '.owner.login + "/" + .name'
```

Present the detected values and ask for confirmation.

### Step 3: Parse Epic and Sprint Data

**Read `references/content-mapping.md` now** — sections 7 (Label Scheme), 8 (Milestone Scheme),
and 12 (Epic Derivation). You need these to build an accurate onboarding report.

Then parse the actual artifacts:

```bash
python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode epics \
  --file _bmad-output/planning-artifacts/epics.md

python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode sprints \
  --file _bmad-output/planning-artifacts/sprint-plan.md
```

Use the parsed data combined with the label/milestone schemes from the reference file
to determine the exact epic names, label colors, sprint dates, and story counts.

### Step 4: Generate Onboarding Report

Present a report showing everything that WILL be created:

```
=== GITHUB SYNC — ONBOARDING REPORT ===

Repository: {owner}/{repo}

Will create:
  1 GitHub Project v2: "{project_title}"
  8 custom fields:
    - Story ID (TEXT)
    - Epic (SINGLE_SELECT: 12 options)
    - Phase (SINGLE_SELECT: PoC, Hardening)
    - Dev (SINGLE_SELECT: All, Dev 1, Dev 2, Dev 3)
    - Priority (SINGLE_SELECT: Critical Path, Standard, Nice-to-Have)
    - Sprint Start (DATE)
    - Sprint End (DATE)
    - Story Points (NUMBER)
  {N} labels:
    - 12 epic labels (epic:1-foundation ... epic:12-testing)
    - 2 phase labels (phase:poc, phase:hardening)
    - Layer labels (optional, project-specific architecture layers)
  {K} milestones:
    - Sprint 1 (due: 2026-04-10) ... Sprint 12 (due: 2026-09-25)

Proceed with onboarding? [Y/N]
```

**HALT HERE. Wait for user approval.**

### Step 5: Execute Setup

**Read `references/gh-commands.md` now** — you need the exact commands for every operation below.

If approved, execute in this order using the commands from that reference:

1. **Create GitHub Project** via GraphQL `createProjectV2` mutation (section 2)
2. **Create custom fields** via `gh project field-create` (section 3, 8 commands)
3. **Query field IDs and option IDs** via GraphQL field query (section 4)
4. **Create labels** via `gh label create` (section 5, one per label)
5. **Create milestones** via `gh api repos/{owner}/{repo}/milestones` (section 6, one per sprint)

### Step 6: Write Config

**Read `references/config-schema.md` now** — you need the exact YAML format.

Create `.github-sync.yaml` at project root with all populated IDs following that schema.

### Step 7: Report Completion

```
Onboarding complete!
  Project: https://github.com/orgs/{owner}/projects/{number}
  Config: .github-sync.yaml

Next: Run "push stories to github" to create issues.
```

---

## Push Workflow (Files → GitHub)

Pushes BMAD story files to GitHub as issues, adds them to the project, and sets custom fields.

### Step 1: Load Config

Read `.github-sync.yaml`. Verify all field IDs are populated. If any are empty, re-query
field IDs from GitHub (the IDs may have been lost).

### Step 2: Scan Stories

```bash
python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode scan \
  --stories-dir _bmad-output/implementation-artifacts
```

For each story, determine **create** vs **edit** mode based on sync status:
- `synced: false` → CREATE (new issue)
- `synced: true` → UPDATE (edit existing issue)

### Step 3: Handle Partial Sync (Optional)

If the user specified a filter (e.g., "push stories 1.1 1.2", "push epic 1", "push sprint 2"),
filter the story list before proceeding. If no filter, push all stories.

### Step 4: Read Story Files

For each story to push, **read the story file directly** using the Read tool. You need to
understand the content to build the GitHub issue body. As you read each story, identify:
- The user story (## Story section)
- Acceptance criteria (## Acceptance Criteria)
- Tasks and subtasks (## Tasks / Subtasks)
- Dev notes (## Dev Notes)
- Dependencies

**Exclude tasks that are AI agent instructions** — tasks whose subtasks are predominantly
"Read `.knowledge-base/...`" or "Load skill `...`" directives. These are setup steps for
AI agents, not human-actionable work. Use your judgment to identify them by content.

Also load sprint and epic data to determine sprint number, dev assignment, epic label.

### Step 5: Build Issue Content

**Read `references/content-mapping.md` now** — sections 1 (Issue Title Format), 2 (Issue Body
Template), 3 (AC Summarization Rules), 4 (Content Exclusion List), and 9 (Link-Back Strategy).
You need these to correctly transform story files into GitHub issues.

For each story, build the GitHub issue content following those templates:
- **Title**: `{story_id} {short_title}` (section 1 rules)
- **Body**: User story blockquote → AC checklist → Tasks → Dependencies → Collapsible dev notes → Collapsible standards → Sync footer (section 2 template)
- **Labels**: `epic:{N}-{name}`, `phase:{phase}` (section 7 scheme)
- **Milestone**: `Sprint {N}` (section 8 scheme)
- **Assignee**: Map dev alias to GitHub username via config `dev_mapping`

### Step 6: Generate Sync Report

```
=== GITHUB SYNC — PUSH REPORT ===
Generated: {timestamp}

--- CREATES ({count} new issues) ---

  [CREATE] {story_id} {short_title}
           File: {story_file_path}
           Epic: {epic_label} | Sprint: {sprint_number} | Dev: {dev}
           Labels: epic:{N}-{name}, phase:{phase}
           Milestone: Sprint {N}

  [CREATE] ...
           ...

--- UPDATES ({count} existing issues) ---

  [UPDATE] {story_id} {short_title} (#{issue_number})
           Changes: body updated (AC changed)

--- SKIPPED ({count} items) ---

  [SKIP] {story_id} {short_title} — already synced, no local changes

--- SUMMARY ---
Creates: {N} | Updates: {N} | Skips: {N}
Estimated API calls: ~{N} (within rate limits)

Proceed? [Y/N]
```

**HALT HERE. Wait for user approval.**

### Step 7: Execute Push

If approved, for each **CREATE**:
1. Write issue body to a temp file
2. `gh issue create --title "..." --body-file /tmp/... --label "..." --milestone "Sprint N"`
3. Extract issue URL from output
4. `gh project item-add {project_number} --owner {owner} --url {issue_url} --format json`
5. Extract item ID from JSON output
6. `gh project item-edit` for each custom field (Story ID, Epic, Phase, Dev, Sprint Start, Sprint End)
7. Write link-back to local file:
   - Story files: replace H1 with `# [title](issue_url)`
   - Planning files: add `gh_item_url` to frontmatter

For each **UPDATE**:
1. Write updated body to temp file
2. `gh issue edit {number} --body-file /tmp/...`
3. Update labels/milestone if changed

### Step 8: Report Completion

```
Push complete!
  Created: {N} issues
  Updated: {N} issues
  Skipped: {N} items

Config updated: last_synced = {timestamp}
```

---

## Pull Workflow (GitHub → Files)

Pulls status, assignees, and task completion from GitHub back into local BMAD files.

### Step 1: Load Config and Query GitHub

Read `.github-sync.yaml`. Then **read `references/gh-commands.md` section 9** to get the full
GraphQL items query with all field types. Execute that query to fetch all project items.

### Step 2: Match Items to Local Files

For each GitHub item that has a "Story ID" field value:
1. Find the matching local story file (by story ID → filename pattern)
2. Compare GitHub state with local file state:
   - Status: GitHub status vs local `Status:` line
   - Assignee: GitHub assignee vs local dev mapping
   - Task checkboxes: GitHub issue body checkboxes vs local file checkboxes

### Step 3: Generate Sync Report

```
=== GITHUB SYNC — PULL REPORT ===
Generated: {timestamp}

--- FILE UPDATES ({count} items) ---

  [UPDATE] {story_filename}.md
           Status: ready-for-dev → done (from GitHub #{issue_number})
           Assignee: (none) → @{username}

  [UPDATE] {story_filename}.md
           Status: ready-for-dev → in-progress (from GitHub #{issue_number})

--- NO CHANGES ({count} items) ---

  [OK] {story_filename}.md — in sync

--- GITHUB-ONLY ({count} items) ---

  [WARN] GitHub #55 "Extra item" — no matching local file (Story ID: "X.X")

--- SUMMARY ---
File updates: {N} | No changes: {N} | Warnings: {N}

Proceed? [Y/N]
```

**HALT HERE. Wait for user approval.**

### Step 4: Execute Pull

If approved, for each file update:
1. Read the story file
2. Update the `Status:` line with the mapped BMAD status
3. Write the file back
4. Update config `last_synced`

### Step 5: Report Completion

```
Pull complete!
  Updated: {N} files
  Unchanged: {N} files

Config updated: last_synced = {timestamp}
```

---

## Status Check (Read-Only)

Compare local files with GitHub state without making any changes. No approval needed.

```bash
# Scan local files
python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode scan \
  --stories-dir _bmad-output/implementation-artifacts

# Query GitHub items
gh api graphql -f query='...'  # (items query from references/gh-commands.md)
```

Output a comparison table:

```
=== GITHUB SYNC — STATUS ===

| Story | Local Status | GitHub Status | Synced? | Issue |
|-------|-------------|---------------|---------|-------|
| 1.1   | ready-for-dev | Done        | NO      | #42   |
| 1.2   | ready-for-dev | Ready       | YES     | #43   |
| 2.1   | ready-for-dev | (not synced)| NO      | —     |
| ...   | ...          | ...          | ...     | ...   |

Summary: {N} in sync, {M} out of sync, {K} not yet pushed
```

---

## Partial Sync Filters

The user can limit push/pull to a subset of stories:

| Filter | Example | Effect |
|--------|---------|--------|
| By story IDs | `push stories 1.1 1.2 1.3` | Only these stories |
| By epic | `push epic 3` | All stories in Epic 3 |
| By sprint | `push sprint 2` | All stories assigned to Sprint 2 |
| By status | `push unsynced` | Only stories not yet pushed |
| All | `push` or `push all` | All stories (default) |

Parse the filter from the user's message. If ambiguous, ask for clarification.

---

## Error Handling

| Error | Action |
|-------|--------|
| `gh` command returns non-zero exit code | Show the error output, suggest fix, halt |
| Field ID missing from config | Re-query field IDs: `gh project field-list --format json` |
| Rate limit hit (HTTP 429) | Show warning, suggest waiting 60 seconds, halt |
| Story file has unexpected format | Skip with warning in the sync report |
| Milestone already exists | Skip creation (idempotent) |
| Label already exists | Skip creation (idempotent) |
| Issue already exists for story | Switch to update mode instead of create |

---

## Reference File Index

| File | Read When |
|------|-----------|
| `references/gh-commands.md` | You need exact `gh` CLI commands or GraphQL queries |
| `references/content-mapping.md` | You need to build issue body, map fields, or check label/milestone scheme |
| `references/config-schema.md` | You need to create or read `.github-sync.yaml` |
