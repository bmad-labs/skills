# Approach: Batch Sync BMAD Documents (Without Skill)

## Task Summary

Sync all BMAD documents in the project to Jira and Confluence. This requires discovering all planning and implementation artifacts from the BMAD output directory, determining their sync status, and pushing each document to the appropriate Atlassian destination (Confluence pages for documentation, Jira issues for backlog items).

## Understanding the BMAD Document Structure

The project has a `_bmad/bmm/config.yaml` that defines the artifact paths:

- `planning_artifacts`: `{project-root}/_bmad-output/planning-artifacts`
- `implementation_artifacts`: `{project-root}/_bmad-output/implementation-artifacts`
- `project_knowledge`: `{project-root}/docs`

To execute a batch sync, I would need to:

1. Parse `config.yaml` to discover these paths.
2. Recursively scan each path for markdown/document files.
3. For each discovered file, determine whether it maps to a Confluence page or Jira issue.
4. Check the current sync state (new, modified since last sync, unchanged, conflicting).
5. Process each file accordingly.

## What a Batch Sync Requires

### Step 1: Read BMAD Configuration

Read `_bmad/bmm/config.yaml` to discover the configured artifact paths. This tells us where all BMAD documents live. Without a helper script like `sync.mjs init-batch`, I would have to manually parse this YAML and construct a batch configuration file (e.g., `memory/batch-sync-config.json`) that maps local paths to Atlassian destinations.

### Step 2: Discover All Documents

Scan the configured paths recursively:

- `_bmad-output/planning-artifacts/` -- PRDs, specs, research documents, architecture decisions
- `_bmad-output/implementation-artifacts/` -- technical docs, API specs, implementation notes
- `docs/` -- project knowledge base documents

For each file, record: file path, last modified timestamp, file type, and content hash.

### Step 3: Initialize or Load Sync State

Check for an existing sync state file (e.g., `memory/batch-sync-config.json`) that tracks:

- Which local files have been synced before
- The Confluence page ID or Jira issue key each file maps to
- The last-synced content hash and timestamp
- The Atlassian space/project destination for each file

If no sync state exists, this is a first-time sync and every document is treated as "new." A human or the skill's `sync.mjs init-batch` command would normally generate this configuration, presenting it for user review before saving.

### Step 4: Determine Sync Status for Each Document

For each discovered file, classify it as:

- **New** -- no prior sync record; needs to be created in Atlassian
- **Modified locally** -- local content hash differs from last-synced hash; needs to be pushed
- **Modified remotely** -- Atlassian version has changed since last sync; needs to be pulled or merged
- **Conflict** -- both local and remote have changed; requires human resolution
- **Up to date** -- no changes on either side; skip

Checking remote status requires fetching each mapped Confluence page or Jira issue to compare versions, which means many API calls.

### Step 5: Present Summary Table

Before processing, display a summary table to the user showing:

| File | Type | Destination | Status | Action |
|------|------|-------------|--------|--------|
| planning-artifacts/research/technical-cpp-embedded-best-practices-research-2026-03-10.md | Research | Confluence TEAM space | New | Create page |
| ... | ... | ... | ... | ... |

The user should confirm before proceeding.

### Step 6: Process Each File

For each file needing sync:

- **New files to Confluence:** Convert markdown to Confluence storage format (XHTML), then call `POST /wiki/api/v2/pages` to create the page.
- **New files to Jira:** Parse document structure to extract issue fields, then call `POST /rest/api/3/issue` to create the issue.
- **Modified files:** Fetch the current remote version, update with local content via `PUT /wiki/api/v2/pages/{id}` or `PUT /rest/api/3/issue/{key}`.
- **Conflicts:** Pause and present both versions to the user for manual resolution.

### Step 7: Update Sync State

After each successful sync operation, update the sync state file with the new content hash, timestamp, and remote ID/version.

## API Calls Required

For a batch sync of N documents, the minimum API calls would be:

1. **`GET /wiki/api/v2/spaces?keys=TEAM`** -- Resolve space ID for Confluence operations.
2. **`GET /rest/api/3/project/DO`** -- Verify Jira project exists and get metadata.
3. For each existing mapping: **`GET /wiki/api/v2/pages/{id}`** or **`GET /rest/api/3/issue/{key}`** -- Check remote version for conflict detection.
4. For each new document: **`POST /wiki/api/v2/pages`** or **`POST /rest/api/3/issue`** -- Create the resource.
5. For each modified document: **`PUT /wiki/api/v2/pages/{id}`** or **`PUT /rest/api/3/issue/{key}`** -- Update the resource.

All calls require authentication via `Authorization: Basic <base64(email:api-token)>` or OAuth.

## What Is Blocked Without Tooling

Without the Atlassian MCP plugin, helper scripts (`sync.mjs`), or any pre-configured sync infrastructure:

1. **No authentication** -- I have no Confluence or Jira API tokens or OAuth credentials to make authenticated requests from this environment.
2. **No HTTP client** -- I cannot issue `curl` or REST calls with stored credentials.
3. **No sync state management** -- There is no `sync.mjs init-batch` to automatically discover documents, build the mapping configuration, and present it for review. I would have to manually construct and maintain the sync state JSON.
4. **No markdown-to-Confluence conversion** -- Converting markdown documents to Confluence storage format (XHTML with Atlassian-specific macros) requires a conversion library or script. Raw markdown cannot be posted directly to Confluence's storage API.
5. **No conflict detection** -- Without fetching remote versions, I cannot determine whether documents have been modified on the Atlassian side, risking data loss from blind overwrites.
6. **No batch orchestration** -- Processing many files sequentially with error handling, retries, and partial-failure recovery requires scripting that does not exist in this environment.
7. **No destination mapping** -- I have no way to know which Confluence space or Jira project each document type should sync to without a pre-configured mapping file.

## What the Atlassian Skill Would Provide

If the atlassian-rest skill were available, the workflow would be:

1. **Load the sync-bmad-documents sub-skill** -- A dedicated workflow that understands the BMAD document structure and sync semantics.
2. **`sync.mjs init-batch`** -- Automatically reads `_bmad/bmm/config.yaml`, discovers all artifact paths, builds a `memory/batch-sync-config.json` mapping file, and presents it for user review.
3. **`sync.mjs batch`** -- Scans all configured paths, computes content hashes, checks remote versions via the MCP plugin, and produces a summary table of all documents and their sync status.
4. **Automated processing** -- For each document needing sync, the skill handles markdown-to-storage-format conversion, creates or updates the Atlassian resources via MCP tools (`createConfluencePage`, `updateConfluencePage`, `createJiraIssue`, `editJiraIssue`), and pauses on conflicts for human resolution.
5. **State persistence** -- After each operation, the sync state is updated so subsequent runs are incremental.

## Conclusion

This task **cannot be completed** without authenticated access to the Atlassian APIs and sync orchestration tooling. The batch sync workflow requires:

- Discovering and classifying all BMAD documents from configured paths
- Maintaining a persistent sync state mapping local files to remote resources
- Converting markdown content to Confluence storage format
- Making many authenticated API calls for conflict detection, creation, and updates
- Handling conflicts interactively

A human would need to either:
- Manually upload each document to the appropriate Confluence space or Jira project, or
- Enable the Atlassian MCP plugin and the atlassian-rest skill so the agent can use `sync.mjs` and the MCP tools to orchestrate the batch sync automatically.
