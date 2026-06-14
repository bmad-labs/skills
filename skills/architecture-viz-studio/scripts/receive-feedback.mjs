#!/usr/bin/env node
/* ============================================================================
   receive-feedback.mjs — land downloaded edit-mode feedback where the AI can read it.

   WHY
   Edit-mode runs in the browser, which is sandboxed and CANNOT write to disk — it
   can only *download* files (to ~/Downloads by default). So the snip screenshots
   live as `snip-N.png` in Downloads, and the exported JSON/markdown references them
   by an absolute `imagePath` (default `/tmp/viz-edit/snip-N.png`). This script moves
   the downloaded `edit-feedback.json` + `snip-*.png` to that `imageDir`, so the AI
   can read each image by the exact path the feedback names. Run it once after the
   user clicks "Download" in edit-mode.

   USAGE
     node receive-feedback.mjs [downloadsDir] [--json edit-feedback.json]
   - downloadsDir defaults to ~/Downloads.
   - Reads imageDir from the JSON (falls back to /tmp/viz-edit), creates it, and
     moves edit-feedback.json + every snip-*.png there. Prints the absolute paths.

   No dependencies beyond Node.
   ============================================================================ */

import { readFileSync, writeFileSync, mkdirSync, renameSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const downloads = (args.find((a) => !a.startsWith('--')) ) || join(homedir(), 'Downloads');
const jsonName = (() => { const i = args.indexOf('--json'); return i >= 0 ? args[i + 1] : 'edit-feedback.json'; })();

const jsonPath = resolve(downloads, jsonName);
if (!existsSync(jsonPath)) {
  console.error(`No ${jsonName} in ${downloads}. Click "Download" in edit-mode first, or pass the downloads dir.`);
  process.exit(1);
}

const batch = JSON.parse(readFileSync(jsonPath, 'utf8'));
const imageDir = batch.imageDir || '/tmp/viz-edit';
mkdirSync(imageDir, { recursive: true });

const move = (from, to) => { try { renameSync(from, to); } catch { copyFileSync(from, to); } };

// land the JSON itself
const jsonDst = join(imageDir, 'edit-feedback.json');
copyFileSync(jsonPath, jsonDst);

// land every snip-*.png referenced by the batch (or any present in downloads)
const moved = [];
const wanted = new Set(batch.comments.map((c) => c.screenshotFile).filter(Boolean));
// also catch any snip-*.png even if the JSON predates the screenshotFile field
readdirSync(downloads).filter((f) => /^snip-\d+\.png$/i.test(f)).forEach((f) => wanted.add(f));
for (const f of wanted) {
  const src = join(downloads, f);
  if (existsSync(src)) { const dst = join(imageDir, f); move(src, dst); moved.push(dst); }
}

console.log(`✓ feedback landed in ${imageDir}`);
console.log(`  ${jsonDst}`);
moved.forEach((m) => console.log(`  ${m}`));
console.log(`\nThe AI can now read each comment's "imagePath" directly. Paste edit-feedback.json (or its`);
console.log(`markdown) into the chat — the screenshot paths are absolute and resolvable.`);
