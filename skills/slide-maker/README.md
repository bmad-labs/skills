# Slide Maker

Build presentation slides and export them to editable PowerPoint, image PowerPoint,
standalone HTML, or PDF.

This is a Claude skill. You don't run it by hand: ask Claude for a deck, and it loads the
skill and does the work. This README explains what the skill contains.
[`SKILL.md`](SKILL.md) is what the agent actually follows.

Every slide is driven by design tokens rather than hardcoded colors or fonts, so the same
34 layouts re-skin by swapping one theme file. Bring your own design system or use the
bundled default.

## Getting a deck

Describe what you want. Claude picks the matching workflow.

```
"Help me build a deck to pitch our SaaS product to investors"
"I already have the outline, just build the slides"
"Export the deck in ./slides to PDF"
```

A full run goes brainstorm, then generate, then export. You can start at any step.

## Workflows

| Goal | Workflow |
|---|---|
| Decide what the deck says and how it's structured | `slide-brainstorm` |
| Build the slides and iterate on them | `slide-generate` |
| Editable PowerPoint, where the recipient can change text and shapes | `export-editable-pptx` |
| Pixel-perfect view-only PowerPoint | `export-image-pptx` |
| Single self-contained HTML file that opens offline | `export-standalone-html` |
| PDF for print or handout | `export-pdf` |

Step-by-step detail for each: [`references/workflows/`](references/workflows/).

## Design system resolution

At the start of brainstorm and generate, Claude works down this list and stops at the
first match:

1. Your own design system or brand tokens, mapped into the theme file.
2. A `nextlevelbuilder/ui-ux-pro-max-skill` suggestion, if that skill is installed.
3. A recommendation to install that skill.
4. A one-turn-only clone of it, with your explicit consent.
5. The bundled `clean-light` theme.

The last option is the floor, so the skill never blocks on a missing design system. The
active theme file is the single source of truth for color and type. Layouts never change;
only token values do.

## Review and feedback

When Claude shows you a deck, it runs a dev server with a point-and-comment overlay:

1. Open the deck. Claude gives you the URL, usually `http://localhost:5173/`.
2. Press `e` for edit mode. Click an element, Cmd-click several, or drag a box to snip an
   area. Type a comment, then press "Copy for AI".
3. Tell Claude to read the feedback. It sees which elements you meant and your snip image,
   and edits those elements directly.

Edit mode is a dev tool and is stripped from every export.

## Quality gates

A deck passes three checks before Claude hands it over. Each is blind to what the next
one catches.

- **Mechanical.** `check-slop` on the source, plus `validate-pptx.mjs` on the export:
  text position and size, colors, fills, icons, tables, wrapping, structure. Passes only
  when every issue is fixed or acknowledged with a written reason.
- **Visual.** Claude renders the slides and reviews the images, catching what the checker
  can't see: a clipped chip, an undersized hero, a flattened accent.
- **Diff.** `verify-export.mjs` renders the export back and diffs it against the HTML,
  slide by slide, ranked. Export drift is usually uniform, so it looks plausible on every
  slide individually and only shows up in the comparison.

## When not to use this

The editable PPTX export reconstructs each slide as native PowerPoint objects by measuring
the rendered DOM. It reaches roughly 96-98% visual fidelity on the bundled layouts, and the
validation gate exists because that last few percent needs a human decision. If you need a
PowerPoint that matches the HTML exactly, export image PPTX instead and give up
editability.

Slides are React components, so changing one means editing JSX. If you want a WYSIWYG
editor, use PowerPoint or Google Slides directly.

The tooling assumes a 1280x720 canvas. Other aspect ratios need changes across the theme,
the layouts, and the export scripts.

## Layout

```
slide-maker/
├── SKILL.md                    workflow router and craft rules (what the agent follows)
├── design-system/              the token-driven design kit
│   ├── tokens/                 colors, type, spacing, fonts
│   ├── themes/clean-light.css  bundled default theme
│   ├── slides/                 34 premade layouts as standalone HTML
│   ├── styles.css              token entry point for plain-HTML slides
│   └── assets/logos/           neutral placeholder marks
├── deck-template/              React and Tailwind deck, copied per project
│   └── scripts/                export, validation, and review tooling
├── references/                 docs the workflows load as needed
│   ├── workflows/              the 6 workflows above
│   ├── house-style.md          layout catalog and voice rules
│   ├── wow-guide.md            craft techniques
│   ├── tailwind-theme.md       the theme block for React decks
│   ├── validation.md           what check-slop enforces
│   ├── visual-review.md        how the visual pass works
│   └── pptx-editable.md        editable PPTX internals
└── research/                   dated proposals, evaluated but not built
```

If anything contradicts `design-system/tokens/` or the active theme, the token and theme
files win.

## House style

Light slides on a neutral ink scale, with one restrained accent hue (indigo in
`clean-light`) used sparingly. One focal point per slide, generous whitespace, calm
motion. No second typeface, no hardcoded color.

Full rules: [`references/house-style.md`](references/house-style.md) and
[`references/wow-guide.md`](references/wow-guide.md).

## Using only the design layer

Another slide generator can pull the tokens, components, and patterns from here and skip
its own theme selection, so its output uses a real design system. See
[`references/tailwind-theme.md`](references/tailwind-theme.md).

## Tooling prerequisites

The deck scripts need Node and Playwright. Rendering the editable PPTX for validation also
needs LibreOffice with `soffice` on `PATH`. From inside a copied deck:

```bash
npm install
npx playwright install chromium
```

Claude runs these as part of the workflows.
