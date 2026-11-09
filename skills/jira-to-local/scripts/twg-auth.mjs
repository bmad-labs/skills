#!/usr/bin/env node
/**
 * twg-auth.mjs — Check and complete the browser sign-in the `twg` transport needs.
 *
 * Usage:
 *   twg-auth.mjs status [--site HOST]
 *   twg-auth.mjs login --site HOST
 *
 * `login` is the one step a non-technical user would otherwise do in a terminal.
 * `twg login` refuses to run without a terminal, so it runs under `script`, which
 * gives it one. This opens the sign-in page with the system opener, prints the
 * link as a fallback, and returns once `twg whoami` succeeds — the agent never has
 * to ask the user to come back and say "done".
 *
 * Accepting twg's terms (`twg consent`) is the user's own decision and is never
 * done here; `status` reports whether it is recorded.
 */

import { spawn, execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { twgBinary, runTwg } from './twg.mjs';

/** How long to wait for the browser approval before giving up. */
const TIMEOUT_MIN = 10;

/** How often to ask twg whether the approval has landed. */
const POLL_MS = 3000;

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * The shell line that runs `bin args` inside a pseudo-terminal.
 *
 * `cat` sits in front because Node hands a child its stdin as a socket, and macOS
 * `script` exits at once on a socket ("tcgetattr/ioctl: Operation not supported on
 * socket"); through `cat` it reads a real pipe.
 */
export function ptyCommand(platform, bin, args) {
  const line = [bin, ...args].map(shellQuote).join(' ');
  if (platform === 'darwin') return ['/bin/sh', ['-c', `cat | script -q /dev/null ${line}`]];
  if (platform === 'linux') return ['/bin/sh', ['-c', `cat | script -qec ${shellQuote(line)} /dev/null`]];
  throw new Error(`No terminal wrapper for ${platform}. Run \`twg login\` in your own terminal instead.`);
}

/** The system command that opens `url` in the default browser, or null when there is none here. */
export function browserCommand(platform, url) {
  if (platform === 'darwin') return ['open', [url]];
  if (platform === 'linux') return ['xdg-open', [url]];
  return null;
}

/**
 * What the twg login screen shows so far.
 *
 * Under `script`, twg's output can arrive one byte per line — colour codes split
 * across line breaks — so whitespace is removed first, which rejoins the codes,
 * then the codes and the border characters twg draws between letters. The device
 * code is matched by its fixed XXXX-XXXX form, so the text after it cannot run in.
 */
export function readLoginScreen(screen) {
  const compact = screen.replace(/\s/g, '').replace(ANSI, '').replace(/│/g, '');
  const url = compact.match(/https:\/\/auth\.atlassian\.com\/oauth\/activate\?user_code=([A-Z0-9]{4}-[A-Z0-9]{4})/);
  return {
    url: url ? url[0] : null,
    code: url ? url[1] : null,
    asksBrowser: compact.includes('Openinbrowser?'),
  };
}

function twgText(args) {
  return new Promise((done) => {
    execFile(twgBinary(), args, (error, stdout, stderr) => {
      done({ ok: !error, text: `${stdout || ''}${stderr || ''}`.trim(), missing: error?.code === 'ENOENT' });
    });
  });
}

async function whoami(site) {
  try {
    const envelope = await runTwg(['whoami'], site);
    return envelope.data?.email || envelope.data?.name || null;
  } catch {
    return null;
  }
}

async function cmdStatus(site) {
  const version = await twgText(['--version']);
  if (version.missing) {
    console.log(JSON.stringify({ installed: false, consent: false, signedIn: false }, null, 2));
    return 1;
  }
  const consent = await twgText(['consent', '--status']);
  const email = await whoami(site);
  console.log(JSON.stringify({
    installed: true,
    version: version.text,
    consent: /recorded/i.test(consent.text) && !/not recorded/i.test(consent.text),
    signedIn: !!email,
    email,
  }, null, 2));
  return email ? 0 : 1;
}

function cmdLogin(site) {
  const [cmd, args] = ptyCommand(process.platform, twgBinary(), ['login', '--site', site]);
  // Its own process group, so stopping it also stops the `cat` and `script` under the shell.
  const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], detached: true });
  const stop = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } };
  let screen = '';
  let answered = false;
  let poll = null;

  return new Promise((done) => {
    let finished = false;
    const finish = (code, report) => {
      // Stopping the group fires `close`, which would report a second time.
      if (finished) return;
      finished = true;
      clearInterval(poll);
      clearTimeout(timer);
      stop();
      console.log(JSON.stringify(report, null, 2));
      done(code);
    };

    const onData = (chunk) => {
      screen += chunk.toString();
      const found = readLoginScreen(screen);
      if (found.url && !poll) {
        // Opened here rather than by answering twg's own browser prompt: in a live
        // run that prompt path left the browser closed, and this one does not
        // depend on how twg draws its question.
        const opener = browserCommand(process.platform, found.url);
        if (opener) spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
        console.log(`Sign-in page: ${found.url}`);
        console.log(`Code: ${found.code}`);
        console.log('Waiting for the approval in the browser...');
        // twg keeps its prompt open after the approval, so the sign-in is detected
        // by asking twg who is signed in rather than by waiting for it to exit.
        poll = setInterval(async () => {
          const email = await whoami(site);
          if (email) finish(0, { signedIn: true, email });
        }, POLL_MS);
      }
      // The page is already open, so decline twg's offer to open a second one.
      if (found.asksBrowser && !answered) {
        answered = true;
        child.stdin.write('n\r');
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const timer = setTimeout(() => {
      console.error(`No approval within ${TIMEOUT_MIN} minutes. Run login again for a new code.`);
      finish(1, { signedIn: false });
    }, TIMEOUT_MIN * 60 * 1000);

    child.on('close', async () => {
      if (!poll && /consent/i.test(screen.replace(ANSI, ''))) {
        console.error('twg needs its terms accepted first. The user runs: twg consent');
      }
      const email = await whoami(site);
      finish(email ? 0 : 1, email ? { signedIn: true, email } : { signedIn: false });
    });
  });
}

function flag(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  const site = flag('--site');

  if (command === 'status') return cmdStatus(site);
  if (command === 'login') {
    if (!site) {
      console.error('Required: --site, e.g. mycompany.atlassian.net');
      return 1;
    }
    return cmdLogin(site);
  }

  console.log('Usage:');
  console.log('  twg-auth.mjs status [--site HOST]');
  console.log('  twg-auth.mjs login --site HOST');
  return command ? 1 : 0;
}

// realpathSync on both sides, because a symlinked skill directory makes the raw
// paths disagree: the file would then load as a library and do nothing, printing
// no output and exiting 0 — which reads as success.
function isMainScript(selfPath) {
  const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  return real(process.argv[1]) === real(selfPath);
}

if (process.argv[1] && isMainScript(new URL(import.meta.url).pathname)) {
  main().then((code) => process.exit(code), (err) => { console.error(err.message); process.exit(1); });
}
