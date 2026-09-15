#!/usr/bin/env node
/* ============================================================================
   gen-viz-manifest.mjs — build a `vizId → source location` map.

   WHY
   Edit-mode hands the AI stable ids (`data-viz-id="hero.title"`,
   `userData.vizId = 'scene.gateway'`). An id tells the AI *which* thing, but it
   still has to find the code. This script closes that last gap: it scans your
   source for every literal viz id and records the file, line, the enclosing
   builder function, and (best-effort) the CSS rule — so a click round-trips to
   the exact code in ONE hop. For Three.js objects this is the ONLY bridge,
   since 3D objects have no DOM node to inspect.

   WHAT IT EMITS
   viz-manifest.json:
   {
     "hero.title":      { "file":"index.html",          "line":71,  "kind":"dom",   "cssRule":"styles.css .hero-title" },
     "scene.gateway":   { "file":"main.js",              "line":142, "kind":"three", "builderFn":"buildGateway" },
     "arch.node.ledger":{ "file":"diagrams/payments.js", "line":88,  "kind":"svg" }
   }

   HOW IT WORKS (dependency-free, regex + brace tracking — good enough for the
   vanilla-JS / HTML / SVG builders this skill produces; not a full AST, but it
   does track the nearest enclosing `function name(...)` / `const name = (...) =>`).

   USAGE
     node scripts/gen-viz-manifest.mjs <srcDir> [--out viz-manifest.json] [--css styles.css]
   then load it in the page before edit-mode:
     <script src="viz-manifest.js"></script>   (see --as-js)  OR
     fetch('viz-manifest.json') → EditMode.init({ manifest })

   This is intentionally simple and forgiving: a missing builderFn or cssRule is
   fine (fields are optional). The id + file + line alone already saves the AI a
   grep. Run it as a build step or by hand before you publish.
   ============================================================================ */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

const args = process.argv.slice(2);
const srcDir = args[0] || '.';
const outPath = argVal('--out') || 'viz-manifest.json';
const cssArg = argVal('--css');                 // optional explicit css file(s), comma-sep
const asJs = args.includes('--as-js');          // also emit viz-manifest.js (window.__VIZ_MANIFEST=...)

function argVal(flag) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

const CODE_EXT = new Set(['.js', '.mjs', '.ts', '.html', '.htm', '.svg', '.jsx', '.tsx']);
const CSS_EXT = new Set(['.css']);

/* ---- gather files ---- */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const allFiles = walk(srcDir);
const codeFiles = allFiles.filter((f) => CODE_EXT.has(extname(f)));
const cssFiles = cssArg
  ? cssArg.split(',').map((s) => join(srcDir, s.trim()))
  : allFiles.filter((f) => CSS_EXT.has(extname(f)));

/* ---- 1. find every viz id with its file+line+kind+builder ---- */
// Matches: data-viz-id="x.y"   OR   vizId: 'x.y'   OR   registerVizObject(obj, 'x.y')
const ID_RE = /(?:data-viz-id\s*=\s*|userData\.vizId\s*=\s*|vizId\s*:\s*|registerVizObject\s*\([^,]+,\s*)(['"])([\w.-]+)\1/g;
// nearest enclosing builder: `function name(` or `const name = (` / `name = function`
const FN_RE = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/g;

const manifest = {};

for (const file of codeFiles) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const rel = relative(srcDir, file) || basename(file);
  const ext = extname(file);
  const kindDefault = (ext === '.html' || ext === '.htm') ? 'dom'
    : (ext === '.svg') ? 'svg' : null;   // .js could be either; refine per-match below

  // precompute function-start positions (char offset -> name)
  const fnMarks = [];
  let fm;
  FN_RE.lastIndex = 0;
  while ((fm = FN_RE.exec(text))) fnMarks.push({ pos: fm.index, name: fm[1] || fm[2] });

  let m;
  ID_RE.lastIndex = 0;
  while ((m = ID_RE.exec(text))) {
    const id = m[2];
    const charPos = m.index;
    const line = text.slice(0, charPos).split('\n').length;
    const matchStr = m[0];
    // kind: data-viz-id => dom/svg; registerVizObject/userData.vizId => three; vizId: => three
    let kind = kindDefault;
    if (/data-viz-id/.test(matchStr)) kind = kind || 'dom';
    else kind = 'three';
    if (kind === null) kind = 'dom';

    // nearest preceding function mark
    let builderFn;
    for (const mark of fnMarks) { if (mark.pos < charPos) builderFn = mark.name; else break; }

    const entry = { file: rel, line, kind };
    if (builderFn && kind === 'three') entry.builderFn = builderFn;
    else if (builderFn) entry.builderFn = builderFn;
    // keep the first occurrence (definition site) if duplicated
    if (!manifest[id]) manifest[id] = entry;
  }
}

/* ---- 2. best-effort CSS rule lookup: which selector styles the id (by class) ----
   We can't know the runtime class from a static id, but viz ids are usually
   dotted forms of a class (hero.title -> .hero-title) or appear as a comment.
   Strategy: for each id, look for a selector containing the id's leaf token. */
const cssIndex = [];
for (const file of cssFiles) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  const rel = relative(srcDir, file) || basename(file);
  const lines = text.split('\n');
  lines.forEach((ln, i) => {
    const sel = ln.match(/^([.#][\w-]+(?:[\s>.#][\w-]+)*)\s*\{/);
    if (sel) cssIndex.push({ file: rel, line: i + 1, selector: sel[1].trim() });
  });
}
function leafToken(id) { return id.split('.').pop(); }
for (const [id, entry] of Object.entries(manifest)) {
  const leaf = leafToken(id);
  // candidate class forms: .leaf, .id-with-dashes
  const dashForm = id.replace(/\./g, '-');
  const hit = cssIndex.find((c) =>
    c.selector.includes('.' + leaf) || c.selector.includes('.' + dashForm));
  if (hit) entry.cssRule = `${hit.file}:${hit.line} ${hit.selector}`;
}

/* ---- write ---- */
const json = JSON.stringify(manifest, null, 2);
writeFileSync(join(srcDir, outPath), json);
const ids = Object.keys(manifest);
console.log(`viz-manifest: ${ids.length} ids → ${outPath}`);
if (asJs) {
  const jsPath = outPath.replace(/\.json$/, '.js');
  writeFileSync(join(srcDir, jsPath), `window.__VIZ_MANIFEST = ${json};\n`);
  console.log(`               also wrote ${jsPath} (sets window.__VIZ_MANIFEST)`);
}
if (ids.length === 0) {
  console.warn('  (no data-viz-id / userData.vizId / registerVizObject ids found — is srcDir correct?)');
}
