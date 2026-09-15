#!/usr/bin/env node
/* ============================================================================
   verify.mjs — automated browser verification for animated viz pages.

   WHY
   These pages are visual and animation-timed; you cannot confirm them by reading
   code, and a single screenshot misses overflow, clipping, contrast, jank, and
   "did the WebGL canvas actually render". This runs the objective, machine-
   checkable layer so a human only has to judge the things that genuinely need
   taste. A clean run is a floor ("nothing mechanically broken"), not a ceiling
   ("this is good") — see references/visual-verification.md for the honest
   division of labor.

   WHAT IT CHECKS (all headless, zero paid cloud)
   1. Console — no errors/warnings on load.
   2. Layout probes across 3 viewports (375 / 768 / 1280): horizontal overflow,
      element overlap of tagged components, text clipping.
   3. Accessibility + contrast via axe-core (WCAG 2.2 AA) → machine-readable JSON.
      (Reminder: automation covers ~1/3 of WCAG criteria — a floor, not proof.)
   4. WebGL/canvas actually rendered — screenshots the canvas and asserts the
      pixels aren't uniform/black (NOT gl.readPixels, which false-reports black
      because three.js uses preserveDrawingBuffer:false).
   5. Animation determinism for screenshots — drives GSAP via an exposed
      `window.__tl.progress(p)` hook (NOT page.clock, which doesn't reliably pin
      a frame). Optional visual-regression baseline via toHaveScreenshot-style
      pixel compare is left to Playwright Test; here we capture labelled frames.
   6. Jank/CPU during a scripted scroll — long-animation-frame + long-task counts
      and rAF frame-time distribution. We report jank, NOT "fps": headless GPU
      timing is not representative of real hardware.

   HOW TO MAKE A PAGE VERIFIABLE
   - Expose your master timeline: `window.__tl = myGsapTimeline;` (test/debug build).
     For raw rAF/Three pages, expose `window.__renderFrame = () => renderer.render(scene,camera);`
   - Tag components with data-viz-id (you already do for edit-mode).

   USAGE
     node scripts/verify.mjs <url|file> [--out report.json] [--shots dir/] [--frames 0,0.5,1]
   Requires Playwright: npm i -D @playwright/test && npx playwright install chromium
   For deterministic WebGL across machines, launch flags below pin a software
   renderer (the auto-SwiftShader fallback was deprecated in Chromium; the
   --enable-unsafe-swiftshader opt-in is now required or WebGL context creation
   can fail and you screenshot a blank canvas).
   ============================================================================ */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
const target = args[0];
if (!target) { console.error('usage: verify.mjs <url|file> [--out r.json] [--shots dir] [--frames 0,0.5,1]'); process.exit(2); }
const outPath = argVal('--out');
const shotsDir = argVal('--shots');
const frames = (argVal('--frames') || '0,0.5,1').split(',').map(Number);
function argVal(f) { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; }
const url = /^https?:\/\//.test(target) ? target : pathToFileURL(resolve(target)).href;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

const report = { schema: 'architecture-viz/verify@1', url, console: [], layout: [], axe: null, canvas: null, frames: [], jank: null, ok: true };

/* axe-core source, injected into the page (loaded from node_modules if present). */
async function loadAxeSource() {
  try {
    const req = (await import('node:module')).createRequire(import.meta.url);
    const path = req.resolve('axe-core/axe.min.js');
    return (await import('node:fs')).readFileSync(path, 'utf8');
  } catch { return null; }
}

const browser = await chromium.launch({
  args: [
    // deterministic software WebGL (portable default; on dedicated Linux CI prefer
    // --use-gl=angle --use-angle=gl with Mesa llvmpipe for speed)
    '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--force-color-profile=srgb',
  ],
});

/* ---- console capture ---- */
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// Ignore GPU/driver perf chatter from the software renderer (SwiftShader/ANGLE) and
// devtools-only noise — these aren't page bugs. Real errors/pageerrors still fail.
const NOISE = /GL Driver Message|GPU stall|ReadPixels|SwiftShader|use-angle|Deprecation|favicon/i;
page.on('console', (m) => {
  if ((m.type() === 'error' || m.type() === 'warning') && !NOISE.test(m.text())) report.console.push({ type: m.type(), text: m.text() });
});
page.on('pageerror', (e) => report.console.push({ type: 'pageerror', text: String(e) }));
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => page.goto(url));
await page.waitForTimeout(500);
if (report.console.length) report.ok = false;

/* ---- 1+2. layout probes across viewports ---- */
for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(250);
  const res = await page.evaluate(layoutProbe);
  report.layout.push({ viewport: vp.name, ...res });
  if (res.overflow.length || res.clipped.length || res.overlaps.length) report.ok = false;
}
function layoutProbe() {
  const docW = document.documentElement.clientWidth;
  const EPS = 1; // subpixel tolerance
  const tagged = Array.from(document.querySelectorAll('[data-viz-id]'));
  // horizontal overflow: anything sticking past the viewport
  const overflow = [];
  document.querySelectorAll('body *').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0) return;
    if (b.right > docW + EPS || b.left < -EPS) {
      const id = el.closest('[data-viz-id]')?.getAttribute('data-viz-id');
      overflow.push({ tag: el.tagName.toLowerCase(), id: id || null, right: Math.round(b.right), docW });
    }
  });
  // text clipping (ellipsis / clamp) on tagged elements
  const clipped = [];
  tagged.forEach((el) => {
    if (el.scrollWidth > el.clientWidth + EPS || el.scrollHeight > el.clientHeight + EPS) {
      const ov = getComputedStyle(el).overflow + getComputedStyle(el).overflowX + getComputedStyle(el).overflowY;
      if (/hidden|clip/.test(ov)) clipped.push({ id: el.getAttribute('data-viz-id'), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight });
    }
  });
  // overlap between tagged components. We only care about CONTENT collisions, so
  // skip background layers a page deliberately stacks behind everything: a
  // fixed/absolute element that covers most of the viewport (e.g. the 3D <canvas>
  // stage) legitimately sits under all content and would otherwise overlap
  // everything. Also skip pairs not on the same stacking plane.
  const vpArea = window.innerWidth * window.innerHeight;
  // Skip layers that are deliberately stacked rather than colliding in document
  // flow: a fixed/sticky element (nav, the 3D stage, a toolbar) intentionally
  // sits over/under content. A large absolute element is a backdrop too. Overlap
  // detection is about *flow* collisions (two cards crashing into each other),
  // not z-stacked chrome — those are false positives.
  const isLayered = (el, b) => {
    // walk up: if the element or any ancestor is fixed/sticky, it's z-stacked chrome
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const pos = getComputedStyle(n).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
    }
    if (getComputedStyle(el).position === 'absolute' && (b.width * b.height) > 0.7 * vpArea) return true;
    return false;
  };
  const overlaps = [];
  const rects = tagged
    .map((el) => ({ id: el.getAttribute('data-viz-id'), el, b: el.getBoundingClientRect() }))
    .filter((r) => !isLayered(r.el, r.b));      // drop deliberately z-stacked chrome/backgrounds
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const A = rects[i], B = rects[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const a = A.b, b = B.b;
    if (a.width < 2 || b.width < 2) continue;
    const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const area = ox * oy;
    const minArea = Math.min(a.width * a.height, b.width * b.height);
    if (area > 0.35 * minArea) overlaps.push({ a: A.id, b: B.id, overlap: Math.round(area / minArea * 100) + '%' });
  }
  return { overflow, clipped, overlaps };
}

/* ---- 3. axe-core a11y + contrast ---- */
await page.setViewportSize({ width: 1280, height: 900 });
const axeSrc = await loadAxeSource();
if (axeSrc) {
  await page.addScriptTag({ content: axeSrc });
  report.axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    return {
      violations: r.violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, count: v.nodes.length,
        // surface contrast specifics, which is the most useful machine-readable bit
        contrast: v.id === 'color-contrast' ? v.nodes.slice(0, 8).map((n) => n.any[0] && n.any[0].data).filter(Boolean) : undefined,
      })),
    };
  });
  const serious = report.axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length) report.ok = false;
} else {
  report.axe = { skipped: 'axe-core not installed (npm i -D axe-core) — a11y check skipped' };
}

/* ---- 4. WebGL canvas actually rendered ----
   Reading the GL buffer (readPixels / drawImage→getImageData) false-reports BLACK
   because three.js uses preserveDrawingBuffer:false — the buffer is cleared after
   compositing. The reliable path is to let Playwright screenshot the composited
   canvas region, then analyse the PNG's pixel spread in the driver. */
const canvasHandle = await page.$('canvas');
if (!canvasHandle) {
  report.canvas = { present: false };
} else {
  try {
    const buf = await canvasHandle.screenshot({ type: 'png' });   // composited pixels, not the GL buffer
    const { PNG } = await import('pngjs').then((m) => m.default || m).catch(() => ({}));
    if (PNG) {
      const png = PNG.sync.read(buf);
      let min = [255, 255, 255], max = [0, 0, 0], nonBlack = 0, n = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], png.data[i + k]); max[k] = Math.max(max[k], png.data[i + k]); }
        if (png.data[i] + png.data[i + 1] + png.data[i + 2] > 24) nonBlack++; n++;
      }
      const spread = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
      const frac = n ? nonBlack / n : 0;
      report.canvas = { present: true, spread, nonBlackFraction: +frac.toFixed(3), rendered: spread > 12 && frac > 0.02 };
    } else {
      // pngjs not installed — fall back to a size heuristic (a blank PNG is tiny)
      report.canvas = { present: true, pngBytes: buf.length, rendered: buf.length > 2000, note: 'install pngjs for pixel-accurate canvas check' };
    }
  } catch (e) {
    report.canvas = { present: true, error: String(e), rendered: null };
  }
}
if (report.canvas && report.canvas.present && report.canvas.rendered === false) report.ok = false;

/* ---- 5. deterministic frames via GSAP hook ---- */
const hasTl = await page.evaluate(() => !!window.__tl);
if (hasTl && shotsDir) {
  for (const p of frames) {
    await page.evaluate((pp) => { window.__tl.pause(); window.__tl.progress(pp); if (window.__renderFrame) window.__renderFrame(); }, p);
    await page.waitForTimeout(120);
    const file = join(shotsDir, `frame-${String(p).replace('.', '_')}.png`);
    await page.screenshot({ path: file });
    report.frames.push({ progress: p, shot: file });
  }
  await page.evaluate(() => { if (window.__tl) window.__tl.resume(); });
} else if (shotsDir) {
  // no GSAP hook — capture static viewport shots per breakpoint instead
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(200);
    const file = join(shotsDir, `view-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    report.frames.push({ viewport: vp.name, shot: file });
  }
  report.frames.note = 'No window.__tl hook found — expose your GSAP timeline to capture deterministic animation frames.';
}

/* ---- 6. jank / CPU during a scripted scroll ---- */
report.jank = await page.evaluate(async () => {
  const longTasks = []; const loaf = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => loaf.push(e.duration))).observe({ type: 'long-animation-frame', buffered: true }); } catch {}
  const frameTimes = [];
  let last = performance.now();
  const onFrame = () => { const now = performance.now(); frameTimes.push(now - last); last = now; };
  let raf = requestAnimationFrame(function loop() { onFrame(); raf = requestAnimationFrame(loop); });
  // scripted scroll over ~1.2s
  const steps = 24, total = document.body.scrollHeight - window.innerHeight;
  for (let i = 0; i <= steps; i++) { window.scrollTo(0, total * i / steps); await new Promise((r) => setTimeout(r, 50)); }
  cancelAnimationFrame(raf);
  window.scrollTo(0, 0);
  const sorted = frameTimes.slice(1).sort((a, b) => a - b);
  const pct = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;
  const jankyFrames = sorted.filter((t) => t > 16.7).length;
  return {
    frames: sorted.length,
    frameMs_p50: +pct(0.5).toFixed(1), frameMs_p95: +pct(0.95).toFixed(1),
    jankyFramePct: sorted.length ? +(jankyFrames / sorted.length * 100).toFixed(1) : 0,
    longTasks: longTasks.length, longTaskMs: +longTasks.reduce((a, b) => a + b, 0).toFixed(0),
    longAnimationFrames: loaf.length,
    note: 'Headless GPU timing is NOT representative of real hardware. Gate on jank/long-tasks, not on an fps figure.',
  };
});

await browser.close();

/* ---- write + summarize ---- */
if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`verify: ${url}`);
console.log(`  console errors/warnings : ${report.console.length}${report.console.length ? ' ✗' : ' ✓'}`);
for (const L of report.layout) {
  const issues = L.overflow.length + L.clipped.length + L.overlaps.length;
  console.log(`  layout @ ${L.viewport.padEnd(7)}       : ${issues ? '✗ ' + L.overflow.length + ' overflow, ' + L.clipped.length + ' clipped, ' + L.overlaps.length + ' overlap' : '✓ clean'}`);
}
if (report.axe && report.axe.violations) {
  const s = report.axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').length;
  console.log(`  a11y (axe wcag22aa)     : ${report.axe.violations.length} violations (${s} serious+)${s ? ' ✗' : ' ✓'}`);
} else console.log(`  a11y                    : ${report.axe.skipped}`);
if (report.canvas) console.log(`  webgl canvas rendered   : ${report.canvas.present ? (report.canvas.rendered ? '✓ yes' : (report.canvas.rendered === false ? '✗ blank!' : '? (' + (report.canvas.error || 'unknown') + ')')) : 'n/a (no canvas)'}`);
if (report.jank) console.log(`  scroll jank             : p95 ${report.jank.frameMs_p95}ms · ${report.jank.jankyFramePct}% janky · ${report.jank.longTasks} long-tasks`);
console.log(`\n  OVERALL: ${report.ok ? '✓ no mechanical issues' : '✗ issues found (see report)'} — taste/feel still need a human.`);
if (outPath) console.log(`  report → ${outPath}`);
process.exit(report.ok ? 0 : 1);
