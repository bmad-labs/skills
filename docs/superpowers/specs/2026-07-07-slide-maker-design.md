# slide-maker — Design Spec

**Date:** 2026-07-07
**Status:** Approved (brainstorm phase)
**Author:** Jarvis + TanNT

## Summary

`slide-maker` is a public, de-branded fork of the internal `mti-slide-maker` skill. It keeps
the full engine — brainstorm → generate → export (editable PPTX, image PPTX, standalone HTML,
PDF), with edit-mode, the anti-slop validator, and the geometry gate — but replaces the fixed
MTI Technology brand with a **pluggable design-system layer**.

It ships **34 neutral, token-driven base layouts** and a bundled **`clean-light`** default
theme, so it works standalone yet re-skins instantly to any design system: the user's own, one
suggested by `nextlevelbuilder/ui-ux-pro-max-skill`, or the bundled default.

Target location in this repo: `skills/slide-maker/`.

## Goals

- Publishable: zero MTI/MTV/robotics terms, brand colors, logos, or fonts anywhere in the skill
  (outside `node_modules`).
- Design-system agnostic: layouts reference CSS-variable tokens only; swapping the theme file
  re-skins every slide.
- Never blocks: there is always a working path down to the bundled `clean-light` theme.
- Keep the full capability of the source (all four exporters + quality tooling).

## Non-Goals

- No new export formats or new layout types beyond the 34 selected.
- No redesign of the export/validation pipeline logic — it is ported as-is, only de-branded and
  re-tokenized.
- Not shipping `node_modules` (users run `npm install`).

## Architecture — the pluggable design layer

The core idea: **decouple the layouts from the brand via CSS tokens.** Every layout references
only semantic tokens (`var(--color-accent)`, `var(--font-display)`, `var(--fs-h1)`,
`var(--space-8)`, …) and never a raw hex or font name. The active theme file supplies the token
values. Swap the theme → everything re-skins.

```
skills/slide-maker/
├── SKILL.md                      # de-branded; adds the DS-resolution flow + output-location ask
├── README.md                     # de-branded quick orientation
├── design-system/
│   ├── styles.css                # token entry point (imports the active theme)
│   ├── themes/
│   │   └── clean-light.css        # bundled neutral default: slate ink + indigo accent, system fonts
│   ├── tokens/                    # THE CONTRACT: colors / typography / spacing / fonts as CSS vars
│   │   ├── colors.css
│   │   ├── typography.css
│   │   ├── spacing.css
│   │   └── fonts.css
│   ├── slides/                    # 34 neutral base layouts: <name>.html + <name>.png preview
│   └── assets/logos/              # neutral placeholder marks (no MTI logo)
├── deck-template/                 # React deck + exporters (de-branded, tokenized)
│   ├── src/…                      # App, components, index.css — token-driven
│   ├── scripts/…                  # export/validate/inspect pipeline (logic unchanged)
│   ├── tailwind.config.js         # theme block reads tokens, not MTI hexes
│   └── package.json               # renamed; node_modules gitignored
├── references/                    # de-branded docs + workflows
│   └── workflows/                 # slide-brainstorm, slide-generate, 4 export workflows
└── evals/                         # de-branded eval cases
```

**The token contract is the seam.** The source already defines semantic aliases in `colors.css`
(`--color-accent`, `--text-primary`, `--surface-page`, …). The de-brand work is removing every
place MTI leaked *past* those aliases:
- 14 hardcoded hex values in `deck-template/src` + `deck-template/scripts`
- the brand block in `deck-template/tailwind.config.js` (`mti-green`, `mti-yellow`, …)
- `.mti-rule` and similar branded class names in `index.css`
- Noto Sans JP hardwiring (→ `var(--font-*)`, default = system stack, no webfont download)

## The design-system resolution flow

Runs at the start of the **brainstorm** and **generate** workflows. Resolution order:

```
1. Ask: "Do you have your own design system / brand tokens?"
   └─ YES → user points to it → map their tokens into the token contract → use it.
2. NO → is `ui-ux-pro-max-skill` installed?
   └─ YES → invoke it to suggest the best-fit design system for the deck's content/idea.
3. NOT installed → recommend it; guide permanent install from
   https://github.com/nextlevelbuilder/ui-ux-pro-max-skill  (the preferred path).
4. User declines permanent install → ASK before any network fetch →
   shallow `git clone` into /tmp → use it for THIS TURN ONLY (not persisted).
5. User declines the /tmp fetch too → fall back to the bundled `clean-light` theme.
```

Rules:
- Never perform the `/tmp` network fetch without explicit consent (step 4 asks first).
- The `/tmp` clone is ephemeral: used for the current turn, never copied into the skill or the
  user's project.
- `clean-light` is the guaranteed floor — the flow always terminates in a working theme.

**Mapping a design system into the contract:** whichever source is chosen (user's DS, a
ui-ux-pro-max suggestion, or clean-light), its values are written into
`design-system/themes/<active>.css` as the token variables the layouts consume. Layouts never
change; only the theme file does.

## The 34 base layouts

One neutral, token-only version each. Starts from the 17 numbered originals plus 17 high-value
base types. All MTI style-variants (minimal / bold-green / dark-rail / editorial / card-elevated)
and all robotics/tech-specific slides are dropped.

```
cover                 section-divider       agenda                agenda-rail
statement             three-column          four-column           metrics
hero-metrics          single-kpi-hero       kpi-row               content-image
comparison            comparison-table      two-panel-compare     problem-solution
before-after          quote                 pull-quote            feature-list
icon-grid             checklist             pillars               numbered-list
timeline              process-flow          roadmap-phases        bar-chart
line-chart            donut-chart           stat-callout          matrix-2x2
closing               persona
```

Each is:
- Rewritten to reference tokens only (no hardcoded color/font/spacing).
- Re-rendered to a fresh neutral PNG preview under `clean-light`.
- Kept at the source's fixed 1280×720 authoring frame.

## De-branding scope (mechanical, well-bounded)

Approx. 104 `mti`/`mtv` mentions across code files (mostly comments + copy), plus docs.

- Rename skill + all `mti-*` identifiers → `slide-maker` / neutral names.
- Replace 14 hardcoded hexes + the `tailwind.config.js` brand block + `.mti-rule` → token refs.
- Swap Noto Sans JP hardwiring → `var(--font-*)`; `clean-light` uses a system font stack (no
  webfont). Remove the Google Fonts `@import`.
- Replace MTI logos (`mti-logo-full.svg`, `mti-mark.svg`) with neutral placeholder marks.
- Rewrite `references/*` (~2,900 lines) + `README` to remove MTI/MTV terms and robotics examples;
  replace with neutral examples.
- De-brand `evals/evals.json`.
- Keep `node_modules` gitignored.

## Output location (ask-first)

At the start of the **generate** workflow, the skill asks the user where to scaffold the deck.

- **Default proposed:** `./slides/<deck-name>/` in the user's current project.
- **Exports:** `./slides/<deck-name>/export/`.
- User may override with any path.
- The skill copies the `deck-template/` scaffold to that location (not into the skill dir), so the
  install stays clean and multiple decks can coexist.

## Copy method

1. Copy the source tree **excluding** `deck-template/node_modules` (202MB) and the old MTI slide
   PNGs + all style-variant/robotics HTMLs.
2. Keep only the 34 selected base layout HTMLs (rebuild PNGs after de-tokenizing).
3. Apply the de-branding changes above.
4. Run `npm install` in `deck-template/` to validate the pipeline (node_modules stays gitignored).

## Testing

- **Theme-swap test:** render 3–4 layouts under `clean-light`, then under a second dummy theme →
  confirm zero hardcoded brand leaks (visuals fully change with the theme file).
- **Grep gate:** `grep -ri 'mti\|mtv\|noto sans\|00A73B\|00B050\|FABE00\|221815\|robot\|ros'`
  across the new skill (excluding `node_modules`) returns nothing.
- **Pipeline smoke test:** `npm install`; generate a 3-slide deck; run each exporter
  (editable PPTX, image PPTX, PDF, standalone HTML); run the slop + geometry gates.
- **Eye-check:** review rendered PNGs per the source's visual-review discipline (batched
  subagents for heavy images).

## Open risks

- **De-brand completeness in references:** 2,900 lines of docs carry MTI framing and robotics
  examples. Risk of a missed mention; the grep gate is the backstop.
- **Token coverage of layouts:** some layouts may rely on MTI-specific visual motifs (yellow
  dot-trail, green full-bleed dividers) that don't map cleanly to a neutral token. These get
  redesigned to a neutral equivalent, not carried over.
- **ui-ux-pro-max integration contract:** exact invocation/interface of that skill is unverified;
  the flow degrades gracefully to `clean-light` if it can't be driven.
