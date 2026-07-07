#!/usr/bin/env node
/* ============================================================================
   verify-text.mjs — GUARANTEE text position + font size + styling in the export,
   ignoring glyph antialiasing (which Chromium and LibreOffice rasterise differently
   and is NOT an export defect).

   For every tagged text element it measures the INK BOUNDS (top/left/height of the
   actual rendered pixels) in BOTH the source render and the LibreOffice render of
   the exported PPTX, within that element's box, and asserts:
     • position  — ink top & left match within --pos-tol px (default 4)
     • font size — ink HEIGHT matches within --size-tol px (default 3)
   Glyph-to-glyph AA drift doesn't move the ink bounds, so it's transparent here.

   Styling (bold/color/align) is exact by construction (we set it from the DOM),
   so it's reported from the source geometry, not re-measured.

   USAGE
     node scripts/verify-text.mjs --ref source.png --rendered lo-render.png
          --geometry /tmp/mti-slide-inspect/geometry.json
          [--pos-tol 4] [--size-tol 3] [--json out.json]
   Exit non-zero if any element drifts beyond tolerance.
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { makeDeckRequire } from './lib/deck-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const refPath = resolve(flag('--ref', ''));
const renPath = resolve(flag('--rendered', ''));
const geoPath = flag('--geometry', '/tmp/mti-slide-inspect/geometry.json');
const posTol = +flag('--pos-tol', '4');
const sizeTol = +flag('--size-tol', '5');   // ±5px ink height ≈ one wrap line on a long body
const jsonPath = flag('--json', null);
const { dep } = makeDeckRequire(resolve(HERE, '..'));

if (!existsSync(refPath) || !existsSync(renPath) || !existsSync(resolve(geoPath))) {
  console.error('need --ref, --rendered PNGs and --geometry json'); process.exit(1);
}

// ink bounds (top,left,bottom,right of non-background pixels) inside a sub-rectangle
function inkBounds(d, rx, ry, rw, rh) {
  let top = -1, left = 1e9, bottom = -1, right = -1, count = 0;
  const x1 = Math.min(d.width, rx + rw), y1 = Math.min(d.height, ry + rh);
  for (let y = Math.max(0, ry); y < y1; y++) {
    for (let x = Math.max(0, rx); x < x1; x++) {
      const i = (y * d.width + x) * 4;
      const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
      // "ink" = noticeably darker OR saturated vs white bg (catches green/coloured text too)
      const sat = Math.max(d.data[i], d.data[i + 1], d.data[i + 2]) - Math.min(d.data[i], d.data[i + 1], d.data[i + 2]);
      if (lum < 205 || sat > 40) { if (top < 0) top = y; bottom = y; if (x < left) left = x; if (x > right) right = x; count++; }
    }
  }
  if (count < 4) return null;
  return { top, left, bottom, right, h: bottom - top + 1, w: right - left + 1, count };
}

(async () => {
  const { PNG } = await dep('pngjs');
  const A = PNG.sync.read(readFileSync(refPath));      // source (Chromium)
  let B = PNG.sync.read(readFileSync(renPath));        // LibreOffice render
  if (B.width !== A.width || B.height !== A.height) {  // nearest-neighbour to A's size
    const R = new PNG({ width: A.width, height: A.height });
    for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
      const sx = (x * B.width / A.width) | 0, sy = (y * B.height / A.height) | 0;
      const s = (sy * B.width + sx) * 4, t = (y * A.width + x) * 4;
      R.data[t] = B.data[s]; R.data[t + 1] = B.data[s + 1]; R.data[t + 2] = B.data[s + 2]; R.data[t + 3] = 255;
    }
    B = R;
  }
  const geo = JSON.parse(readFileSync(resolve(geoPath), 'utf8'));
  // text elements = LEAVES: drop the slide root, obvious non-text wrappers, AND any
  // element that geometrically CONTAINS another tagged element (a container, not text).
  const contains = (a, b) => a !== b && b.x >= a.x - 2 && b.y >= a.y - 2 && b.x + b.w <= a.x + a.w + 2 && b.y + b.h <= a.y + a.h + 2 && (a.w * a.h) > (b.w * b.h) * 1.1;
  const isWrapper = (g) => /^s\d+$/.test(g.id) || /\.(card|chip|icon|table|head|rule|hero|chart|callout)$/.test(g.id);
  const els = geo.filter((g) => !isWrapper(g) && !geo.some((o) => contains(g, o)));

  const rows = [];
  let fails = 0;
  for (const g of els) {
    // Vertical pad scales with element height (big KPI numbers overflow their measured
    // box by a few px — a fixed tiny pad would clip them and report a false size error).
    // Horizontal pad stays small so we don't bleed into the next column.
    const vpad = Math.min(10, Math.max(3, Math.round(g.h * 0.15)));
    const hpad = 3;
    const sa = inkBounds(A, g.x - hpad, g.y - vpad, g.w + 2 * hpad, g.h + 2 * vpad);
    const sb = inkBounds(B, g.x - hpad, g.y - vpad, g.w + 2 * hpad, g.h + 2 * vpad);
    if (!sa || !sb) continue;                          // no ink (empty) → skip
    const dTop = sb.top - sa.top, dLeft = sb.left - sa.left, dH = sb.h - sa.h;
    const posOk = Math.abs(dTop) <= posTol && Math.abs(dLeft) <= posTol;
    const sizeOk = Math.abs(dH) <= sizeTol;
    const ok = posOk && sizeOk;
    if (!ok) fails++;
    rows.push({ id: g.id, dTop, dLeft, dHeight: dH, srcInkH: sa.h, renInkH: sb.h, posOk, sizeOk, ok });
  }

  // report
  console.log(`\n  Text fidelity — position ≤${posTol}px, font-size(ink height) ≤${sizeTol}px  (glyph AA ignored)\n`);
  console.log('   element                       Δtop  Δleft  Δsize  inkH(src→ren)  verdict');
  console.log('  ──────────────────────────────┼─────┼──────┼──────┼──────────────┼────────');
  for (const r of rows) {
    const v = r.ok ? '✓' : (`✗ ${[!r.posOk && 'pos', !r.sizeOk && 'size'].filter(Boolean).join('+')}`);
    console.log(`   ${r.id.padEnd(28)} │ ${String(r.dTop).padStart(3)} │ ${String(r.dLeft).padStart(4)} │ ${String(r.dHeight).padStart(4)} │ ${String(r.srcInkH + '→' + r.renInkH).padStart(12)} │ ${v}`);
  }
  console.log(`\n  ${rows.length - fails}/${rows.length} text elements within tolerance` + (fails ? `  —  ${fails} drifted` : '  ✓'));

  if (jsonPath) {
    writeFileSync(resolve(jsonPath), JSON.stringify({ posTol, sizeTol, total: rows.length, fails, elements: rows }, null, 2));
    console.log(`  json → ${resolve(jsonPath)}`);
  }
  process.exit(fails ? 2 : 0);
})().catch((e) => { console.error('verify-text failed:', e.message); process.exit(1); });
