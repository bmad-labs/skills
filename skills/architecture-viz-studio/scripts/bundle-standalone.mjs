#!/usr/bin/env node
/* ============================================================================
   bundle-standalone.mjs — inline a viz page into ONE standalone .html file.

   WHY
   These pages are split across index.html + styles.css + main.js + edit-mode/* +
   viz-manifest. That's right for development, but to SHARE the result (email it,
   drop it in a deck, open it with no server) you want a single file. This inlines
   every LOCAL asset into one .html. CDN libs (three, gsap) stay as <script src>
   by default so the file is small; pass --vendor to download and inline them too
   for a fully offline file.

   WHAT IT HANDLES
   - <link rel="stylesheet" href="local.css">      → inlined <style>
   - <script src="local.js">                        → inlined <script>
   - <script type="module" src="main.js">           → inlined <script type="module">
     (rewrites bare `import ... from 'three'` to the importmap URL, or to the
      vendored blob when --vendor, since an inline module can't use a relative src)
   - viz-manifest.js / edit-mode/* / viz.js         → inlined
   - edit-mode is STRIPPED BY DEFAULT (an export is a shared/publish artifact —
     no overlay, no ✎ button). Pass --keep-edit to retain the authoring tool.
   - --vendor : also fetch the CDN libs (three, gsap) and inline them for a fully
     OFFLINE file (opens with no internet). Without it, CDN <script src> are kept.

   USAGE
     node bundle-standalone.mjs <index.html> [--out page.standalone.html] [--vendor] [--keep-edit]

   No dependencies beyond Node (uses fetch for --vendor). Run from the page dir.
   ============================================================================ */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const args = process.argv.slice(2);
const entry = args.find((a) => !a.startsWith('--')) || 'index.html';
const outArg = val('--out');
const vendor = args.includes('--vendor');
// Edit-mode is a DEV/authoring tool — a shared/exported page should never carry it.
// So the standalone export strips edit-mode by DEFAULT; pass --keep-edit to retain it.
const noEdit = !args.includes('--keep-edit');
function val(f) { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; }

const entryPath = resolve(entry);
const baseDir = dirname(entryPath);
const out = outArg || entryPath.replace(/\.html?$/, '') + '.standalone.html';
let html = readFileSync(entryPath, 'utf8');

const readLocal = (href) => {
  const p = join(baseDir, href.split('?')[0].split('#')[0]);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};
const isLocal = (url) => url && !/^https?:\/\//.test(url) && !url.startsWith('data:');

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  return r.text();
}

/* ---- 0. strip edit-mode for the publish build ----
   Remove the edit-mode css/js + viz.js + viz-manifest includes so the tool never
   loads. We DON'T text-surgery the page's `EditMode.foo()` calls (those span
   multiple lines and break syntax) — instead we inject a tiny NO-OP shim so any
   `EditMode.*` / `__viz.*` calls left in the page code are harmless. Robust and
   syntax-safe. */
if (noEdit) {
  html = html
    .replace(/<link[^>]+edit-mode[^>]*>\s*/gi, '')
    .replace(/<script[^>]+edit-mode\/[^>]*><\/script>\s*/gi, '')
    .replace(/<script[^>]+viz\.js[^>]*><\/script>\s*/gi, '')
    .replace(/<script[^>]+viz-manifest[^>]*><\/script>\s*/gi, '')
    .replace(/<!--[^>]*[Ee]dit\s*[Mm]ode[\s\S]*?-->\s*/g, '');
  const shim = `<script>(function(){var noop=function(){return noop;};`
    + `window.EditMode=new Proxy({},{get:function(){return noop;}});`
    + `window.__viz=new Proxy({},{get:function(){return noop;}});`
    + `window.__VIZ_MANIFEST=window.__VIZ_MANIFEST||{};})();</script>`;
  html = html.replace(/<\/head>/i, shim + '\n</head>');
}

/* ---- 1. capture the importmap's three URL (we KEEP the importmap; an inline
        module resolves `import 'three'` through it. For --vendor we rewrite the
        URL inside the importmap to a blob in §4, so the module code is untouched). */
let threeUrl = null;
html.replace(/<script\s+type=["']importmap["']\s*>([\s\S]*?)<\/script>/i, (m, body) => {
  try { threeUrl = JSON.parse(body).imports?.three || null; } catch (_) {}
  return m;
});

/* ---- 2. inline local <link rel=stylesheet> ---- */
html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
  const href = (tag.match(/href=["']([^"']+)["']/) || [])[1];
  if (!isLocal(href)) return tag;
  const css = readLocal(href);
  return css == null ? tag : `<style>\n${css}\n</style>`;
});

/* ---- 3. inline local <script> (classic and module) ----
   Replace each matched tag IN PLACE via a single regex pass. (Don't use
   html.replace(tagString, …) per-tag: the inlined code can itself contain a
   literal `<script src="…">` in a comment, and string-replace hits the first
   occurrence — which would be that comment, not the real tag.) We first collect
   async work (vendored CDN fetches), then splice synchronously. */
const SCRIPT_RE = /<script\b[^>]*\ssrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;

// pre-fetch any vendored CDN script bodies (needs await; regex-replace can't be async)
const fetched = new Map();
if (vendor) {
  for (const m of html.matchAll(SCRIPT_RE)) {
    const src = m[1];
    if (/^https?:\/\//.test(src) && !fetched.has(src)) fetched.set(src, await fetchText(src));
  }
}

html = html.replace(SCRIPT_RE, (tag, src) => {
  const isModule = /type=["']module["']/.test(tag);
  if (isLocal(src)) {
    let code = readLocal(src);
    if (code == null) return tag;
    if (isModule) {
      if (vendor) {
        // offline: turn the static `import * as THREE from 'three'` into a dynamic
        // import of the blob URL (valid top-level await in a module). Works for the
        // common `import * as THREE from 'three'` and `import {X} from 'three'` forms.
        code = code
          .replace(/import\s+\*\s+as\s+THREE\s+from\s+(["'])three\1\s*;?/g, 'const THREE = await import(window.__THREE_BLOB__);')
          .replace(/import\s+(\{[^}]*\})\s+from\s+(["'])three\2\s*;?/g, 'const $1 = await import(window.__THREE_BLOB__);');
      }
      // else: leave `import … from 'three'` as-is — the kept importmap resolves it to the CDN URL.
      // (We do NOT strip EditMode calls here — a no-op shim in §0 neutralises them safely.)
      return `<script type="module">\n${code}\n</script>`;
    }
    return `<script>\n${code}\n</script>`;
  }
  if (vendor && fetched.has(src)) return `<script>\n${fetched.get(src)}\n</script>`;
  return tag;   // remote, not vendoring → leave as CDN <script src>
});

/* ---- 4. vendor three: fetch it once, expose as a blob URL the module imports
        dynamically (see §3 vendor rewrite). Drop the now-unused importmap. ---- */
if (vendor && threeUrl) {
  const threeSrc = await fetchText(threeUrl);
  const loader = `<script>window.__THREE_BLOB__=URL.createObjectURL(new Blob([${JSON.stringify(threeSrc)}],{type:'text/javascript'}));</script>`;
  html = html.replace(/<script\s+type=["']importmap["']\s*>[\s\S]*?<\/script>\s*/i, loader + '\n');
}

/* ---- 5. write ---- */
writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`✓ standalone → ${out} (${kb} KB)${vendor ? ' · libs vendored (offline-ready)' : ' · CDN libs kept'}${noEdit ? ' · edit-mode stripped (publish build)' : ''}`);
if (!vendor) console.log('  Note: opening over file:// keeps CDN <script src> — needs internet. Use --vendor for a fully offline file.');
