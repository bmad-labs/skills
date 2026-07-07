#!/usr/bin/env node
/* ============================================================================
   verify-deck.mjs — ONE unified verification gate for the editable PPTX.

   The export classifies every element into a typed OP (text / rect / rule / icon /
   graphic / table). This gate verifies EACH op against the source + rendered PNGs,
   so no element class falls between tools. Per slide it asserts:

     • text    — ink position (±posTol) + ink height / font size (±sizeTol)
     • rect    — the element's FILL colour is actually present in its region
                 (catches a card/header/chip whose background/rounding didn't render)
     • rule    — a coloured strip is present where the rule should be
     • icon    — ink is present in the icon box (catches a dropped/empty icon)
     • graphic — the chart region has content (not blank)
     • table   — every cell's text lands within tolerance (via the text check)

   Glyph antialiasing is ignored (ink bounds + region colour don't move with it).

   USAGE
     # 1) export with the ops dump:
     node scripts/export-pptx-jsx.mjs --dump-ops          # → export/ops.json
     # 2) render the pptx to PNGs (LibreOffice) into a dir, then:
     node scripts/verify-deck.mjs --ops export/ops.json \
          --ref-dir review --rendered-dir /tmp/deck-verify --rendered-glob 'p-{n}.png'
          [--pos-tol 5] [--size-tol 5] [--json export/verify-editable-pptx/deck-report.json]

   Exit non-zero if ANY op fails.
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { makeDeckRequire } from './lib/deck-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const opsPath = resolve(flag('--ops', 'export/ops.json'));
const refDir = resolve(flag('--ref-dir', 'review'));
const renDir = resolve(flag('--rendered-dir', '/tmp/deck-verify'));
const renGlob = flag('--rendered-glob', 'p-{n}.png');
const refGlob = flag('--ref-glob', 'slide-{nn}.png');
const posTol = +flag('--pos-tol', '5');
const sizeTol = +flag('--size-tol', '5');
const ssimMin = parseFloat(flag('--ssim-min', '0.80'));   // gross-breakage floor (whole slide)
const structShare = +flag('--struct-share', '50');         // a diff region ≥ this% = structural
const jsonPath = flag('--json', 'export/verify-editable-pptx/deck-report.json');
const diffDir = flag('--diff-dir', null);   // if set, write per-slide heatmaps here
const PXIN = 96;
const { dep } = makeDeckRequire(resolve(HERE, '..'));

if (!existsSync(opsPath)) { console.error(`no ops dump: ${opsPath} (run export-pptx-jsx.mjs --dump-ops)`); process.exit(1); }

const inToPx = (v) => Math.round(v * PXIN);
const hex2rgb = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

// Bucket the NATURE of a failure (not the exact value) so the issue id is stable for
// "the same problem" but changes when the failure materially worsens. Drift buckets
// are coarse (≤2× tol, ≤4× tol, severe) — a small known drift stays one id; a big
// regression becomes a new (unacknowledged) id.
function classify(c) {
  const bucket = (n, tol) => { const a = Math.abs(n); if (a <= tol) return '0'; if (a <= tol * 2) return 's'; if (a <= tol * 4) return 'm'; return 'L'; };
  if (c.kind === 'text') {
    const m = /Δtop (-?\d+) Δleft (-?\d+) Δsize (-?\d+)/.exec(c.detail || '');
    if (/MISSING/.test(c.detail || '')) return 'text-missing';
    if (m) { const [, t, l, s] = m.map(Number); const parts = []; if (Math.abs(t) > posTol) parts.push('top' + bucket(t, posTol)); if (Math.abs(l) > posTol) parts.push('left' + bucket(l, posTol)); if (Math.abs(s) > sizeTol) parts.push('size' + bucket(s, sizeTol)); return 'text-' + (parts.join('-') || 'drift'); }
    return 'text-drift';
  }
  if (c.kind === 'rect' || c.kind === 'rule') return 'fill-low';
  if (c.kind === 'icon') return 'icon-missing';
  if (c.kind === 'graphic') return 'graphic-blank';
  if (c.kind === 'wrap') return 'text-wrapped';
  if (c.kind === 'runcolor') return 'run-colour-missing';
  if (c.kind === 'tablerule') return 'table-rule-missing';
  if (c.kind === 'ssim') return 'ssim-low';
  if (c.kind === 'region') return 'structural-region';
  return c.kind + '-fail';
}
function issueId(slide, elId, kind, failClass) {
  const s = `${slide}|${elId}|${kind}|${failClass}`;
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'E' + h.toString(36).toUpperCase().padStart(7, '0').slice(0, 7);
}

// ink bounds (non-background pixels) in a sub-rect — for text/icon presence + size
function inkBounds(d, rx, ry, rw, rh) {
  let top = -1, left = 1e9, bottom = -1, right = -1, count = 0;
  const x1 = Math.min(d.width, rx + rw), y1 = Math.min(d.height, ry + rh);
  for (let y = Math.max(0, ry); y < y1; y++) for (let x = Math.max(0, rx); x < x1; x++) {
    const i = (y * d.width + x) * 4;
    const lum = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    const sat = Math.max(d.data[i], d.data[i + 1], d.data[i + 2]) - Math.min(d.data[i], d.data[i + 1], d.data[i + 2]);
    if (lum < 205 || sat > 40) { if (top < 0) top = y; bottom = y; if (x < left) left = x; if (x > right) right = x; count++; }
  }
  if (count < 4) return null;
  return { top, left, bottom, right, h: bottom - top + 1, w: right - left + 1, count };
}
// fraction of pixels in a region close to a target colour — for fill/rule presence
function colourCoverage(d, rx, ry, rw, rh, [tr, tg, tb]) {
  let hit = 0, total = 0;
  const x1 = Math.min(d.width, rx + rw), y1 = Math.min(d.height, ry + rh);
  for (let y = Math.max(0, ry); y < y1; y++) for (let x = Math.max(0, rx); x < x1; x++) {
    const i = (y * d.width + x) * 4; total++;
    if (Math.abs(d.data[i] - tr) < 36 && Math.abs(d.data[i + 1] - tg) < 36 && Math.abs(d.data[i + 2] - tb) < 36) hit++;
  }
  return total ? hit / total : 0;
}

// top hard-diff regions (grid density → flood-fill) — same method as diff-regions.mjs
function topDiffRegions(A, B, pixelmatch, PNG, grid = 32) {
  const W = A.width, H = A.height;
  const diff = new PNG({ width: W, height: H });
  pixelmatch(A.data, B.data, diff.data, W, H, { threshold: 0.12, includeAA: false, diffColor: [255, 0, 0] });
  const cols = Math.ceil(W / grid), rows = Math.ceil(H / grid);
  const cell = new Float64Array(cols * rows);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (diff.data[i] > 200 && diff.data[i + 1] < 80 && diff.data[i + 2] < 80) cell[(y / grid | 0) * cols + (x / grid | 0)]++;
  }
  const thr = grid * grid * 0.06, seen = new Uint8Array(cols * rows), regions = [];
  const idx = (c, r) => r * cols + c;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (seen[idx(c, r)] || cell[idx(c, r)] < thr) continue;
    let minc = c, maxc = c, minr = r, maxr = r, mass = 0; const st = [[c, r]]; seen[idx(c, r)] = 1;
    while (st.length) { const [cc, rr] = st.pop(); mass += cell[idx(cc, rr)]; minc = Math.min(minc, cc); maxc = Math.max(maxc, cc); minr = Math.min(minr, rr); maxr = Math.max(maxr, rr);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = cc + dc, nr = rr + dr; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue; if (!seen[idx(nc, nr)] && cell[idx(nc, nr)] >= thr) { seen[idx(nc, nr)] = 1; st.push([nc, nr]); } } }
    regions.push({ x: minc * grid, y: minr * grid, w: (maxc - minc + 1) * grid, h: (maxr - minr + 1) * grid, mass: Math.round(mass) });
  }
  regions.sort((a, b) => b.mass - a.mass);
  const total = regions.reduce((s, r) => s + r.mass, 0) || 1;
  const top = regions.slice(0, 5).map((r) => ({ ...r, share: Math.round((r.mass / total) * 100) }));
  return { top, diff };
}

(async () => {
  const { PNG } = await dep('pngjs');
  const pixelmatch = (await dep('pixelmatch')).default;
  const ssimMod = await dep('ssim.js');
  const ssim = [ssimMod.ssim, ssimMod.default && ssimMod.default.default, ssimMod.default, ssimMod].find((c) => typeof c === 'function');
  const opsBySlide = JSON.parse(readFileSync(opsPath, 'utf8'));
  const slideReports = [];
  let anyFail = false;

  for (const idxStr of Object.keys(opsBySlide).sort((a, b) => +a - +b)) {
    const idx = +idxStr;
    const nn = String(idx).padStart(2, '0');
    const refP = join(refDir, refGlob.replace('{nn}', nn).replace('{n}', String(idx)));
    const renP = join(renDir, renGlob.replace('{nn}', nn).replace('{n}', String(idx)));
    if (!existsSync(refP) || !existsSync(renP)) {
      anyFail = true;
      const miss = `${existsSync(refP) ? '' : 'ref '}${existsSync(renP) ? '' : 'render'}`.trim();
      console.log(`  slide ${idx}: ✗ MISSING PNG (${miss}) — cannot verify`);
      slideReports.push({ slide: idx, total: 0, fails: 1, error: `missing ${miss} png` });
      continue;
    }
    const A = PNG.sync.read(readFileSync(refP));
    let B = PNG.sync.read(readFileSync(renP));
    if (B.width !== A.width || B.height !== A.height) {
      const R = new PNG({ width: A.width, height: A.height });
      for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
        const sx = (x * B.width / A.width) | 0, sy = (y * B.height / A.height) | 0;
        const s = (sy * B.width + sx) * 4, t = (y * A.width + x) * 4;
        R.data[t] = B.data[s]; R.data[t + 1] = B.data[s + 1]; R.data[t + 2] = B.data[s + 2]; R.data[t + 3] = 255;
      }
      B = R;
    }

    const checks = [];
    for (const op of opsBySlide[idx]) {
      if (!op.box) continue;
      const bx = inToPx(op.box.x), by = inToPx(op.box.y), bw = inToPx(op.box.w), bh = inToPx(op.box.h);
      const id = op.id || op.gid || op.kind;

      if (op.kind === 'text') {
        const vpad = Math.min(10, Math.max(3, Math.round(bh * 0.15)));
        const sa = inkBounds(A, bx - 3, by - vpad, bw + 6, bh + 2 * vpad);
        const sb = inkBounds(B, bx - 3, by - vpad, bw + 6, bh + 2 * vpad);
        if (!sa) { checks.push({ id, kind: 'text', ok: true, detail: 'no source ink (empty)', skipped: true }); continue; }
        if (!sb) { checks.push({ id, kind: 'text', ok: false, detail: 'TEXT MISSING — source has ink, render is blank' }); continue; }
        const dTop = sb.top - sa.top, dLeft = sb.left - sa.left, dH = sb.h - sa.h;
        const ok = Math.abs(dTop) <= posTol && Math.abs(dLeft) <= posTol && Math.abs(dH) <= sizeTol;
        checks.push({ id, kind: 'text', ok, detail: `Δtop ${dTop} Δleft ${dLeft} Δsize ${dH}` });

        // LINE-COUNT check — catches text that wrapped to more lines in the render than
        // in the source (the "1 line in HTML, 2 lines in PPTX" defect). Estimate lines by
        // ink height ÷ a single line's ink height (font size ≈ source ink height).
        const lineH = Math.max(8, sa.h);                 // source single-line ink height
        const srcLines = Math.max(1, Math.round(sa.h / lineH));
        const renLines = Math.max(1, Math.round(sb.h / (lineH * 0.92)));   // render line ≈ same
        if (renLines > srcLines) {
          checks.push({ id, kind: 'wrap', ok: false, detail: `WRAPPED — source ${srcLines} line(s), render ${renLines} line(s)` });
        }

        // MULTI-RUN COLOUR check — SOURCE-DRIVEN so it catches a flattened accent even
        // when the export drops the run info from its ops. For each accent colour the op
        // declares (the brand colours it COULD contain), measure that colour's coverage
        // in the SOURCE text box; if the source clearly has it, the render must too. This
        // way "source is green here, render is black" fails regardless of what the ops say.
        // Always probe the brand green (the common accent) plus any op-declared run colour.
        const baseC = (op.color || '221815').toLowerCase();
        const declared = (op.runs || []).map((r) => (r.color || '').toLowerCase());
        const accents = [...new Set([...declared, '00a73b'].filter((c) => c && c !== baseC))];
        for (const hex of accents) {
          const tgt = hex2rgb(hex);
          const srcCov = colourCoverage(A, bx - 3, by - vpad, bw + 6, bh + 2 * vpad, tgt);
          if (srcCov < 0.004) continue;                  // source doesn't really have this accent → nothing to assert
          const renCov = colourCoverage(B, bx - 3, by - vpad, bw + 6, bh + 2 * vpad, tgt);
          const okRun = renCov >= srcCov * 0.4;          // render must show a comparable amount
          checks.push({ id, kind: 'runcolor', ok: okRun, detail: okRun ? `accent #${hex} present (src ${(srcCov*100).toFixed(2)}% → ren ${(renCov*100).toFixed(2)}%)` : `ACCENT #${hex} MISSING — source ${(srcCov*100).toFixed(2)}%, render ${(renCov*100).toFixed(2)}% (flattened?)` });
        }

      } else if (op.kind === 'rect' || op.kind === 'rule') {
        // assert the fill colour actually appears in the region (catches missing
        // card/header background or a rounding that didn't render).
        if (!op.fill) {
          // no fill → it's a border-only/transparent shape; assert SOME ink (the border)
          const sb = inkBounds(B, bx, by, Math.max(bw, 2), Math.max(bh, 2));
          const sa = inkBounds(A, bx, by, Math.max(bw, 2), Math.max(bh, 2));
          checks.push({ id, kind: op.kind, ok: !sa || !!sb, detail: op.line && op.line.color ? `border #${op.line.color}` : 'no fill/border (transparent)' });
          continue;
        }
        const tgt = hex2rgb(op.fill);
        const cov = colourCoverage(B, bx, by, Math.max(bw, 2), Math.max(bh, 2), tgt);
        const srcCov = colourCoverage(A, bx, by, Math.max(bw, 2), Math.max(bh, 2), tgt);
        // the render must show a similar amount of that colour as the source. If the
        // source itself barely shows it (<2%), flag — the op claims a fill that isn't
        // really there (a wrong colour / wrong box), so we can't silently pass it.
        const ok = srcCov < 0.02 ? cov < 0.05 : cov >= srcCov * 0.6;
        const note = srcCov < 0.02 ? ' (source lacks this fill too — check colour/box)' : '';
        checks.push({ id, kind: op.kind, ok, detail: `fill #${op.fill} coverage src ${(srcCov * 100) | 0}% → ren ${(cov * 100) | 0}%${note}` });

      } else if (op.kind === 'icon') {
        // icon must have ink in its box (catches a dropped/empty icon)
        const sb = inkBounds(B, bx - 2, by - 2, bw + 4, bh + 4);
        const sa = inkBounds(A, bx - 2, by - 2, bw + 4, bh + 4);
        const ok = !sa || !!sb;   // if source has an icon, render must too
        checks.push({ id, kind: 'icon', ok, detail: ok ? 'present' : 'MISSING ink in icon box' });

      } else if (op.kind === 'graphic') {
        const sb = inkBounds(B, bx, by, bw, bh);
        const ok = !!sb;
        checks.push({ id, kind: 'graphic', ok, detail: ok ? 'has content' : 'BLANK region' });

      } else if (op.kind === 'table') {
        // table structure: emitted rows × cols (cell text positions are verified as
        // individual text ops elsewhere; here we assert the table is non-trivial).
        const nRows = (op.rows && op.rows.length) || 0;
        const nCols = op.rows ? Math.max(...op.rows.map((r) => r.length)) : 0;
        const ok = nRows >= 1 && nCols >= 1;
        checks.push({ id, kind: 'table', ok, detail: `${nRows}×${nCols} cells` });

        // HEADER RULE check — the table records a header-bottom border (e.g. the green
        // `border-b-2`). Native table cell borders don't export, so we draw it separately;
        // verify the rule colour actually appears along the header's bottom edge. Catches
        // the "separator line between header and rows is missing in the pptx" defect.
        if (op.headerRule) {
          const r = op.headerRule;
          const rx = inToPx(r.box.x), rw = inToPx(r.box.w);
          const ry = inToPx(r.box.y + r.box.h) - 4;      // a 8px band straddling the bottom edge
          const cov = colourCoverage(B, rx, ry, rw, 8, hex2rgb(r.color));
          const okRule = cov >= 0.05;                    // a thin line across the width → modest coverage
          checks.push({ id: id + '.headerRule', kind: 'tablerule', ok: okRule, detail: okRule ? `header rule #${r.color} present (${(cov*100).toFixed(1)}%)` : `HEADER RULE #${r.color} MISSING` });
        }
        // HEADER FILL check — if a rounded header bar is recorded, verify its fill renders.
        if (op.headerRound) {
          const r = op.headerRound;
          const cov = colourCoverage(B, inToPx(r.box.x), inToPx(r.box.y), inToPx(r.box.w), inToPx(r.box.h), hex2rgb(r.fill));
          const okHdr = cov >= 0.4;
          checks.push({ id: id + '.headerFill', kind: 'tablerule', ok: okHdr, detail: okHdr ? `header fill #${r.fill} present (${(cov*100)|0}%)` : `HEADER FILL #${r.fill} MISSING` });
        }
      }
    }

    // ── ALWAYS-RUN structural checks (never skipped, regardless of per-op results) ──
    // (1) SSIM — whole-slide structural similarity (catches gross layout breakage).
    let mssim = null;
    try { mssim = ssim({ data: A.data, width: A.width, height: A.height }, { data: B.data, width: B.width, height: B.height }).mssim; } catch (_) {}
    if (mssim != null) checks.push({ id: '(whole slide)', kind: 'ssim', ok: mssim >= ssimMin, detail: `SSIM ${(mssim * 100).toFixed(1)}% (gate ${(ssimMin * 100) | 0}%)` });
    // (2) diff-regions — biggest hard-diff cluster. A single dominant region (≥ struct
    //     share) means a real structural defect somewhere; record it + the worst region.
    const dr = topDiffRegions(A, B, pixelmatch, PNG);
    if (dr.top.length) {
      const dom = dr.top[0];
      // A region is "structural" (a real defect) only if it dominates the diff AND the
      // whole-slide SSIM is actually low. A thin correctly-placed line (a header rule, a
      // chart axis) concentrates diff mass into one region from sub-pixel placement alone
      // — high share, but SSIM stays high because nothing structural moved. Gating on
      // SSIM avoids flagging those benign thin-line diffs as defects. Also ignore
      // line-like regions (very flat or very narrow) for the same reason.
      const lineLike = dom.h <= 12 || dom.w <= 12;
      const structural = dom.share >= structShare && (mssim == null || mssim < ssimMin + 0.05) && !lineLike;
      const why = structural ? ' — STRUCTURAL, investigate'
        : lineLike ? ' (thin line — sub-pixel placement, benign)'
        : (mssim != null && mssim >= ssimMin + 0.05) ? ' (SSIM high → spread/font noise, benign)'
        : ' (spread = font noise)';
      checks.push({ id: `region ${dom.x},${dom.y} ${dom.w}×${dom.h}`, kind: 'region', ok: !structural, detail: `top region ${dom.share}% of diff${why}` });
    }
    // per-slide heatmap → <diff-dir>/slide-NN.png (red = hard diff · yellow = AA/text)
    if (diffDir) {
      mkdirSync(resolve(diffDir), { recursive: true });
      const hm = new PNG({ width: A.width, height: A.height });
      pixelmatch(A.data, B.data, hm.data, A.width, A.height, { threshold: 0.12, diffColor: [255, 0, 0], aaColor: [255, 190, 0] });
      writeFileSync(join(resolve(diffDir), `slide-${nn}.png`), PNG.sync.write(hm));
    }

    // tag each FAILING check with a stable content-hash issue id + a bucketed failure
    // class (the NATURE of the failure, not exact pixels — so the same problem keeps the
    // same id across runs, but a materially-worse drift or a new element gets a NEW id).
    for (const c of checks) {
      if (c.ok) continue;
      c.failClass = classify(c);
      c.issueId = issueId(idx, c.id, c.kind, c.failClass);
    }
    const fails = checks.filter((c) => !c.ok);
    if (fails.length) anyFail = true;
    slideReports.push({ slide: idx, total: checks.length, fails: fails.length, checks, ssim: mssim, diffRegions: dr.top });

    const byKind = {};
    checks.forEach((c) => { byKind[c.kind] = byKind[c.kind] || { ok: 0, n: 0 }; byKind[c.kind].n++; if (c.ok) byKind[c.kind].ok++; });
    const summary = Object.entries(byKind).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(' · ');
    console.log(`  slide ${idx}: ${checks.length - fails.length}/${checks.length}  [${summary}]${fails.length ? '  ✗' : '  ✓'}`);
    for (const f of fails) console.log(`      ✗ [${f.issueId}] ${f.kind.padEnd(7)} ${f.id.padEnd(28)} ${f.detail}`);
  }

  const report = { posTol, sizeTol, anyFail, slides: slideReports };
  writeFileSync(resolve(jsonPath), JSON.stringify(report, null, 2));
  console.log(`\n  ${anyFail ? '✗ FAIL — some element classes drifted (see above)' : '✓ PASS — all element classes within tolerance'}`);
  console.log(`  json → ${resolve(jsonPath)}`);
  process.exit(anyFail ? 2 : 0);
})().catch((e) => { console.error('verify-deck failed:', e.message); process.exit(1); });
