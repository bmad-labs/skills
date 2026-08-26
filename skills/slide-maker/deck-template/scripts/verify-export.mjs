#!/usr/bin/env node
/* ============================================================================
   verify-export.mjs — did the exported PPTX actually match the HTML deck?

   Producing an editable PPTX is a RE-IMPLEMENTATION of each slide in another
   renderer. It drifts. The drift is usually uniform (every text block a few px
   low, one column narrow), which is exactly the kind of thing that is invisible
   when you look at slides one at a time and obvious when you diff them.

   This wraps the pieces so there is ONE command to run after any export,
   whichever exporter produced the file:

     HTML render (truth) ── shoot-slides.mjs
     PPTX render         ── LibreOffice → pdftoppm
                            ↓
              pixelmatch per slide → ranked table
                            ↓
              diff-regions.mjs on the worst → WHERE it differs

   USAGE
     node scripts/verify-export.mjs [deckDir] [--top 3] [--no-shoot]
                                    [--pptx export/deck-image.pptx]

   --pptx defaults to export/deck.pptx; point it at deck-image.pptx to check the
   image export instead.

   Exit 0 always: this reports, it does not gate. Read the numbers.
   ============================================================================ */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const deckDir = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : join(HERE, '..'));
const flag = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const TOP = +flag('--top', 3);
const pptx = resolve(deckDir, flag('--pptx', join('export', 'deck.pptx')));
const tmp = join(deckDir, 'export', 'verify-export');

if (!existsSync(pptx)) { console.error(`no ${pptx} — export first`); process.exit(1); }

const SOFFICE = ['/opt/homebrew/bin/soffice', '/usr/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']
  .find((p) => existsSync(p)) || 'soffice';

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: deckDir, stdio: 'inherit', ...opts });

// 1) reference: the HTML deck as rendered
if (!process.argv.includes('--no-shoot')) {
  console.log('• rendering the HTML deck (reference)…');
  run('node', ['scripts/shoot-slides.mjs', '--mode', 'normal'], { stdio: 'ignore' });
}

// 2) render the PPTX back, at the SAME pixel size as the reference
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
console.log('• rendering the PPTX via LibreOffice…');
run(SOFFICE, ['--headless', '--convert-to', 'pdf', '--outdir', tmp, pptx], { stdio: 'ignore' });
const pdf = join(tmp, basename(pptx).replace(/\.pptx$/i, '.pdf'));
if (!existsSync(pdf)) { console.error('LibreOffice produced no pdf — is `soffice` on PATH?'); process.exit(1); }
run('pdftoppm', ['-png', '-r', '96', '-scale-to-x', '1280', '-scale-to-y', '720', pdf, join(tmp, 'r')], { stdio: 'ignore' });

// 3) diff every slide
const { PNG } = await import(join(deckDir, 'node_modules', 'pngjs', 'lib', 'png.js')).catch(() => import('pngjs'));
const pixelmatch = (await import(join(deckDir, 'node_modules', 'pixelmatch', 'index.js')).catch(() => import('pixelmatch'))).default;

const reviewDir = join(deckDir, 'review');
if (!existsSync(reviewDir)) { console.error(`no ${reviewDir} — run without --no-shoot`); process.exit(1); }
const refs = readdirSync(reviewDir).filter((f) => /^slide-\d+\.png$/.test(f)).sort();
const rows = [];
for (const f of refs) {
  const n = f.match(/(\d+)/)[1];
  const rp = join(tmp, `r-${n}.png`);
  if (!existsSync(rp)) continue;
  const A = PNG.sync.read(readFileSync(join(reviewDir, f)));
  const B = PNG.sync.read(readFileSync(rp));
  if (A.width !== B.width || A.height !== B.height) { rows.push([n, NaN, 'size mismatch']); continue; }
  const hard = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0.15 });
  const loose = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0.35 });
  const pct = (hard / (A.width * A.height)) * 100;
  // antialiasing collapses at a loose threshold; a real geometric offset persists
  const kind = loose < hard * 0.35 ? 'antialiasing' : 'REAL SHIFT';
  rows.push([n, pct, kind]);
}
rows.sort((a, b) => (b[1] || 0) - (a[1] || 0));

console.log('\n  slide   hard-diff   nature');
for (const [n, p, kind] of rows) {
  console.log(`   ${n}      ${isNaN(p) ? '  ?  ' : p.toFixed(2).padStart(5)}%     ${kind}`);
}
const mean = rows.reduce((a, r) => a + (r[1] || 0), 0) / (rows.length || 1);
console.log(`\n  mean ${mean.toFixed(2)}%  ·  worst ${rows[0] ? rows[0][0] + ' @ ' + rows[0][1].toFixed(2) + '%' : '-'}`);

// 4) locate WHERE, on the worst few
console.log('\n  worst slides — where the diff is:');
for (const [n] of rows.slice(0, TOP)) {
  console.log(`\n  ── slide ${n} ──`);
  run('node', ['scripts/diff-regions.mjs',
    '--ref', join('review', `slide-${n}.png`),
    '--rendered', join(tmp, `r-${n}.png`), '--top', '2',
    '--out', join(tmp, `regions-${n}.png`)]);
}

console.log(`\n  renders kept in ${tmp}`);
console.log('  Read the worst slide images before calling the export done.');
