#!/usr/bin/env node
/* Render standalone design-system/slides/*.html to 1280x720 PNGs (layout catalog previews).

   Unlike shoot-slides.mjs (which shoots the BUILT React deck in dist-standalone), this
   serves the raw design-system/slides directory and screenshots each standalone layout
   HTML at exactly 1280x720. Used to regenerate the layout catalog previews.

   Usage:
     node scripts/shoot-layouts.mjs                 # all *.html in the slides dir
     node scripts/shoot-layouts.mjs --only 01,02,03 # only matching name prefixes
*/
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { readdirSync } from 'node:fs';
import { serveDir, launchBrowser, makeDeckRequire } from './lib/deck-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const deckDir = resolve(HERE, '..');
// Serve the design-system ROOT (not slides/) so each layout's relative
// `../styles.css` and `../assets/...` refs resolve — serving slides/ as root
// would make `../` escape the served tree and 404 the CSS + logos.
const dsRoot = resolve(deckDir, '../design-system');
const slidesDir = resolve(dsRoot, 'slides');
const flag = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const only = (flag('--only', null)?.split(',').map((s) => s.trim())) || null; // e.g. 01,02,03

(async () => {
  const { dep } = makeDeckRequire(deckDir);
  const srv = await serveDir(dsRoot);                          // { url, close } — serves design-system/
  const browser = await launchBrowser(dep);                    // returns the browser directly
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  let files = readdirSync(slidesDir).filter((f) => f.endsWith('.html'));
  if (only) files = files.filter((f) => only.some((n) => f.startsWith(n + '-') || f.startsWith(n)));
  files.sort();
  for (const f of files) {
    const name = basename(f, '.html');
    const base = srv.url.endsWith('/') ? srv.url : `${srv.url}/`;
    await page.goto(`${base}slides/${f}`, { waitUntil: 'load' });
    await page.waitForTimeout(300); // let webfonts/layout settle
    // Force the .slide box to fill the fixed 1280x720 frame, then clip the
    // viewport to exactly that region. Element .screenshot() captures the box's
    // laid-out height, which collapses when html/body have no height — giving
    // short PNGs. A clipped viewport shot is deterministic at 1280x720.
    await page.evaluate(() => {
      const s = document.querySelector('.slide');
      if (s) { s.style.width = '1280px'; s.style.height = '720px'; }
      document.documentElement.style.margin = '0';
      document.body.style.margin = '0';
    });
    await page.screenshot({ path: join(slidesDir, `${name}.png`), clip: { x: 0, y: 0, width: 1280, height: 720 } });
    console.log(`✓ ${name}.png`);
  }
  await browser.close();
  await srv.close?.();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
