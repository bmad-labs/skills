#!/usr/bin/env node
/**
 * fetch-confluence.mjs — Pull a linked Confluence page into a Jira issue's folder.
 *
 * A page linked from an issue is a reference, not a space to mirror, so the
 * default depth is 0: that page alone. Raise it only when the children are
 * genuinely part of what the issue is asking for.
 *
 * The page is always markdown, whatever `output.mode` says. A wiki page is a
 * written document rather than a record with fields, so there is no useful JSON
 * shape for it and no schema to check it against.
 *
 * Usage:
 *   fetch-confluence.mjs --issue <KEY>                  Every page the issue links
 *   fetch-confluence.mjs --issue <KEY> --page-url <URL>  One page, into that folder
 *   fetch-confluence.mjs --page-id <ID> --out DIR        One page, anywhere
 *   fetch-confluence.mjs --issue <KEY> --list            Report links, write nothing
 *
 * Options:
 *   --max-depth N        Child levels to follow (default: from the config)
 *   --no-assets          Do not download images or attachments
 *   --quiet              Report only the summary
 */

import { writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, extname, basename } from 'node:path';
import { connect, apiGet, apiGetSoft } from './jira-api.mjs';
import { outputDirFor } from './config.mjs';
import { storageToMarkdown } from './confluence-format.mjs';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Every shape a Confluence page URL takes, reduced to a page id.
 *
 *   /wiki/spaces/KEY/pages/12345/Title      the usual link
 *   /wiki/spaces/KEY/pages/12345            without the slug
 *   /pages/viewpage.action?pageId=12345     the older form
 *   /wiki/x/AbCdEf                          a short link, which needs a lookup
 */
export function pageIdFromUrl(url) {
  if (!url) return null;
  const byPath = url.match(/\/pages\/(?:viewpage\.action\?pageId=)?(\d+)/);
  if (byPath) return byPath[1];
  const byQuery = url.match(/[?&]pageId=(\d+)/);
  if (byQuery) return byQuery[1];
  return null;
}

/** True for any URL that points at this site's wiki. */
function isWikiUrl(url, domain) {
  if (typeof url !== 'string') return false;
  return url.includes(`${domain}/wiki/`) || /atlassian\.net\/wiki\//.test(url);
}

/**
 * Find every Confluence page an issue points at.
 *
 * Three places carry them, and a real issue uses all three:
 *   /issue/{key}/remotelink   a proper linked page, the reliable source
 *   the description           a pasted URL, or an inlineCard smart link
 *   a comment                 the same, added later in the conversation
 */
async function findLinkedPages(cred, key) {
  const found = new Map();

  const remember = (url, title, source) => {
    if (!isWikiUrl(url, cred.domain)) return;
    const id = pageIdFromUrl(url);
    // A short link has no id in it. Keep it so the report can name it, and let
    // the fetch resolve it, rather than dropping it silently.
    const mapKey = id || url;
    if (!found.has(mapKey)) found.set(mapKey, { pageId: id, url, title: title || null, source });
  };

  const remote = await apiGetSoft(cred, `/rest/api/3/issue/${key}/remotelink`);
  for (const link of remote || []) {
    remember(link.object?.url, link.object?.title, 'remotelink');
  }

  const issue = await apiGet(cred, `/rest/api/3/issue/${key}?fields=description,comment`);

  // An inlineCard keeps its URL in attrs.href; a pasted link is a text node with
  // a link mark; a bare URL is just text. Walking for all three catches the lot.
  const walk = (node, source) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, source));
    if (node.attrs?.url) remember(node.attrs.url, null, source);
    if (node.attrs?.href) remember(node.attrs.href, null, source);
    for (const mark of node.marks || []) {
      if (mark.attrs?.href) remember(mark.attrs.href, node.text, source);
    }
    if (node.text) {
      for (const m of node.text.matchAll(/https?:\/\/[^\s)\]]+/g)) remember(m[0], null, source);
    }
    if (node.content) walk(node.content, source);
  };

  walk(issue.fields?.description, 'description');
  for (const c of issue.fields?.comment?.comments || []) walk(c.body, 'comment');

  return [...found.values()];
}

/** Fetch one page with its body in storage format. */
async function fetchPage(cred, pageId) {
  const page = await apiGetSoft(
    cred,
    `/wiki/api/v2/pages/${pageId}?body-format=storage&include-version=true`
  );
  return page;
}

/** The page's direct children, paged. */
async function fetchChildren(cred, pageId) {
  const out = [];
  let cursor = null;
  for (let guard = 0; guard < 50; guard++) {
    const suffix = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const data = await apiGetSoft(cred, `/wiki/api/v2/pages/${pageId}/children?limit=50${suffix}`);
    if (!data) break;
    out.push(...(data.results || []));
    const next = data._links?.next;
    if (!next) break;
    const m = next.match(/cursor=([^&]+)/);
    if (!m) break;
    cursor = decodeURIComponent(m[1]);
  }
  return out;
}

function safeFileName(title) {
  const stem = String(title || 'page')
    .replace(/[^A-Za-z0-9 ._-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return (stem || 'page') + '.md';
}

function safeAssetName(filename) {
  const ext = extname(filename);
  const stem = basename(filename, ext).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (stem || 'attachment') + ext;
}

/**
 * Download a page's attachments and rewrite their references to the local copy.
 *
 * Both forms need rewriting: an image reference, and a plain link. A `view-file`
 * macro produces a link rather than an image, so handling only images leaves
 * every attached document pointing back at Confluence.
 */
async function downloadAttachments(cred, pageId, assetsDir, markdown, { skip }) {
  const data = skip ? null : await apiGetSoft(cred, `/wiki/rest/api/content/${pageId}/child/attachment?limit=100`);
  const attachments = data?.results || [];
  let md = markdown;
  let saved = 0;

  for (const att of attachments) {
    const filename = att.title;
    const downloadPath = att._links?.download;
    if (!filename || !downloadPath) continue;

    const res = await fetch(`https://${cred.domain}/wiki${downloadPath}`, {
      headers: { Authorization: cred.auth },
      redirect: 'follow',
    });
    if (!res.ok) continue;

    mkdirSync(assetsDir, { recursive: true });
    const name = safeAssetName(filename);
    writeFileSync(join(assetsDir, name), Buffer.from(await res.arrayBuffer()));
    saved += 1;

    const rel = `assets/${name}`;

    // The converter writes the attachment name as the link target, and a name
    // with spaces arrives percent-encoded. Rewrite every spelling of it, or the
    // page keeps pointing at a file that is not there while its image sits
    // downloaded beside it.
    for (const spelling of new Set([filename, encodeURIComponent(filename), filename.replace(/ /g, '%20')])) {
      const escaped = spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Images first, then plain links: a view-file macro produces a link rather
      // than an image reference, so handling only images leaves attached
      // documents pointing back at Confluence.
      md = md.replace(new RegExp(`!\\[([^\\]]*)\\]\\(${escaped}\\)`, 'g'), `![$1](${rel})`);
      md = md.replace(new RegExp(`(?<!!)\\[([^\\]]*)\\]\\(${escaped}\\)`, 'g'), `[$1](${rel})`);
    }
  }

  return { markdown: md, saved, listed: attachments.length };
}

function buildPageMarkdown(cred, page, body, issueKey) {
  const base = page._links?.base || `https://${cred.domain}/wiki`;
  const webui = page._links?.webui || '';
  const url = `${base}${webui}`;

  const out = [
    '---',
    'schema: jira-to-local/confluence-page-v1',
    `page_id: ${page.id}`,
    `page_url: ${url}`,
    `title: ${JSON.stringify(page.title || '')}`,
    `space: ${page.spaceId || ''}`,
    `version: ${page.version?.number ?? ''}`,
    ...(issueKey ? [`linked_from: ${issueKey}`] : []),
    `fetched: ${today()}`,
    '---',
    '',
    `# [${page.title || 'Untitled'}](${url})`,
    '',
  ];

  if (issueKey) {
    out.push(
      `_Pulled from Confluence for [${issueKey}](https://${cred.domain}/browse/${issueKey})._`,
      ''
    );
  } else {
    out.push('_Pulled from Confluence._', '');
  }

  out.push(body.trim(), '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

function parseArgs(argv) {
  const flags = {};
  const booleans = new Set(['no-assets', 'quiet', 'list', 'help']);
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
  console.log('  fetch-confluence.mjs --issue <KEY>');
  console.log('  fetch-confluence.mjs --issue <KEY> --page-url <URL>');
  console.log('  fetch-confluence.mjs --page-id <ID> --out DIR');
  console.log('  fetch-confluence.mjs --issue <KEY> --list');
  console.log('');
  console.log('  --max-depth N   Child levels to follow (default: from the config)');
  console.log('  --no-assets     Do not download images or attachments');
  console.log('  --quiet         Report only the summary');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help || (!flags.issue && !flags['page-id'] && !flags['page-url'])) {
    usage();
    process.exit(flags.help ? 0 : 1);
  }

  const { config, root, cred } = connect();
  const log = (msg) => { if (!flags.quiet) console.log(msg); };

  const issueKey = typeof flags.issue === 'string' ? flags.issue.toUpperCase() : null;

  let maxDepth = config.confluence?.maxDepth ?? 0;
  if (flags['max-depth'] !== undefined && flags['max-depth'] !== true) {
    maxDepth = Number(flags['max-depth']);
    if (!Number.isFinite(maxDepth) || maxDepth < 0) {
      console.error(`--max-depth needs a number of 0 or more, got: ${flags['max-depth']}`);
      process.exit(1);
    }
  }

  // Where the pages go: inside the issue's own folder, under the configured
  // subfolder, so one issue stays one folder.
  const subdir = config.confluence?.subdir || 'confluence';
  const outDir = flags.out && flags.out !== true
    ? resolve(String(flags.out))
    : issueKey
      ? join(outputDirFor(config, issueKey, root), subdir)
      : null;

  if (!outDir) {
    console.error('Required: --issue KEY, or --out DIR when there is no issue.');
    process.exit(1);
  }

  // Work out which pages to pull.
  let targets = [];
  if (flags['page-id'] && flags['page-id'] !== true) {
    targets = [{ pageId: String(flags['page-id']), url: null, title: null, source: 'argument' }];
  } else if (flags['page-url'] && flags['page-url'] !== true) {
    const id = pageIdFromUrl(String(flags['page-url']));
    if (!id) {
      console.error(`Could not read a page id out of: ${flags['page-url']}`);
      console.error('A short link (/wiki/x/AbCd) has no id in it; open it and use the full URL.');
      process.exit(1);
    }
    targets = [{ pageId: id, url: String(flags['page-url']), title: null, source: 'argument' }];
  } else {
    targets = await findLinkedPages(cred, issueKey);
  }

  if (!targets.length) {
    log(`${issueKey} links no Confluence page. Nothing to pull.`);
    return;
  }

  if (flags.list) {
    for (const t of targets) {
      console.log(`${t.pageId || '(short link)'}  ${t.source.padEnd(11)}  ${t.title || t.url}`);
    }
    return;
  }

  if (config.confluence?.pullLinkedPages === false && !flags['page-id'] && !flags['page-url']) {
    log('confluence.pullLinkedPages is false in the config; nothing pulled.');
    log(`${targets.length} link(s) found. Pass --page-url to pull one anyway.`);
    return;
  }

  const written = [];
  const skipped = [];

  /** Fetch one page, then its children while depth allows. */
  const pull = async (pageId, depth, parentTitle) => {
    if (!pageId) { skipped.push('a short link with no page id'); return; }

    const page = await fetchPage(cred, pageId);
    if (!page) { skipped.push(`page ${pageId} could not be read`); return; }

    mkdirSync(outDir, { recursive: true });
    let body = storageToMarkdown(page.body?.storage?.value || '');
    const result = await downloadAttachments(cred, pageId, join(outDir, 'assets'), body, {
      skip: !!flags['no-assets'],
    });
    body = result.markdown;

    const name = safeFileName(page.title);
    const path = join(outDir, name);
    writeFileSync(path, buildPageMarkdown(cred, page, body, issueKey), 'utf8');
    written.push({ name, title: page.title, pageId, assets: result.saved, depth, parentTitle });

    if (depth < maxDepth) {
      for (const child of await fetchChildren(cred, pageId)) {
        await pull(String(child.id), depth + 1, page.title);
      }
    }
  };

  for (const t of targets) await pull(t.pageId, 0, null);

  for (const w of written) {
    log(`  ${w.name}  (page ${w.pageId}${w.assets ? `, ${w.assets} asset(s)` : ''})`);
  }
  for (const s of skipped) log(`  skipped: ${s}`);

  log('');
  if (written.length) {
    console.log(`Wrote ${outDir}/`);
    for (const w of written) console.log(`  ${w.name}`);
    if (existsSync(join(outDir, 'assets'))) console.log('  assets/');
    console.log('');
    console.log('Link these from content.md under a "## Linked Documents" heading, so a');
    console.log('reader finds them without being told they exist.');
  } else {
    console.log('No page written.');
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
