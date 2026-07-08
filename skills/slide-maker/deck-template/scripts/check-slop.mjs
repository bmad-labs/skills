#!/usr/bin/env node
// check-slop.mjs — slide anti-slop validator.
//
// Catches mechanical "AI slop" in generated slides BEFORE the visual review step:
// raw hex instead of brand tokens, off-brand fonts, generic Tailwind colors, dark
// glass, layout-breakers (ERRORs that fail), plus craft warnings (walls of text,
// no focal point, missing rhythm, yellow misuse, image overload) that report only.
//
// Dependency-free (node: builtins + regex). Works on HTML and JSX.
//
// Usage:
//   node check-slop.mjs <file...> [--format html|jsx|auto] [--json]
//
// Exit code: non-zero if any ERROR fired (so it can gate a build).
//
// The brand allowlists are loaded from the skill's own source of truth at runtime
// (design-system/tokens/colors.css for hex; references/tailwind-theme.md for the
// chart series palette), so this script never drifts from the design system.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// check-slop ships inside deck-template/scripts/, so the deck root is the parent.
// In the skill it also has a sibling design-system/; in a clone it doesn't, and the
// token source of truth is the deck's tailwind.config.js. Try both.
const DECK = resolve(HERE, '..');
const SKILL = resolve(HERE, '..', '..');   // when scripts/ is at deck-template/scripts/

// ---------- load allowlists from source of truth ----------

function loadAllowedHex() {
  const set = new Set();
  let found = false;
  // 1) the skill's design-system token CSS, if present (authoritative)
  for (const base of [resolve(SKILL, 'design-system/tokens'), resolve(DECK, '../design-system/tokens')]) {
    for (const f of ['colors.css', 'typography.css', 'spacing.css', 'fonts.css']) {
      try {
        const css = readFileSync(resolve(base, f), 'utf8');
        for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) { set.add(m[0].toUpperCase()); found = true; }
      } catch { /* optional */ }
    }
    if (found) break;
  }
  // 2) clone fallback: read every hex from the deck's tailwind.config.js (the theme)
  if (!found) {
    try {
      const tw = readFileSync(resolve(DECK, 'tailwind.config.js'), 'utf8');
      for (const m of tw.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) set.add(m[0].toUpperCase());
    } catch { /* leave empty → callers see ERRORs, signalling a broken setup */ }
  }
  return set;
}

function loadSeries() {
  // the chart series palette from tailwind-theme.md — the only hex allowed inside
  // chart/SVG code on top of the token hexes (they overlap, but keep this explicit
  // for clarity). Match any `..._SERIES` / `SERIES` export name so this keeps working
  // whichever naming the reference doc currently uses.
  const chrome = ['#E2E8F0', '#EEF2FF'];
  try {
    const md = readFileSync(resolve(SKILL, 'references/tailwind-theme.md'), 'utf8');
    const m = md.match(/\b\w*SERIES\s*=\s*\[([^\]]+)\]/);
    if (m) {
      const hexes = [...m[1].matchAll(/#[0-9a-fA-F]{3,8}/g)].map(x => x[0].toUpperCase());
      return new Set([...hexes, ...chrome.map(c => c.toUpperCase())]);
    }
  } catch { /* fall through */ }
  return new Set([...chrome.map(c => c.toUpperCase()),
    '#4F46E5', '#0EA5E9', '#64748B', '#94A3B8', '#334155', '#A5B4FC']);
}

const ALLOWED_HEX = loadAllowedHex();
const SERIES_HEX = loadSeries();

// ---------- helpers ----------

const FORBIDDEN_FONTS = /\b(Sora|DM Sans|Inter|Roboto|Helvetica|Times New Roman|Comic Sans|Montserrat|Poppins|Lato)\b/gi;
// Tailwind built-in color palettes — using these means the agent reached past the theme.
const GENERIC_TW = /\b(?:text|bg|border|from|to|via|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(?:50|[1-9]00|950)\b/;

function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

function stripTags(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
             .replace(/<script[\s\S]*?<\/script>/gi, ' ')
             .replace(/<!--[\s\S]*?-->/g, ' ')
             .replace(/<[^>]+>/g, ' ')
             .replace(/&[a-z]+;/gi, ' ');
}

// visible-text word count (for density). Works for both HTML and JSX-ish source.
function wordCount(src, fmt) {
  let text;
  if (fmt === 'html') {
    text = stripTags(src);
  } else {
    // JSX: drop comments, imports, and braces FIRST (so {expr} that spans a tag
    // boundary doesn't swallow following text), then strip tags. Only count text
    // that sits as a JSX child (between > and <).
    const noCode = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/^\s*import[^\n]*$/gm, ' ')
      .replace(/\{[^{}]*\}/g, ' ')      // simple expressions
      .replace(/\{[^{}]*\}/g, ' ');     // second pass for one level of nesting
    const childText = [...noCode.matchAll(/>([^<>{}]+)</g)].map(m => m[1]).join(' ');
    text = childText;
  }
  const words = text.split(/\s+/).filter(w => /[A-Za-z]{2,}/.test(w));
  return words.length;
}

// ---------- the checks ----------

function checkFile(file) {
  const src = readFileSync(file, 'utf8');
  let fmt = OPTS.format;
  if (fmt === 'auto') fmt = ['.jsx', '.tsx', '.js', '.ts'].includes(extname(file)) ? 'jsx' : 'html';

  const findings = [];
  const err = (line, msg, fix) => findings.push({ level: 'ERROR', line, msg, fix });
  const warn = (line, msg, fix) => findings.push({ level: 'WARN', line, msg, fix });

  // For hex scanning, ignore token-definition files entirely (callers shouldn't
  // point the validator at tokens/, but be safe).
  const isTokenFile = /design-system\/tokens\//.test(file.replace(/\\/g, '/'));

  // --- ERROR: raw hex not in the brand allowlist ---
  if (!isTokenFile) {
    // collect hex inside <svg>...</svg> ranges so we can apply the chart palette rule
    const svgRanges = [];
    for (const m of src.matchAll(/<svg[\s\S]*?<\/svg>/gi)) svgRanges.push([m.index, m.index + m[0].length]);
    const inSvg = i => svgRanges.some(([a, b]) => i >= a && i < b);

    for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      // skip HTML numeric entities like &#9650; (▲), &#8209; (non-breaking hyphen):
      // these are `&#<digits>;`, not colour hex — the `#` is preceded by `&` and the
      // run is all decimal digits terminated by `;`.
      if (src[m.index - 1] === '&' && /^#[0-9]+$/.test(m[0]) && src[m.index + m[0].length] === ';') continue;
      // skip SVG local references like url(#a2d), href="#grad", xlink:href="#m1":
      // `#id` after `url(`, `(`, or a quote is an element ID, not a colour.
      if (/[("']/.test(src[m.index - 1] || '')) continue;
      const hex = m[0].toUpperCase();
      // normalize #rgb -> compare both forms against allowlist
      const long = hex.length === 4
        ? '#' + hex.slice(1).split('').map(c => c + c).join('')
        : hex;
      if (ALLOWED_HEX.has(hex) || ALLOWED_HEX.has(long)) continue;
      if (inSvg(m.index)) {
        // inside a chart: must be a series or chrome color
        if (SERIES_HEX.has(hex) || SERIES_HEX.has(long)) continue;
        err(lineOf(src, m.index), `off-palette chart color ${m[0]}`,
            'use a color from the chart series palette (tailwind-theme.md) + #E2E8F0/#EEF2FF chrome');
      } else {
        err(lineOf(src, m.index), `raw hex ${m[0]} (use tokens, not literal hex)`,
            'replace with a var(--*) token (HTML) or a mapped class (JSX) — see tailwind-theme.md');
      }
    }
  }

  // --- ERROR: off-brand font ---
  for (const m of src.matchAll(FORBIDDEN_FONTS)) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const lineEnd = src.indexOf('\n', m.index);
    const line = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    // allow it only if it's clearly a fallback inside the display stack — i.e. preceded
    // by the display font name earlier on the same line (our --font-sans has its own fallback).
    if (/the display font/i.test(line)) continue;         // fallback in the display stack — fine
    // only flag in a FONT context (a font declaration or a Google-Fonts import) — not
    // when the word merely appears in displayed copy ("Inter-service transport", "Lato
    // America", "internal"). A real off-theme font shows up next to font/@import/fonts.google.
    if (!/font|@import|fonts\.google|typeface|@font-face/i.test(line)) continue;
    err(lineOf(src, m.index), `off-theme font "${m[0]}" (use the deck's display font only)`,
        'use font-display / --font-sans (the deck display font)');
  }

  // --- ERROR: generic Tailwind color utility ---
  for (const m of src.matchAll(new RegExp(GENERIC_TW, 'g'))) {
    err(lineOf(src, m.index), `generic Tailwind color "${m[0]}" bypasses the theme`,
        'use primary-* / accent-* / ink-* / text-text-* / bg-bg-* from tailwind-theme.md');
  }

  // --- ERROR: dark glass used positively ---
  // match the `glass` CSS UTILITY/CLASS or `backdrop-filter` (glassmorphism) — NOT the
  // word "glass" in slide copy (e.g. "one pane of glass", "glass cockpit"). A real glass
  // class shows up as a `.glass{...}` rule, a `class="... glass ..."` attr, or backdrop-filter.
  const glassRe = /\.glass\b(?!-light)|class\s*=\s*["'][^"']*\bglass\b(?!-light)[^"']*["']|backdrop-filter\s*:/g;
  for (const m of src.matchAll(glassRe)) {
    err(lineOf(src, m.index), 'dark `glass` class is off-brand on a light deck',
        'use bg-bg-card border border-border-subtle shadow-sm; glass-light only over a photo');
  }

  // --- ERROR: layout-breakers (JSX/Tailwind) ---
  for (const m of src.matchAll(/\b(min-h-screen|h-screen)\b/g)) {
    err(lineOf(src, m.index), `${m[0]} breaks the slide frame`,
        'remove it — slide-page already sizes the slide');
  }
  // h-full is only allowed on slide-content; flag other occurrences in JSX
  if (fmt === 'jsx') {
    for (const m of src.matchAll(/className="[^"]*\bh-full\b[^"]*"/g)) {
      if (!/slide-content/.test(m[0])) {
        warn(lineOf(src, m.index), 'h-full outside slide-content can break flex layout',
             'let slide-content own the fill; avoid h-full on inner wrappers');
      }
    }
  }

  // --- WARN: density (word count) ---
  const wc = wordCount(src, fmt);
  if (wc > 150) warn(1, `wall of text — ${wc} words on one slide (>150)`,
                     'split into two slides; aim < ~110 words');
  else if (wc > 110) warn(1, `dense — ${wc} words on one slide (>110)`,
                          'trim copy; one idea per slide');

  // --- WARN: bullet count (per list, not per slide — grouped columns are fine) ---
  let maxList = 0;
  for (const ul of src.matchAll(/<(ul|ol)\b[\s\S]*?<\/\1>/gi)) {
    const n = (ul[0].match(/<li\b/gi) || []).length;
    if (n > maxList) maxList = n;
  }
  if (maxList === 0) maxList = (src.match(/<li\b/gi) || []).length; // fallback: ungrouped
  if (maxList > 6) warn(1, `${maxList} bullets in one list (>6)`, 'max ~5-6 per list; split or cut');

  // --- WARN: no focal point (flat hierarchy) ---
  const hasHero =
    /\btext-display\b/.test(src) || /\bfont-black\b/.test(src) ||
    /var\(--fw-black\)/.test(src) || /var\(--fs-display\)/.test(src) ||
    /font-size:\s*(\d{2,})px/.test(src) && (src.match(/font-size:\s*(\d{2,})px/g) || [])
      .some(s => parseInt(s.match(/(\d+)/)[1], 10) >= 56) ||
    /text-\[(\d{2,})px\]/.test(src) && (src.match(/text-\[(\d+)px\]/g) || [])
      .some(s => parseInt(s.match(/(\d+)/)[1], 10) >= 56);
  // multi-column *content* layouts (comparison, content+image, persona, three-col)
  // are legitimately non-hero — their job is parallel content, so don't nag them.
  const exemptHero = /comparison|content-image|persona|three-column|agenda/i.test(file);
  if (!hasHero && !exemptHero)
    warn(1, 'no clear focal point — nothing at hero scale (≥56px / display / black)',
         'make ONE element dominate: a KPI, number, accent-word title, or chart');

  // --- WARN: missing typography rhythm (title without eyebrow or rule) ---
  const hasTitle = fmt === 'html'
    ? /<h1\b/i.test(src)
    : /\btext-(h1|display)\b/.test(src) || /<h1\b/.test(src);
  const hasEyebrow = /tracking-eyebrow/.test(src) || /var\(--ls-eyebrow\)/.test(src) ||
                     /\bclass="[^"]*eyebrow/.test(src) || /className="[^"]*eyebrow/.test(src);
  const hasRule = /var\(--rule-accent-w\)/.test(src) ||
                  /\brounded-pill\b[\s\S]{0,40}\bbg-primary-500\b/.test(src) ||
                  /\bbg-primary-500\b[\s\S]{0,40}\brounded-pill\b/.test(src) ||
                  /class="[^"]*\brule\b/.test(src) ||
                  /\baccent-rule\b/.test(src) || /<AccentRule\b/.test(src);   // deck-template rule component
  // agenda carries brand via a full green rail; comparison goes title→columns by
  // design. Both are intentionally rule-less heads — exempt them.
  const exemptRhythm = /cover|closing|quote|divider|agenda|comparison/i.test(file);
  if (hasTitle && !exemptRhythm && (!hasEyebrow || !hasRule)) {
    const miss = [!hasEyebrow && 'eyebrow', !hasRule && 'green accent rule'].filter(Boolean).join(' + ');
    warn(1, `title present but missing ${miss} (breaks eyebrow→title→rule→body rhythm)`,
         'add the missing element — see wow-guide.md §7');
  }

  // --- WARN: accent misuse (large fill or text color) ---
  for (const m of src.matchAll(/\bbg-accent-500\b|background:\s*var\(--color-accent\)|background:\s*var\(--yellow-500\)/g)) {
    // a small dot uses width/height ~12px or rounded-pill nearby — heuristic: flag if
    // the same element looks full-bleed (inset-0 / w-full / 100%).
    const ctx = src.slice(Math.max(0, m.index - 120), m.index + 120);
    if (/inset-0|w-full|width:\s*100%|height:\s*100%/.test(ctx)) {
      warn(lineOf(src, m.index), 'accent color used as a large fill — accent is a dot/highlight only',
           'use ink/neutral for fills; keep the accent to the small dot-trail or one highlight');
    }
  }
  for (const m of src.matchAll(/\btext-accent-500\b|color:\s*var\(--color-accent\)/g)) {
    warn(lineOf(src, m.index), 'accent used as a text color — low contrast, off-brand',
         'use text-primary-500 or ink for text');
  }

  // --- WARN: image overload ---
  const imgs = (src.match(/<img\b/gi) || []).length +
               (src.match(/background-image\s*:/gi) || []).length;
  if (imgs > 3) warn(1, `${imgs} images on one slide (>3) — composition overload`,
                     'one strong image beats several; split or cut');

  return { file, fmt, wc, findings };
}

// ---------- cli ----------

const OPTS = { format: 'auto', json: false, files: [] };
for (const a of process.argv.slice(2)) {
  if (a === '--json') OPTS.json = true;
  else if (a.startsWith('--format')) OPTS.format = a.split('=')[1] || 'auto';
  else if (a === 'html' || a === 'jsx' || a === 'auto') OPTS.format = a; // after --format
  else OPTS.files.push(a);
}
// support "--format html" (space-separated)
const fi = process.argv.indexOf('--format');
if (fi !== -1 && process.argv[fi + 1] && !process.argv[fi + 1].startsWith('--')) {
  OPTS.format = process.argv[fi + 1];
  OPTS.files = OPTS.files.filter(f => f !== OPTS.format);
}

if (OPTS.files.length === 0) {
  console.error('usage: node check-slop.mjs <file...> [--format html|jsx|auto] [--json]');
  process.exit(2);
}

const results = OPTS.files.map(checkFile);
let errors = 0, warns = 0;
for (const r of results) for (const f of r.findings) (f.level === 'ERROR' ? errors++ : warns++);

if (OPTS.json) {
  console.log(JSON.stringify({ errors, warns, results }, null, 2));
} else {
  for (const r of results) {
    const head = `\n${r.file}  (${r.fmt}, ${r.wc} words)`;
    if (r.findings.length === 0) { console.log(`${head}  ✓ clean`); continue; }
    console.log(head);
    for (const f of r.findings) {
      const tag = f.level === 'ERROR' ? 'ERROR' : 'warn ';
      console.log(`  ${tag} L${f.line}: ${f.msg}`);
      if (f.fix) console.log(`         ↳ ${f.fix}`);
    }
  }
  console.log(`\n${errors} error(s), ${warns} warning(s) across ${results.length} file(s).`);
}

process.exit(errors > 0 ? 1 : 0);
