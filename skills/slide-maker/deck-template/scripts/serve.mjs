#!/usr/bin/env node
/* ============================================================================
   serve.mjs — run the feedback-bridge alongside the deck dev server, so edit-mode
   "Copy for AI" is always one click.

   The deck is a Vite app, so the *page* server is `npm run dev` (port 5173). This
   script starts the **feedback-bridge** (port 8930) next to it and prints the
   wiring. Run it in one terminal, `npm run dev` in another — or pass --dev and this
   spawns `npm run dev` for you (in the deckDir).

   USAGE
     node serve.mjs [deckDir] [--dev] [--port 8930] [--dir /tmp/slide-maker-edit]

   edit-mode is already wired in the deck to EditMode.init({ bridge:
   'http://localhost:8930' }), so once this is up, "Copy for AI" writes
   edit-feedback.json + snip-N.png to the feedback dir. Tell the assistant:
   "read /tmp/slide-maker-edit/edit-feedback.json".
   ============================================================================ */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const positional = args.find((a) => !a.startsWith('--'));
// scripts live in <deck>/scripts/, so the deck root is the parent.
const deckDir = resolve(positional || resolve(HERE, '..'));
const port = flag('--port', '8930');
const dir = flag('--dir', '/tmp/slide-maker-edit');
const withDev = args.includes('--dev');

const procs = [];
function run(cmd, cmdArgs, opts = {}) {
  const p = spawn(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  procs.push(p);
  p.on('exit', (code) => { console.log(`\n[${cmd}] exited (${code}); stopping the rest.`); shutdown(); });
  return p;
}
function shutdown() { procs.forEach((p) => { try { p.kill(); } catch (_) {} }); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`slide-maker serve:`);
console.log(`  feedback-bridge → http://localhost:${port}  (writes ${dir})`);
run('node', [resolve(HERE, 'feedback-bridge.mjs'), '--port', port, '--dir', dir]);

if (withDev) {
  console.log(`  deck dev server → starting "npm run dev" in ${deckDir}`);
  run('npm', ['run', 'dev'], { cwd: deckDir });
} else {
  console.log(`  deck dev server → run "npm run dev" in ${deckDir} (separate terminal)`);
  console.log(`     or re-run with --dev to start it here.`);
}
console.log(`\nOpen the deck, press "e", select/snip, then "Copy for AI".`);
console.log(`Then tell the assistant: read ${dir}/edit-feedback.json`);
