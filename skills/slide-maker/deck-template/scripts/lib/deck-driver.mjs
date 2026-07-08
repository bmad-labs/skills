/* ============================================================================
   deck-driver.mjs — shared headless rendering plumbing for the deck.

   Used by both scripts/export-deck.mjs (HTML/PDF/PPTX) and scripts/shoot-slides.mjs
   (visual-review PNGs). Built on Playwright Chromium — one launch path, no
   browser-binary fallback gymnastics. If the browser is missing, run:
       npx playwright install chromium   (inside the deck dir)

   Everything is parameterized by deckDir, so a caller passes its own deck path.
   ============================================================================ */

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Remove the edit-mode overlay + nav from the live DOM before a clean capture, and
// flag .deck-export so the stage drops its Normal-mode inset and fills the 1280×720
// frame (CSS in index.css). (Exports always strip; the review "normal" mode strips;
// "labeled" mode does NOT.)
export const STRIP = () => {
  document.documentElement.classList.add('deck-export');
  document.querySelectorAll('.em-root,.em-fab,.em-toolbar,.em-panel,.em-overlay,.em-popup,.em-sel-chip,.em-toast,.em-snip,.em-marquee,.em-brush,[data-navigation]')
    .forEach((n) => n.remove());
};

// THE CAPTURE RULE (single source of truth):
//   Every script that shoots slide PIXELS — shoot-slides (review), export-pptx-jsx
//   (editable PPTX), pptx-image, pdf — captures in PRESENTATION mode: slide content
//   ONLY, full-bleed 1280×720, no rail / topbar / grid / margin. The ONLY exception
//   is the standalone-HTML export, which deliberately ships BOTH normal + present.
//
// Call this right after openDeck(), before any navigation/measurement/screenshot.
// It uses the deck's own presentation mode (__DECK.setPresent) so source renders and
// every export line up 1:1 — and also adds .deck-export as a belt-and-suspenders
// full-bleed guarantee in case a build predates setPresent.
export async function enterPresentMode(page) {
  await page.evaluate(() => {
    if (window.__DECK && typeof window.__DECK.setPresent === 'function') window.__DECK.setPresent(true);
    document.documentElement.classList.add('deck-export');
  });
  await sleep(600);   // let the mode switch + layout settle
}

// Resolve a dep (playwright/pdf-lib/pptxgenjs/html-to-image) from the DECK's
// node_modules — these scripts live in the skill's scripts/, the deps in the deck.
export function makeDeckRequire(deckDir) {
  const deckRequire = createRequire(join(deckDir, 'package.json'));
  const dep = async (name) => {
    try { return await import(pathToFileURL(deckRequire.resolve(name)).href); }
    catch {
      try { return await import(name); }
      catch { throw new Error(`Missing "${name}". Run "npm install" in ${deckDir} first.`); }
    }
  };
  return { deckRequire, dep };
}

// Build the standalone single-file deck (VITE_EDIT=off → edit-mode never bundled).
export function buildStandalone(deckDir) {
  return new Promise((res, rej) => {
    console.log('• building standalone deck (VITE_EDIT=off)…');
    const p = spawn('npm', ['run', 'build:standalone'], {
      cwd: deckDir, stdio: 'inherit', env: { ...process.env, VITE_EDIT: 'off' },
    });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error('build:standalone failed'))));
  });
}

// Serve a directory statically. Returns { url, close }.
export function serveDir(dir, port = 0) {
  return new Promise((res) => {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
    const srv = createServer((req, rq) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/' || p.endsWith('/')) p += 'index.html';
      const file = join(dir, p);
      if (!file.startsWith(dir) || !existsSync(file)) { rq.writeHead(404); return rq.end('not found'); }
      const ext = p.slice(p.lastIndexOf('.'));
      rq.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      rq.end(readFileSync(file));
    });
    srv.listen(port, () => res({ url: `http://localhost:${srv.address().port}/`, close: () => srv.close() }));
  });
}

// Launch Playwright Chromium headless. No fallback chain needed — it just works;
// a clear hint is surfaced if the browser binary isn't installed.
export async function launchBrowser(dep) {
  const pw = await dep('playwright');
  // When resolved from the deck's node_modules via a file URL, playwright's named
  // exports land on `.default` (CJS interop) rather than the top-level namespace.
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  if (!chromium) throw new Error('playwright loaded but chromium export not found.');
  try {
    return await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  } catch (e) {
    throw new Error(`Playwright could not launch Chromium (${e.message}). Run "npx playwright install chromium" in the deck dir.`);
  }
}

// Open the deck: launch + page + viewport + goto + settle. Returns { browser, page }.
// width/height default to the 1280×720 slide canvas; scale = deviceScaleFactor.
export async function openDeck(url, { dep, width = 1280, height = 720, scale = 1 } = {}) {
  const browser = await launchBrowser(dep);
  const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width, height } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await sleep(1000);
  return { browser, page };
}

export async function detectSlideCount(page, override) {
  if (override) return +override;
  return await page.evaluate(() => {
    // Prefer the deck's own exposed count; fall back to the rail's slide buttons.
    if (window.__DECK && window.__DECK.total) return window.__DECK.total;
    const rail = document.querySelectorAll('[data-navigation] [aria-label^="Slide "]').length;
    return rail || 1;
  });
}

// Navigate to slide i. Prefer the deck's exposed goTo (chrome-independent, exact);
// fall back to ArrowRight stepping. strip=true removes edit-mode/nav and flags the
// export layout. settle covers count-up springs + reveal animations before capture.
export async function gotoSlide(page, i, { strip = true } = {}) {
  const jumped = await page.evaluate((idx) => {
    if (window.__DECK && typeof window.__DECK.goTo === 'function') { window.__DECK.goTo(idx); return true; }
    return false;
  }, i);
  if (!jumped && i > 0) { await page.keyboard.press('ArrowRight'); }
  await sleep(900);
  if (strip) await page.evaluate(STRIP);
  await sleep(900);
}

// Inject html-to-image into the page (for editable-PPTX SVG/chart rasterization).
export async function injectHtmlToImage(page, deckRequire) {
  try {
    const path = deckRequire.resolve('html-to-image/dist/html-to-image.js');
    await page.addScriptTag({ path });
  } catch (_) { /* optional — degrades to skipping the image */ }
}

// Inject the edit-mode overlay (js+css) into the served page, for labeled/inspect
// review renders. The export build strips edit-mode, so the review re-injects it.
// `dir` is the deck root; falls back to a deck-template/ subdir if present.
export async function injectEditMode(page, dir) {
  const candidates = [
    resolve(dir, 'public', 'edit-mode'),
    resolve(dir, 'deck-template', 'public', 'edit-mode'),
  ];
  const base = candidates.find((c) => existsSync(join(c, 'edit-mode.js')));
  if (!base) throw new Error(`edit-mode assets not found under ${dir}`);
  await page.addStyleTag({ content: readFileSync(join(base, 'edit-mode.css'), 'utf8') });
  await page.addScriptTag({ content: readFileSync(join(base, 'edit-mode.js'), 'utf8') });
}

export { mkdirSync };
