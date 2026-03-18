# Approach: Create Status Report Page with Two-Column Layout in Confluence (Without Skill)

## Task Summary

Create a status report page in the Confluence ENG space featuring a two-column layout with an overall status green lozenge on the left and sprint progress on the right, tables for completed and in-progress tickets, a warning panel for risks, and an embedded burndown chart image uploaded from `./charts/burndown.png` at 800px width.

## Desired Page Structure

### Two-Column Layout

**Left Column — Overall Status:**
- Green status lozenge indicating project health
- Summary text describing overall progress

**Right Column — Sprint Progress:**
- Sprint name, dates, and velocity metrics
- Percentage complete or story points remaining

### Completed Tickets Table

| Ticket | Summary | Assignee | Story Points |
|--------|---------|----------|-------------|
| ENG-101 | Implement auth flow | Alice | 5 |
| ENG-102 | Add unit tests | Bob | 3 |

### In-Progress Tickets Table

| Ticket | Summary | Assignee | Status | Story Points |
|--------|---------|----------|--------|-------------|
| ENG-103 | API refactor | Carol | In Review | 8 |
| ENG-104 | Dashboard UI | Dave | In Progress | 5 |

### Risks Warning Panel

- Dependency on external API delivery (due March 22)
- Two team members out next week

### Burndown Chart

Embedded image from uploaded `burndown.png` at 800px width.

---

## What I Would Need to Build (Confluence Storage Format)

The page body requires Atlassian Confluence storage format (XHTML) with layout macros, structured macros for lozenges and panels, tables, and image embedding. The full body would look like:

```xml
<ac:layout>
  <ac:layout-section ac:type="two_equal">
    <ac:layout-cell>
      <h2>Overall Status</h2>
      <p>
        <ac:structured-macro ac:name="status">
          <ac:parameter ac:name="colour">Green</ac:parameter>
          <ac:parameter ac:name="title">On Track</ac:parameter>
        </ac:structured-macro>
      </p>
      <p>Sprint is progressing well. All critical items on track for delivery.</p>
    </ac:layout-cell>
    <ac:layout-cell>
      <h2>Sprint Progress</h2>
      <p><strong>Sprint:</strong> Sprint 14</p>
      <p><strong>Dates:</strong> March 4 - March 18, 2026</p>
      <p><strong>Velocity:</strong> 34 / 42 story points completed</p>
      <p><strong>Completion:</strong> 81%</p>
    </ac:layout-cell>
  </ac:layout-section>
</ac:layout>

<h2>Completed Tickets</h2>
<table>
  <thead>
    <tr><th>Ticket</th><th>Summary</th><th>Assignee</th><th>Story Points</th></tr>
  </thead>
  <tbody>
    <tr><td>ENG-101</td><td>Implement auth flow</td><td>Alice</td><td>5</td></tr>
    <tr><td>ENG-102</td><td>Add unit tests</td><td>Bob</td><td>3</td></tr>
  </tbody>
</table>

<h2>In-Progress Tickets</h2>
<table>
  <thead>
    <tr><th>Ticket</th><th>Summary</th><th>Assignee</th><th>Status</th><th>Story Points</th></tr>
  </thead>
  <tbody>
    <tr><td>ENG-103</td><td>API refactor</td><td>Carol</td><td>In Review</td><td>8</td></tr>
    <tr><td>ENG-104</td><td>Dashboard UI</td><td>Dave</td><td>In Progress</td><td>5</td></tr>
  </tbody>
</table>

<ac:structured-macro ac:name="warning">
  <ac:parameter ac:name="title">Risks &amp; Blockers</ac:parameter>
  <ac:rich-text-body>
    <ul>
      <li>Dependency on external API delivery (due March 22)</li>
      <li>Two team members out next week — capacity reduced by 30%</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Burndown Chart</h2>
<ac:image ac:width="800">
  <ri:attachment ri:filename="burndown.png" />
</ac:image>
```

---

## Steps Required to Complete This Task

### Step 1: Save the Storage Format Body to a File

Because the storage format content is long and complex, it should be saved to a temporary file (e.g., `/tmp/status-report-body.html`) and passed via `--body-file` to avoid shell argument limits.

### Step 2: Create the Page in the ENG Space

```bash
confluence.mjs create-page --space ENG --title "Sprint 14 Status Report" --body-file /tmp/status-report-body.html
```

This returns the newly created page ID (e.g., `98765`).

### Step 3: Upload the Burndown Chart as an Attachment

```bash
confluence.mjs attach 98765 ./charts/burndown.png --comment "Sprint 14 burndown chart"
```

### Step 4: Update the Page to Embed the Image

The initial page body already contains the `<ac:image>` reference to `burndown.png`. However, the attachment must exist before Confluence can resolve the `<ri:attachment>` reference. Two strategies:

- **Strategy A:** Create the page without the image reference first, upload the attachment, then update the page body to include the `<ac:image>` tag. This guarantees the attachment exists when the page renders.
- **Strategy B:** Create the page with the full body including the image reference. If Confluence shows a broken image temporarily, update the page after uploading to force a re-render.

Strategy A is more reliable:

```bash
# Step 2: Create page WITHOUT the burndown chart section
confluence.mjs create-page --space ENG --title "Sprint 14 Status Report" --body-file /tmp/status-report-body-no-image.html
# Returns page ID, e.g., 98765

# Step 3: Upload the chart
confluence.mjs attach 98765 ./charts/burndown.png --comment "Sprint 14 burndown chart"

# Step 4: Update page WITH the full body including the image embed
confluence.mjs update-page 98765 --title "Sprint 14 Status Report" --body-file /tmp/status-report-body.html
```

### Step 5: Verify the Page

```bash
confluence.mjs get-page 98765 --format view
```

Confirm the layout, tables, lozenge, warning panel, and embedded image all render correctly.

---

## What Is Actually Blocked (Without Specialized Tooling)

Without the Atlassian REST skill or any MCP plugin, I **cannot execute any of these steps**:

1. **No authentication** -- I have no Confluence API token, OAuth credentials, or session cookie to authenticate REST API calls.
2. **No instance URL** -- I do not know which Confluence cloud site to target (e.g., `https://company.atlassian.net`).
3. **No helper scripts** -- The `confluence.mjs` script (which handles auth, API versioning, body-file loading, and attachment uploads) is not available without the skill installed.
4. **No reference documentation** -- I cannot consult `references/confluence-formatting.md` for the correct storage format syntax for layout macros, status lozenges, warning panels, or image embedding. The storage format XML above is reconstructed from general Confluence knowledge and may have syntax issues.
5. **No space verification** -- I cannot confirm the ENG space exists or retrieve its space key/ID.
6. **No file upload capability** -- I cannot upload `./charts/burndown.png` to a Confluence page without an authenticated REST client that supports multipart form uploads.
7. **No page update for image embed** -- The two-step create-then-update flow requires script tooling to manage page versions automatically.

## What the Atlassian Skill Would Provide

If the atlassian-rest skill were available, I could:

1. **Read `references/confluence-formatting.md`** to get the exact storage format syntax for layouts, lozenges, panels, tables, and image macros -- ensuring the body is correct.
2. **Use `confluence.mjs create-page`** with `--body-file` to create the page with the full storage format content in the ENG space.
3. **Use `confluence.mjs attach`** to upload `./charts/burndown.png` to the newly created page.
4. **Use `confluence.mjs update-page`** with `--body-file` to update the page body with the `<ac:image>` embed referencing the uploaded attachment at 800px width.
5. **Use `confluence.mjs get-page`** to verify the final result.
6. **Follow the `workflows/create-confluence-document.md`** workflow for a structured process that handles all of these steps in the correct order.

## Conclusion

Without the Atlassian skill, this task **cannot be completed**. The approach above documents the exact storage format body, the multi-step execution plan (create page, upload attachment, update page with image embed), and the specific script commands that would be needed. A human would need to either install the atlassian-rest skill, use the Atlassian MCP plugin, or manually create the page in the Confluence web editor.
