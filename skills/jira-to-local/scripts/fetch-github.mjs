#!/usr/bin/env node
/**
 * fetch-github.mjs — Pull the GitHub links an issue's design fields point at.
 *
 * A team that writes its technical design as a pull request leaves the issue
 * holding a link and nothing else: the design itself is on github.com, so a
 * pulled issue read offline is missing the very thing it is about. This script
 * fetches what the link points at — a pull request, a commit, a file, a
 * directory, a repository — and writes it beside the issue.
 *
 * Only three fields are read: the description and the two design fields named
 * by `github.sourceFields` in the config. A GitHub link in a comment is a
 * passing reference rather than the design, so it is left alone.
 *
 * The content is always markdown, whatever `output.mode` says. A pull request
 * is a written document rather than a record with fields, so there is no useful
 * JSON shape for it and no schema to check it against.
 *
 * Everything here reads. `gh` is called only with `view`, `api` (GET), and
 * `--json`; nothing creates, edits, comments on, or merges anything.
 *
 * Usage:
 *   fetch-github.mjs --issue <KEY>            Every GitHub link the issue's fields hold
 *   fetch-github.mjs --issue <KEY> --list     Report the links, write nothing
 *   fetch-github.mjs --url <URL> --out DIR    One link, anywhere
 *
 * Options:
 *   --no-files    Metadata only; do not fetch the changed file contents
 *   --quiet       Report only the summary
 */

import { writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { connect, apiGet } from './jira-api.mjs';
import { outputDirFor } from './config.mjs';

const today = () => new Date().toISOString().slice(0, 10);

/** Fields whose GitHub links are the design, when the config names none. */
const DEFAULT_SOURCE_FIELDS = ['description'];

/** A file bigger than this is recorded in the table but not written. */
const DEFAULT_MAX_FILE_KB = 512;

/**
 * Every shape of GitHub URL the issues actually carry, reduced to a target.
 *
 *   /owner/repo/pull/84                     a pull request
 *   /owner/repo/pull/84/files#diff-abc      the same, deep-linked into a diff
 *   /owner/repo/commit/a1b2c3d              a commit
 *   /owner/repo/blob/main/path/to/file.ts   one file
 *   /owner/repo/tree/main/libs/thing        a directory
 *   /owner/repo                             the repository itself
 *
 * The fragment and the query are dropped: `#diff-<sha>` names a hunk inside a
 * page, not a different thing to fetch, and keeping it would pull the same pull
 * request once per anchor.
 */
export function parseGitHubUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/\s#?]+)\/([^/\s#?]+)(\/[^\s#?]*)?/i);
  if (!m) return null;

  const owner = m[1];
  const repo = m[2].replace(/\.git$/, '');
  const rest = (m[3] || '').replace(/\/+$/, '');
  const base = { owner, repo, url, nwo: `${owner}/${repo}` };

  let sub;
  if ((sub = rest.match(/^\/pull\/(\d+)/))) return { ...base, kind: 'pull', number: sub[1] };
  if ((sub = rest.match(/^\/commit\/([0-9a-f]{7,40})/i))) return { ...base, kind: 'commit', sha: sub[1] };
  if ((sub = rest.match(/^\/(blob|raw)\/([^/]+)\/(.+)$/))) {
    return { ...base, kind: 'file', ref: decodeURIComponent(sub[2]), path: decodeURIComponent(sub[3]),
      refPath: decodeURIComponent(`${sub[2]}/${sub[3]}`) };
  }
  if ((sub = rest.match(/^\/tree\/([^/]+)(?:\/(.*))?$/))) {
    return { ...base, kind: 'tree', ref: decodeURIComponent(sub[1]), path: decodeURIComponent(sub[2] || ''),
      refPath: decodeURIComponent(sub[2] ? `${sub[1]}/${sub[2]}` : sub[1]) };
  }
  if (rest === '') return { ...base, kind: 'repo' };
  return null;
}

/**
 * Split a blob or tree link at the branch it really names.
 *
 * `/tree/base/login-flow` reads as branch `base` and path
 * `login-flow`, but a branch name may hold a slash, so the URL alone cannot
 * tell. GitHub resolves it the same way: the longest existing branch wins. With
 * no match the first segment stays the ref, which is right for `main` and a SHA.
 */
export function resolveRef(t, refs) {
  if (!t.refPath) return t;
  const match = refs
    .filter((r) => t.refPath === r || t.refPath.startsWith(`${r}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) return t;
  return { ...t, ref: match, path: t.refPath.slice(match.length + 1) };
}

/** A stable folder or file name for one target, unique across the links found. */
export function targetSlug(t) {
  const clean = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (t.kind === 'pull') return `pull-${t.number}-${clean(t.repo)}`;
  if (t.kind === 'commit') return `commit-${t.sha.slice(0, 8)}-${clean(t.repo)}`;
  if (t.kind === 'file') return `file-${clean(t.repo)}-${clean(t.path.replace(/\//g, '-'))}`;
  if (t.kind === 'tree') return `tree-${clean(t.repo)}${t.path ? '-' + clean(t.path.replace(/\//g, '-')) : ''}`;
  return `repo-${clean(t.repo)}`;
}

/**
 * Find every GitHub link in the fields that carry the design.
 *
 * The fields are named in the config rather than hard-coded, because the
 * custom field that holds a technical design has a different id on every Jira
 * site. `description` is always read; the rest come from `github.sourceFields`.
 */
async function findLinks(cred, key, sourceFields) {
  const wanted = [...new Set(['description', ...sourceFields])];
  const issue = await apiGet(cred, `/rest/api/3/issue/${key}?fields=${wanted.join(',')}`);
  const found = new Map();

  const remember = (url, source) => {
    const target = parseGitHubUrl(url);
    if (!target) return;
    // Key on the target, not the URL: the same pull request linked twice, once
    // with a diff anchor, is one thing to fetch.
    const mapKey = targetSlug(target);
    if (!found.has(mapKey)) found.set(mapKey, { ...target, source });
  };

  // An inlineCard keeps its URL in attrs.href; a pasted link is a text node
  // with a link mark; a bare URL is just text. Walking for all three catches
  // the lot, the same way the Confluence pull does.
  const walk = (node, source) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, source));
    if (node.attrs?.url) remember(node.attrs.url, source);
    if (node.attrs?.href) remember(node.attrs.href, source);
    for (const mark of node.marks || []) {
      if (mark.attrs?.href) remember(mark.attrs.href, source);
    }
    if (node.text) {
      for (const m of node.text.matchAll(/https?:\/\/[^\s)\]>]+/g)) remember(m[0], source);
    }
    if (node.content) walk(node.content, source);
  };

  for (const field of wanted) walk(issue.fields?.[field], field);
  return [...found.values()];
}

/**
 * Run one read-only `gh` call. Returns null when gh fails, rather than throwing.
 *
 * gh writes its own diagnosis to stderr, which would interleave with this
 * script's report and describe one failed link as though the whole run broke.
 * The reason is captured instead, and named against the link it belongs to.
 */
let lastGhError = null;
function gh(args) {
  try {
    lastGhError = null;
    return execFileSync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    lastGhError = String(err.stderr || err.message || '').trim().split('\n')[0] || null;
    return null;
  }
}

/** The reason the last gh call failed, as a clause to append to a message. */
const ghWhy = () => (lastGhError ? `: ${lastGhError}` : '');

/** True when gh is installed and holds a usable token. */
function ghReady() {
  if (!gh(['--version'])) return { ok: false, why: 'the gh CLI is not installed' };
  if (!gh(['auth', 'status'])) return { ok: false, why: 'gh is not authenticated (run: gh auth login)' };
  return { ok: true };
}

function ghJson(args) {
  const out = gh(args);
  if (!out) return null;
  try { return JSON.parse(out); } catch { return null; }
}

/** A file's contents at a ref, or null when it cannot be read. */
function fileContents(nwo, path, ref) {
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const out = gh(['api', `repos/${nwo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}${suffix}`,
    '--jq', '.content']);
  if (!out || !out.trim()) return null;
  try { return Buffer.from(out.trim(), 'base64').toString('utf8'); } catch { return null; }
}

/**
 * A path for a table cell.
 *
 * Backticks are right for a short path and wrong for a long one: the checker
 * measures any 60-character backtick span as a code statement that belongs in a
 * fenced block, and a fenced block cannot sit inside a table cell. A deep path
 * is a filename either way, so past that length it goes in plain.
 */
const pathCell = (p) => (p.length >= 60 ? p : `\`${p}\``);

/** True for a path worth writing as text. A binary blob helps nobody in a diff folder. */
function isTextPath(path) {
  return !/\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|gz|tgz|jar|woff2?|ttf|eot|mp4|mov|xlsx?|docx?|pptx?)$/i.test(path);
}

const fence = (path, body) => {
  const lang = (path.match(/\.([A-Za-z0-9]+)$/) || [, ''])[1].toLowerCase();
  const known = { ts: 'ts', tsx: 'tsx', js: 'js', jsx: 'jsx', json: 'json', yml: 'yaml', yaml: 'yaml',
    sh: 'bash', py: 'python', sql: 'sql', java: 'java', go: 'go', rb: 'ruby', proto: 'proto' };
  // A markdown file inside a markdown fence needs a longer fence than any it
  // contains, or its own fences close the wrapper early.
  const longest = Math.max(2, ...[...body.matchAll(/^(`{3,})/gm)].map((m) => m[1].length));
  const bar = '`'.repeat(longest + 1);
  return `${bar}${known[lang] || ''}\n${body.replace(/\n$/, '')}\n${bar}`;
}

/** Write one changed or linked file into the target's `files/` folder. */
function writeFile(dir, path, body, maxKb) {
  const kb = Buffer.byteLength(body, 'utf8') / 1024;
  if (kb > maxKb) return { path, written: false, why: `${kb.toFixed(0)} KB, over the ${maxKb} KB limit` };
  const dest = join(dir, 'files', path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body, 'utf8');
  return { path, written: true, rel: `files/${path}` };
}

/**
 * Fetch one target and write it.
 *
 * Each kind writes the same two things: a `<slug>.md` naming what the link
 * points at, and — unless `--no-files` — the file contents under `files/`, so
 * the design is readable without opening a browser.
 */
/** Branch names that start with `prefix`, so a slashed branch can be told from a path. */
function branchesStartingWith(nwo, prefix) {
  const out = gh(['api', `repos/${nwo}/git/matching-refs/heads/${encodeURIComponent(prefix)}`, '--jq', '.[].ref']);
  return (out || '').split('\n').filter(Boolean).map((r) => r.replace(/^refs\/heads\//, ''));
}

function pullTarget(t, outDir, { noFiles, maxKb }) {
  if (t.refPath) t = resolveRef(t, branchesStartingWith(t.nwo, t.ref));
  const dir = join(outDir, targetSlug(t));
  const lines = [];
  const files = [];
  let title = null;

  if (t.kind === 'pull') {
    const pr = ghJson(['pr', 'view', t.number, '--repo', t.nwo, '--json',
      'number,title,state,isDraft,author,baseRefName,headRefName,headRefOid,createdAt,mergedAt,url,body,changedFiles']);
    if (!pr) return { ok: false, why: `pull request ${t.nwo}#${t.number} could not be read${ghWhy()}` };
    title = `${t.nwo}#${pr.number} — ${pr.title}`;
    lines.push('| Field | Value |', '| --- | --- |',
      `| State | ${pr.isDraft ? 'DRAFT ' : ''}${pr.state} |`,
      `| Author | ${pr.author?.login || '—'} |`,
      `| Branch | \`${pr.headRefName}\` into \`${pr.baseRefName}\` |`,
      `| Opened | ${(pr.createdAt || '').slice(0, 10) || '—'} |`,
      `| Merged | ${(pr.mergedAt || '').slice(0, 10) || '—'} |`, '');
    if (pr.body?.trim()) lines.push('## Pull request description', '', pr.body.trim(), '');

    // `gh pr view --json files` stops at 100, so the list comes from the paged API.
    const changed = (gh(['api', `repos/${t.nwo}/pulls/${t.number}/files`, '--paginate',
      '--jq', '.[] | {path: .filename, additions, deletions}']) || '')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l));
    if (changed.length !== pr.changedFiles) {
      return { ok: false, why: `pull request ${t.nwo}#${t.number} listed ${changed.length} of ${pr.changedFiles} changed file(s)${ghWhy()}` };
    }
    lines.push('## Changed files', '', `${changed.length} file(s) changed.`, '',
      '| File | Added | Deleted | Local copy |', '| --- | --- | --- | --- |');
    for (const f of changed) {
      let cell = '—';
      if (!noFiles && isTextPath(f.path)) {
        // The head commit, not the branch: a closed pull request's branch moves on
        // or is deleted, and the files the pull request changed go with it.
        const body = fileContents(t.nwo, f.path, pr.headRefOid);
        if (body !== null) {
          const w = writeFile(dir, f.path, body, maxKb);
          files.push(w);
          cell = w.written ? `[${f.path.split('/').pop()}](${w.rel})` : `not saved — ${w.why}`;
        } else {
          cell = 'not readable at this ref';
        }
      } else if (!noFiles) {
        cell = 'binary — not saved';
      }
      lines.push(`| ${pathCell(f.path)} | +${f.additions ?? 0} | -${f.deletions ?? 0} | ${cell} |`);
    }
    lines.push('');
  } else if (t.kind === 'commit') {
    const c = ghJson(['api', `repos/${t.nwo}/commits/${t.sha}`]);
    if (!c) return { ok: false, why: `commit ${t.sha} in ${t.nwo} could not be read${ghWhy()}` };
    const msg = c.commit?.message || '';
    title = `${t.nwo}@${t.sha.slice(0, 8)} — ${msg.split('\n')[0]}`;
    lines.push('| Field | Value |', '| --- | --- |',
      `| SHA | \`${c.sha}\` |`,
      `| Author | ${c.commit?.author?.name || c.author?.login || '—'} |`,
      `| Date | ${(c.commit?.author?.date || '').slice(0, 10) || '—'} |`, '');
    if (msg.includes('\n')) lines.push('## Commit message', '', msg.trim(), '');
    const changed = c.files || [];
    lines.push('## Changed files', '', `${changed.length} file(s) changed.`, '',
      '| File | Added | Deleted | Local copy |', '| --- | --- | --- | --- |');
    for (const f of changed) {
      let cell = '—';
      if (!noFiles && isTextPath(f.filename)) {
        const body = fileContents(t.nwo, f.filename, c.sha);
        if (body !== null) {
          const w = writeFile(dir, f.filename, body, maxKb);
          files.push(w);
          cell = w.written ? `[${f.filename.split('/').pop()}](${w.rel})` : `not saved — ${w.why}`;
        } else cell = 'not readable at this ref';
      } else if (!noFiles) cell = 'binary — not saved';
      lines.push(`| ${pathCell(f.filename)} | +${f.additions ?? 0} | -${f.deletions ?? 0} | ${cell} |`);
    }
    lines.push('');
  } else if (t.kind === 'file') {
    const body = fileContents(t.nwo, t.path, t.ref);
    if (body === null) return { ok: false, why: `${t.nwo}/${t.path} could not be read at ${t.ref}${ghWhy()}` };
    title = `${t.nwo}/${t.path}`;
    lines.push('| Field | Value |', '| --- | --- |',
      `| Repository | ${t.nwo} |`, `| Ref | \`${t.ref}\` |`, `| Path | ${pathCell(t.path)} |`, '');
    if (!noFiles) {
      const w = writeFile(dir, t.path, body, maxKb);
      files.push(w);
      lines.push('## File', '',
        w.written ? `[${t.path}](${w.rel})` : `Not saved — ${w.why}.`, '');
      if (w.written && isTextPath(t.path)) lines.push(fence(t.path, body), '');
    }
  } else if (t.kind === 'tree') {
    const entries = ghJson(['api',
      `repos/${t.nwo}/contents/${t.path ? encodeURIComponent(t.path).replace(/%2F/g, '/') : ''}?ref=${encodeURIComponent(t.ref)}`]);
    if (!Array.isArray(entries)) return { ok: false, why: `${t.nwo}/${t.path || '/'} could not be listed at ${t.ref}${ghWhy()}` };
    title = `${t.nwo}/${t.path || ''} (directory)`;
    lines.push('| Field | Value |', '| --- | --- |',
      `| Repository | ${t.nwo} |`, `| Ref | \`${t.ref}\` |`, `| Path | ${pathCell(t.path || '/')} |`, '');
    lines.push('## Contents', '', `${entries.length} entr(y/ies).`, '',
      '| Name | Type | Local copy |', '| --- | --- | --- |');
    for (const e of entries) {
      let cell = '—';
      if (!noFiles && e.type === 'file' && isTextPath(e.path)) {
        const body = fileContents(t.nwo, e.path, t.ref);
        if (body !== null) {
          const w = writeFile(dir, e.path, body, maxKb);
          files.push(w);
          cell = w.written ? `[${e.name}](${w.rel})` : `not saved — ${w.why}`;
        } else cell = 'not readable';
      } else if (e.type === 'dir') {
        cell = 'directory — not followed';
      } else if (!noFiles) cell = 'binary — not saved';
      lines.push(`| ${pathCell(e.name)} | ${e.type} | ${cell} |`);
    }
    lines.push('');
  } else {
    const r = ghJson(['repo', 'view', t.nwo, '--json',
      'name,nameWithOwner,description,defaultBranchRef,isPrivate,isArchived,pushedAt,primaryLanguage']);
    if (!r) return { ok: false, why: `repository ${t.nwo} could not be read${ghWhy()}` };
    title = `${r.nameWithOwner} — repository`;
    lines.push('| Field | Value |', '| --- | --- |',
      `| Repository | ${r.nameWithOwner} |`,
      `| Description | ${r.description || '—'} |`,
      `| Default branch | \`${r.defaultBranchRef?.name || '—'}\` |`,
      `| Visibility | ${r.isPrivate ? 'private' : 'public'}${r.isArchived ? ', archived' : ''} |`,
      `| Language | ${r.primaryLanguage?.name || '—'} |`,
      `| Last push | ${(r.pushedAt || '').slice(0, 10) || '—'} |`, '');
    if (!noFiles) {
      const readme = ghJson(['api', `repos/${t.nwo}/readme`, '--jq', '{path:.path,content:.content}']);
      if (readme?.content) {
        const body = Buffer.from(readme.content, 'base64').toString('utf8');
        const w = writeFile(dir, readme.path, body, maxKb);
        files.push(w);
        lines.push('## Readme', '', w.written ? `[${readme.path}](${w.rel})` : `Not saved — ${w.why}.`, '');
      }
    }
  }

  mkdirSync(dir, { recursive: true });
  const head = [
    '---',
    'schema: jira-to-local/github-v1',
    `github_url: ${t.url}`,
    `kind: ${t.kind}`,
    `repo: ${t.nwo}`,
    `source_field: ${t.source || 'argument'}`,
    `fetched: ${today()}`,
    '---',
    '',
    `# ${title}`,
    '',
    `Fetched from [${t.url}](${t.url}) — the link as the issue wrote it.`,
    '',
  ];
  const path = join(dir, `${targetSlug(t)}.md`);
  writeFileSync(path, head.concat(lines).join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');

  return { ok: true, title, dir, doc: `${targetSlug(t)}/${targetSlug(t)}.md`, files, kind: t.kind, url: t.url };
}

function parseArgs(argv) {
  const flags = {};
  const booleans = new Set(['no-files', 'quiet', 'list', 'help']);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const name = argv[i].slice(2);
    if (booleans.has(name)) { flags[name] = true; continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { flags[name] = true; continue; }
    flags[name] = next;
    i++;
  }
  return flags;
}

function usage() {
  console.log('Usage:');
  console.log('  fetch-github.mjs --issue <KEY>');
  console.log('  fetch-github.mjs --issue <KEY> --list');
  console.log('  fetch-github.mjs --url <URL> --out DIR');
  console.log('');
  console.log('Options:');
  console.log('  --no-files   Metadata only; do not fetch the changed file contents');
  console.log('  --quiet      Report only the summary');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help || (!flags.issue && !flags.url)) {
    usage();
    process.exit(flags.help ? 0 : 1);
  }

  const { config, root, cred } = connect();
  const log = (msg) => { if (!flags.quiet) console.log(msg); };

  const issueKey = typeof flags.issue === 'string' ? flags.issue.toUpperCase() : null;
  const subdir = config.github?.subdir || 'github';
  const maxKb = config.github?.maxFileKb ?? DEFAULT_MAX_FILE_KB;
  const noFiles = !!flags['no-files'] || config.github?.fetchFileContents === false;

  const outDir = flags.out && flags.out !== true
    ? resolve(String(flags.out))
    : issueKey
      ? join(outputDirFor(config, issueKey, root), subdir)
      : null;

  if (!outDir) {
    console.error('Required: --issue KEY, or --out DIR when there is no issue.');
    process.exit(1);
  }

  let targets = [];
  if (flags.url && flags.url !== true) {
    const t = parseGitHubUrl(String(flags.url));
    if (!t) {
      console.error(`Not a GitHub URL this script can read: ${flags.url}`);
      console.error('Handled: /pull/N, /commit/SHA, /blob/REF/PATH, /tree/REF/PATH, and a bare repo.');
      process.exit(1);
    }
    targets = [{ ...t, source: 'argument' }];
  } else {
    const sourceFields = config.github?.sourceFields || DEFAULT_SOURCE_FIELDS;
    targets = await findLinks(cred, issueKey, sourceFields);
  }

  if (!targets.length) {
    log(`${issueKey} links no GitHub page in its design fields. Nothing to pull.`);
    return;
  }

  if (flags.list) {
    for (const t of targets) {
      console.log(`${t.kind.padEnd(7)}  ${String(t.source).padEnd(18)}  ${t.url}`);
    }
    return;
  }

  if (config.github?.pullLinkedRepos === false && !flags.url) {
    log('github.pullLinkedRepos is false in the config; nothing pulled.');
    log(`${targets.length} link(s) found. Pass --url to pull one anyway.`);
    return;
  }

  // gh is checked once, here, rather than per target: an unauthenticated run
  // would otherwise report every private link as "could not be read", which
  // reads as a missing page rather than a missing token.
  const ready = ghReady();
  if (!ready.ok) {
    console.error(`Cannot fetch GitHub links: ${ready.why}.`);
    console.error(`${targets.length} link(s) found and left unfetched. The issue keeps its GitHub links either way.`);
    process.exit(1);
  }

  const written = [];
  const skipped = [];

  for (const t of targets) {
    const res = pullTarget(t, outDir, { noFiles, maxKb });
    if (res.ok) written.push(res);
    else skipped.push(res.why);
  }

  for (const w of written) {
    const saved = w.files.filter((f) => f.written).length;
    log(`  ${w.doc}  (${w.kind}${saved ? `, ${saved} file(s)` : ''})`);
  }
  // A skipped link goes to stderr even under --quiet: a link the run could not
  // fetch is the one thing the caller must not miss.
  for (const s of skipped) console.error(`  skipped: ${s}`);

  log('');
  if (written.length) {
    console.log(`Wrote ${outDir}/`);
    for (const w of written) console.log(`  ${w.doc}`);
    console.log('');
    console.log('Add a local link after each GitHub link in content.md, keeping the');
    console.log('original URL, so a reader sees both the source and the local copy.');
  } else {
    console.log('No GitHub page written.');
    process.exit(1);
  }
}

// realpathSync on both sides, because a symlinked skill directory makes the raw
// paths disagree: the file would then load as a library and do nothing, printing
// no output and exiting 0 — which reads as success.
function isMainScript(selfPath) {
  const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  return real(process.argv[1]) === real(selfPath);
}

if (process.argv[1] && isMainScript(new URL(import.meta.url).pathname)) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
