# Confluence Storage Format — Macros, Layouts & Document Templates

Complete reference for building professional Confluence pages using storage format XHTML.

---

## Table of Contents Macro

Add at the top of any document with 3+ sections:

```xml
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
  <ac:parameter ac:name="minLevel">1</ac:parameter>
</ac:structured-macro>
```

---

## Info / Warning / Note / Tip Panels

### Info Panel

```xml
<ac:structured-macro ac:name="info">
  <ac:parameter ac:name="title">Important Note</ac:parameter>
  <ac:rich-text-body>
    <p>This is an informational message with context the reader should know.</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Warning Panel

```xml
<ac:structured-macro ac:name="warning">
  <ac:parameter ac:name="title">Caution</ac:parameter>
  <ac:rich-text-body>
    <p>This action is irreversible. Proceed with care.</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Note Panel

```xml
<ac:structured-macro ac:name="note">
  <ac:parameter ac:name="title">Note</ac:parameter>
  <ac:rich-text-body>
    <p>Additional context that may be helpful but is not critical.</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Tip Panel

```xml
<ac:structured-macro ac:name="tip">
  <ac:parameter ac:name="title">Pro Tip</ac:parameter>
  <ac:rich-text-body>
    <p>A best practice or shortcut the reader may find useful.</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

---

## Expand / Collapse Sections

```xml
<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">Click to expand details</ac:parameter>
  <ac:rich-text-body>
    <p>Hidden content revealed on click. Use for lengthy details, raw logs, or supplementary information.</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

---

## Status Lozenges

Inline coloured badges for status indicators:

```xml
<ac:structured-macro ac:name="status">
  <ac:parameter ac:name="colour">Green</ac:parameter>
  <ac:parameter ac:name="title">DONE</ac:parameter>
</ac:structured-macro>
```

| Colour | Typical Use |
|--------|-------------|
| `Green` | Done, Approved, Healthy |
| `Yellow` | In Progress, Pending, At Risk |
| `Red` | Blocked, Failed, Critical |
| `Blue` | New, Info, Planned |
| `Grey` | Deferred, N/A, Unknown |

---

## Code Blocks

```xml
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:parameter ac:name="title">Example</ac:parameter>
  <ac:parameter ac:name="linenumbers">true</ac:parameter>
  <ac:plain-text-body><![CDATA[function hello() {
  console.log("Hello, world!");
}]]></ac:plain-text-body>
</ac:structured-macro>
```

Supported languages: `javascript`, `typescript`, `python`, `java`, `bash`, `sql`, `json`, `xml`, `html`, `css`, `go`, `rust`, `c`, `cpp`, and more.

---

## Panel Macro

Generic styled container with background colour and border:

```xml
<ac:structured-macro ac:name="panel">
  <ac:parameter ac:name="bgColor">#f0f0f0</ac:parameter>
  <ac:parameter ac:name="borderStyle">solid</ac:parameter>
  <ac:parameter ac:name="borderColor">#cccccc</ac:parameter>
  <ac:parameter ac:name="titleBGColor">#e0e0e0</ac:parameter>
  <ac:parameter ac:name="title">Section Title</ac:parameter>
  <ac:rich-text-body>
    <p>Panel content goes here.</p>
  </ac:rich-text-body>
</ac:structured-macro>
```

---

## Multi-Column Layouts

### Two Equal Columns

```xml
<ac:layout>
  <ac:layout-section ac:type="two_equal">
    <ac:layout-cell><p>Left column content</p></ac:layout-cell>
    <ac:layout-cell><p>Right column content</p></ac:layout-cell>
  </ac:layout-section>
</ac:layout>
```

### Three Equal Columns

```xml
<ac:layout>
  <ac:layout-section ac:type="three_equal">
    <ac:layout-cell><p>Column 1</p></ac:layout-cell>
    <ac:layout-cell><p>Column 2</p></ac:layout-cell>
    <ac:layout-cell><p>Column 3</p></ac:layout-cell>
  </ac:layout-section>
</ac:layout>
```

### Sidebar Layout (wide + narrow)

```xml
<ac:layout>
  <ac:layout-section ac:type="two_left_sidebar">
    <ac:layout-cell><p>Sidebar content</p></ac:layout-cell>
    <ac:layout-cell><p>Main content</p></ac:layout-cell>
  </ac:layout-section>
</ac:layout>
```

Other types: `two_right_sidebar`, `single`.

---

## Image Embedding

### Attached Images (uploaded to the page)

```xml
<ac:image ac:width="800" ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="screenshot.png" />
</ac:image>
```

### External URL Images

```xml
<ac:image ac:width="800" ac:align="center">
  <ri:url ri:value="https://example.com/image.png" />
</ac:image>
```

### Image Sizing Guidelines (1920x1080 screens)

| Content Type | Recommended Width | Notes |
|---|---|---|
| Full-width screenshots | `800` | Fills ~60% of content area, text remains readable |
| Diagrams / flowcharts | `600` | Balanced with surrounding text |
| UI mockups | `700` | Large enough for UI detail |
| Icons / badges | `24`–`48` | Inline with text |
| Thumbnails | `200`–`300` | For image galleries or side-by-side comparisons |

Always set `ac:align="center"` for standalone images. Omit `ac:width` to use natural size.

---

## Tables

Standard XHTML tables — Confluence renders them with default styling:

```xml
<table>
  <thead>
    <tr>
      <th>Header 1</th>
      <th>Header 2</th>
      <th>Header 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Cell 1</td>
      <td>Cell 2</td>
      <td>Cell 3</td>
    </tr>
  </tbody>
</table>
```

For coloured header rows, add inline styles:

```xml
<th style="background-color: #f4f5f7; font-weight: bold;">Header</th>
```

---

## Document Templates

### Technical Document

```xml
<ac:structured-macro ac:name="toc">
  <ac:parameter ac:name="maxLevel">3</ac:parameter>
</ac:structured-macro>

<h1>Overview</h1>
<ac:structured-macro ac:name="info">
  <ac:parameter ac:name="title">Summary</ac:parameter>
  <ac:rich-text-body>
    <p>Brief one-paragraph summary of the document purpose and scope.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Background</h2>
<p>Context and motivation.</p>

<h2>Technical Details</h2>
<p>Core content with diagrams and code.</p>

<ac:structured-macro ac:name="expand">
  <ac:parameter ac:name="title">Implementation Details</ac:parameter>
  <ac:rich-text-body>
    <p>Detailed implementation notes, configuration examples, raw data.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>References</h2>
<table><thead><tr><th>Resource</th><th>Link</th></tr></thead>
<tbody><tr><td>API Docs</td><td><a href="https://example.com">Link</a></td></tr></tbody></table>
```

### Architecture Decision Record (ADR)

```xml
<p><strong>Status:</strong>
<ac:structured-macro ac:name="status">
  <ac:parameter ac:name="colour">Green</ac:parameter>
  <ac:parameter ac:name="title">ACCEPTED</ac:parameter>
</ac:structured-macro></p>

<h2>Context</h2>
<p>What is the issue or decision that needs to be made?</p>

<h2>Decision</h2>
<ac:structured-macro ac:name="info">
  <ac:rich-text-body><p>We will use X because Y.</p></ac:rich-text-body>
</ac:structured-macro>

<h2>Consequences</h2>
<ac:structured-macro ac:name="tip">
  <ac:parameter ac:name="title">Benefits</ac:parameter>
  <ac:rich-text-body><ul><li>Benefit 1</li><li>Benefit 2</li></ul></ac:rich-text-body>
</ac:structured-macro>
<ac:structured-macro ac:name="warning">
  <ac:parameter ac:name="title">Trade-offs</ac:parameter>
  <ac:rich-text-body><ul><li>Trade-off 1</li><li>Trade-off 2</li></ul></ac:rich-text-body>
</ac:structured-macro>
```

### Status Report

```xml
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
<table><thead><tr><th>Ticket</th><th>Summary</th><th>Status</th></tr></thead>
<tbody><tr><td>PROJ-101</td><td>Feature X</td><td>Done</td></tr></tbody></table>

<h2>In Progress</h2>
<table><thead><tr><th>Ticket</th><th>Summary</th><th>Assignee</th><th>ETA</th></tr></thead>
<tbody><tr><td>PROJ-102</td><td>Feature Y</td><td>Alice</td><td>Mar 20</td></tr></tbody></table>

<ac:structured-macro ac:name="warning">
  <ac:parameter ac:name="title">Risks &amp; Blockers</ac:parameter>
  <ac:rich-text-body>
    <ul><li><strong>PROJ-103:</strong> Blocked on external API access</li></ul>
  </ac:rich-text-body>
</ac:structured-macro>
```

### Meeting Notes

```xml
<table><thead><tr><th>Field</th><th>Value</th></tr></thead>
<tbody>
<tr><td><strong>Date</strong></td><td>2025-03-15</td></tr>
<tr><td><strong>Attendees</strong></td><td>Alice, Bob, Carol</td></tr>
<tr><td><strong>Facilitator</strong></td><td>Alice</td></tr>
</tbody></table>

<h2>Agenda</h2>
<ol><li>Topic 1</li><li>Topic 2</li></ol>

<h2>Discussion</h2>
<h3>Topic 1</h3>
<p>Notes from the discussion.</p>

<h2>Action Items</h2>
<table><thead><tr><th>Action</th><th>Owner</th><th>Due Date</th><th>Status</th></tr></thead>
<tbody>
<tr><td>Follow up on X</td><td>Bob</td><td>Mar 20</td>
<td><ac:structured-macro ac:name="status">
  <ac:parameter ac:name="colour">Yellow</ac:parameter>
  <ac:parameter ac:name="title">PENDING</ac:parameter>
</ac:structured-macro></td></tr>
</tbody></table>

<ac:structured-macro ac:name="info">
  <ac:parameter ac:name="title">Key Decisions</ac:parameter>
  <ac:rich-text-body>
    <ul><li>Decision 1: We agreed to proceed with option A</li></ul>
  </ac:rich-text-body>
</ac:structured-macro>
```
