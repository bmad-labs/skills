#!/usr/bin/env node
/* ============================================================================
   shoot-slides.mjs — render deck slides to PNG files for agent visual self-review.

   The agent (Claude) reads PNGs natively, so this just produces the images + (for
   labeled/inspect modes) draws the edit-mode id-boxes so the agent can map a
   visual defect to the exact data-viz-id. See references/visual-review.md.

   USAGE
     node shoot-slides.mjs [deckDir] [--out review/] [--slide N] [--scale 1|2]
                           [--mode normal|labeled|both] [--inspect id1,id2,...]

   MODES
     normal  (default)  → clean slide (edit-mode stripped, like exports) → slide-NN.png
     labeled            → every element boxed + named (EditMode.inspect({all}))
                          → slide-NN-labeled.png
     both               → writes both
     --inspect <ids>    → box only those ids (EditMode.inspect({ids})) → slide-NN-inspect.png

   Rendering = Playwright Chromium via lib/deck-driver.mjs. Needs the deck's
   devDeps: `npm install` + `npx playwright install chromium` in the deck dir.
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import {
  sleep, buildStandalone, serveDir, openDeck, detectSlideCount, gotoSlide,
  injectEditMode, makeDeckRequire, enterPresentMode,
} from './lib/deck-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
// scripts live in <deck>/scripts/, so the deck root is the parent. The positional
// deckDir must not swallow a flag's value (e.g. the `1` in `--slide 1`).
const _flagVals = new Set();
['--out', '--slide', '--scale', '--mode', '--inspect'].forEach((f) => { const i = args.indexOf(f); if (i >= 0) _flagVals.add(args[i + 1]); });
const deckDir = resolve(args.find((a) => !a.startsWith('--') && !_flagVals.has(a)) || resolve(HERE, '..'));
const outDir = resolve(flag('--out', join(deckDir, 'review')));
const onlySlide = flag('--slide', null);        // 1-based
const scale = +flag('--scale', '1');
const inspectIds = flag('--inspect', null);     // "s0.title,s0.kpi.value"
let mode = flag('--mode', inspectIds ? 'inspect' : 'normal');

mkdirSync(outDir, { recursive: true });
const { dep } = makeDeckRequire(deckDir);

const pad = (n) => String(n).padStart(2, '0');

(async () => {
  // build (or reuse) the standalone deck
  const distIndex = join(deckDir, 'dist-standalone', 'index.html');
  if (!existsSync(distIndex)) await buildStandalone(deckDir);
  const srv = await serveDir(join(deckDir, 'dist-standalone'));
  console.log(`• serving deck at ${srv.url}`);

  const { browser, page } = await openDeck(srv.url, { dep, width: 1280, height: 720, scale });
  const total = await detectSlideCount(page);
  console.log(`• ${total} slide(s); mode=${mode}${inspectIds ? ` ids=${inspectIds}` : ''}`);

  const doNormal = mode === 'normal' || mode === 'both';
  const doLabeled = mode === 'labeled' || mode === 'both' || mode === 'inspect';
  const labelSuffix = mode === 'inspect' ? 'inspect' : 'labeled';

  // CAPTURE RULE: clean ("normal") shots are PRESENTATION mode (slide content only,
  // full-bleed) so they line up 1:1 with every export. labeled/inspect must stay in
  // the editor (normal mode) for edit-mode to draw id-boxes, so only enter present
  // mode when we're NOT doing a labeled pass.
  if (doNormal && !doLabeled) await enterPresentMode(page);

  const written = [];
  try {
    for (let i = 0; i < total; i++) {
      const n = i + 1;
      // navigate to this slide (no strip — we control stripping per shot below)
      await gotoSlide(page, i, { strip: false });
      if (onlySlide && n !== +onlySlide) continue;   // pass through to reach target

      // NORMAL: clean full-bleed capture. When not also doing a labeled pass we are
      // already in presentation mode (slide content only) via enterPresentMode above.
      // For the combined `--mode both` case we stay in the editor, so add .deck-export
      // here to fill the frame and remove residual chrome before the clean shot.
      if (doNormal) {
        if (doLabeled) {
          await page.evaluate(() => {
            document.documentElement.classList.add('deck-export');
            document.querySelectorAll('.em-root,.em-overlay,[data-navigation]').forEach((el) => el.remove());
          });
        }
        const p = join(outDir, `slide-${pad(n)}.png`);
        writeFileSync(p, await page.screenshot({ type: 'png' }));
        written.push(p);
        if (doLabeled) await page.evaluate(() => document.documentElement.classList.remove('deck-export'));
      }

      // LABELED / INSPECT: inject edit-mode (idempotent), draw boxes, capture
      if (doLabeled) {
        await injectEditMode(page, deckDir);
        const geom = await page.evaluate((idsCsv) => {
          if (!window.EditMode) return [];
          document.querySelectorAll('[data-navigation]').forEach((el) => { el.style.visibility = 'hidden'; });
          return idsCsv
            ? window.EditMode.inspect({ ids: idsCsv.split(',').map((s) => s.trim()).filter(Boolean) })
            : window.EditMode.inspect({ all: true });
        }, mode === 'inspect' ? inspectIds : null);
        await sleep(150);
        const p = join(outDir, `slide-${pad(n)}-${labelSuffix}.png`);
        writeFileSync(p, await page.screenshot({ type: 'png' }));
        written.push(p);
        await page.evaluate(() => window.EditMode && window.EditMode.inspect({ clear: true }));
        if (geom && geom.length) {
          writeFileSync(join(outDir, `slide-${pad(n)}-${labelSuffix}.json`), JSON.stringify(geom, null, 2));
        }
      }
    }
  } finally {
    await browser.close();
    srv.close();
  }

  console.log(`\nWrote ${written.length} image(s):`);
  written.forEach((p) => console.log('  ' + p));
  console.log(`\nRead these PNGs and review against references/visual-review.md.`);
})().catch((e) => { console.error('shoot failed:', e.message); process.exit(1); });
