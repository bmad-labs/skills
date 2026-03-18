# Create Confluence Document

Workflow for creating professional, well-structured Confluence pages with images, macros, and document templates.

**Reference files:** `references/confluence-formatting.md`, `references/confluence-api.md`

---

## Step 1: Gather Requirements

Collect the following from the user:

- **Space** — Confluence space key or ID (run `confluence.mjs spaces` if unknown)
- **Title** — page title
- **Parent page** — optional parent page ID for hierarchy
- **Document type** — Technical Document, ADR, Status Report, Meeting Notes, or custom
- **Content** — the information to include (text, data, decisions, etc.)
- **Local images/files** — any local files to attach (screenshots, diagrams, exports)

If the document type is unclear, suggest one based on the content.

## Step 2: Plan Document Structure

Consult `references/confluence-formatting.md` for the matching template.

Build an outline:

1. **Heading hierarchy** — h1 for title sections, h2 for major sections, h3 for subsections
2. **Macro placement** — where to use info/warning panels, expand sections, status lozenges
3. **Image placement** — which images go where, with sizing per the guidelines:
   - Screenshots: `800px` width
   - Diagrams: `600px` width
   - UI mockups: `700px` width
   - Icons/badges: `24–48px`
4. **Layout** — whether to use multi-column layout sections

Present the outline to the user and get confirmation before building.

## Step 3: Build Storage Format Body

Construct the complete storage format HTML:

1. Start with `<ac:structured-macro ac:name="toc">` if the document has 3+ sections
2. Use the appropriate template from `references/confluence-formatting.md` as a starting point
3. Replace placeholder content with actual content
4. Include `<ac:image>` tags for any images — use `<ri:attachment ri:filename="...">` for files that will be uploaded

If the body exceeds ~2000 characters, write it to a temporary file:

```bash
# Write body to temp file, then use --body-file
confluence.mjs create-page --space SPACE --title "Title" --body-file /tmp/confluence-body.html
```

For shorter content, pass directly via `--body`.

## Step 4: Create the Page

```bash
# With inline body
node <skill-path>/scripts/confluence.mjs create-page --space SPACE --title "Page Title" --body "<html content>"

# With body file (for long content)
node <skill-path>/scripts/confluence.mjs create-page --space SPACE --title "Page Title" --body-file /tmp/body.html

# With parent page
node <skill-path>/scripts/confluence.mjs create-page --space SPACE --title "Page Title" --body-file /tmp/body.html --parent 12345
```

Note the returned page ID — needed for attachment uploads.

## Step 5: Upload & Embed Images

For each local file that needs to be attached:

```bash
node <skill-path>/scripts/confluence.mjs attach <pageId> /path/to/screenshot.png --comment "Architecture diagram"
```

After all attachments are uploaded, update the page body to embed them with proper sizing:

```xml
<ac:image ac:width="800" ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="screenshot.png" />
</ac:image>
```

Size by content type:
- Screenshots → `800px`
- Diagrams/flowcharts → `600px`
- UI mockups → `700px`

Then update the page:

```bash
node <skill-path>/scripts/confluence.mjs update-page <pageId> --title "Page Title" --body-file /tmp/body-with-images.html
```

## Step 6: Review

Fetch the final page to verify:

```bash
node <skill-path>/scripts/confluence.mjs get-page <pageId> --format storage
```

Report to the user:
- Page URL (from the `_links.webui` field in the response)
- Summary of what was created
- List of attached files
- Ask if any adjustments are needed

If changes are requested, update the page body and/or re-upload attachments as needed.
