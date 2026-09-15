# slide-maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, de-branded `slide-maker` skill from `mti-slide-maker` — same brainstorm→generate→export engine, but with a pluggable design-system layer, 34 neutral token-driven layouts, and a bundled `clean-light` default theme.

**Architecture:** Copy the source tree (excluding `node_modules` and dropped slides), then decouple every layout and template from the MTI brand via a CSS-variable token contract. The active theme file supplies token values; layouts reference tokens only. A design-system resolution flow (user's DS → ui-ux-pro-max → guide install → `/tmp` clone → `clean-light`) picks the theme at runtime. The generate workflow asks where to scaffold the deck (default `./slides/<deck-name>/`).

**Tech Stack:** HTML/CSS (token-driven layouts), React + Vite + Tailwind (deck template), Node ESM scripts (exporters/validators), Playwright/Puppeteer-based render pipeline (inherited from source).

## Global Constraints

- Skill directory: `skills/slide-maker/` (in this repo, `bmad-skills`).
- Source to copy from: `/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker/`.
- **Zero brand leaks:** no `mti`, `mtv`, `noto sans`, `robot`, `ros`, or MTI hex values (`00A73B`, `00B050`, `007A2B`, `FABE00`, `221815`, `0070C0`, `F2F0ED`) anywhere outside `node_modules`. This is the grep gate.
- **Token-only layouts:** every `design-system/slides/*.html` references CSS variables only — no raw hex, no font names, no magic pixel colors.
- **Never ship `node_modules`:** keep it gitignored; users run `npm install`.
- Bundled default theme = `clean-light`: neutral slate ink + one indigo accent + system font stack (no webfont `@import`).
- Fixed authoring frame: 1280×720 (do not change).
- 34 base layouts exactly (list in Task 5). One neutral version each.
- Skill name `slide-maker`; deck package name `slide-deck`.
- End every commit message with the Co-Authored-By trailer for Claude.

---

### Task 1: Copy source tree, prune, register skill skeleton

**Files:**
- Create: `skills/slide-maker/` (whole tree, copied + pruned)
- Create: `skills/slide-maker/deck-template/.gitignore` (ensure `node_modules` ignored)
- Test: shell assertions below

**Interfaces:**
- Produces: the working directory `skills/slide-maker/` with `SKILL.md`, `README.md`, `design-system/`, `deck-template/` (no `node_modules`), `references/`, `evals/`. All still MTI-branded — de-branding happens in later tasks.

- [ ] **Step 1: Copy the source tree excluding node_modules and OS cruft**

```bash
SRC=/Users/tannt/Work/GIT/MTI-Robot/Sources/mtv-robot-the-forge/.agents/skills/mti-slide-maker
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
mkdir -p "$DST"
rsync -a --exclude 'node_modules' --exclude '.DS_Store' --exclude '.git' "$SRC/" "$DST/"
```

- [ ] **Step 2: Prune the dropped slide layouts — keep only the 17 numbered originals**

The 34-layout catalog is built in Task 5. For now, delete every style-variant and robotics/tech slide (numbered 018+), keeping the 17 originals (`01-` … `17-`) as the rebuild base.

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
cd "$DST/design-system/slides"
# keep only 01-..17- prefixed files; delete the rest (018+ variants, robotics, etc.)
ls | grep -vE '^(0[1-9]|1[0-7])-' | xargs -r rm -f
ls | wc -l   # expect 34 (17 html + 17 png)
```

- [ ] **Step 3: Remove source-only matrix/generator scratch files**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
cd "$DST/design-system"
rm -f _matrix.mjs _matrix-tech.mjs _matrix-extra.mjs wave-log.md CONVERT-TO-JSX.md SOURCE.json layouts.csv 2>/dev/null || true
```

- [ ] **Step 4: Verify structure and size**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
test -f "$DST/SKILL.md" && test -d "$DST/deck-template/scripts" && test -d "$DST/design-system/slides" && echo "structure OK"
test ! -d "$DST/deck-template/node_modules" && echo "no node_modules OK"
du -sh "$DST"   # expect well under 50MB
grep -q 'node_modules' "$DST/deck-template/.gitignore" && echo "gitignore OK"
```
Expected: `structure OK`, `no node_modules OK`, size < 50MB, `gitignore OK`.

- [ ] **Step 5: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker
git commit -m "chore(slide-maker): copy + prune source tree (pre-debrand)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Neutralize the design-system token files (the contract)

**Files:**
- Modify: `skills/slide-maker/design-system/tokens/colors.css`
- Modify: `skills/slide-maker/design-system/tokens/typography.css`
- Modify: `skills/slide-maker/design-system/tokens/spacing.css`
- Modify: `skills/slide-maker/design-system/tokens/fonts.css`
- Modify: `skills/slide-maker/design-system/styles.css`
- Test: grep assertions

**Interfaces:**
- Produces: a neutral token contract. Semantic aliases keep their names (`--color-accent`, `--text-primary`, `--surface-page`, `--font-display`, `--fs-h1`, `--space-8`, `--radius-md`, `--shadow-md`, `--rule-accent-w`) so all layouts and the deck template resolve against them unchanged. Raw brand values are replaced with neutral `clean-light` values.

- [ ] **Step 1: Rewrite `colors.css` — neutral clean-light palette, keep alias names**

Replace the MTI brand core + green/yellow scales with a neutral slate + single indigo accent. Keep every semantic alias name identical. Example target for the top of the file:

```css
/* ============================================================
   slide-maker — Color tokens (clean-light default theme)
   Neutral, unbranded. Swap this file (or override the aliases)
   to re-skin every slide. Aliases at the bottom are the contract.
   ============================================================ */
:root {
  /* ---- Accent (single restrained hue) ---- */
  --accent-500: #4F46E5;   /* indigo — primary accent            */
  --accent-600: #4338CA;   /* pressed / darker accent            */
  --accent-050: #EEF2FF;   /* soft accent wash                   */

  /* ---- Neutral / ink scale (slate) ---- */
  --ink-900: #0F172A;
  --ink-800: #1E293B;
  --ink-700: #334155;
  --ink-600: #475569;
  --ink-500: #64748B;
  --ink-400: #94A3B8;
  --ink-300: #CBD5E1;
  --ink-200: #E2E8F0;
  --ink-100: #F1F5F9;
  --ink-50:  #F8FAFC;
  --white:   #FFFFFF;

  /* ---- Semantic data / status ---- */
  --status-positive: #16A34A;
  --status-info:     #2563EB;
  --status-warning:  #D97706;
  --status-danger:   #DC2626;

  /* ---- Semantic aliases (THE CONTRACT — components/slides use these) ---- */
  --color-accent:        var(--accent-500);
  --color-accent-bright: var(--accent-500);
  --color-accent-soft:   var(--accent-050);

  --text-primary:   var(--ink-900);
  --text-secondary: var(--ink-600);
  --text-muted:     var(--ink-500);
  --text-inverse:   var(--white);
  --text-on-accent: var(--white);
  --text-accent:    var(--accent-600);

  --surface-page:   var(--white);
  --surface-card:   var(--white);
  --surface-subtle: var(--ink-50);
  --surface-muted:  var(--ink-100);
  --surface-ink:    var(--ink-900);
  --surface-accent: var(--accent-500);

  --border-subtle:  var(--ink-200);
  --border-default: var(--ink-300);
  --border-strong:  var(--ink-900);
  --border-accent:  var(--accent-500);
}
```

- [ ] **Step 2: Rewrite `fonts.css` — system stack, no webfont**

```css
/* ============================================================
   slide-maker — Fonts (clean-light default)
   Default uses the system stack (no network fetch). A design
   system can override --font-* in its own theme file.
   ============================================================ */
/* No @import: system fonts only by default. */
```

- [ ] **Step 3: Rewrite `typography.css` families — drop Noto Sans JP**

Replace the `--font-sans` / `--font-display` / `--font-mono` block; keep the whole type scale (`--fs-*`), weights, line-heights, letter-spacing unchanged.

```css
  /* ---- Families ---- */
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-display: var(--font-sans);
  --font-mono: "SFMono-Regular", "Consolas", ui-monospace, monospace;
```

- [ ] **Step 4: Neutralize `spacing.css` comments + shadows**

Rename the MTI header comment, change the `--rule-accent-w` comment ("green accent" → "accent rule"), and re-base shadow rgba from `34,24,21` (MTI ink) to neutral slate and drop `--shadow-accent`'s green:

```css
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 4px 14px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 12px 32px rgba(15, 23, 42, 0.12);
  --shadow-accent: 0 8px 24px rgba(79, 70, 229, 0.22);
```

- [ ] **Step 5: Update `styles.css` header comment**

Change the `MTI Technology Design System` header to `slide-maker design system — global entry point`. Imports stay the same (fonts, colors, typography, spacing).

- [ ] **Step 6: Verify no brand leaks in tokens**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
! grep -riE 'mti|mtv|noto|00A73B|00B050|007A2B|FABE00|221815|0070C0|F2F0ED' "$DST/design-system/tokens" "$DST/design-system/styles.css" && echo "tokens clean OK"
```
Expected: `tokens clean OK`.

- [ ] **Step 7: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker/design-system/tokens skills/slide-maker/design-system/styles.css
git commit -m "feat(slide-maker): neutralize token contract to clean-light theme

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Set up the theme file + neutral placeholder logos

**Files:**
- Create: `skills/slide-maker/design-system/themes/clean-light.css`
- Modify: `skills/slide-maker/design-system/styles.css` (import active theme)
- Create: `skills/slide-maker/design-system/assets/logos/mark.svg`
- Create: `skills/slide-maker/design-system/assets/logos/logo-full.svg`
- Delete: `skills/slide-maker/design-system/assets/logos/mti-mark.svg`, `mti-logo-full.svg`
- Test: grep + file assertions

**Interfaces:**
- Consumes: the token aliases from Task 2.
- Produces: `themes/clean-light.css` as the swappable active-theme file (initially just re-exports the neutral defaults, giving a single file to overwrite when a design system is chosen). Neutral logo files `mark.svg` / `logo-full.svg` referenced by name (no `mti-` prefix).

- [ ] **Step 1: Create `themes/clean-light.css`**

```css
/* ============================================================
   slide-maker — clean-light theme (bundled default).
   This file is the SWAP POINT. To re-skin the deck, overwrite
   the token values here (or point styles.css at another theme).
   By default it inherits the neutral token contract as-is.
   ============================================================ */
/* clean-light uses the neutral defaults already defined in
   ../tokens/*.css — no overrides needed. A design-system import
   (user DS or ui-ux-pro-max suggestion) replaces this file. */
```

- [ ] **Step 2: Import the theme after tokens in `styles.css`**

Append after the existing token imports:

```css
@import url("./themes/clean-light.css");
```

- [ ] **Step 3: Create neutral placeholder logo `mark.svg`**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
cat > "$DST/design-system/assets/logos/mark.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="w-12"><rect width="48" height="48" rx="10" fill="currentColor"/><path d="M14 32V16h4.2l5.8 9 5.8-9H40" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
SVG
```

- [ ] **Step 4: Create neutral placeholder `logo-full.svg`**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
cat > "$DST/design-system/assets/logos/logo-full.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 48"><rect width="48" height="48" rx="10" fill="currentColor"/><path d="M14 32V16h4.2l5.8 9 5.8-9H40" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><text x="60" y="31" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="currentColor">Your Brand</text></svg>
SVG
```

- [ ] **Step 5: Delete the MTI logos and grep for references**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
rm -f "$DST/design-system/assets/logos/mti-mark.svg" "$DST/design-system/assets/logos/mti-logo-full.svg"
# find any code that still points at the old names (fixed in later tasks if any)
grep -rIl 'mti-mark\|mti-logo-full' "$DST" | grep -v node_modules || echo "no logo refs OK"
```

- [ ] **Step 6: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker/design-system
git commit -m "feat(slide-maker): add clean-light theme swap point + neutral logos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: De-brand the deck template (CSS, config, components, package)

**Files:**
- Modify: `skills/slide-maker/deck-template/src/index.css`
- Modify: `skills/slide-maker/deck-template/tailwind.config.js`
- Modify: `skills/slide-maker/deck-template/package.json`
- Modify: `skills/slide-maker/deck-template/index.html`
- Modify: `skills/slide-maker/deck-template/src/App.jsx`, `src/components/Background.jsx`, `src/components/ExportMenu.jsx`, `src/components/SlideTransition.jsx` (brand strings/hexes → tokens)
- Test: grep + `npm run build`

**Interfaces:**
- Consumes: the token contract (Task 2) and theme (Task 3).
- Produces: a token-driven deck shell. `.mti-rule` renamed to `.accent-rule`. All hardcoded MTI hexes in `index.css` (`#F2F0ED`, `#221815`, `#FFFFFF` where they're brand-fill vs. structural white) mapped to `var(--surface-*)` / `var(--text-primary)`. Deck package name `slide-deck`.

- [ ] **Step 1: De-brand `index.css`**

Replace the MTI header comment. Map brand values to tokens: `body { background: var(--surface-muted); color: var(--text-primary); }`; `.deck-present { background: var(--surface-ink); }`; `.deck-normal { background: var(--surface-muted); }`; `.slide-page { background: var(--surface-page); color: var(--text-primary); font-family: var(--font-sans); }`; the root `font-family` → `var(--font-sans)`. Rename `.mti-rule` → `.accent-rule` with `background: var(--color-accent);`. Change the `Card grids (MTI gutter)` comment to `Card grids`. Keep export-path `#FFFFFF` backgrounds (those are intentional clean export white) but comment them as such. Import tokens at the top so vars resolve:

```css
@import url("../../design-system/styles.css");
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: De-brand `tailwind.config.js`**

Replace the MTI theme block. Map Tailwind color keys to CSS vars so utilities resolve to the active theme:

```js
// slide-maker theme — reads design-system tokens (CSS vars), not fixed brand hexes.
colors: {
  accent: { DEFAULT: 'var(--color-accent)', soft: 'var(--color-accent-soft)' },
  ink: {
    900: 'var(--ink-900)', 700: 'var(--ink-700)', 600: 'var(--ink-600)',
    500: 'var(--ink-500)', 300: 'var(--ink-300)', 200: 'var(--ink-200)',
    100: 'var(--ink-100)', 50: 'var(--ink-50)',
  },
  surface: {
    page: 'var(--surface-page)', card: 'var(--surface-card)',
    subtle: 'var(--surface-subtle)', muted: 'var(--surface-muted)', ink: 'var(--surface-ink)',
  },
},
fontFamily: {
  display: ['var(--font-display)'],
  body: ['var(--font-sans)'],
  sans: ['var(--font-sans)'],
},
```

- [ ] **Step 3: Rename package + fix any old class/logo/brand references in components**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/deck-template
# package name
sed -i '' 's/"mti-slide-deck"/"slide-deck"/' "$DST/package.json"
# rename .mti-rule usages in JSX/components
grep -rl 'mti-rule' "$DST/src" | xargs -r sed -i '' 's/mti-rule/accent-rule/g'
# repoint old logo filenames if referenced
grep -rl 'mti-mark\|mti-logo-full' "$DST/src" | xargs -r sed -i '' -e 's/mti-logo-full/logo-full/g' -e 's/mti-mark/mark/g'
```

- [ ] **Step 4: Replace residual brand hexes and strings in components + index.html**

Manually inspect and fix each remaining hit (title text, hardcoded `#00A73B` accents, "MTI" copy) in `App.jsx`, `Background.jsx`, `ExportMenu.jsx`, `SlideTransition.jsx`, `index.html`. Replace hardcoded accent hexes with `var(--color-accent)` and brand copy with neutral text (e.g. page `<title>` → `Slide Deck`).

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/deck-template
grep -rInE 'mti|mtv|00A73B|00B050|FABE00|221815|F2F0ED|Noto Sans' "$DST/src" "$DST/index.html" | grep -v node_modules
```
Fix every line printed, then re-run until it returns nothing.

- [ ] **Step 5: Install deps and build**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/deck-template
cd "$DST" && npm install && npm run build
```
Expected: build succeeds, `dist/` produced with no unresolved-import errors.

- [ ] **Step 6: Grep gate for the template**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/deck-template
! grep -rIE 'mti|mtv|Noto Sans|00A73B|00B050|FABE00|221815|F2F0ED' "$DST/src" "$DST/tailwind.config.js" "$DST/index.html" "$DST/package.json" && echo "template clean OK"
```
Expected: `template clean OK`.

- [ ] **Step 7: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker/deck-template
git commit -m "feat(slide-maker): tokenize + de-brand the deck template

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rebuild the 34 base layouts — token-only, batch A (structural, 1-9)

**Files:**
- Modify: `skills/slide-maker/design-system/slides/01-cover.html` … `09-quote.html`
- Create (re-render): matching `*.png` previews
- Test: token-only grep + visual render

**Interfaces:**
- Consumes: the token contract (Task 2) and `.accent-rule` (Task 4).
- Produces: the first 9 of 34 neutral layouts. Each layout links the design system and uses tokens only. The 34-layout target catalog is:
  `cover, section-divider, agenda, agenda-rail, statement, three-column, four-column, metrics, hero-metrics, single-kpi-hero, kpi-row, content-image, comparison, comparison-table, two-panel-compare, problem-solution, before-after, quote, pull-quote, feature-list, icon-grid, checklist, pillars, numbered-list, timeline, process-flow, roadmap-phases, bar-chart, line-chart, donut-chart, stat-callout, matrix-2x2, closing, persona`.
  The 17 originals map directly; the remaining 17 are added in Task 6.

- [ ] **Step 1: Establish the token-only layout convention**

Each layout HTML must: link the design system in `<head>` (`<link rel="stylesheet" href="../styles.css">`), use only `var(--…)` for color/font/spacing, use `.accent-rule` for the title underline, and carry no MTI comments. Confirm the pattern by reading `01-cover.html` and rewriting its `<style>`/inline values to tokens.

- [ ] **Step 2: Rewrite layouts 01–09 to token-only**

For each of `01-cover`, `02-section-divider`, `03-three-column`, `04-metrics`, `05-agenda`, `06-content-image`, `07-comparison`, `08-persona`, `09-quote`: replace every hardcoded hex/font with the matching token, swap `.mti-rule`→`.accent-rule`, remove yellow-dot / green-fill MTI motifs in favor of neutral accent equivalents, and delete MTI copy (use neutral placeholder text like "Section title", "Your point here").

- [ ] **Step 3: Grep gate on this batch**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/design-system/slides
! grep -riE 'mti|mtv|noto|00A73B|00B050|007A2B|FABE00|221815|0070C0' 0[1-9]-*.html && echo "batch A clean OK"
# assert token usage present
grep -l 'var(--color-accent)' 0[1-9]-*.html | wc -l
```
Expected: `batch A clean OK`; token usage count > 0.

- [ ] **Step 4: Re-render PNG previews for 01–09**

Use the deck template's screenshot pipeline (the source ships `scripts/shoot-slides.mjs`). Render each of the 9 layout HTMLs at 1280×720 to overwrite its `*.png`.

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
cd "$DST/deck-template"
node scripts/shoot-slides.mjs --slides ../design-system/slides --only 01,02,03,04,05,06,07,08,09
```
(If the script's flags differ, read `scripts/shoot-slides.mjs` and invoke it accordingly; the goal is fresh neutral PNGs.)

- [ ] **Step 5: Eye-check the 9 previews**

Open the 9 regenerated PNGs. Confirm: neutral palette, accent used sparingly, no green/yellow, title rule renders, no clipped content, text legible.

- [ ] **Step 6: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker/design-system/slides
git commit -m "feat(slide-maker): tokenize layouts 01-09 (batch A)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Rebuild the 34 base layouts — batch B (originals 10-17 + 17 new)

**Files:**
- Modify: `skills/slide-maker/design-system/slides/10-closing.html` … `17-feature-list.html`
- Create: the 17 additional layouts + PNGs (names below)
- Test: token-only grep + visual render + count == 34

**Interfaces:**
- Consumes: the layout convention from Task 5.
- Produces: the full 34-layout catalog. The 8 remaining originals (`10-closing, 11-hero-metrics, 12-timeline, 13-process-flow, 14-comparison-table, 15-statement, 16-problem-solution, 17-feature-list`) tokenized; plus 17 NEW layouts authored token-only: `18-agenda-rail, 19-four-column, 20-single-kpi-hero, 21-kpi-row, 22-two-panel-compare, 23-before-after, 24-pull-quote, 25-icon-grid, 26-checklist, 27-pillars, 28-numbered-list, 29-roadmap-phases, 30-bar-chart, 31-line-chart, 32-donut-chart, 33-stat-callout, 34-matrix-2x2`.

- [ ] **Step 1: Tokenize the 8 remaining originals (10–17)**

Same convention as Task 5 for `10-closing`, `11-hero-metrics`, `12-timeline`, `13-process-flow`, `14-comparison-table`, `15-statement`, `16-problem-solution`, `17-feature-list`: tokens only, `.accent-rule`, neutral copy, no MTI motifs.

- [ ] **Step 2: Author the 17 new layouts**

Create `18`–`34` as listed above, each a token-only HTML at 1280×720 linking `../styles.css`. Base their structure on the closest source variant that was pruned (e.g. the new `bar-chart` mirrors the pruned `142-bar-chart-minimal` structure) but authored fresh with neutral tokens and placeholder content. Charts use `var(--color-accent)` for series fills and `var(--ink-*)` for axes/gridlines.

- [ ] **Step 3: Grep gate + count**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/design-system/slides
! grep -riE 'mti|mtv|noto|00A73B|00B050|007A2B|FABE00|221815|0070C0' *.html && echo "all layouts clean OK"
ls *.html | wc -l   # expect 34
```
Expected: `all layouts clean OK`; count `34`.

- [ ] **Step 4: Render all remaining PNGs (10–34)**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
cd "$DST/deck-template"
node scripts/shoot-slides.mjs --slides ../design-system/slides   # render any missing/updated
```

- [ ] **Step 5: Theme-swap test — prove tokens actually drive the look**

Temporarily override the accent + ink in a scratch theme and re-render 3 layouts to confirm they visibly change (proves no hardcoded leaks).

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
cp "$DST/design-system/themes/clean-light.css" /tmp/clean-light.bak
printf ':root{--accent-500:#B91C1C;--color-accent:#B91C1C;--ink-900:#111;}\n' >> "$DST/design-system/themes/clean-light.css"
cd "$DST/deck-template" && node scripts/shoot-slides.mjs --slides ../design-system/slides --only 01,20,30 --out /tmp/swap-test
# eye-check /tmp/swap-test/*.png — accent must be red now
cp /tmp/clean-light.bak "$DST/design-system/themes/clean-light.css"   # restore
```
Expected: the 3 swap-test PNGs show a red accent → tokens drive the look.

- [ ] **Step 6: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker/design-system/slides
git commit -m "feat(slide-maker): complete 34 token-driven layouts (batch B + new)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: De-brand the Node scripts (exporters, validators, drivers)

**Files:**
- Modify: `skills/slide-maker/deck-template/scripts/*.mjs` and `scripts/lib/*.mjs` (the ~20 files that mention brand)
- Test: grep gate + one exporter dry-run

**Interfaces:**
- Consumes: the tokenized template (Task 4) and layouts (Tasks 5-6).
- Produces: brand-free pipeline scripts. Any hardcoded MTI hex used for chart palettes / fills replaced with neutral values or token reads; MTI comments/strings removed. Script logic unchanged.

- [ ] **Step 1: List every brand hit in scripts**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/deck-template
grep -rInE 'mti|mtv|Noto Sans|00A73B|00B050|007A2B|FABE00|221815|0070C0|F2F0ED' "$DST/scripts" | grep -v node_modules
```

- [ ] **Step 2: Fix each hit**

For each line: brand comments/strings → neutral wording; hardcoded chart-palette hexes (e.g. an `MTI_SERIES` array) → a neutral series palette derived from the accent + slate scale, e.g.:

```js
// neutral chart series palette (accent-led, unbranded)
const SERIES = ['#4F46E5', '#0EA5E9', '#64748B', '#94A3B8', '#334155', '#A5B4FC'];
```
Rename any `MTI_SERIES` identifier → `SERIES` and update references.

- [ ] **Step 3: Grep gate for scripts**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/deck-template
! grep -rIE 'mti|mtv|Noto Sans|00A73B|00B050|007A2B|FABE00|221815|0070C0|F2F0ED|MTI_SERIES' "$DST/scripts" && echo "scripts clean OK"
```
Expected: `scripts clean OK`.

- [ ] **Step 4: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker/deck-template/scripts
git commit -m "feat(slide-maker): de-brand pipeline scripts + neutral chart palette

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Rewrite SKILL.md — de-brand + DS-resolution flow + output-location ask

**Files:**
- Modify: `skills/slide-maker/SKILL.md`
- Test: grep gate + content assertions

**Interfaces:**
- Consumes: everything above.
- Produces: the skill's driving document. New frontmatter (`name: slide-maker`), de-branded body, plus two NEW behavior sections: the design-system resolution flow and the output-location ask.

- [ ] **Step 1: Rewrite frontmatter + intro**

`name: slide-maker`; description covers "make impressive, on-brand presentation slides for ANY design system" — remove all MTI wording. Keep the workflow-routing table and the brainstorm→generate→export diagram.

- [ ] **Step 2: Replace the "Hard brand rules" section with design-system-agnostic craft rules**

Keep the craft discipline (one focal point, whitespace, measure-don't-eyeball geometry gate, "done = passing test with numbers", eye-check via subagents) but strip MTI palette/font mandates. Add: "The active design system is the source of truth for color/type; layouts are token-driven — never hardcode a hex or font."

- [ ] **Step 3: Add the "Resolve the design system" section**

Document the exact flow verbatim from the spec:
```
1. Ask if the user has their own design system → map it into design-system/themes/clean-light.css (or a new theme file).
2. Else: is nextlevelbuilder/ui-ux-pro-max-skill installed? → use it to suggest the best-fit DS for the deck's content.
3. Else: recommend + guide install from https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (preferred path).
4. Else (user declines install): ASK first, then shallow `git clone` into /tmp, use for THIS TURN ONLY, do not persist.
5. Else (declines fetch): use the bundled clean-light theme.
```
State the consent rule for the `/tmp` clone and that clean-light is the guaranteed floor.

- [ ] **Step 4: Add the "Choose where to write the deck" section**

At the start of generate: ask the user for an output path; default `./slides/<deck-name>/`, exports in `./slides/<deck-name>/export/`; copy the `deck-template/` scaffold there (not into the skill dir).

- [ ] **Step 5: Fix the brand-kit + reference-library sections**

Repoint paths (`design-system/`, `themes/clean-light.css`, `assets/logos/mark.svg`), de-brand the reference table rows, keep the "automated gate necessary not sufficient — always LOOK / MEASURE" discipline.

- [ ] **Step 6: Grep gate**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
! grep -iE 'mti|mtv|noto sans' "$DST/SKILL.md" && echo "SKILL.md clean OK"
grep -q 'ui-ux-pro-max' "$DST/SKILL.md" && grep -q './slides/' "$DST/SKILL.md" && echo "new sections present OK"
```
Expected: `SKILL.md clean OK`; `new sections present OK`.

- [ ] **Step 7: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker/SKILL.md
git commit -m "feat(slide-maker): rewrite SKILL.md — DS-resolution flow + output ask

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: De-brand references, workflows, README, evals

**Files:**
- Modify: `skills/slide-maker/references/*.md`, `references/workflows/*.md`
- Modify: `skills/slide-maker/README.md`
- Modify: `skills/slide-maker/evals/evals.json`
- Test: repo-wide grep gate

**Interfaces:**
- Consumes: the finalized SKILL.md conventions (Task 8) — paths, theme names, output-location behavior.
- Produces: fully de-branded docs. Workflows reflect the DS-resolution + output-location steps. README is a neutral public orientation. `house-style.md` describes the 34 layouts (not 11) and neutral rules.

- [ ] **Step 1: De-brand each reference file**

For every file in `references/` and `references/workflows/`: replace MTI/MTV terms, robotics examples, Noto Sans, green/yellow palette talk with neutral equivalents. Update `house-style.md` to catalog the 34 layouts. Update `deck-template.md`, `pptx-editable.md`, `visual-review.md`, `validation.md`, `wow-guide.md`, `tailwind-theme.md`, `edit-mode.md`. In `slide-brainstorm.md` / `slide-generate.md`, insert the DS-resolution step and the output-location ask.

- [ ] **Step 2: Rewrite README.md as a neutral public orientation**

Remove MTI framing; describe slide-maker as a design-system-agnostic slide skill; keep the TL;DR / workflow table but with neutral examples.

- [ ] **Step 3: De-brand evals.json**

Replace MTI-specific eval prompts/expected outputs with neutral deck examples.

- [ ] **Step 4: Repo-wide grep gate (the big one)**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
! grep -rIiE 'mti|mtv|noto sans|00A73B|00B050|007A2B|FABE00|221815|0070C0|F2F0ED|\brobot\b|\bros\b' "$DST" --exclude-dir=node_modules && echo "FULL SKILL CLEAN OK"
```
Expected: `FULL SKILL CLEAN OK`. (If any hit remains, fix it before committing.)

- [ ] **Step 5: Commit**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add skills/slide-maker/references skills/slide-maker/README.md skills/slide-maker/evals
git commit -m "feat(slide-maker): de-brand references, workflows, README, evals

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: End-to-end pipeline smoke test + repo registration

**Files:**
- Modify: `README.md` (repo root — add slide-maker to skills table)
- Test: full generate→export cycle through every exporter

**Interfaces:**
- Consumes: the complete skill.
- Produces: proof the ported pipeline works end-to-end under the neutral theme, and the skill is listed in the repo's skills table.

- [ ] **Step 1: Generate a 3-slide test deck into a temp output dir**

Follow the generate workflow manually: scaffold `deck-template` into `/tmp/slide-maker-smoke/`, add 3 slides (cover + one content + closing) built from the token layouts under `clean-light`.

```bash
rm -rf /tmp/slide-maker-smoke && mkdir -p /tmp/slide-maker-smoke
rsync -a --exclude node_modules /Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker/deck-template/ /tmp/slide-maker-smoke/
cd /tmp/slide-maker-smoke && npm install
```

- [ ] **Step 2: Run each exporter**

```bash
cd /tmp/slide-maker-smoke
node scripts/export-deck.mjs        # standalone HTML + PDF paths
node scripts/export-pptx-jsx.mjs    # editable PPTX
node scripts/validate-pptx.mjs      # PPTX validation gate
node scripts/check-slop.mjs         # slop validator
```
Expected: each completes without error; artifacts appear in `export/`. (Read each script's actual entry/flags first; adjust invocation to match.)

- [ ] **Step 3: Run the geometry + slop gates and eye-check**

```bash
cd /tmp/slide-maker-smoke
node scripts/inspect.mjs            # geometry.json
```
Confirm content bottoms ≤ 648, no overlaps; eye-check the exported PDF/PPTX previews render neutral, on-theme, unclipped.

- [ ] **Step 4: Add slide-maker to the repo skills table**

Edit the root `README.md` skills table: add a `slide-maker` row (name + one-line description + link to `skills/slide-maker/`).

- [ ] **Step 5: Validate plugin structure**

```bash
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
claude plugin validate . 2>/dev/null || echo "validate not available — skip"
```

- [ ] **Step 6: Final full grep gate + commit**

```bash
DST=/Users/tannt/Work/GIT/Personal/Sources/bmad-skills/skills/slide-maker
! grep -rIiE 'mti|mtv|noto sans|00A73B|00B050|007A2B|FABE00|221815|0070C0|F2F0ED|\brobot\b|\bros\b' "$DST" --exclude-dir=node_modules && echo "FINAL CLEAN OK"
cd /Users/tannt/Work/GIT/Personal/Sources/bmad-skills
git add README.md
git commit -m "feat(slide-maker): register skill + verify end-to-end pipeline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Read scripts before invoking them.** The exact CLI flags for `shoot-slides.mjs`, `export-deck.mjs`, `export-pptx-jsx.mjs`, etc. come from the source; verify each script's argument parsing before running (Steps that call them say so).
- **The grep gate is the backstop for completeness**, but LOOK at rendered PNGs too — a layout can be token-clean and still look wrong (source's own discipline).
- **Charts are the trickiest layouts** (30-32): make sure series colors read from the neutral `SERIES` palette / tokens, not hardcoded brand hexes.
- **`\brobot\b` / `\bros\b` in the final grep** may false-positive on words like "across" — `\b` word boundaries avoid most; review any hit in context before "fixing."
