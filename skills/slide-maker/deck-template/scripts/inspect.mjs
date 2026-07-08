#!/usr/bin/env node
/* ============================================================================
   inspect.mjs — built-in agent inspection tool.

   When the agent needs to know an element's POSITION, BOUNDARY, COORDINATES, or the
   VISUAL RELATIONSHIP between elements (gaps, alignment, overlap), it runs this to
   get, for a slide or a set of `data-viz-id`s:

     • geometry  — {id, x, y, w, h} per element (derive spacing/alignment/overlap)
     • a HIGHLIGHTED capture — the slide with the elements boxed + id-labelled, so
       their positions and spatial relations are visible at a glance
     • a CLEAN capture — the same region with no overlay, to judge the real visual

   This is the headless, programmatic counterpart to a human selecting elements in
   edit mode. It drives the in-page `window.EditMode` API (inspect / addComment /
   getFeedback). Writes to /tmp by default so the deck stays clean.

   USAGE
     node scripts/inspect.mjs [deckDir] [--slide N] [--ids a,b,c]
                              [--mode highlight|clean|both]   (default: both)
                              [--all]                          (target every tagged el)
                              [--comment "text"]               (also author a feedback comment)
                              [--out /tmp/slide-maker-inspect]
   OUTPUT (in --out)
     geometry.json                 [{id,x,y,w,h}, …] for the targeted elements
     slide-NN-highlight.png        capture WITH the id boxes drawn
     slide-NN-clean.png            capture WITHOUT overlay (the real visual)
     edit-feedback.json + snip.png (only with --comment — the slide-maker/edit-feedback@1 batch)
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import {
  sleep, buildStandalone, serveDir, openDeck, detectSlideCount, gotoSlide,
  injectEditMode, makeDeckRequire,
} from './lib/deck-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const has = (f) => args.includes(f);
const flagVals = new Set();
['--slide', '--ids', '--mode', '--comment', '--out'].forEach((f) => { const i = args.indexOf(f); if (i >= 0) flagVals.add(args[i + 1]); });
const positional = args.find((a) => !a.startsWith('--') && !flagVals.has(a));
const deckDir = resolve(positional || resolve(HERE, '..'));
const slideN = +flag('--slide', '1');
const idsArg = flag('--ids', null);
const mode = flag('--mode', 'both');          // highlight | clean | both
const allEls = has('--all');
const commentText = flag('--comment', null);
const outDir = flag('--out', '/tmp/slide-maker-inspect');
mkdirSync(outDir, { recursive: true });
const { dep } = makeDeckRequire(deckDir);
const pad = (n) => String(n).padStart(2, '0');

(async () => {
  const distIndex = join(deckDir, 'dist-standalone', 'index.html');
  if (!existsSync(distIndex)) await buildStandalone(deckDir);
  const srv = await serveDir(join(deckDir, 'dist-standalone'));
  const { browser, page } = await openDeck(srv.url, { dep, width: 1280, height: 720, scale: 1 });
  const written = [];

  try {
    const total = await detectSlideCount(page);
    // Full-bleed geometry: add .deck-export so the slide fills the canonical 1280×720
    // frame (no normal-mode margin inset) — geometry coords then match the export/
    // present frame, so the geometry gate's bounds (y+h ≤ 648 etc.) are exact. We stay
    // in NORMAL mode (not present) because edit-mode's inspect() needs the editor DOM.
    await page.evaluate(() => document.documentElement.classList.add('deck-export'));
    // navigate by ABSOLUTE index (__DECK.goTo is absolute; a relative-step loop parked
    // every slide on index 1 — the same bug fixed in export-pptx-jsx).
    await gotoSlide(page, slideN - 1, { strip: false });
    await injectEditMode(page, deckDir);
    await page.evaluate(() => window.EditMode.init({}));
    await sleep(300);

    // targets: --ids, else --all, else every tagged element (minus the slide root)
    const ids = await page.evaluate(({ csv, all }) => {
      if (csv) return csv.split(',').map((s) => s.trim()).filter(Boolean);
      const list = [...document.querySelectorAll('.slide-page [data-viz-id]')]
        .map((n) => n.getAttribute('data-viz-id'));
      return all ? list : list.filter((id) => !/^s\d+$/.test(id));
    }, { csv: idsArg, all: allEls });

    // ── geometry (position / boundary / coordinates) ──
    const geometry = await page.evaluate((ids) => window.EditMode.inspect({ ids }), ids);
    writeFileSync(join(outDir, 'geometry.json'), JSON.stringify(geometry, null, 2));
    written.push('geometry.json');
    console.log(`• ${geometry.length} element(s); slide ${slideN}; mode ${mode}`);

    // ── HIGHLIGHT capture (boxes + id labels still drawn) ──
    if (mode === 'highlight' || mode === 'both') {
      await page.evaluate((ids) => window.EditMode.inspect({ ids }), ids);
      await page.evaluate(() => document.querySelectorAll('[data-navigation]').forEach((el) => el.remove()));
      await sleep(120);
      const f = `slide-${pad(slideN)}-highlight.png`;
      writeFileSync(join(outDir, f), await page.screenshot({ type: 'png' }));
      written.push(f);
    }

    // ── CLEAN capture (overlay cleared; the real visual) ──
    if (mode === 'clean' || mode === 'both') {
      await page.evaluate(() => { window.EditMode.inspect({ clear: true }); document.querySelectorAll('.em-root,[data-navigation]').forEach((el) => el.remove()); });
      await sleep(120);
      const f = `slide-${pad(slideN)}-clean.png`;
      writeFileSync(join(outDir, f), await page.screenshot({ type: 'png' }));
      written.push(f);
    }

    // ── optional: author a feedback comment (the full edit-mode round-trip) ──
    if (commentText) {
      await page.evaluate(() => window.EditMode.inspect({ clear: true }));
      await page.evaluate(async ({ ids, text }) => window.EditMode.addComment({ ids, text }), { ids, text: commentText });
      const batch = await page.evaluate(() => window.EditMode.getFeedback(true));
      batch.comments.forEach((c, i) => {
        if (c.screenshotDataUrl) {
          const file = c.screenshotFile || `snip-${i + 1}.png`;
          writeFileSync(join(outDir, file), Buffer.from(c.screenshotDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
          c.imagePath = join(outDir, file); written.push(file);
        }
        delete c.screenshotDataUrl;
      });
      batch.imageDir = outDir;
      writeFileSync(join(outDir, 'edit-feedback.json'), JSON.stringify(batch, null, 2));
      written.push('edit-feedback.json');
    }

    console.log(`\nWrote to ${outDir}:`);
    written.forEach((f) => console.log('  ' + join(outDir, f)));
    console.log('\nRead the PNGs to see element positions/relationships; geometry.json for exact coords.');
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error('inspect failed:', e.message); process.exit(1); });
