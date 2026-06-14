#!/usr/bin/env node
/* ============================================================================
   slop-lint.mjs — flag "AI slop" design tells on a rendered page.

   WHY
   The anti-slop bar (one accent, neutral greys, real type scale, restrained
   motion) is the difference between "looks professionally designed" and "looks
   AI-generated". This lints the MECHANICAL tells — the ones that are actually
   measurable from the DOM + computed styles — so you catch them before a human
   has to. It does NOT certify taste: a clean lint means "no obvious slop
   markers", not "this is good design". The judgment calls (does the metaphor
   land, does it feel premium) still need human eyes — that's by design.

   The ruleset is grounded in the documented, reproducible tells from Adrian
   Krebs' `ai-design-checker` (deterministic CSS/DOM checks, no screenshot
   judging) plus the academic UIClip "jitter" defect catalog (palette noise,
   type-scale noise, contrast, off-grid spacing). See references/styling-and-
   anti-slop.md for the why behind each.

   USAGE
     node scripts/slop-lint.mjs <url|file> [--json out.json] [--fail-on N]
   Exits non-zero if findings >= --fail-on (default: never fails; reporting only).

   Requires Playwright (npm i -D @playwright/test; npx playwright install chromium).
   ============================================================================ */

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const target = args[0];
if (!target) { console.error('usage: slop-lint.mjs <url|file> [--json out] [--fail-on N]'); process.exit(2); }
const jsonOut = argVal('--json');
const failOn = Number(argVal('--fail-on') || Infinity);
function argVal(f) { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; }

const url = /^https?:\/\//.test(target)
  ? target
  : pathToFileURL(resolve(target)).href;

/* ---- the lint runs IN the page so it can read getComputedStyle ----
   Each rule returns { rule, hits, sample, note }. hits === 0 means clean. */
function pageLint() {
  const out = [];
  const all = Array.from(document.querySelectorAll('body *'));
  const styles = new Map(all.map((el) => [el, getComputedStyle(el)]));
  const cs = (el) => styles.get(el) || getComputedStyle(el);

  /* color helpers */
  const parseRGB = (str) => {
    const m = str && str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(',').map((x) => parseFloat(x));
    return { r, g, b, a: a == null ? 1 : a };
  };
  const rgbToHsl = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  };
  const isPurple = (rgb) => {
    if (!rgb || rgb.a < 0.3) return false;
    const { h, s, l } = rgbToHsl(rgb);
    return h >= 250 && h <= 300 && s > 0.25 && l >= 0.15 && l <= 0.85;
  };

  /* 1. Purple/violet accent on filled CTAs (the Tailwind indigo-500 leak) */
  {
    const cand = all.filter((el) => /^(a|button)$/i.test(el.tagName) ||
      (cs(el).cursor === 'pointer' && el.offsetWidth > 40 && el.offsetWidth < 400));
    const hits = cand.filter((el) => {
      const bg = parseRGB(cs(el).backgroundColor);
      return bg && bg.a >= 0.5 && isPurple(bg);
    });
    if (hits.length) out.push({ rule: 'purple-cta', hits: hits.length,
      sample: cs(hits[0]).backgroundColor, note: 'Filled CTA in the indigo/violet 250–300° band — the #1 AI tell. Reserve one brand accent instead.' });
  }

  /* 2. Gradient-text hero, or many gradient backgrounds */
  {
    const gradHeroes = all.filter((el) => /^h[1-2]$/i.test(el.tagName) &&
      parseFloat(cs(el).fontSize) >= 40 &&
      (cs(el).backgroundImage || '').includes('gradient') &&
      (cs(el).webkitBackgroundClip === 'text' || cs(el).backgroundClip === 'text'));
    const gradBgs = all.filter((el) => (cs(el).backgroundImage || '').includes('gradient'));
    if (gradHeroes.length) out.push({ rule: 'gradient-text-hero', hits: gradHeroes.length,
      sample: gradHeroes[0].tagName, note: 'Gradient-clipped hero headline. Flat ink reads more premium.' });
    if (gradBgs.length >= 4) out.push({ rule: 'many-gradients', hits: gradBgs.length,
      sample: cs(gradBgs[0]).backgroundImage.slice(0, 60), note: '4+ gradient backgrounds. Gradients are a generic AI default; use sparingly.' });
  }

  /* 3. Neon / saturated glow box-shadows */
  {
    const glow = all.filter((el) => {
      const sh = cs(el).boxShadow;
      if (!sh || sh === 'none') return false;
      const blur = (sh.match(/(\d+)px/g) || []).map((x) => parseInt(x)).sort((a, b) => b - a)[0] || 0;
      const col = parseRGB(sh);
      if (!col || blur < 15) return false;
      const { s, l } = rgbToHsl(col);
      return s > 0.3 && l > 0.2 && l < 0.9;
    });
    if (glow.length >= 2) out.push({ rule: 'colored-glow', hits: glow.length,
      sample: cs(glow[0]).boxShadow.slice(0, 50), note: 'Saturated neon glow shadows (blur ≥15px). Reads as AI/landing-page slop.' });
  }

  /* 4. Uniform radius + padding everywhere (kills hierarchy) */
  {
    const boxes = all.filter((el) => el.offsetWidth > 60 && el.offsetHeight > 30);
    const radii = {}, pads = {};
    boxes.forEach((el) => {
      const r = cs(el).borderRadius; if (r && r !== '0px') radii[r] = (radii[r] || 0) + 1;
      const p = cs(el).padding; if (p && p !== '0px') pads[p] = (pads[p] || 0) + 1;
    });
    const topRadius = Object.entries(radii).sort((a, b) => b[1] - a[1])[0];
    if (topRadius && topRadius[1] >= 8 && Object.keys(radii).length <= 2) {
      out.push({ rule: 'uniform-radius', hits: topRadius[1], sample: topRadius[0],
        note: 'Same border-radius on nearly everything. Vary radius to build hierarchy.' });
    }
  }

  /* 5. Slop display fonts + Inter-on-centered-hero */
  {
    const SLOP = ['space grotesk', 'instrument serif', 'fraunces', 'bricolage', 'sora', 'young serif', 'bodoni', 'syne'];
    const heads = all.filter((el) => /^h[1-3]$/i.test(el.tagName));
    const slopFont = heads.filter((el) => {
      const f = (cs(el).fontFamily || '').toLowerCase();
      return SLOP.some((s) => f.includes(s));
    });
    if (slopFont.length) out.push({ rule: 'slop-display-font', hits: slopFont.length,
      sample: cs(slopFont[0]).fontFamily.split(',')[0], note: 'Trendy AI-default display font. Fine occasionally; common in generated pages.' });
    const centeredInterHero = heads.filter((el) => /^h1$/i.test(el.tagName) &&
      cs(el).textAlign === 'center' && /inter|system-ui|-apple-system/i.test(cs(el).fontFamily));
    if (centeredInterHero.length) out.push({ rule: 'centered-inter-hero', hits: centeredInterHero.length,
      sample: 'h1 centered + Inter', note: 'Centered Inter H1 is the statistical-median AI hero. Try a left-aligned, distinctive type pairing.' });
  }

  /* 6. Too many distinct saturated accent colors (no palette discipline) */
  {
    const sat = new Set();
    all.forEach((el) => {
      [cs(el).color, cs(el).backgroundColor, cs(el).borderColor].forEach((c) => {
        const rgb = parseRGB(c); if (!rgb || rgb.a < 0.5) return;
        const { h, s, l } = rgbToHsl(rgb);
        if (s > 0.4 && l > 0.2 && l < 0.85) sat.add(Math.round(h / 30) * 30); // bucket hues by 30°
      });
    });
    if (sat.size >= 5) out.push({ rule: 'palette-sprawl', hits: sat.size,
      sample: [...sat].sort((a, b) => a - b).join('°, ') + '°', note: '5+ distinct saturated hue families. Reserve ONE accent; keep the rest neutral.' });
  }

  /* 7. Type-scale sprawl: too many distinct font sizes (no modular scale) */
  {
    const sizes = new Set();
    all.forEach((el) => { if (el.textContent && el.textContent.trim()) sizes.add(Math.round(parseFloat(cs(el).fontSize))); });
    if (sizes.size >= 12) out.push({ rule: 'type-scale-sprawl', hits: sizes.size,
      sample: [...sizes].sort((a, b) => a - b).join(', '), note: '12+ distinct font sizes. Designed UIs use a small modular scale (~6–9 steps).' });
  }

  /* 8. Glassmorphism (backdrop-blur translucent panels) overuse */
  {
    const glass = all.filter((el) => /blur/.test(cs(el).backdropFilter || cs(el).webkitBackdropFilter || ''));
    if (glass.length >= 2) out.push({ rule: 'glassmorphism', hits: glass.length,
      sample: cs(glass[0]).backdropFilter, note: 'Multiple backdrop-blur panels. A heavily-overused AI/landing aesthetic.' });
  }

  /* 9. Emoji used as feature/section icons or in nav */
  {
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;
    const navLinks = Array.from(document.querySelectorAll('nav a, header a, [role="navigation"] a'));
    const emojiNav = navLinks.filter((a) => emojiRe.test(a.textContent || ''));
    if (navLinks.length >= 3 && emojiNav.length / navLinks.length >= 0.4) {
      out.push({ rule: 'emoji-nav', hits: emojiNav.length, sample: emojiNav[0].textContent.trim().slice(0, 20),
        note: '≥40% of nav links prefixed with emoji. Use real icons or none.' });
    }
    const heads = all.filter((el) => /^h[2-3]$/i.test(el.tagName) && emojiRe.test(el.textContent || ''));
    if (heads.length >= 2) out.push({ rule: 'emoji-headers', hits: heads.length,
      sample: heads[0].textContent.trim().slice(0, 24), note: 'Emoji in section headings. A classic generated-page tell.' });
  }

  /* 10. Identical icon-card grid (3–12 equal cards in a row/grid) */
  {
    const grids = all.filter((el) => /grid|flex/.test(cs(el).display));
    const iconCardish = grids.filter((g) => {
      const kids = Array.from(g.children);
      if (kids.length < 3 || kids.length > 12) return false;
      const sameSize = kids.every((k) => Math.abs(k.offsetWidth - kids[0].offsetWidth) < 6);
      const haveHeading = kids.filter((k) => k.querySelector('h2,h3,h4')).length >= kids.length - 1;
      return sameSize && haveHeading;
    });
    if (iconCardish.length) out.push({ rule: 'icon-card-grid', hits: iconCardish.length,
      sample: iconCardish[0].children.length + ' equal cards', note: 'README-bullets-as-cards grid. Fine if intentional; ubiquitous in generated pages.' });
  }

  /* 11. Perma-dark with low-contrast grey body text */
  {
    const bodyBg = parseRGB(cs(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    const dark = (bodyBg.r + bodyBg.g + bodyBg.b) / 3 < 70;
    if (dark) {
      const lum = (rgb) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b); };
      const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
      const lowContrastText = all.filter((el) => {
        if (!el.textContent || !el.textContent.trim() || el.children.length) return false;
        const fg = parseRGB(cs(el).color); if (!fg) return false;
        return ratio(fg, bodyBg) < 4.5;
      });
      if (lowContrastText.length >= 3) out.push({ rule: 'dark-low-contrast', hits: lowContrastText.length,
        sample: cs(lowContrastText[0]).color, note: 'Dark theme with body text under 4.5:1 contrast. The "muted grey on charcoal" slop look (and an a11y fail).' });
    }
  }

  /* 12. Everything centered (no asymmetry / editorial layout) */
  {
    const blocks = all.filter((el) => el.offsetWidth > 200 && el.offsetHeight > 40 &&
      (/^(section|div|header|main|article)$/i.test(el.tagName)));
    const centered = blocks.filter((el) => cs(el).textAlign === 'center');
    if (blocks.length >= 5 && centered.length / blocks.length >= 0.6) {
      out.push({ rule: 'everything-centered', hits: centered.length,
        sample: `${centered.length}/${blocks.length} blocks`, note: '≥60% of blocks center-aligned. Asymmetric, left-anchored layout reads more designed.' });
    }
  }

  return out;
}

/* ---- driver ---- */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => page.goto(url));
await page.waitForTimeout(400);
const findings = await page.evaluate(pageLint);
await browser.close();

const report = {
  schema: 'architecture-viz/slop-lint@1',
  url,
  total: findings.reduce((n, f) => n + 1, 0),
  findings,
};

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2));

/* console summary */
if (!findings.length) {
  console.log('✓ slop-lint: clean — no mechanical AI-slop markers found.');
  console.log('  (clean ≠ good design; taste/metaphor/feel still need a human eye.)');
} else {
  console.log(`slop-lint: ${findings.length} marker${findings.length === 1 ? '' : 's'} on ${url}\n`);
  for (const f of findings) {
    console.log(`  ✗ ${f.rule}  (${f.hits}× · e.g. ${f.sample})`);
    console.log(`    ${f.note}`);
  }
  console.log('\n  These are markers, not verdicts — a deliberate choice can be fine. Review each.');
}
process.exit(findings.length >= failOn ? 1 : 0);
