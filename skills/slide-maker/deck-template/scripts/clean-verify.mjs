#!/usr/bin/env node
/* ============================================================================
   clean-verify.mjs — wipe the editable-PPTX verification output before a fresh
   export, so stale renders/heatmaps/reports never leak into a new run.

   Clears export/verify-editable-pptx/ — EXCEPT pptx-acknowledgements.json, which
   records human waiver decisions and must survive a clean (losing it would silently
   re-open every previously-acknowledged issue). Use --all to wipe that too.

   USAGE
     node scripts/clean-verify.mjs           # clean, keep acknowledgements
     node scripts/clean-verify.mjs --all      # clean everything incl. acknowledgements
   ============================================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync, rmSync, mkdirSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DECK = resolve(HERE, '..');
const VERIFY = join(DECK, 'export', 'verify-editable-pptx');
const args = process.argv.slice(2);
const all = args.includes('--all');
const KEEP = all ? [] : ['pptx-acknowledgements.json'];

if (!existsSync(VERIFY)) {
  mkdirSync(VERIFY, { recursive: true });
  console.log(`• ${VERIFY} did not exist — created clean.`);
  process.exit(0);
}

let removed = 0;
for (const entry of readdirSync(VERIFY)) {
  if (KEEP.includes(entry)) continue;
  rmSync(join(VERIFY, entry), { recursive: true, force: true });
  removed++;
}
console.log(`• cleaned ${VERIFY} (removed ${removed} item(s)${KEEP.length ? `, kept ${KEEP.join(', ')}` : ''})`);
