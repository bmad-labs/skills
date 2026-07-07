#!/usr/bin/env node
/* ============================================================================
   diff-regions.mjs — find & RANK the worst diff areas on a slide, so a verify
   failure points to WHERE (coordinates + which data-viz-id) instead of needing a
   human to eyeball the heatmap.

   Pipeline:
     source.png + rendered.png → pixelmatch (hard diffs only) → density grid →
     merge hot cells into regions → rank by diff mass → attribute each region to the
     data-viz-id it overlaps (geometry from inspect.mjs / a geometry json).

   USAGE
     node scripts/diff-regions.mjs --ref source.png --rendered rendered.png
                                   [--geometry geo.json] [--top 5] [--grid 32]
                                   [--out export/verify-editable-pptx/regions.png]
     (--geometry is the [{id,x,y,w,h}] array inspect.mjs writes; optional)

   Prints a ranked table; writes an annotated PNG boxing the top regions.
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { makeDeckRequire } from './lib/deck-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const refPath = resolve(flag('--ref', ''));
const renPath = resolve(flag('--rendered', ''));
const geoPath = flag('--geometry', null);
const topN = +flag('--top', '5');
const grid = +flag('--grid', '32');          // cell size in px (smaller = finer)
const outPath = resolve(flag('--out', 'export/verify-editable-pptx/regions.png'));
const jsonPath = resolve(flag('--json', outPath.replace(/\.png$/, '.json')));  // sibling .json
const PXIN = 96;
const { dep } = makeDeckRequire(resolve(HERE, '..'));

if (!existsSync(refPath) || !existsSync(renPath)) { console.error('need --ref and --rendered PNGs'); process.exit(1); }

(async () => {
  const { PNG } = await dep('pngjs');
  const pixelmatch = (await dep('pixelmatch')).default;
  const A = PNG.sync.read(readFileSync(refPath));
  let B = PNG.sync.read(readFileSync(renPath));
  if (B.width !== A.width || B.height !== A.height) {
    // nearest-neighbour resize B → A (keeps it dependency-free)
    const R = new PNG({ width: A.width, height: A.height });
    for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
      const sx = Math.floor(x * B.width / A.width), sy = Math.floor(y * B.height / A.height);
      const s = (sy * B.width + sx) * 4, d = (y * A.width + x) * 4;
      R.data[d] = B.data[s]; R.data[d + 1] = B.data[s + 1]; R.data[d + 2] = B.data[s + 2]; R.data[d + 3] = 255;
    }
    B = R;
  }
  const W = A.width, H = A.height;

  // hard diffs only (includeAA:false) → don't let text-edge AA dominate the regions
  const diff = new PNG({ width: W, height: H });
  pixelmatch(A.data, B.data, diff.data, W, H, { threshold: 0.12, includeAA: false, diffColor: [255, 0, 0] });

  // density grid: count red diff pixels per cell
  const cols = Math.ceil(W / grid), rows = Math.ceil(H / grid);
  const cell = new Float64Array(cols * rows);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (diff.data[i] > 200 && diff.data[i + 1] < 80 && diff.data[i + 2] < 80) cell[(y / grid | 0) * cols + (x / grid | 0)]++;
  }
  const cellThresh = grid * grid * 0.06;       // a cell is "hot" if ≥6% of it differs

  // flood-fill adjacent hot cells into regions
  const seen = new Uint8Array(cols * rows);
  const regions = [];
  const idx = (c, r) => r * cols + c;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (seen[idx(c, r)] || cell[idx(c, r)] < cellThresh) continue;
    let minc = c, maxc = c, minr = r, maxr = r, mass = 0;
    const stack = [[c, r]];
    seen[idx(c, r)] = 1;
    while (stack.length) {
      const [cc, rr] = stack.pop();
      mass += cell[idx(cc, rr)];
      minc = Math.min(minc, cc); maxc = Math.max(maxc, cc);
      minr = Math.min(minr, rr); maxr = Math.max(maxr, rr);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cc + dc, nr = rr + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (!seen[idx(nc, nr)] && cell[idx(nc, nr)] >= cellThresh) { seen[idx(nc, nr)] = 1; stack.push([nc, nr]); }
      }
    }
    regions.push({ x: minc * grid, y: minr * grid, w: (maxc - minc + 1) * grid, h: (maxr - minr + 1) * grid, mass: Math.round(mass) });
  }
  regions.sort((a, b) => b.mass - a.mass);
  const top = regions.slice(0, topN);

  // attribute each region to the data-viz-id whose box overlaps it most
  let geo = null;
  if (geoPath && existsSync(resolve(geoPath))) {
    try { geo = JSON.parse(readFileSync(resolve(geoPath), 'utf8')); } catch (_) {}
  }
  // inspect.mjs geometry is in VIEWPORT PIXELS (same space as the heatmap), so use
  // it directly. (If a geometry json is ever in inches, values would be <14 — detect
  // and scale.) Pick the smallest element that contains the region centre, so a cell
  // attributes to the leaf (a table cell), not just the big table/card wrapping it.
  const inches = geo && geo.every((g) => g.w < 20 && g.h < 20);
  const sc = inches ? PXIN : 1;
  const overlap = (R, g) => {
    const gx = g.x * sc, gy = g.y * sc, gw = g.w * sc, gh = g.h * sc;
    const ox = Math.max(0, Math.min(R.x + R.w, gx + gw) - Math.max(R.x, gx));
    const oy = Math.max(0, Math.min(R.y + R.h, gy + gh) - Math.max(R.y, gy));
    return ox * oy;
  };
  for (const R of top) {
    if (geo) {
      // ALL elements that overlap this region, ranked by how much of the ELEMENT is
      // inside the region (so a fully-covered cell ranks above a big wrapper that only
      // clips it). Keep structured detail (box, overlap px, coverage) for the JSON.
      R.elements = geo.map((g) => {
        const a = overlap(R, g), area = (g.w * sc) * (g.h * sc) || 1;
        return { id: g.id, box: { x: g.x, y: g.y, w: g.w, h: g.h }, overlapPx: Math.round(a), coverage: +(a / area).toFixed(3) };
      }).filter((o) => o.overlapPx > 0 && o.coverage >= 0.25)
        .sort((a, b) => b.overlapPx - a.overlapPx);
    }
  }
  const totalMass = regions.reduce((s, r) => s + r.mass, 0) || 1;
  top.forEach((R) => { R.share = Math.round((R.mass / totalMass) * 100); });

  // report: each region, its share of the total diff, and the elements inside it
  console.log(`\n  Top ${top.length} diff regions (hard pixels, ${grid}px grid) — ${refPath.split('/').pop()}\n`);
  top.forEach((R, i) => {
    console.log(`  #${i + 1}  region ${R.x},${R.y} ${R.w}×${R.h}px   ${R.share}% of diff`);
    if (geo) {
      const ids = (R.elements || []).map((e) => e.id);
      if (ids.length) console.log(`      elements: ${ids.join(', ')}`);
      else console.log(`      elements: (none ≥25% inside — likely text-shift between cells)`);
    } else {
      console.log(`      (pass --geometry <inspect geometry.json> to list elements here)`);
    }
  });

  // ── machine-readable JSON for debugging ──
  const totalHardPx = regions.reduce((s, r) => s + r.mass, 0);
  // classify the failure shape: one dominant region = structural; spread = font-render noise
  const dominance = top.length ? top[0].share : 0;
  const verdict = dominance >= 50 ? 'structural (one region dominates → fix that element)'
    : dominance >= 30 ? 'mixed (a leading region, investigate it)'
    : 'spread (diff across many text regions → likely font-render noise, not a layout defect)';
  const report = {
    ref: refPath, rendered: renPath, geometry: geoPath ? resolve(geoPath) : null,
    image: { width: W, height: H }, grid, topN,
    totalHardDiffPx: Math.round(totalHardPx),
    regionCount: regions.length,
    dominanceShare: dominance,
    verdict,
    annotatedPng: outPath,
    regions: top.map((R, i) => ({
      rank: i + 1,
      box: { x: R.x, y: R.y, w: R.w, h: R.h },
      shareOfDiff: R.share,           // % of total hard-diff mass in this region
      massPx: R.mass,
      elements: R.elements || null,    // [{id, box, overlapPx, coverage}] or null if no geometry
    })),
  };
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n  verdict: ${verdict}`);
  console.log(`  json    → ${jsonPath}`);

  // annotated PNG: rendered slide + numbered red boxes on the top regions
  const out = new PNG({ width: W, height: H });
  B.data.copy(out.data);
  const stroke = (R, col) => {
    for (let t = 0; t < 3; t++) for (let x = R.x; x < R.x + R.w; x++) {
      for (const yy of [R.y + t, R.y + R.h - 1 - t]) { const i = (yy * W + x) * 4; if (i >= 0 && i < out.data.length) { out.data[i] = col[0]; out.data[i + 1] = col[1]; out.data[i + 2] = col[2]; } }
    }
    for (let t = 0; t < 3; t++) for (let y = R.y; y < R.y + R.h; y++) {
      for (const xx of [R.x + t, R.x + R.w - 1 - t]) { const i = (y * W + xx) * 4; if (i >= 0 && i < out.data.length) { out.data[i] = col[0]; out.data[i + 1] = col[1]; out.data[i + 2] = col[2]; } }
    }
  };
  top.forEach((R) => stroke(R, [255, 0, 0]));
  writeFileSync(outPath, PNG.sync.write(out));
  console.log(`\n  annotated → ${outPath}`);
})().catch((e) => { console.error('diff-regions failed:', e.message); process.exit(1); });
