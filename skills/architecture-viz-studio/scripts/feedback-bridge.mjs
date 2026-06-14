#!/usr/bin/env node
/* ============================================================================
   feedback-bridge.mjs — the ONE-CLICK path: edit-mode → disk → AI.

   WHY
   The browser is sandboxed and can't write files, so getting a snip screenshot to
   the AI normally means download → move → paste (clunky). But the browser CAN POST
   to localhost. This tiny server listens on a port; when a bridge is configured,
   edit-mode's "Copy for AI" button POSTs the whole batch (comments + snip PNGs as
   base64) here, and the bridge writes `edit-feedback.json` + `snip-N.png` to
   /tmp/viz-edit/ instantly. Then the user just says "read the feedback" — the AI
   reads the JSON + images by absolute path. No download, no manual move, no paste.

   USAGE
     node feedback-bridge.mjs [--port 8910] [--dir /tmp/viz-edit]
   Then load edit-mode with:  EditMode.init({ bridge: 'http://localhost:8910' })
   "Copy for AI" then copies the markdown AND saves the files here. If the bridge
   isn't running, "Copy for AI" silently falls back to a normal clipboard copy.

   CORS is wide-open (localhost dev tool). No deps beyond Node.
   ============================================================================ */

import { createServer } from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const port = +val('--port', 8910);
const dir = val('--dir', '/tmp/viz-edit');
mkdirSync(dir, { recursive: true });

const server = createServer((req, res) => {
  // permissive CORS so the page (any localhost port / file://) can POST
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('viz feedback-bridge up\n'); }
  if (req.method !== 'POST') { res.writeHead(405); return res.end(); }

  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 80 * 1024 * 1024) req.destroy(); });   // 80MB guard
  req.on('end', () => {
   try {
    let batch;
    try { batch = JSON.parse(body); } catch { res.writeHead(400); return res.end('bad json'); }

    // re-ensure the dir exists on every request — it may have been cleared since
    // startup (e.g. someone wiped /tmp). Never assume it persists.
    mkdirSync(dir, { recursive: true });

    const written = [];
    // write each snip PNG (comments carry screenshotDataUrl when sent via bridge)
    (batch.comments || []).forEach((c, i) => {
      if (c.screenshotDataUrl) {
        const m = c.screenshotDataUrl.match(/^data:image\/png;base64,(.+)$/);
        if (m) {
          const file = c.screenshotFile || `snip-${i + 1}.png`;
          const path = join(dir, file);
          writeFileSync(path, Buffer.from(m[1], 'base64'));
          c.imagePath = path;                 // stamp the absolute path
          written.push(path);
        }
      }
      delete c.screenshotDataUrl;             // don't bloat the JSON on disk
    });
    batch.imageDir = dir;
    const jsonPath = join(dir, 'edit-feedback.json');
    writeFileSync(jsonPath, JSON.stringify(batch, null, 2));
    written.unshift(jsonPath);

    // also write the human-readable markdown if the page sent it
    if (batch.markdown) { const md = join(dir, 'edit-feedback.md'); writeFileSync(md, batch.markdown); written.push(md); }

    console.log(`← received ${(batch.comments || []).length} comment(s); wrote:`);
    written.forEach((w) => console.log('   ' + w));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, dir, written }));
   } catch (err) {
    // never let a write error crash the bridge — report it and stay up
    console.error('write failed:', err.message);
    try { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: err.message })); } catch (_) {}
   }
  });
});

// last-resort guard: an unexpected throw should log, not kill the bridge
process.on('uncaughtException', (e) => console.error('bridge error (kept alive):', e.message));

server.listen(port, () => {
  console.log(`viz feedback-bridge listening on http://localhost:${port}  →  writes to ${dir}`);
  console.log(`load edit-mode with:  EditMode.init({ bridge: 'http://localhost:${port}' })`);
  console.log(`then click "Copy for AI". Tell the assistant: "read ${join(dir, 'edit-feedback.json')}".`);
});
