# Approach: Create Status Report Page in Confluence with Two-Column Layout

## Overview

Create a professional status report page in the Confluence **ENG** space using the atlassian-rest skill. The page features a two-column layout with overall status and sprint progress, tables for completed and in-progress tickets, a warning panel for risks, and an embedded burndown chart image uploaded as an attachment.

## Workflow Used

**Create Confluence Document** (`workflows/create-confluence-document.md`)

## Reference Material

- `references/confluence-formatting.md` — Status Report template, layout macros, image embedding, status lozenges, warning panels, tables

---

## Step 1: Gather Requirements (Workflow Step 1)

All requirements are provided in the task:

- **Space:** `ENG`
- **Title:** Status Report (e.g., "Sprint 14 Status Report — 2026-03-18")
- **Document type:** Status Report
- **Layout:** Two-column layout — overall status (green lozenge) on left, sprint progress on right
- **Content sections:** Completed tickets table, in-progress tickets table, risks/blockers warning panel
- **Attachments:** `./charts/burndown.png` — embedded at 800px width

No ambiguity to resolve; all parameters are specified.

## Step 2: Plan Document Structure (Workflow Step 2)

Based on the Status Report template in `references/confluence-formatting.md`:

1. **Two-column layout section** (`ac:layout` with `two_equal` type)
   - Left cell: "Overall Status" heading + green status lozenge (ON TRACK)
   - Right cell: "Sprint Progress" heading + sprint details text
2. **Completed This Week** section — `<h2>` heading + table with Ticket, Summary, Status columns
3. **In Progress** section — `<h2>` heading + table with Ticket, Summary, Assignee, ETA columns
4. **Risks & Blockers** — warning panel macro listing risk items
5. **Burndown Chart** section — `<h2>` heading + embedded image from attachment at 800px

## Step 3: Build Storage Format Body (Workflow Step 3)

Write the full storage-format HTML to a temporary file since it exceeds 2000 characters.

```bash
cat > /tmp/confluence-status-report-body.html << 'HTMLEOF'
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
  <ac:parameter ac:name="minLevel">1</ac:parameter>
</ac:structured-macro>

<ac:layout>
  <ac:layout-section ac:type="two_equal">
    <ac:layout-cell>
      <h3>Overall Status</h3>
      <p><ac:structured-macro ac:name="status">
        <ac:parameter ac:name="colour">Green</ac:parameter>
        <ac:parameter ac:name="title">ON TRACK</ac:parameter>
      </ac:structured-macro></p>
    </ac:layout-cell>
    <ac:layout-cell>
      <h3>Sprint Progress</h3>
      <p>Sprint 14 — Day 7 of 10</p>
    </ac:layout-cell>
  </ac:layout-section>
</ac:layout>

<h2>Completed This Week</h2>
<table>
  <thead>
    <tr>
      <th style="background-color: #f4f5f7; font-weight: bold;">Ticket</th>
      <th style="background-color: #f4f5f7; font-weight: bold;">Summary</th>
      <th style="background-color: #f4f5f7; font-weight: bold;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>ENG-101</td>
      <td>Implement user authentication</td>
      <td><ac:structured-macro ac:name="status">
        <ac:parameter ac:name="colour">Green</ac:parameter>
        <ac:parameter ac:name="title">DONE</ac:parameter>
      </ac:structured-macro></td>
    </tr>
    <tr>
      <td>ENG-104</td>
      <td>Fix session timeout handling</td>
      <td><ac:structured-macro ac:name="status">
        <ac:parameter ac:name="colour">Green</ac:parameter>
        <ac:parameter ac:name="title">DONE</ac:parameter>
      </ac:structured-macro></td>
    </tr>
  </tbody>
</table>

<h2>In Progress</h2>
<table>
  <thead>
    <tr>
      <th style="background-color: #f4f5f7; font-weight: bold;">Ticket</th>
      <th style="background-color: #f4f5f7; font-weight: bold;">Summary</th>
      <th style="background-color: #f4f5f7; font-weight: bold;">Assignee</th>
      <th style="background-color: #f4f5f7; font-weight: bold;">ETA</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>ENG-102</td>
      <td>API rate limiting middleware</td>
      <td>Alice</td>
      <td>Mar 20</td>
    </tr>
    <tr>
      <td>ENG-105</td>
      <td>Dashboard analytics integration</td>
      <td>Bob</td>
      <td>Mar 22</td>
    </tr>
  </tbody>
</table>

<ac:structured-macro ac:name="warning">
  <ac:parameter ac:name="title">Risks &amp; Blockers</ac:parameter>
  <ac:rich-text-body>
    <ul>
      <li><strong>ENG-103:</strong> Blocked on external payment API access — awaiting vendor credentials</li>
      <li><strong>ENG-106:</strong> Performance regression in search — needs investigation before release</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Burndown Chart</h2>
<ac:image ac:width="800" ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="burndown.png" />
</ac:image>
HTMLEOF
```

**Key formatting decisions from `references/confluence-formatting.md`:**

- **Two-column layout:** Uses `<ac:layout>` with `<ac:layout-section ac:type="two_equal">` and two `<ac:layout-cell>` elements
- **Green status lozenge:** `<ac:structured-macro ac:name="status">` with `colour=Green` and `title=ON TRACK`
- **Tables:** Standard XHTML `<table>` with styled header rows (`background-color: #f4f5f7`)
- **Warning panel:** `<ac:structured-macro ac:name="warning">` with `<ac:rich-text-body>` containing bulleted risks
- **Image embed:** `<ac:image ac:width="800" ac:align="center" ac:layout="center">` with `<ri:attachment ri:filename="burndown.png" />` — uses the 800px screenshot guideline from the sizing table

## Step 4: Create the Page (Workflow Step 4)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs \
  create-page \
  --space ENG \
  --title "Sprint 14 Status Report — 2026-03-18" \
  --body-file /tmp/confluence-status-report-body.html
```

Uses `--body-file` because the body content is lengthy (well over 2000 characters). Record the returned **page ID** from the response for use in subsequent steps.

## Step 5: Upload Burndown Chart & Update Page (Workflow Step 5)

### 5a. Upload the burndown chart as an attachment

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs \
  attach <pageId> \
  ./charts/burndown.png \
  --comment "Sprint 14 burndown chart"
```

Replace `<pageId>` with the actual page ID returned from Step 4.

### 5b. Update page body (if needed)

The page body already references `burndown.png` via `<ri:attachment ri:filename="burndown.png" />`. If the attachment filename differs from what was referenced, update the body:

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs \
  update-page <pageId> \
  --title "Sprint 14 Status Report — 2026-03-18" \
  --body-file /tmp/confluence-status-report-body.html
```

In practice, since the `ri:filename` matches the uploaded file, the image will render correctly without an additional update. The update step is only needed if the attachment filename needs correction.

## Step 6: Verify the Page (Workflow Step 6)

```bash
node /Users/tannt/Works/GIT/Personal/Sources/bmad-skills/skills/atlassian-rest/scripts/confluence.mjs \
  get-page <pageId> --format storage
```

Verify:
- Two-column layout renders with status lozenge on left and sprint info on right
- Both tables (completed, in-progress) display with styled headers
- Warning panel shows risks with bold ticket keys
- Burndown chart image renders at 800px width, centered
- Page URL is available from the `_links.webui` field

Report the page URL to the user and ask if adjustments are needed.

---

## Command Summary

| Step | Command | Purpose |
|------|---------|---------|
| 3 | `cat > /tmp/confluence-status-report-body.html` | Write storage-format HTML body to temp file |
| 4 | `confluence.mjs create-page --space ENG --title "..." --body-file /tmp/...` | Create the page in ENG space |
| 5a | `confluence.mjs attach <pageId> ./charts/burndown.png --comment "..."` | Upload the burndown chart |
| 5b | `confluence.mjs update-page <pageId> --title "..." --body-file /tmp/...` | Update body if attachment name correction needed |
| 6 | `confluence.mjs get-page <pageId> --format storage` | Verify final page content |

## Confluence Formatting Features Used

| Feature | Macro/Element | Reference |
|---------|---------------|-----------|
| Two-column layout | `<ac:layout>` with `two_equal` section type | `confluence-formatting.md` — Multi-Column Layouts |
| Green status lozenge | `<ac:structured-macro ac:name="status">` with `colour=Green` | `confluence-formatting.md` — Status Lozenges |
| Styled tables | `<table>` with `<th style="background-color: #f4f5f7">` headers | `confluence-formatting.md` — Tables |
| Warning panel | `<ac:structured-macro ac:name="warning">` | `confluence-formatting.md` — Warning Panel |
| Image embed (attachment) | `<ac:image ac:width="800">` with `<ri:attachment>` | `confluence-formatting.md` — Image Embedding |
| Table of contents | `<ac:structured-macro ac:name="toc">` | `confluence-formatting.md` — Table of Contents Macro |
