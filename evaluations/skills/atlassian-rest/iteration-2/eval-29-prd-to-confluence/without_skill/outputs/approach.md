# Approach: PRD to Confluence Without Atlassian Skill

## Task Summary

Take a local PRD document at `docs/prd/platform-prd.md`, publish it to Confluence, and establish a persistent link between the local file and the Confluence page so future syncs are possible.

## Interpretation of "Link and Push"

The prompt says "link my PRD document to Confluence and push it." This implies two distinct operations:

1. **Link** -- Establish a bidirectional mapping between the local markdown file and a Confluence page (typically by storing a `confluence_page_id` in the document's YAML frontmatter).
2. **Push** -- Convert the markdown content to Confluence storage format and create or update the corresponding Confluence page.

Without a dedicated skill or sync tooling, the agent must manually perform each sub-step that a sync workflow would normally orchestrate.

## Required Operations

### Step 1: Read the Local PRD Document

- **Tool:** `Read` (file system)
- **Action:** Read `docs/prd/platform-prd.md` to understand its content, structure, and whether it already has YAML frontmatter with sync metadata (e.g., `confluence_page_id`, `confluence_space`, `document_type`).
- **Purpose:** Determine whether this is a first-time publish (create new page) or an update (page already linked).

### Step 2: Determine the Target Confluence Space

The prompt does not specify which Confluence space to publish to. Without a skill that auto-detects document type and routes to the correct space, the agent must:

- **Option A:** Ask the user which Confluence space key to use (e.g., "TEAM", "ENG", "DOCS").
- **Option B:** Guess based on conventions or list available spaces first.

To list spaces:
- **Tool:** `mcp__plugin_atlassian_atlassian__getConfluenceSpaces`
- **Parameters:** `cloudId` for the target instance
- **Purpose:** Present available spaces so the user can choose.

This is a critical decision point that a sync skill would handle automatically by reading a mapping configuration (e.g., `sync-config.json` or frontmatter metadata that maps document types to spaces).

### Step 3: Convert Markdown to Confluence Storage Format

Confluence pages use XHTML-based "storage format," not markdown. The agent must convert the PRD content. Without helper scripts (like `sync.mjs` with `markdownToStorage`), the agent must:

- Manually translate markdown headings (`#`, `##`) to `<h1>`, `<h2>` tags.
- Convert markdown lists, bold, italic, links, code blocks to their XHTML equivalents.
- Handle tables by converting markdown table syntax to `<table>` elements.
- Convert any embedded images to Confluence attachment references or external URLs.

This manual conversion is error-prone. Common issues include:

- Markdown tables with alignment syntax not mapping cleanly to Confluence tables.
- Code blocks needing Confluence `<ac:structured-macro>` elements for syntax highlighting.
- Relative image paths becoming broken since they reference local files.
- Confluence-specific macros (TOC, status, expand) having no markdown equivalent.

A sync script would use a library (e.g., marklassian or a custom converter) to handle these edge cases reliably.

### Step 4: Create the Confluence Page

- **Tool:** `mcp__plugin_atlassian_atlassian__createConfluencePage`
- **Parameters:**
  - `cloudId: "wnesolutions.atlassian.net"` (or whatever the configured instance is)
  - `spaceId: "<resolved from Step 2>"`
  - `title: "Platform PRD"` (derived from the document title or first heading)
  - `body: "<converted XHTML content from Step 3>"`
  - `contentFormat: "storage"`
- **Output:** The returned page ID is needed for the linking step.

If the page already exists (frontmatter has a `confluence_page_id`), the agent would instead use:
- **Tool:** `mcp__plugin_atlassian_atlassian__updateConfluencePage`
- **Parameters:** Include the existing `pageId` and the current `version` number (which requires first fetching the page to get the version).

### Step 5: Link the Document (Update Frontmatter)

After the Confluence page is created, the agent must write the page ID back into the local document's YAML frontmatter:

```yaml
---
title: Platform PRD
document_type: prd
confluence_page_id: "12345678"
confluence_space: "TEAM"
last_synced: "2026-03-18T00:00:00Z"
---
```

- **Tool:** `Edit` (file system)
- **Action:** Add or update frontmatter fields in `docs/prd/platform-prd.md` with the Confluence page ID, space key, and sync timestamp.
- **Purpose:** Establish the persistent link so future push/pull operations know which Confluence page this document maps to.

### Step 6: Verify the Page

- **Tool:** `mcp__plugin_atlassian_atlassian__getConfluencePage`
- **Parameters:** `pageId: "<created page ID>"`
- **Purpose:** Confirm the page was created successfully and retrieve the URL to present to the user.

## Challenges Without the Skill

1. **No sync infrastructure:** Without `sync.mjs` or equivalent tooling, there is no automated status detection, document type classification, or space routing. The agent must ask the user for information that a sync config would provide automatically.

2. **No markdown-to-storage conversion:** The agent has no access to a proper markdown-to-Confluence-storage converter (like marklassian). Manual conversion is unreliable, especially for complex markdown features like nested lists, code blocks with syntax highlighting, tables with merged cells, or embedded diagrams.

3. **No document type awareness:** A sync skill would recognize `docs/prd/` as a PRD document type and apply the correct Confluence template, parent page placement, and space routing. Without this, the agent creates a generic page with no structured placement.

4. **No frontmatter sync protocol:** The agent must invent its own frontmatter schema for storing the Confluence link. A skill would use an established schema (e.g., `confluence_page_id`, `sync_hash`, `last_synced`) that other sync operations (pull, diff, status) also understand.

5. **No conflict detection:** Without a sync hash or version tracking mechanism, subsequent pushes could overwrite changes made directly in Confluence. A proper sync tool would compute a content hash and compare before pushing.

6. **No parent page placement:** PRDs typically belong under a specific parent page in Confluence (e.g., "Product Requirements" or "PRDs"). Without the skill's space/page hierarchy knowledge, the page is created at the space root level.

7. **No template application:** A sync skill might apply a PRD-specific Confluence template (with sections like Overview, Goals, Requirements, Success Metrics, Timeline). Without it, the raw markdown structure is used as-is.

## Estimated Tool Calls

| Operation                          | Calls |
|------------------------------------|-------|
| Read local PRD file                | 1     |
| List Confluence spaces             | 1     |
| Ask user for space selection       | 1 (interaction) |
| Create Confluence page             | 1     |
| Update local file frontmatter      | 1     |
| Verify page creation               | 1     |
| **Total**                          | **5-6** |

## Conclusion

Without a dedicated sync skill, the "link and push" task requires the agent to manually orchestrate every step: reading the document, asking the user for the target space, converting markdown to Confluence storage format by hand, creating the page via MCP, and writing the page ID back to frontmatter. The most significant gap is the lack of a reliable markdown-to-storage converter -- manual conversion produces brittle XHTML that may render incorrectly in Confluence. Additionally, there is no established sync protocol, so the "link" created is ad-hoc and may not be compatible with future sync operations like pull, diff, or conflict resolution. A sync skill would handle document type detection, space routing, content conversion, frontmatter management, and verification as a single coordinated workflow.
