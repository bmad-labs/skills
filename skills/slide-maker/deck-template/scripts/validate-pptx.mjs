#!/usr/bin/env node
/* ============================================================================
   validate-pptx.mjs — GLOBAL quality gate for the editable PPTX export.

   Runs the whole pipeline and ENFORCES quality: the deck PASSES only when every
   detected issue is either (a) fixed, or (b) explicitly ACKNOWLEDGED with a reason.

     export (--dump-ops) → LibreOffice render → verify-deck (all checks) → collect
     issues (each with a stable id) → apply export/acknowledgements.json → verdict.

   Every issue gets a content-hash ID. The agent reviews each one; if an issue is a
   known/acceptable artifact (e.g. a 1-line wrap difference LibreOffice renders), the
   agent acknowledges it BY ID with a reason. New or worsened issues get a new id →
   they are NOT covered by old acks → the gate fails until reviewed.

   COMMANDS
     node scripts/validate-pptx.mjs                 # run full validation (export+render+check)
     node scripts/validate-pptx.mjs --no-build      # reuse existing export/ops.json + render
     node scripts/validate-pptx.mjs --ack <ID> --reason "why this is acceptable"
     node scripts/validate-pptx.mjs --unack <ID>
     node scripts/validate-pptx.mjs --list-acks

   Exit 0 only when ALL issues are fixed or acknowledged. Non-zero otherwise.
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const DECK = resolve(HERE, '..');
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const has = (f) => args.includes(f);

// Everything the gate produces lives under export/verify-editable-pptx/ (gitignored):
//   .../deck-report.json                 the gate result
//   .../pptx-acknowledgements.json        waived issues + reasons
//   .../source/<slide>.png                source render (from the HTML/Chromium)
//   .../slides/<slide>.png                render of the exported pptx (LibreOffice)
//   .../diff/<slide>.png                  pixel-diff heatmap
//   .../diff/<slide>_inspect.{png,json}   diff-region analysis (annotated + data)
const VERIFY = join(DECK, 'export', 'verify-editable-pptx');
const DIR = { source: join(VERIFY, 'source'), slides: join(VERIFY, 'slides'), diff: join(VERIFY, 'diff') };
const ACK_PATH = resolve(flag('--acks', join(VERIFY, 'pptx-acknowledgements.json')));
const OPS_PATH = join(DECK, 'export', 'ops.json');
const REPORT_PATH = join(VERIFY, 'deck-report.json');
const LO_TMP = '/tmp/slide-maker-validate';
const pad2 = (n) => String(n).padStart(2, '0');
const SOFFICE = ['/opt/homebrew/bin/soffice', '/usr/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'].find((p) => existsSync(p)) || 'soffice';
const today = flag('--date', '');   // pass a date in (no Date.now in some envs); else 'recorded'

const loadAcks = () => (existsSync(ACK_PATH) ? JSON.parse(readFileSync(ACK_PATH, 'utf8')) : {});
const saveAcks = (a) => { mkdirSync(dirname(ACK_PATH), { recursive: true }); writeFileSync(ACK_PATH, JSON.stringify(a, null, 2) + '\n'); };
// collect ALL values after a flag (space- or comma-separated), until the next --flag.
// e.g. `--ack E1 E2 E3 --reason "…"` or `--ack E1,E2,E3`
const flagValues = (f) => {
  const i = args.indexOf(f); if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) out.push(...args[j].split(','));
  return out.map((s) => s.trim()).filter(Boolean);
};

// ── acknowledgement management (no pipeline run) ──
if (has('--ack')) {
  const ids = flagValues('--ack'), reason = flag('--reason', null);
  if (!ids.length || !reason) { console.error('usage: --ack <ID> [<ID> …] --reason "why it is acceptable"  (reason REQUIRED; applies to all listed IDs)'); process.exit(1); }
  const acks = loadAcks();
  ids.forEach((id) => { acks[id] = { reason, ack: today || 'recorded' }; });
  saveAcks(acks);
  console.log(`✓ acknowledged ${ids.length} issue(s): ${ids.join(', ')}\n  reason: ${reason}`);
  process.exit(0);
}
if (has('--unack')) {
  const ids = flagValues('--unack'); const acks = loadAcks();
  let n = 0;
  ids.forEach((id) => { if (acks[id]) { delete acks[id]; n++; console.log(`✓ removed acknowledgement ${id}`); } else console.log(`no acknowledgement for ${id}`); });
  if (n) saveAcks(acks);
  process.exit(0);
}
if (has('--list-acks')) {
  const acks = loadAcks(); const ids = Object.keys(acks);
  if (!ids.length) console.log('no acknowledgements.');
  else { console.log(`acknowledgements (${ids.length}):`); ids.forEach((id) => console.log(`  ${id}  ${acks[id].reason}  [${acks[id].ack}]`)); }
  process.exit(0);
}

// ── full validation run ──
function run(cmd, a) { return execFileSync(cmd, a, { cwd: DECK, stdio: 'pipe', timeout: 600000, env: { ...process.env } }); }

(async () => {
  if (!has('--no-build')) {
    // NOTE: this script does NOT auto-clean verify-editable-pptx/ — the diff/render
    // artifacts are needed during the fix loop. Per-slide outputs are overwritten in
    // place each run. Run `node scripts/clean-verify.mjs` yourself when you want a
    // fresh slate (it keeps pptx-acknowledgements.json).
    Object.values(DIR).forEach((d) => mkdirSync(d, { recursive: true }));

    console.log('• exporting deck (--dump-ops)…');
    run('node', ['scripts/export-pptx-jsx.mjs', '--dump-ops']);

    console.log('• rendering exported pptx via LibreOffice → verify/slides/…');
    mkdirSync(LO_TMP, { recursive: true });
    // Wipe STALE renders from prior runs first. LO_TMP persists across runs, and
    // pdftoppm emits BOTH `p-1.png` (single-digit) and a fresh run's `p-01.png`
    // (padded). The copy loop's /^p-\d+\.png$/ matches both, so a leftover `p-1.png`
    // from an OLD export (e.g. a different deck) can overwrite the fresh `slide-01.png`
    // — silently validating the wrong slide. Clear p-*.png + deck.pdf every run.
    readdirSync(LO_TMP).filter((f) => /^p-\d+\.png$/.test(f) || f === 'deck.pdf')
      .forEach((f) => { try { rmSync(join(LO_TMP, f)); } catch (_) {} });
    run(SOFFICE, ['--headless', '--norestore', '--nolockcheck', `-env:UserInstallation=file://${join(LO_TMP, '.profile')}`, '--convert-to', 'pdf', '--outdir', LO_TMP, join(DECK, 'export', 'deck.pptx')]);
    const pdf = join(LO_TMP, 'deck.pdf');
    if (!existsSync(pdf)) { console.error('LibreOffice produced no PDF'); process.exit(1); }
    try { run('pdftoppm', ['-png', '-scale-to-x', '1280', '-scale-to-y', '720', pdf, join(LO_TMP, 'p')]); }
    catch { console.error('pdftoppm failed (needed to split the deck PDF into per-slide PNGs)'); process.exit(1); }
    // p-N.png → verify/slides/slide-NN.png
    readdirSync(LO_TMP).filter((f) => /^p-\d+\.png$/.test(f)).forEach((f) => {
      const n = +f.match(/\d+/)[0];
      cpSync(join(LO_TMP, f), join(DIR.slides, `slide-${pad2(n)}.png`));
    });

    // source render (from the HTML) → verify/source/<slide>.png
    console.log('• rendering source from HTML → verify/source/…');
    run('node', ['scripts/shoot-slides.mjs', '--mode', 'normal', '--out', DIR.source]);

    console.log('• running unified gate (verify-deck)… → verify/diff/ heatmaps');
    try { run('node', ['scripts/verify-deck.mjs', '--ops', OPS_PATH, '--ref-dir', DIR.source, '--rendered-dir', DIR.slides, '--ref-glob', 'slide-{nn}.png', '--rendered-glob', 'slide-{nn}.png', '--json', REPORT_PATH, '--diff-dir', DIR.diff]); }
    catch (_) { /* verify-deck exits non-zero on issues; we read its JSON regardless */ }

    // per-slide diff-region inspection → verify/diff/<slide>_inspect.{png,json}
    console.log('• writing diff-region inspections → verify/diff/…');
    const report0 = existsSync(REPORT_PATH) ? JSON.parse(readFileSync(REPORT_PATH, 'utf8')) : { slides: [] };
    for (const s of report0.slides || []) {
      const nn = pad2(s.slide);
      const src = join(DIR.source, `slide-${nn}.png`), ren = join(DIR.slides, `slide-${nn}.png`);
      if (!existsSync(src) || !existsSync(ren)) continue;
      try {
        run('node', ['scripts/inspect.mjs', '--slide', String(s.slide), '--all', '--mode', 'clean', '--out', join(LO_TMP, 'geo')]);
        run('node', ['scripts/diff-regions.mjs', '--ref', src, '--rendered', ren,
          '--geometry', join(LO_TMP, 'geo', 'geometry.json'),
          '--out', join(DIR.diff, `slide-${nn}_inspect.png`),
          '--json', join(DIR.diff, `slide-${nn}_inspect.json`)]);
      } catch (_) { /* best-effort per slide */ }
    }
  }

  if (!existsSync(REPORT_PATH)) { console.error(`no gate report at ${REPORT_PATH} (run without --no-build)`); process.exit(1); }
  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
  const acks = loadAcks();

  // collect every failing issue
  const issues = [];
  for (const s of report.slides || []) {
    if (s.error) { issues.push({ issueId: 'E_MISSING_' + s.slide, slide: s.slide, kind: 'render', id: '(slide)', detail: s.error, failClass: 'render-missing' }); continue; }
    for (const c of s.checks || []) if (!c.ok) issues.push({ issueId: c.issueId, slide: s.slide, kind: c.kind, id: c.id, detail: c.detail, failClass: c.failClass });
  }

  const open = issues.filter((i) => !acks[i.issueId]);
  const acked = issues.filter((i) => acks[i.issueId]);
  const staleAckIds = Object.keys(acks).filter((id) => !issues.some((i) => i.issueId === id));

  // ── report ──
  console.log('\n══════════ PPTX VALIDATION ══════════');
  console.log(`  issues: ${issues.length}   open: ${open.length}   acknowledged: ${acked.length}`);
  if (open.length) {
    console.log('\n  ✗ OPEN ISSUES — for EACH, review the 5 evidence files below, then fix or acknowledge.');
    console.log('     MANDATORY before deciding: Read all 5 (source · rendered · heatmap · inspect.png · inspect.json).');
    console.log('     The judgement (fix vs acknowledge) MUST be grounded in what they show — never rubber-stamp.\n');
    // group open issues by slide so the per-slide evidence set is listed once
    const bySlide = {};
    for (const i of open) (bySlide[i.slide] = bySlide[i.slide] || []).push(i);
    const rel = (p) => p.replace(DECK + '/', '');
    for (const slide of Object.keys(bySlide).sort((a, b) => a - b)) {
      const nn = pad2(slide);
      console.log(`  ── slide ${slide} ──  review these before judging:`);
      console.log(`     source   : ${rel(join(DIR.source, `slide-${nn}.png`))}   (the HTML design — the target)`);
      console.log(`     rendered : ${rel(join(DIR.slides, `slide-${nn}.png`))}   (the exported pptx via LibreOffice)`);
      console.log(`     heatmap  : ${rel(join(DIR.diff, `slide-${nn}.png`))}   (red = hard diff · yellow = AA/font noise)`);
      console.log(`     inspect  : ${rel(join(DIR.diff, `slide-${nn}_inspect.png`))}   (top diff regions boxed on the render)`);
      console.log(`     inspect  : ${rel(join(DIR.diff, `slide-${nn}_inspect.json`))}   (regions + the data-viz-ids in each + verdict)`);
      for (const i of bySlide[slide]) {
        console.log(`     • [${i.issueId}] ${i.kind}/${i.failClass}  ${i.id}`);
        console.log(`           ${i.detail}`);
        console.log(`           → after reviewing the 5 files: fix the cause, OR`);
        console.log(`             node scripts/validate-pptx.mjs --ack ${i.issueId} --reason "what the evidence showed + why acceptable"`);
      }
      console.log('');
    }
  }
  if (acked.length) {
    console.log('\n  ◽ acknowledged (waived):');
    for (const i of acked) console.log(`    [${i.issueId}]  slide ${i.slide}  ${i.kind}/${i.failClass} — ${acks[i.issueId].reason}`);
  }
  if (staleAckIds.length) {
    console.log('\n  ⚠ stale acknowledgements (issue no longer present — safe to remove):');
    staleAckIds.forEach((id) => console.log(`    [${id}]  ${acks[id].reason}  →  --unack ${id}`));
  }

  const pass = open.length === 0;
  console.log(`\n  ${pass ? '✓ PASS — all issues fixed or acknowledged' : `✗ FAIL — ${open.length} open issue(s) need a fix or acknowledgement`}`);
  console.log('═════════════════════════════════════');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('validate-pptx failed:', e.message); process.exit(1); });
