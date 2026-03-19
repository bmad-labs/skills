# Workflow: Sync Confluence Space to Local Markdown

Download an entire Confluence space (or subtree) to a local directory as markdown files, preserving the page hierarchy, attachments, and links back to the original pages.

## When to Use

- User wants to "download confluence pages", "sync confluence to local", "pull docs from confluence"
- User wants a local copy of their Confluence documentation for AI context, search, or version control
- User wants to convert Confluence content to markdown for migration

## Prerequisites

- Confluence credentials configured (run `setup.mjs` if not)
- Node.js 18+ with `marked` package installed in `<skill-path>/scripts/`

## Step 1: Identify the Root Page

Ask the user which space or page to sync. Get the root page ID:

```bash
# Search for the space
node <skill-path>/scripts/confluence.mjs spaces --max 20

# Find the root page by title
node <skill-path>/scripts/confluence.mjs search 'type = page AND title = "Project Name"' --max 5
```

The root page ID is needed for the API calls. You can also get it from the Confluence URL: `https://domain.atlassian.net/wiki/spaces/KEY/pages/PAGE_ID/Title`

## Step 2: Run the Sync Script

Use the built-in sync script:

```bash
# Basic sync
node <skill-path>/scripts/sync-confluence-space.mjs --root <PAGE_ID> --output ./docs/confluence

# Sync without downloading attachments (faster, markdown only)
node <skill-path>/scripts/sync-confluence-space.mjs --root <PAGE_ID> --output ./docs/confluence --skip-attachments

# Preview what would be synced without writing anything
node <skill-path>/scripts/sync-confluence-space.mjs --root <PAGE_ID> --output ./docs/confluence --dry-run

# Flat file structure (no subdirectories)
node <skill-path>/scripts/sync-confluence-space.mjs --root <PAGE_ID> --output ./docs/confluence --flatten

# Custom assets directory location
node <skill-path>/scripts/sync-confluence-space.mjs --root <PAGE_ID> --output ./docs/confluence --assets-dir ./docs/assets
```

The script will:
1. Recursively fetch the page tree from the root page
2. Convert each page from Confluence storage format to markdown
3. Download all attachments to a shared `assets/` directory
4. Write markdown files with hierarchy matching the page tree
5. Rewrite image and file references to point to local assets
6. Generate an `INDEX.md` with a table of contents

### Custom Sync Script

For advanced customization (e.g., filtering pages by label, adding frontmatter, custom naming), create a custom script in the target output directory. Import the converter:

```js
import { storageToMarkdown } from '<skill-path>/scripts/confluence-format.mjs';
```

See `<skill-path>/scripts/sync-confluence-space.mjs` for a complete reference implementation to copy and modify.

## Step 3: Verify Output

After sync, spot-check several files:
- Tables render with proper `| cell |` syntax
- Code blocks have triple-backtick fences with language tags
- Images have encoded URLs and alt text
- Headings are properly separated with blank lines
- Generic types in code blocks (e.g., `Array<string>`) are preserved (not stripped)
- Expand/collapsible sections render as `<details><summary>` blocks
- Attached files (view-file macros) render as markdown links
- Bullet lists inside expand sections are properly formatted

## Step 4: Re-sync

The script is idempotent — running it again overwrites files with latest content. Existing attachment files are skipped (not re-downloaded) to save time. For incremental updates, the user can:
- Re-run the full script (simple, complete)
- Modify to track page version numbers and skip unchanged pages (optimization for very large spaces)

## Key API Endpoints

```
GET /wiki/api/v2/pages/{id}?body-format=storage    # Fetch page with storage body
GET /wiki/api/v2/pages/{id}/children?limit=50       # Fetch direct children (paginated)
GET /wiki/rest/api/content/{id}/child/attachment     # List attachments
```

## Production Lessons Learned

These were discovered through real-world use and prevent common issues:

### Page URL Construction
The v2 API returns `_links` with:
- `base`: `https://domain.atlassian.net/wiki`
- `webui`: `/spaces/KEY/pages/123/Title`

Construct full URL as `_links.base + _links.webui`. Do **NOT** use `env.domain + _links.webui` — the webui path doesn't include `/wiki`.

### File Hierarchy
- **Pages with children** → create `PageName/index.md` directory
- **Leaf pages (no children)** → create flat `PageName.md` file
- This keeps the tree clean — no empty directories for leaf pages

### Attachment Path Rewriting
The sync script must rewrite **both** image references (`![alt](filename)`) and file attachment links (`[filename](filename)`) to point to the local assets directory. Confluence `view-file` macros produce regular links, not image references.

Use **depth-aware relative paths** from each file back to the shared assets directory:
- Root `index.md` (depth 0): `assets/imgs/file.png`
- Child `Foo/index.md` (depth 1): `../assets/imgs/file.png`
- Grandchild `Foo/Bar.md` (depth 1): `../assets/imgs/file.png`
- Deep `Foo/Bar/index.md` (depth 2): `../../assets/imgs/file.png`

### Filename Encoding
Attachment filenames from Confluence often contain spaces, parentheses, and special characters. URL-encode them in markdown references:
```js
const encoded = filename
  .replace(/\(/g, '%28').replace(/\)/g, '%29')
  .replace(/ /g, '%20');
```

### Confluence HTML Attributes
Confluence adds `local-id`, `breakoutWidth`, `data-layout`, and other attributes to most HTML tags. Any regex matching HTML tags must use `[^>]*` to accept optional attributes — e.g., `<ul[^>]*>` not `<ul>`.

### Expand Macros
`<ac:structured-macro ac:name="expand">` macros can have multiple `<ac:parameter>` tags beyond just `title` (e.g., `breakoutWidth`). The regex must consume all parameters, not just the title. The converter handles these as `<details><summary>` collapsible sections.

### View-File Macros
Confluence uses `<ac:structured-macro ac:name="view-file">` for embedded file viewers (drawio diagrams, markdown files, PDFs). These must be explicitly handled — they convert to `[filename](filename)` links in markdown, which the sync script rewrites to local asset paths.

### Expand Body Content
Expand macro bodies can contain any Confluence content — code blocks, images, tables, nested lists, panels. The inner HTML converter must handle the same set of macros and elements as the main converter. Content loss inside expand sections is a common source of bugs.

### Placeholder Restore Ordering
When using placeholder systems to protect content during conversion (e.g., code blocks, details blocks), restore outer wrappers (details blocks) before inner content (code blocks). Details blocks may contain code block placeholders that need restoring.
