---
name: github-sync
description: >
  Bidirectional sync between BMAD planning artifacts and GitHub Projects v2.
  Use this skill whenever the user says "sync to github", "push stories",
  "pull status from github", "set up github project", "github sync",
  "onboard github project", "create github issues from stories",
  "update stories from github", "sync status", or wants to manage
  BMAD artifacts in GitHub Projects. Also trigger when user mentions
  "gh project", "github board", "sprint board", "project roadmap",
  "relationship field", "blocked by", or "parent issue"
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

## Four Rules (Never Break These)

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

4. **Never auto-parse issue bodies with a script.** Issue body generation requires reading each
   story file directly with the Read tool and crafting the body manually following the template
   in `references/content-mapping.md`. Auto-parsing scripts fail silently in subtle ways:
   they strip task lists when formatting assumptions are wrong, gut dev notes by removing code
   blocks, and produce empty section headers. One bad push contaminates all 27 issues at once.
   **Read the file. Write the body. No shortcuts.**

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

This is the first-time setup. It creates or connects to a GitHub Project, creates custom
fields, labels, and phase-based milestones.

### Step 1: Detect BMAD Artifacts

Run the parser to discover what exists:

```bash
python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode scan \
  --stories-dir .artifacts/implementation-artifacts
```

Also check that these files exist:
- `.artifacts/planning-artifacts/epics.md`
- `.artifacts/planning-artifacts/sprint-plan.md`

> **Note:** The artifacts path `.artifacts/` may differ per project. Check the actual
> directory structure — some projects use `_bmad-output/`. Confirm the correct paths with
> the user and use them throughout. Update `paths.*` in the config accordingly.

Report the count: "Found N story files, M epics, K sprints."

### Step 2: Gather GitHub Details

Auto-detect the current repo:
```bash
gh repo view --json owner,name --jq '.owner.login + "/" + .name'
```

List existing projects and ask the user whether to use one or create new:
```bash
gh project list --owner {owner} --format json
```

Present detected owner/repo and existing projects. Ask for confirmation before proceeding.

### Step 3: Parse Epic and Sprint Data

**Read `references/content-mapping.md` now** — sections 7 (Label Scheme), 8 (Milestone Scheme),
and 12 (Epic Derivation). You need these to build an accurate onboarding report.

Then parse the actual artifacts:

```bash
python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode epics \
  --file .artifacts/planning-artifacts/epics.md

python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode sprints \
  --file .artifacts/planning-artifacts/sprint-plan.md
```

### Step 4: Generate Onboarding Report

Present a report showing everything that WILL be created:

```
=== GITHUB SYNC — ONBOARDING REPORT ===

Repository: {owner}/{repo}
Project: #{N} "{title}" (existing) OR new project "{title}"

Will create/verify:
  Custom fields (7):
    - Story ID      (TEXT)
    - Epic          (SINGLE_SELECT: 12 options, rainbow colors)
    - Sprint        (SINGLE_SELECT: Sprint 01–12, rainbow colors + sprint goal descriptions)
    - Dev           (SINGLE_SELECT: All, Dev 1, Dev 2, Dev 3, Dev 1+2)
    - Sprint Start  (DATE)
    - Sprint End    (DATE)
    - Story Points  (NUMBER)
  Built-in fields to set:
    - Start date    (DATE, pre-existing)   ← same dates as Sprint Start
    - Target date   (DATE, pre-existing)   ← same dates as Sprint End
    - Status        (single-select, pre-existing)
  {N} labels:
    - Epic labels (one per epic, e.g., epic:1-foundation ... epic:12-testing)
    - Phase labels (e.g., phase:poc, phase:hardening)
    - Layer labels (optional, project-specific architecture layers)
  {K} milestones (phase-based, NOT per-sprint):
    - PoC              (due: {sprint_6_end})    Sprints 1–6
    - Production Hardening (due: {sprint_12_end}) Sprints 7–12

Note: No "Phase" custom field — the milestone covers phase membership.

Proceed with onboarding? [Y/N]
```

**HALT HERE. Wait for user approval.**

### Step 5: Execute Setup

**Read `references/gh-commands.md` now** — you need the exact commands for every operation below.

If approved, execute in this order:

1. **Create or connect GitHub Project** (section 2) — if using existing, just get its node ID
2. **Create custom fields** (section 3) — Story ID, Epic, Sprint, Dev, Sprint Start, Sprint End, Story Points
3. **Query all field IDs** (section 4) — including the pre-existing Start date, Target date, Status fields
4. **Apply rainbow colors + sprint goal descriptions to Sprint and Epic fields** (section 13)
   - Sprint options: cycle RED→ORANGE→YELLOW→GREEN→BLUE→PURPLE→PINK, repeat
   - Sprint description = sprint objective from sprint-plan.md
   - Epic options: RED→ORANGE→YELLOW→GREEN→BLUE→PURPLE→PINK→RED→ORANGE→YELLOW→GREEN→BLUE
5. **Create labels** (section 5) — 17 labels total
6. **Create phase-based milestones** (section 6) — PoC and Production Hardening

> **Critical:** After calling `updateProjectV2Field` to set colors/descriptions, the single-select
> option IDs CHANGE (the mutation replaces the options list). Always re-query option IDs after
> calling this mutation and use the new IDs in the config.

### Step 6: Write Config

**Read `references/config-schema.md` now** — you need the exact YAML format.

Create `.github-sync.yaml` at project root with all populated IDs following that schema.
Note: No `phase` field in `field_ids` or `option_ids` — Phase was replaced by milestones.

### Step 7: Report Completion

```
Onboarding complete!
  Project: https://github.com/orgs/{owner}/projects/{number}
  Config: .github-sync.yaml

Next: Run "push stories to github" to create issues.
```

---

## Push Workflow (Files → GitHub)

Pushes BMAD story files to GitHub as issues, adds them to the project, sets all fields,
sets date fields, and establishes relationships.

### Step 1: Load Config

Read `.github-sync.yaml`. Verify all field IDs are populated. If any are empty, re-query
field IDs from GitHub (the IDs may have been lost).

### Step 2: Scan Stories

```bash
python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode scan \
  --stories-dir .artifacts/implementation-artifacts
```

For each story, determine **create** vs **edit** mode:
- H1 is plain `# Story X.X: Title` (no link) → CREATE
- H1 contains `# [Story X.X: Title](url)` → UPDATE (already synced)

### Step 3: Handle Partial Sync (Optional)

If the user specified a filter (e.g., "push stories 1.1 1.2", "push epic 1", "push sprint 2"),
filter the story list before proceeding. If no filter, push all stories.

### Step 4: Read Story Files and Build Issue Content

**⚠️ Rule 4 applies here: Read each file with the Read tool. Build bodies manually. No scripts.**

For each story:

1. **Read the file** using the Read tool
2. **Read `references/content-mapping.md`** — sections 1–4 and 9 for the exact format
3. **Build the issue body** following the template:
   - User story blockquote
   - AC as one-line Then-clause summaries (checkboxes)
   - Full task list (Task 2+ only — exclude agent-only tasks by reading content, not by position)
   - Dependencies with `#N` GitHub issue numbers
   - Collapsible dev notes: tables, config snippets, architecture patterns — NOT code skeletons,
     NOT ASCII trees, NOT "What NOT to Do" lists, NOT references
4. **Look up sprint/dev/epic** from sprint-plan.md (NOT from the story file body)

### Step 5: Generate Sync Report

```
=== GITHUB SYNC — PUSH REPORT ===
Generated: {timestamp}

--- CREATES ({count} new issues) ---

  [CREATE] {story_id} {short_title}
           File: {story_file_path}
           Epic: {epic_label} | Sprint: {sprint} | Dev: {dev} | Phase: {phase}
           Labels: epic:{N}-{name}, phase:{phase}
           Milestone: {PoC | Production Hardening}

--- UPDATES ({count} existing issues) ---

  [UPDATE] {story_id} {short_title} (#{issue_number})
           Changes: body updated

--- SKIPPED ({count} items) ---

  [SKIP] {story_id} {short_title} — already synced, no local changes

--- SUMMARY ---
Creates: {N} | Updates: {N} | Skips: {N}

Proceed? [Y/N]
```

**HALT HERE. Wait for user approval.**

### Step 6: Execute Push

If approved, for each **CREATE**:
1. Write issue body to a temp file (`/tmp/issue-{story_id}.md`)
2. `gh issue create --title "..." --body-file /tmp/... --label "epic:X-name" --label "phase:poc" --milestone "{PoC|Production Hardening}"`
3. Extract issue URL from output
4. `gh project item-add {project_number} --owner {owner} --url {issue_url} --format json`
5. Extract item ID from JSON output
6. Set all project fields using `gh project item-edit`:
   - Story ID (text)
   - Epic (single-select option)
   - Sprint (single-select option, e.g., "Sprint 01")
   - Dev (single-select option)
   - Sprint Start (date from sprint-plan.md)
   - Sprint End (date from sprint-plan.md)
   - Status (Backlog)
   - **Start date** (same date as Sprint Start — pre-existing field)
   - **Target date** (same date as Sprint End — pre-existing field)
7. Write link-back to local file: replace H1 with `# [Story X.X: Title](issue_url)`

For each **UPDATE**:
1. Write updated body to temp file
2. `gh issue edit {number} --body-file /tmp/... --milestone "{phase_milestone}"`
3. Update project fields if sprint/epic changed

### Step 7: Set Up Relationships

After all issues are created, establish GitHub native relationships.

**Read `references/gh-commands.md` section 12** for the exact GraphQL mutations.

#### 7a. Epic tracking issues as parents

Create one epic tracking issue per epic (if not already created). See
`references/content-mapping.md` section 10 for the body template. Then for each story,
set its epic tracking issue as its parent:

```graphql
mutation {
  addSubIssue(input: {
    issueId: "{epic_tracking_issue_node_id}"
    subIssueId: "{story_issue_node_id}"
    replaceParent: true
  }) {
    issue { number }
    subIssue { number }
  }
}
```

#### 7b. Blocked-by dependencies

Read the dependency table from `sprint-plan.md` (the `Dependencies` column in each sprint's
story table). For each dependency `A → B` (story A depends on story B):

```graphql
mutation {
  addBlockedBy(input: {
    issueId: "{story_A_node_id}"
    blockingIssueId: "{story_B_node_id}"
  }) {
    issue { number }
    blockingIssue { number }
  }
}
```

> **Always source dependencies from sprint-plan.md, not from story file bodies.**
> The sprint plan is the authoritative dependency record.

Get issue node IDs via:
```bash
gh api graphql -f query='
  query {
    repository(owner:"{owner}", name:"{repo}") {
      issues(first:50, orderBy:{field:CREATED_AT, direction:ASC}) {
        nodes { number id title }
      }
    }
  }
'
```

### Step 8: Report Completion

```
Push complete!
  Created: {N} issues
  Updated: {N} issues
  Skipped: {N} items
  Relationships set: {N} parent, {M} blocked-by

Config updated: last_synced = {timestamp}
```

---

## Pull Workflow (GitHub → Files)

Pulls status, assignees, and task completion from GitHub back into local BMAD files.

### Step 1: Load Config and Query GitHub

Read `.github-sync.yaml`. Then **read `references/gh-commands.md` section 9** to get the full
GraphQL items query. Execute it to fetch all project items.

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

--- NO CHANGES ({count} items) ---

  [OK] {story_filename}.md — in sync

--- GITHUB-ONLY ({count} items) ---

  [WARN] GitHub #{N} "{title}" — no matching local file

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

---

## Status Check (Read-Only)

Compare local files with GitHub state without making any changes. No approval needed.

```bash
# Scan local files
python3 .agents/skills/github-sync/scripts/parse-artifacts.py --mode scan \
  --stories-dir .artifacts/implementation-artifacts

# Query GitHub items (full field values)
# Use GraphQL query from references/gh-commands.md section 9
```

Output a comparison table:

```
=== GITHUB SYNC — STATUS ===

| Story | Local Status  | GitHub Status | Sprint | Synced? | Issue |
|-------|--------------|---------------|--------|---------|-------|
| 1.1   | ready-for-dev | Done          | 01     | NO      | #1    |
| 1.2   | ready-for-dev | Ready         | 01     | YES     | #2    |
| 2.1   | backlog       | (not synced)  | 02     | NO      | —     |

Summary: {N} in sync, {M} out of sync, {K} not yet pushed
```

---

## Partial Sync Filters

| Filter | Example | Effect |
|--------|---------|--------|
| By story IDs | `push stories 1.1 1.2 1.3` | Only these stories |
| By epic | `push epic 3` | All stories in Epic 3 |
| By sprint | `push sprint 2` | All stories assigned to Sprint 2 |
| By status | `push unsynced` | Only stories not yet pushed |
| All | `push` or `push all` | All stories (default) |

---

## Error Handling

| Error | Action |
|-------|--------|
| `gh` command returns non-zero exit code | Show the error output, suggest fix, halt |
| Field ID missing from config | Re-query field IDs via section 4 of gh-commands.md |
| Rate limit hit (HTTP 429) | Show warning, suggest waiting 60 seconds, halt |
| Story file has unexpected format | Skip with warning in the sync report |
| Milestone already exists | Skip creation (idempotent) |
| Label already exists | Skip creation (idempotent) |
| Issue already exists for story | Switch to update mode |
| Single-select option IDs stale | Re-query after any `updateProjectV2Field` call — the mutation replaces all options and issues new IDs |
| `addBlockedBy` payload field error | Return field is `blockingIssue` (not `blockedByIssue`) |
| `updateProjectV2Field` rejects `projectId` | This mutation takes only `fieldId`, not `projectId` |
| `updateProjectV2Field` rejects option `id` | Options use `name`/`color`/`description` only — no `id` field |

---

## Reference File Index

| File | Read When |
|------|-----------|
| `references/gh-commands.md` | You need exact `gh` CLI commands or GraphQL queries |
| `references/content-mapping.md` | You need to build issue body, map fields, or check label/milestone scheme |
| `references/config-schema.md` | You need to create or read `.github-sync.yaml` |
