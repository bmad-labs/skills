# Approach: Upload Architecture Diagram and Embed in Confluence Page

## Task Summary

Upload the file `./docs/arch-diagram.png` as an attachment to Confluence page 54321, then update the page body to embed the image at 600px width, centered.

## Skill Reference

The atlassian-rest skill provides two relevant commands via `confluence.mjs`:

1. **`attach`** — Uploads a local file to a Confluence page as an attachment.
2. **`update-page`** — Updates the page body (and optionally title) using Confluence storage format XHTML.

The `references/confluence-formatting.md` document specifies the exact storage format markup for embedding attached images with sizing and alignment.

## Step-by-Step Approach

### Step 1: Upload the Attachment

Use the `attach` command to upload the PNG file to the target page.

```bash
node <skill-path>/scripts/confluence.mjs attach 54321 ./docs/arch-diagram.png --comment "Architecture diagram"
```

**Arguments:**
- `54321` — The Confluence page ID to attach the file to.
- `./docs/arch-diagram.png` — Local file path to the image.
- `--comment "Architecture diagram"` — Optional comment describing the attachment.

**Expected result:** The file `arch-diagram.png` is uploaded as an attachment on page 54321. The script returns confirmation with the attachment metadata.

### Step 2: Retrieve Current Page Content

Before updating the page, fetch its current body so we can append (or insert) the image embed without overwriting existing content.

```bash
node <skill-path>/scripts/confluence.mjs get-page 54321
```

**Arguments:**
- `54321` — The page ID.

**Expected result:** Returns the page title, version, and current body in storage format. We need the title (required for update) and the existing body HTML to preserve it.

### Step 3: Update the Page Body to Embed the Image

Using the Confluence storage format for attached images (from `references/confluence-formatting.md`), construct the embed markup and append it to the existing page body.

The image embed markup for a 600px centered attached image is:

```xml
<ac:image ac:width="600" ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="arch-diagram.png" />
</ac:image>
```

**Formatting rationale (from reference doc):**
- Width `600` — Recommended for diagrams/flowcharts per the sizing guidelines table: "Diagrams / flowcharts → 600 — Balanced with surrounding text."
- `ac:align="center"` — Per the reference: "Always set `ac:align="center"` for standalone images."
- `ac:layout="center"` — Matches the attached image example pattern in the reference.
- `ri:attachment ri:filename="arch-diagram.png"` — References the uploaded attachment by filename.

Compose the full updated body by appending the image embed to the existing content. Write it to a temp file to avoid shell escaping issues with the XHTML:

```bash
# Write the new body (existing content + image embed) to a temp file
cat > /tmp/page-54321-body.html << 'BODY_EOF'
<!-- existing page body content preserved here -->

<h2>Architecture Diagram</h2>
<ac:image ac:width="600" ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="arch-diagram.png" />
</ac:image>
BODY_EOF
```

Then update the page:

```bash
node <skill-path>/scripts/confluence.mjs update-page 54321 --title "Existing Page Title" --body-file /tmp/page-54321-body.html
```

**Arguments:**
- `54321` — The page ID.
- `--title "Existing Page Title"` — The current page title (retrieved in Step 2; required by the update command).
- `--body-file /tmp/page-54321-body.html` — Path to the file containing the full updated body HTML. Using `--body-file` instead of `--body` avoids shell argument limits and XHTML escaping issues.

**Note:** The version number is auto-incremented by the script — no need to track it manually.

### Step 4: Verify the Update

Fetch the page again to confirm the image embed is present:

```bash
node <skill-path>/scripts/confluence.mjs get-page 54321 --format view
```

Verify that:
- The attachment `arch-diagram.png` appears in the page attachments.
- The page body contains the `<ac:image>` element referencing the attachment.
- The width is set to 600 and alignment is centered.

## Complete Command Sequence

```bash
# 1. Upload the image as an attachment
node <skill-path>/scripts/confluence.mjs attach 54321 ./docs/arch-diagram.png --comment "Architecture diagram"

# 2. Get current page content (need title and existing body)
node <skill-path>/scripts/confluence.mjs get-page 54321

# 3. Write updated body to temp file (preserving existing content + adding image)
cat > /tmp/page-54321-body.html << 'BODY_EOF'
[EXISTING PAGE BODY CONTENT]

<h2>Architecture Diagram</h2>
<ac:image ac:width="600" ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="arch-diagram.png" />
</ac:image>
BODY_EOF

# 4. Update the page with the new body
node <skill-path>/scripts/confluence.mjs update-page 54321 --title "[EXISTING TITLE]" --body-file /tmp/page-54321-body.html

# 5. Verify the result
node <skill-path>/scripts/confluence.mjs get-page 54321 --format view
```

## Key Decisions

1. **Used `--body-file` over `--body`** — The XHTML storage format with `ac:` namespaced tags would be mangled by shell interpolation. The `--body-file` flag is the safe approach per the SKILL.md: "Use `--body-file` for long documents that would exceed shell argument limits."

2. **Preserved existing page content** — The update-page command replaces the entire body, so we must first GET the current body and merge the image embed into it, rather than sending only the image markup (which would wipe the page).

3. **Used `ac:width="600"` for the diagram** — The `references/confluence-formatting.md` sizing guidelines table explicitly recommends width `600` for "Diagrams / flowcharts" as "Balanced with surrounding text."

4. **Used both `ac:align="center"` and `ac:layout="center"`** — Following the exact pattern from the reference doc's attached image example, which includes both attributes for proper centering.

5. **Added an `<h2>` heading before the image** — Provides a labeled section for the diagram, following the technical document template pattern from the reference.

6. **Confirmed before mutating** — Per SKILL.md principle #2: "Before creating issues, transitioning tickets, or publishing Confluence pages, show the user what you're about to do and get confirmation."
