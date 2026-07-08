#!/usr/bin/env node
/* ============================================================================
   export-pptx-jsx.mjs — high-fidelity EDITABLE PPTX export via @artifact-kit/
   pptxgenjs-jsx measure-contract + display-font embedding.

   Pipeline (per the research in docs/research/pptx-export-*):
     1. build standalone deck, serve, open slide N (Playwright), strip edit-mode/nav
     2. inject data-ak-* attributes (alias our data-viz-id → data-ak-measure;
        stamp the slide root with data-ak-slide/width/height/px-per-in)
     3. inject the pptxgenjs-jsx IIFE; measureArtifacts()
     4. author the <Deck> tree by id-convention → native Text / RoundRect / Line /
        BarChart / Table objects, using readPptBox()/readFontPt()
     5. validateDeck() → renderPptx() → base64 → Node writes deck.pptx
     6. post-process: embed the display font (pptx-embed-fonts) into the .pptx zip

   SPIKE SCOPE: slide 1 (company-intro) — eyebrow/title/rule/3 cards/footer.
   Generalizes later to chart + all slides.

   USAGE
     node scripts/export-pptx-jsx.mjs [deckDir] [--slide N] [--out export/deck.pptx]
                                      [--no-fonts]
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import {
  sleep, buildStandalone, serveDir, openDeck, detectSlideCount, gotoSlide,
  makeDeckRequire, injectHtmlToImage, enterPresentMode,
} from './lib/deck-driver.mjs';
import { svgToCustomGeometryNodes } from './lib/svg-to-custgeom.mjs';
import { buildOp } from './lib/pptx-builders.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const has = (f) => args.includes(f);
const flagVals = new Set();
['--slide', '--out'].forEach((f) => { const i = args.indexOf(f); if (i >= 0) flagVals.add(args[i + 1]); });
const positional = args.find((a) => !a.startsWith('--') && !flagVals.has(a));
const deckDir = resolve(positional || resolve(HERE, '..'));
// --slide N exports ONE slide; omit it to export the WHOLE deck into one file.
const slideArg = flag('--slide', null);
const slideN = slideArg ? +slideArg : null;     // null → all slides
const outPath = resolve(flag('--out', join(deckDir, 'export', 'deck.pptx')));
// Font embedding is OPT-IN: pptx-embed-fonts writes .fntdata parts that PowerPoint
// honors but LibreOffice mis-renders (garbled text) — and they 10×+ the file size.
// The deck is Latin text; rely on the installed font. Use --embed-fonts for a
// portable file destined for machines without the display font (verify in PowerPoint).
const embedFonts = has('--embed-fonts');
const { dep, deckRequire } = makeDeckRequire(deckDir);

// resolve the library assets we inject / use
const PKG = join(deckDir, 'node_modules', '@artifact-kit', 'pptxgenjs-jsx', 'dist');
const IIFE = join(PKG, 'pptxgenjs-jsx.browser.iife.js');
const FONT_DIR = join(deckDir, 'assets', 'fonts');
const WALK_SRC = readFileSync(join(HERE, 'lib', 'dom-walk.browser.js'), 'utf8');   // injected browser walker

const PX_PER_IN = 96;            // 1280/13.333 → standard widescreen layout
const CJK_H_BUFFER = 1.10;       // +10% height for CJK line-box inflation
const BRAND = {                  // theme tokens (hex, no #) — must match the deck theme
  green: '4F46E5', greenDeep: '4338CA', ink: '0F172A', yellow: 'D97706',
  textPrimary: '0F172A', textSecondary: '475569', textMuted: '94A3B8',
  cardBg: 'FFFFFF', cardBorder: 'E2E8F0', chipBg: 'EEF2FF',
};
// FONT must exactly match the family name embedded in assets/fonts/*.otf (verified via
// `fc-scan`) — pptxgenjs/PowerPoint/LibreOffice match embedded fonts by this exact string.
const FONT = 'Noto Sans JP';

mkdirSync(dirname(outPath), { recursive: true });

(async () => {
  const distIndex = join(deckDir, 'dist-standalone', 'index.html');
  if (!existsSync(distIndex)) await buildStandalone(deckDir);
  const srv = await serveDir(join(deckDir, 'dist-standalone'));
  const { browser, page } = await openDeck(srv.url, { dep, width: 1280, height: 720, scale: 1 });

  try {
    // CAPTURE RULE: measure in PRESENTATION mode — slide content only, full-bleed,
    // no rail/topbar/grid. (Shared helper; same mode every export + review uses.)
    await enterPresentMode(page);

    const total = await detectSlideCount(page);
    const AK = await dep('@artifact-kit/pptxgenjs-jsx');
    const { Deck, Slide, Text, TextRun, RoundRect, Table, TableRow, TableCell, CustomGeometry, Image, h, validateDeck, write } = AK;

    // which slides to export: a single --slide N, else all of them (1..total)
    const targets = slideN ? [slideN] : Array.from({ length: total }, (_, i) => i + 1);

    // Measure + build ONE slide (whatever is currently visible) → a <Slide> node.
    const captureCurrentSlide = async () => {
    await page.evaluate(() => { try { window.dispatchEvent(new Event('resize')); } catch (_) {} });
    await sleep(300);

    // ── 2. stamp data-ak-* attributes onto the live DOM ──
    // The deck may keep several `.slide-page` nodes mounted; pick the VISIBLE one
    // (largest on-screen area) as the active slide root, and only alias ids within it.
    const rootVizId = await page.evaluate(({ pxPerIn }) => {
      const pages = [...document.querySelectorAll('.slide-page')];
      const visible = pages
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 1 && r.height > 1 &&
          r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight)
        .sort((a, b) => (b.r.width * b.r.height) - (a.r.width * a.r.height));
      const root = (visible[0] || { el: pages[0] }).el;
      if (!root) throw new Error('no .slide-page root found');
      root.setAttribute('data-ak-slide', 'slide');
      const rr = root.getBoundingClientRect();
      root.setAttribute('data-ak-width', String(Math.round(rr.width)));
      root.setAttribute('data-ak-height', String(Math.round(rr.height)));
      root.setAttribute('data-ak-px-per-in', String(pxPerIn));
      // alias data-viz-id → data-ak-measure ONLY within the active slide root
      root.querySelectorAll('[data-viz-id]').forEach((n) => {
        n.setAttribute('data-ak-measure', n.getAttribute('data-viz-id'));
      });
      return root.getAttribute('data-viz-id');
    }, { pxPerIn: PX_PER_IN });
    console.log(`• active slide root: ${rootVizId}`);

    // ── 3. inject the pptxgenjs-jsx IIFE + run measurement; return measurements ──
    // We MEASURE in the page (the measure-contract needs the live DOM) but BUILD +
    // RENDER the deck in Node — the in-page render drops children in this IIFE build.
    await page.addScriptTag({ content: readFileSync(IIFE, 'utf8') });
    await page.addScriptTag({ content: WALK_SRC });
    const measured = await page.evaluate(() => window.__slideWalk());

    // ── 3b. rasterise to PNG in-page: complex icons (gradient/mask) + every chart
    // <svg> graphic. Captured via html-to-image; emitted as native <Image> in PPTX. ──
    const rasterJobs = [
      ...measured.ops.filter((o) => o.kind === 'icon' && o.complex && o.id).map((o) => ({ o, sel: `[data-viz-id="${o.id}"]`, key: 'iconPng' })),
      ...measured.ops.filter((o) => o.kind === 'graphic' && o.gid).map((o) => ({ o, sel: `[data-ak-graphic="${o.gid}"]`, key: 'png' })),
    ];
    if (rasterJobs.length) {
      await injectHtmlToImage(page, deckRequire);
      const shots = await page.evaluate(async (jobs) => {
        const out = {}; const h2i = window.htmlToImage; if (!h2i || !h2i.toPng) return out;
        for (const j of jobs) {
          const el = document.querySelector(j.sel); if (!el) continue;
          try { out[j.sel] = await h2i.toPng(el, { backgroundColor: null, skipFonts: true, cacheBust: false, pixelRatio: 3 }); } catch (_) {}
        }
        return out;
      }, rasterJobs.map((j) => ({ sel: j.sel })));
      rasterJobs.forEach((j) => { if (shots[j.sel]) j.o[j.key] = shots[j.sel]; });
    }

    // ── 4. BUILD this slide's objects in Node from the generic OPS ──
    // Build each op into native node(s) via the kind→builder dispatch (lib/pptx-builders).
    const builderCtx = {
      h, AK, FONT, BRAND, CJK_H_BUFFER, svgToCustomGeometryNodes,
      nodes: { Text, TextRun, RoundRect, Image, Table, TableRow, TableCell },
    };
    const kids = measured.ops.flatMap((op) => buildOp(op, builderCtx));

      return { node: h(Slide, { background: { color: 'FFFFFF' } }, ...kids), count: kids.length, layout: measured.layout, ops: measured.ops };
    };  // end captureCurrentSlide

    // ── navigate to each target slide and capture it ──
    const slideNodes = [];
    const opsBySlide = {};      // for --dump-ops: the typed ops per slide (verify ground truth)
    for (let i = 0; i < targets.length; i++) {
      const idx = targets[i];                         // 1-based
      // __DECK.goTo is ABSOLUTE (0-based index) — jump straight to this slide. (The
      // earlier relative-step loop assumed a relative goTo and parked every slide on
      // index 1, so all content slides exported as slide 2's DOM.)
      await gotoSlide(page, idx - 1, { strip: true });
      const { node, count, ops } = await captureCurrentSlide();
      slideNodes.push(node);
      // strip heavy base64 PNGs from the dumped ops (geometry + style is what verify needs)
      opsBySlide[idx] = ops.map((o) => { const { iconPng, png, icon, ...rest } = o; return { ...rest, hasIcon: !!(icon || iconPng || png) }; });
      console.log(`  ✓ slide ${idx}: ${count} objects`);
    }
    if (has('--dump-ops')) {
      const opsPath = join(dirname(outPath), 'ops.json');
      writeFileSync(opsPath, JSON.stringify(opsBySlide, null, 2));
      console.log(`• ops → ${opsPath}`);
    }

    // ── 5. assemble ONE Deck with all captured slides, validate, render ──
    // The slide is a fixed 1280×720 canvas; every element box was measured at 96 DPI
    // (boxOf uses PXIN=96 → 1280/96 = 13.333in, 720/96 = 7.5in). The Deck layout MUST
    // use those same inches or content overflows: readSlideLayout reports the size at a
    // different DPI (e.g. 10.667×6 at 120 DPI), which would shrink the slide below the
    // element coordinates and push the right/bottom content off the slide. So pin the
    // canonical 16:9 inches that match boxOf, regardless of what the layout probe says.
    const SLIDE_W_IN = 1280 / PX_PER_IN;   // 13.333
    const SLIDE_H_IN = 720 / PX_PER_IN;    // 7.5
    const deck = h(Deck, { title: 'Slide Deck', layout: { name: 'Slide16x9', width: SLIDE_W_IN, height: SLIDE_H_IN } }, ...slideNodes);
    const issues = validateDeck(deck) || [];
    const errs = issues.filter((i) => i.level === 'error');
    if (errs.length) throw new Error('validateDeck errors: ' + JSON.stringify(errs, null, 2));
    console.log(`• ${slideNodes.length} slide(s) authored`);

    let buf = Buffer.from(await write(deck, { outputType: 'base64' }), 'base64');

    // ── 6. embed the display font into the .pptx (post-process the zip) ──
    if (embedFonts) {
      try {
        const efMod = await dep('pptx-embed-fonts');
        const PPTXEmbedFonts = efMod.default?.default || efMod.default || efMod;
        const jszipMod = await dep('jszip');
        const JSZip = jszipMod.default || jszipMod;
        const zip = await JSZip.loadAsync(buf);
        const ef = new PPTXEmbedFonts();
        await ef.loadZip(zip);
        const reg = readFileSync(join(FONT_DIR, 'NotoSansJP-Regular.otf'));
        const bold = readFileSync(join(FONT_DIR, 'NotoSansJP-Bold.otf'));
        await ef.addFontFromOTF(FONT, reg.buffer.slice(reg.byteOffset, reg.byteOffset + reg.byteLength));
        await ef.addFontFromOTF(FONT, bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength));
        await ef.updateFiles();
        const out = await ef.save();
        buf = Buffer.isBuffer(out) ? out : Buffer.from(out);
        console.log('✓ embedded display font (Regular+Bold)');
      } catch (e) {
        console.log('⚠ font embed skipped: ' + e.message);
      }
    }

    writeFileSync(outPath, buf);
    console.log(`✓ pptx (jsx) → ${outPath}  (${(buf.length / 1024).toFixed(0)} KB)`);
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error('export-pptx-jsx failed:', e.stack || e.message); process.exit(1); });
