#!/usr/bin/env node
/* ============================================================================
   export-deck.mjs — export an slide deck to standalone HTML, PDF, and PPTX.

   Edit mode is an AUTHORING tool — every export here strips it:
     • build-time: the standalone build runs with VITE_EDIT=off (overlay never bundled).
     • capture-time: before any screenshot/DOM-walk we remove every .em-* node and
       the nav, so a stray dev build can't leak the tool into a PDF/PPTX/HTML.

   USAGE
     node export-deck.mjs [deckDir] --format <fmt>[,<fmt>...]
       fmt: html | pdf | pptx-image | pptx-editable | all
       all = html,pdf,pptx-editable
     [--out <dir>]        output dir (default: <deckDir>/export)
     [--url <url>]        drive an already-running deck instead of building/serving
     [--slides <n>]       slide count (auto-detected from the page if omitted)

   FORMATS
     html          → vite standalone build → ONE self-contained deck.html (no edit mode).
     pdf           → screenshot each slide @1920×1080 → merged deck.pdf (pdf-lib).
     pptx-image    → screenshot each slide → full-bleed image per 16:9 slide. Perfect
                     fidelity, NOT editable.
     pptx-editable → DOM-walk each slide: real pptxgenjs textboxes (colored runs) +
                     shapes from the tagged elements; charts/icons pre-rasterized.
                     ~88-92% fidelity, fully editable text/shapes in PowerPoint.

   Rendering uses Playwright Chromium (see scripts/lib/deck-driver.mjs). Needs the
   deck's devDeps installed (playwright, pdf-lib, pptxgenjs). Run `npm install`
   then `npx playwright install chromium` in the deck dir first.
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import {
  enterPresentMode,
  sleep, buildStandalone, serveDir, openDeck, detectSlideCount, gotoSlide,
  injectHtmlToImage, makeDeckRequire,
} from './lib/deck-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
// positional deckDir = a bare token that is NOT a flag NOR a flag's value
// (so `--format pptx-editable,pptx-image` isn't mistaken for the deck path).
const flagVals = new Set();
['--format', '--out', '--url', '--slides'].forEach((f) => { const i = args.indexOf(f); if (i >= 0) flagVals.add(args[i + 1]); });
const positional = args.find((a) => !a.startsWith('--') && !flagVals.has(a));
// scripts live in <deck>/scripts/, so the deck root is the parent.
const deckDir = resolve(positional || resolve(HERE, '..'));
const outDir = resolve(flag('--out', join(deckDir, 'export')));
const urlOverride = flag('--url', null);
const slideCountArg = flag('--slides', null);

let formats = (flag('--format', 'all')).split(',').map((s) => s.trim());
if (formats.includes('all')) formats = ['html', 'pdf', 'pptx-editable'];

const VALID = ['html', 'pdf', 'pptx-image', 'pptx-editable'];
const bad = formats.filter((f) => !VALID.includes(f));
if (bad.length) { console.error(`unknown format(s): ${bad.join(', ')} — valid: ${VALID.join(', ')}, all`); process.exit(2); }

mkdirSync(outDir, { recursive: true });

const { deckRequire, dep } = makeDeckRequire(deckDir);

// screenshot every slide → array of PNG buffers (Playwright screenshot is a Buffer).
// CAPTURE RULE: pdf + pptx-image shoot in PRESENTATION mode (slide content only,
// full-bleed). Only the html export keeps both modes — and it never calls this.
async function shootSlides(page, total) {
  await enterPresentMode(page);
  const shots = [];
  for (let i = 0; i < total; i++) {
    await gotoSlide(page, i);
    shots.push(await page.screenshot({ type: 'png' }));
  }
  return shots;
}

// ── format: html ──
async function exportHtml() {
  await buildStandalone(deckDir);
  const src = join(deckDir, 'dist-standalone', 'index.html');
  if (!existsSync(src)) throw new Error('standalone build produced no index.html');
  const dest = join(outDir, 'deck.html');
  // edit mode is already absent (VITE_EDIT=off); copy out
  const { copyFileSync } = await import('node:fs');
  copyFileSync(src, dest);
  console.log(`✓ html  → ${dest}`);
}

// ── format: pdf ──
async function exportPdf(page, total) {
  const { PDFDocument } = await dep('pdf-lib');
  const shots = await shootSlides(page, total);
  const pdf = await PDFDocument.create();
  for (const png of shots) {
    const img = await pdf.embedPng(png);
    const pg = pdf.addPage([1280, 720]);
    pg.drawImage(img, { x: 0, y: 0, width: 1280, height: 720 });
  }
  const bytes = await pdf.save();
  const dest = join(outDir, 'deck.pdf');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(dest, bytes);
  console.log(`✓ pdf   → ${dest} (${total} slides)`);
}

// ── format: pptx-image ──
async function exportPptxImage(page, total) {
  const PptxGenJS = (await dep('pptxgenjs')).default;
  const shots = await shootSlides(page, total);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SLIDE16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'SLIDE16x9';
  for (const png of shots) {
    const slide = pptx.addSlide();
    slide.addImage({ data: 'data:image/png;base64,' + png.toString('base64'), x: 0, y: 0, w: 13.333, h: 7.5 });
  }
  // distinct name so running both pptx modes doesn't overwrite the editable one
  const dest = join(outDir, 'deck-image.pptx');
  await pptx.writeFile({ fileName: dest });
  console.log(`✓ pptx-image → ${dest} (full-bleed images, not editable)`);
}

// ── format: pptx-editable ──
// DOM-walk each slide into three layers — shapes (card/chip/rule backgrounds),
// images (rasterized svg/icons), and text — and emit native pptxgenjs objects.
// Key correctness rules (see references/pptx-export-research.md):
//   • A heading with an inline accent <span> becomes ONE textbox of colored RUNS
//     (not separate overlapping textboxes).
//   • px→pt is exactly ×0.75 (1280px@96dpi = 13.333in cancels the scale to 1.0);
//     line-height maps to lineSpacingMultiple so text doesn't drift.
//   • Shapes are emitted BEFORE text/images (z-order = insertion order).
//   • SVG/img are pre-rasterized to PNG (inline SVG embeds IMG_BROKEN in Node).
async function exportPptxEditable(page, total) {
  const PptxGenJS = (await dep('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SLIDE16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'SLIDE16x9';

  for (let i = 0; i < total; i++) {
    await gotoSlide(page, i);
    await injectHtmlToImage(page, deckRequire);   // (re)inject after each navigation
    const { shapes, texts, images } = await page.evaluate(() => {
      const SLIDE_W = 1280, SLIDE_H = 720;
      const root = document.querySelector('.slide-page');
      if (!root) return { shapes: [], texts: [], images: [] };
      const base = root.getBoundingClientRect();
      // canvas is scaled to fit; normalize every rect back to 1280×720 design space
      const sx = SLIDE_W / base.width, sy = SLIDE_H / base.height;
      const toHex = (c) => {
        const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
        const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n));
        if (a === 0) return null;
        return [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
      };
      const rectOf = (n) => {
        const r = n.getBoundingClientRect();
        return { x: (r.left - base.left) * sx, y: (r.top - base.top) * sy, w: r.width * sx, h: r.height * sy };
      };
      const isImgEl = (n) => n.tagName.toLowerCase() === 'img';
      // Decide whether a tagged element should be RASTERIZED WHOLE (an image) vs. kept
      // as a layout container (shapes + text). Rule (Phase 1 heuristic; Phase 2 replaces
      // this with explicit data-pptx-role):
      //   • <svg> / <img> element itself        → image
      //   • contains an svg AND a tagged text    → CARD: container, not an image
      //     descendant (h3/p with data-viz-id)
      //   • contains an svg, no tagged text       → CHART/ICON wrapper: image
      //     descendant
      const hasTaggedTextDescendant = (n) =>
        [...n.querySelectorAll('[data-viz-id]')].some((k) =>
          k !== n && !k.querySelector('svg') && k.tagName.toLowerCase() !== 'img'
          && (k.innerText || '').trim().length > 0);
      // n "owns" an svg when n is the NEAREST tagged ancestor of that svg — i.e. the
      // svg isn't inside a more-specific tagged element (an icon chip). A chart wrapper
      // owns its inline bars directly even though it also has a caption child.
      const ownsAnSvg = (n) =>
        [...n.querySelectorAll('svg')].some((s) => s.closest('[data-viz-id]') === n);
      const isSvgEl = (n) => {
        if (n.tagName.toLowerCase() === 'svg') return true;
        if (!n.querySelector('svg')) return false;
        if (!hasTaggedTextDescendant(n)) return true;   // icon chip / pure-svg wrapper
        return ownsAnSvg(n);                             // chart: owns inline svg bars
      };
      // an element whose nearest tagged ancestor is an SVG/chart is ALREADY inside a
      // rasterized image — don't also emit its text (avoids the doubled chart caption).
      const insideImage = (n) => {
        let p = n.parentElement && n.parentElement.closest('[data-viz-id]');
        while (p) { if (isSvgEl(p) || isImgEl(p)) return true; p = p.parentElement && p.parentElement.closest('[data-viz-id]'); }
        return false;
      };

      const shapes = [], texts = [], images = [];
      const all = [...root.querySelectorAll('[data-viz-id]')];
      const INLINE = new Set(['span', 'b', 'strong', 'em', 'i', 'a', 'small', 'mark', 'u', 'sub', 'sup']);
      const isInline = (n) => INLINE.has(n.tagName.toLowerCase()) && getComputedStyle(n).display.startsWith('inline');

      // A tagged element is ABSORBED (not emitted standalone) when it's an inline
      // child of another text-owning element — e.g. an accent <span> inside an <h1>.
      // Its text becomes a colored run of the parent's single textbox.
      const absorbed = new Set();
      for (const n of all) {
        if (!isInline(n)) continue;
        const host = n.parentElement && n.parentElement.closest('[data-viz-id]');
        if (host && !isSvgEl(host) && !isImgEl(host)) absorbed.add(n);
      }

      // a tagged element "owns text" if it has visible text and every tagged
      // descendant that bears text is an inline child (absorbed as a run).
      const ownsText = (n) => {
        if (isSvgEl(n) || isImgEl(n)) return false;
        if ((n.innerText || '').trim().length === 0) return false;
        const taggedKids = [...n.querySelectorAll('[data-viz-id]')];
        // any tagged descendant that bears text/img and is NOT an absorbed inline → this isn't a leaf
        return !taggedKids.some((k) => {
          const bearsText = (k.innerText || '').trim().length > 0;
          const bearsImg = !!k.querySelector('svg') || k.tagName.toLowerCase() === 'img';
          return (bearsText || bearsImg) && !absorbed.has(k);
        });
      };

      // collect colored runs from an element's children (text nodes + inline elements,
      // recursing into nested inline spans).
      const collectRuns = (n, inheritColor, inheritBold) => {
        const cs = getComputedStyle(n);
        const color = toHex(cs.color) || inheritColor;
        const bold = +cs.fontWeight >= 600 || inheritBold;
        const runs = [];
        n.childNodes.forEach((c) => {
          if (c.nodeType === 3) {
            const t = c.textContent.replace(/\s+/g, ' ');
            if (t.trim() || t === ' ') runs.push({ text: t, color, bold });
          } else if (c.nodeType === 1) {
            runs.push(...collectRuns(c, color, bold));
          }
        });
        return runs;
      };

      for (const n of all) {
        if (absorbed.has(n)) continue;                          // handled as a run of its host
        const cs = getComputedStyle(n);
        const box = rectOf(n);
        if (box.w < 2 || box.h < 2) continue;
        const id = n.getAttribute('data-viz-id');

        // images: svg/icon/img — pre-rasterized later; sized to THIS element's box
        if (isSvgEl(n) || isImgEl(n)) { images.push({ id, ...box }); continue; }
        // text/shapes inside a rasterized chart/image are already baked into the PNG
        if (insideImage(n)) continue;

        // shapes: a visible background fill (card / chip / rule). Emitted first.
        const bg = toHex(cs.backgroundColor);
        if (bg) shapes.push({ id, ...box, fill: bg, radius: parseFloat(cs.borderRadius) || 0 });

        // text: build a RUN ARRAY so an inline accent keeps ONE textbox.
        if (ownsText(n)) {
          // keep inter-word spaces (text " " between runs); drop only empty strings
          const runs = collectRuns(n, toHex(cs.color) || '0F172A', +cs.fontWeight >= 600)
            .filter((r) => r.text.length > 0);
          if (runs.length && runs.some((r) => r.text.trim())) {
            const lh = parseFloat(cs.lineHeight), fsPx = parseFloat(cs.fontSize);
            texts.push({
              ...box, runs, fs: fsPx,
              lineMult: lh && fsPx ? +(lh / fsPx).toFixed(3) : null,
              align: cs.textAlign,
            });
          }
        }
      }
      return { shapes, texts, images };
    });

    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    const IN = (px) => (px / 1280) * 13.333;   // design-px → inches (x)
    const INy = (px) => (px / 720) * 7.5;       // design-px → inches (y)

    // 1) SHAPES first (z-order: backgrounds sit behind everything)
    for (const s of shapes) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: IN(s.x), y: INy(s.y), w: IN(s.w), h: INy(s.h),
        fill: { color: s.fill },
        rectRadius: Math.min(0.2, IN(s.radius)),
        line: { type: 'none' },
      });
    }

    // 2) IMAGES — pre-rasterize each svg/img to PNG, sized to its element box
    for (const im of images) {
      try {
        const png = await page.evaluate(async (id) => {
          const node = document.querySelector(`[data-viz-id="${id}"]`);
          if (!node || !window.htmlToImage) return null;
          // capture the tagged element itself (the chip/box), not the raw svg — so
          // size matches the container and currentColor is already resolved.
          return await window.htmlToImage.toPng(node, { pixelRatio: 2, skipFonts: true });
        }, im.id);
        if (png) slide.addImage({ data: png, x: IN(im.x), y: INy(im.y), w: IN(im.w), h: INy(im.h) });
      } catch (_) { /* skip if rasterize fails */ }
    }

    // 3) TEXT on top — one textbox per element, colored runs, faithful line-height.
    for (const t of texts) {
      // fresh objects per call (pptxgenjs mutates option objects in place)
      const runObjs = t.runs.map((r) => ({
        text: r.text,
        // fontFace must exactly match the family name embedded in assets/fonts/*.otf
        // (verified via `fc-scan`) — PowerPoint/LibreOffice match embedded fonts by this string.
        options: { color: r.color, bold: r.bold, fontFace: 'Inter' },
      }));
      const opts = {
        x: IN(t.x), y: INy(t.y), w: Math.max(IN(t.w), 0.5),
        // give a little vertical headroom — PPTX/LibreOffice wrap the display font slightly
        // wider than Chrome, so a box sized to the exact browser height can overflow.
        h: Math.max(INy(t.h) + 0.12, 0.2),
        fontSize: Math.max(8, Math.round(t.fs * 0.75)),   // px → pt (exact at 96dpi)
        align: t.align === 'center' ? 'center' : t.align === 'right' ? 'right' : 'left',
        valign: 'top', margin: 0, fill: { type: 'none' },
        autoFit: false, shrinkText: false, wrap: true,
      };
      if (t.lineMult) opts.lineSpacingMultiple = t.lineMult;
      slide.addText(runObjs, opts);
    }
  }

  const dest = join(outDir, 'deck.pptx');
  await pptx.writeFile({ fileName: dest });
  console.log(`✓ pptx-editable → ${dest} (editable text + shapes; ~88-92% fidelity)`);
}

// ── orchestrate ──
(async () => {
  console.log(`Exporting ${deckDir} → ${outDir}  [${formats.join(', ')}]`);

  // html first (it does its own build); it doesn't need a driven page
  if (formats.includes('html')) await exportHtml();

  const needsPage = formats.some((f) => f !== 'html');
  if (needsPage) {
    // serve the standalone build if present, else require --url (a running dev server)
    let url = urlOverride, srv = null;
    if (!url) {
      const distIndex = join(deckDir, 'dist-standalone', 'index.html');
      if (!existsSync(distIndex)) await buildStandalone(deckDir);
      srv = await serveDir(join(deckDir, 'dist-standalone'));
      url = srv.url;
    }
    console.log(`• driving deck at ${url}`);
    const { browser, page } = await openDeck(url, { dep, width: 1920, height: 1080, scale: 2 });
    const total = await detectSlideCount(page, slideCountArg);
    console.log(`• ${total} slide(s)`);
    try {
      if (formats.includes('pdf')) { await exportPdf(page, total); await page.goto(url, { waitUntil: 'networkidle' }); await sleep(800); }
      if (formats.includes('pptx-image')) { await exportPptxImage(page, total); await page.goto(url, { waitUntil: 'networkidle' }); await sleep(800); }
      if (formats.includes('pptx-editable')) { await exportPptxEditable(page, total); }
    } finally {
      await browser.close();
      if (srv) srv.close();
    }
  }
  console.log('Done.');
})().catch((e) => { console.error('export failed:', e.message); process.exit(1); });
