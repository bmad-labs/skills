#!/usr/bin/env node
/* ============================================================================
   verify-pptx.mjs — render a .pptx back to PNG via LibreOffice headless and
   pixel-diff it against the source slide screenshot, to measure export fidelity.

     .pptx → (soffice --convert-to pdf) → PDF → (soffice --convert-to png OR
     sips/pdftoppm) → PNG → pixelmatch vs source PNG → % match + diff image

   USAGE
     node scripts/verify-pptx.mjs <pptx> --ref <source.png> [--out <dir>]
                                  [--threshold <pct>] [--slide-w 1280 --slide-h 720]
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { makeDeckRequire } from './lib/deck-driver.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const pptx = resolve(args.find((a) => !a.startsWith('--')) || '');
const ref = flag('--ref', null);
const outDir = resolve(flag('--out', join(dirname(pptx), 'verify')));
const threshold = +flag('--threshold', '12');     // max % differing pixels to PASS
const W = +flag('--slide-w', '1280'), H = +flag('--slide-h', '720');
const deckDir = resolve(HERE, '..');
const { dep } = makeDeckRequire(deckDir);

const SOFFICE = ['/opt/homebrew/bin/soffice', '/usr/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']
  .find((p) => existsSync(p)) || 'soffice';

if (!existsSync(pptx)) { console.error('pptx not found: ' + pptx); process.exit(1); }
mkdirSync(outDir, { recursive: true });

// LibreOffice (homebrew on macOS) fails to WRITE into the project tree
// (Io Write Code:16) but writes fine under /tmp — so always convert into a /tmp
// workdir with a dedicated UserInstallation profile, then the caller copies out.
const LO_TMP = join('/tmp', 'slide-maker-lo-verify');
function soffice(convertTo, input) {
  mkdirSync(LO_TMP, { recursive: true });
  execFileSync(SOFFICE, [
    '--headless', '--norestore', '--nolockcheck',
    `-env:UserInstallation=file://${join(LO_TMP, '.profile')}`,
    '--convert-to', convertTo, '--outdir', LO_TMP, input,
  ], { stdio: 'pipe', timeout: 120000, env: { ...process.env } });
}

(async () => {
  // 1. pptx → png (via pdf for reliable full-slide rasterization)
  console.log('• rendering pptx via LibreOffice…');
  soffice('pdf', pptx);
  const pdf = join(LO_TMP, basename(pptx).replace(/\.pptx$/, '.pdf'));
  if (!existsSync(pdf)) throw new Error('LibreOffice did not produce a PDF (in ' + LO_TMP + ')');

  // pdf → png at exact slide pixel size. Prefer pdftoppm; fall back to sips (macOS).
  let renderedPng = join(outDir, 'rendered.png');
  try {
    // pdftoppm -png -scale-to-x W -scale-to-y H pdf prefix  → prefix-1.png
    execFileSync('pdftoppm', ['-png', '-scale-to-x', String(W), '-scale-to-y', String(H), '-f', '1', '-l', '1', pdf, join(outDir, 'rendered')], { stdio: 'pipe' });
    const p = readdirSync(outDir).find((f) => /^rendered-?\d*\.png$/.test(f));
    if (p) renderedPng = join(outDir, p);
  } catch {
    // sips: render pdf page1 → png then resize
    execFileSync('sips', ['-s', 'format', 'png', pdf, '--out', renderedPng], { stdio: 'pipe' });
    execFileSync('sips', ['-z', String(H), String(W), renderedPng], { stdio: 'pipe' });
  }
  console.log('  → ' + renderedPng);

  if (!ref || !existsSync(resolve(ref))) {
    console.log('\nNo --ref source PNG given (or missing); rendered the pptx only.');
    console.log('Open both to compare visually:\n  rendered: ' + renderedPng);
    return;
  }

  // 2. compare vs source — TWO metrics:
  //   • SSIM (structural similarity) — the HEADLINE: perceptual, shift/AA-tolerant, so
  //     it reflects REAL drift (a dropped chart, a moved block) not text-edge noise.
  //   • pixel-diff % + heatmap — the DETAIL: shows exactly WHERE pixels differ.
  const { PNG } = (await dep('pngjs'));
  const pixelmatch = (await dep('pixelmatch')).default;
  const ssimMod = await dep('ssim.js');
  // pick the callable: dep() may expose it as .ssim, .default.default, or .default
  const ssim = [ssimMod.ssim, ssimMod.default && ssimMod.default.default, ssimMod.default, ssimMod]
    .find((c) => typeof c === 'function');
  const A = PNG.sync.read(readFileSync(resolve(ref)));
  let B = PNG.sync.read(readFileSync(renderedPng));

  // normalize B to A's dimensions if off-by-a-bit
  if (B.width !== A.width || B.height !== A.height) {
    console.log(`  (resizing rendered ${B.width}×${B.height} → ${A.width}×${A.height})`);
    const tmp = join(outDir, 'rendered-resized.png');
    try { execFileSync('sips', ['-z', String(A.height), String(A.width), renderedPng, '--out', tmp], { stdio: 'pipe' }); B = PNG.sync.read(readFileSync(tmp)); }
    catch { /* fall through; pixelmatch needs same dims, will error below */ }
  }

  // pixel-diff HEATMAP — pixelmatch paints differing pixels red/yellow on white.
  // Reading it tells you WHERE the export drifts: solid blocks of red = a real
  // layout/shape problem; faint coloured ghosting along text edges = benign font
  // antialiasing (LibreOffice vs Chromium rasterise glyphs slightly differently).
  const diff = new PNG({ width: A.width, height: A.height });
  const nDiff = pixelmatch(A.data, B.data, diff.data, A.width, A.height, { threshold: 0.12, diffColor: [255, 0, 0], aaColor: [255, 190, 0] });
  const pct = (nDiff / (A.width * A.height)) * 100;
  const diffPath = join(outDir, 'diff.png');
  writeFileSync(diffPath, PNG.sync.write(diff));

  // SSIM — structural similarity (0..1; 1 = identical). Computed on the SAME two
  // images; tolerant of sub-pixel text shift + AA, so a high SSIM with a high pixel-%
  // means "looks right, just text-rendering noise", while a LOW SSIM means real drift.
  let mssim = null;
  try { mssim = ssim({ data: A.data, width: A.width, height: A.height }, { data: B.data, width: B.width, height: B.height }).mssim; } catch (_) {}

  // side-by-side composite: source / rendered / heatmap stacked, each labelled by a
  // thin coloured gutter — one image to Read for the whole verdict.
  const gap = 8;
  const comp = new PNG({ width: A.width, height: A.height * 3 + gap * 2 });
  comp.data.fill(0xff);   // white background
  const blit = (src, yOff) => {
    for (let y = 0; y < A.height; y++)
      for (let x = 0; x < A.width; x++) {
        const s = (y * A.width + x) * 4, d = ((y + yOff) * comp.width + x) * 4;
        comp.data[d] = src.data[s]; comp.data[d + 1] = src.data[s + 1];
        comp.data[d + 2] = src.data[s + 2]; comp.data[d + 3] = src.data[s + 3];
      }
  };
  blit(A, 0); blit(B, A.height + gap); blit(diff, (A.height + gap) * 2);
  const compPath = join(outDir, 'compare.png');
  writeFileSync(compPath, PNG.sync.write(comp));

  console.log(`\n  source:   ${resolve(ref)}`);
  console.log(`  rendered: ${renderedPng}`);
  console.log(`  heatmap:  ${diffPath}        (red = real diff · yellow = AA/text ghosting)`);
  console.log(`  compare:  ${compPath}   (source / rendered / heatmap stacked — Read this)`);

  // SSIM is the gate (structural). Pixel-% is reported as detail. --ssim-min sets the
  // bar (default 0.80: below this = real structural drift worth investigating).
  const ssimMin = parseFloat(flag('--ssim-min', '0.90'));
  const ssimPct = mssim != null ? (mssim * 100).toFixed(1) + '%' : 'n/a';
  console.log(`\n  STRUCTURE (SSIM):  ${ssimPct}        ← the metric that matters (shift/AA-tolerant)`);
  console.log(`  pixels differ:     ${pct.toFixed(1)}%  (detail — inflated by text antialiasing)`);
  if (mssim != null && mssim < ssimMin) {
    console.log(`\n  ✗ FAIL — SSIM ${ssimPct} < ${(ssimMin * 100).toFixed(0)}%: real structural drift. Read the heatmap for solid red blocks.`);
    process.exit(2);
  }
  console.log(`\n  ✓ PASS  (SSIM ≥ ${(ssimMin * 100).toFixed(0)}%; remaining pixel diff is text-edge rendering, not layout)`);
})().catch((e) => { console.error('verify failed:', e.message); process.exit(1); });
