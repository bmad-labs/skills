/**
 * twg.mjs — the `twg` transport: the same reads as REST, through Atlassian's
 * Teamwork Graph CLI and its browser sign-in instead of an API token.
 *
 * Every caller in this skill speaks REST paths. This module keeps that true in
 * `twg` mode: `planRequest` names the `twg` command that serves a path, and
 * `reshape` / `wrapRows` turn its answer back into the REST response the caller
 * already parses. A path with no `twg` equivalent plans to null, and the caller's
 * soft read records the gap the same way it records a 404.
 *
 * Live comparison on a real site (2026-11-06, twg 1.4.3) found the rows of
 * comments, worklogs, changelog and issue fields equal to REST apart from `self`
 * URLs; only the envelopes differ, which is all this module rewrites.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** twg pages lists by cursor; 100 is the largest page every list command takes. */
const PAGE_SIZE = '100';

/** REST /search/jql returns 50 rows when maxResults is omitted. */
const SEARCH_PAGE_SIZE = '50';

/** Keys `twg jira workitem get` adds beside the REST fields, not part of them. */
const ISSUE_ENVELOPE_KEYS = new Set(['expand', 'id', 'key', 'self', 'url', 'comments', 'remoteLinks']);

const ISSUE_LISTS = { comment: 'comments', worklog: 'worklogs', changelog: 'values' };


/**
 * The twg command for one REST path, or null when twg serves no equivalent.
 *
 * Only the paths the pulls call are planned; anything else is a gap, not a guess.
 * Setup's own reads are not planned: creating the config always goes through REST.
 */
export function planRequest(path) {
  const url = new URL(path, 'https://site.invalid');
  const p = url.pathname;
  const q = url.searchParams;
  let m;

  if ((m = p.match(/^\/rest\/api\/3\/issue\/([^/]+)$/))) {
    const fields = q.get('fields');
    const args = fields && fields !== '*all'
      ? ['jira', 'workitem', 'get', m[1], '--fields', fields]
      : ['jira', 'workitem', 'get', m[1], '--full'];
    return { shape: 'issue', args, names: (q.get('expand') || '').split(',').includes('names') };
  }
  if ((m = p.match(/^\/rest\/api\/3\/issue\/([^/]+)\/(comment|worklog|changelog)$/))) {
    return { shape: 'list', rowsKey: ISSUE_LISTS[m[2]], args: ['jira', 'workitem', m[2], 'query', '--issue-id', m[1]] };
  }
  if ((m = p.match(/^\/rest\/api\/3\/issue\/([^/]+)\/properties\/([^/]+)$/))) {
    return { shape: 'data', args: ['jira', 'workitem', 'property', 'get', '--issue-id', m[1], '--property-key', decodeURIComponent(m[2])] };
  }
  if ((m = p.match(/^\/rest\/api\/3\/issue\/([^/]+)\/remotelink$/))) {
    return { shape: 'remoteLinks', args: ['jira', 'workitem', 'get', m[1], '--remote-links'] };
  }
  if (p === '/rest/api/3/myself') return { shape: 'myself', args: ['whoami'] };
  if (p === '/rest/api/3/search/jql') {
    // One page per call, like REST: the caller pages with nextPageToken, which
    // carries twg's cursor. Reading every page here would turn a one-row probe
    // into a read of the whole project.
    const args = ['jira', 'workitem', 'query', '--jql', q.get('jql') || ''];
    if (q.get('fields')) args.push('--fields', q.get('fields'));
    args.push('--first', q.get('maxResults') || SEARCH_PAGE_SIZE);
    if (q.get('nextPageToken')) args.push('--after', q.get('nextPageToken'));
    return { shape: 'search', args };
  }
  if (p === '/rest/dev-status/1.0/issue/summary') {
    return { shape: 'devSummary', args: ['jira', 'workitem', 'get', q.get('issueId') || '', '--full'] };
  }
  if ((m = p.match(/^\/wiki\/api\/v2\/pages\/([^/]+)$/))) {
    return { shape: 'page', args: ['confluence', 'content', 'get', m[1], '--detail', 'full', '--format', 'md', '--include-metadata'] };
  }
  if ((m = p.match(/^\/wiki\/api\/v2\/pages\/([^/]+)\/children$/))) {
    return { shape: 'children', args: ['confluence', 'tree', '--target', m[1], '--depth', '1'] };
  }
  if ((m = p.match(/^\/wiki\/rest\/api\/content\/([^/]+)\/child\/attachment$/))) {
    return { shape: 'attachments', args: ['confluence', 'content', 'attachments', 'list', '--id', m[1], '--limit', q.get('limit') || '100'] };
  }
  return null;
}

/**
 * The JSON envelope from twg's stdout. twg may print a note line before it, and
 * reports a failure as `ok: false` inside the envelope rather than by exit code.
 */
export function parseOutput(text) {
  const start = text.search(/^\{/m);
  if (start < 0) throw new Error(`twg printed no JSON: ${text.trim().slice(0, 200)}`);
  const envelope = JSON.parse(text.slice(start));
  if (envelope.ok === false) {
    const err = new Error(envelope.error?.message || 'twg reported a failure');
    err.status = envelope.error?.statusCode;
    throw err;
  }
  return envelope;
}

function restIssue(flat) {
  const fields = {};
  for (const [k, v] of Object.entries(flat)) if (!ISSUE_ENVELOPE_KEYS.has(k)) fields[k] = v;
  return { id: flat.id, key: flat.key, self: flat.self, fields };
}

function one(data) {
  return Array.isArray(data) ? data[0] : data;
}

/**
 * The development field holds the dev-status summary as JSON after `json=`, in
 * the same shape `/rest/dev-status/1.0/issue/summary` returns, so the counts
 * survive in twg mode even though the detail endpoints do not.
 */
function devSummary(raw) {
  const text = typeof raw === 'string' ? raw : '';
  const at = text.indexOf('json=');
  if (at < 0) return null;
  try {
    return JSON.parse(text.slice(at + 5, -1)).cachedValue?.summary ?? null;
  } catch {
    return null;
  }
}

/** twg writes an image as `[file: <name>]`; make it the reference the attachment step rewrites. */
function filePlaceholdersToImages(markdown) {
  return markdown.replace(/\[file: ([^\]\n]+)\]/g, '![$1]($1)');
}

/** One twg payload, as the REST response for the planned path. */
export function reshape(plan, data, pageInfo) {
  switch (plan.shape) {
    case 'search': {
      const response = { issues: (data?.issues || []).map(restIssue), isLast: !pageInfo?.hasNextPage };
      if (pageInfo?.hasNextPage && pageInfo.nextCursor) response.nextPageToken = pageInfo.nextCursor;
      return response;
    }
    case 'issue': return restIssue(one(data));
    case 'data': return data;
    case 'remoteLinks': return one(data)?.remoteLinks ?? [];
    case 'myself': return { accountId: data.accountId, emailAddress: data.email, displayName: data.name };
    case 'editmeta': {
      const fields = {};
      for (const f of data.fields || []) {
        fields[f.id] = { key: f.key, name: f.name, required: f.required, schema: f.schema, operations: f.operations };
      }
      return { fields };
    }
    case 'devSummary': return { summary: devSummary(one(data)?.[plan.devField]) };
    case 'page': return {
      id: data.id,
      title: data.title,
      status: data.status,
      spaceId: data.spaceId,
      version: { number: data.metadata?.version?.number },
      // twg returns no page URL; Confluence Cloud redirects this id form to the page.
      _links: { webui: `/pages/viewpage.action?pageId=${data.id}` },
      body: { markdown: { value: filePlaceholdersToImages(data.body?.value || '') } },
    };
    case 'children': return { results: data.descendants || [] };
    case 'attachments': return { results: data.results || [] };
    default: throw new Error(`No reshape for twg shape "${plan.shape}"`);
  }
}

/** A complete list in the paged REST envelope: one page, holding every row. */
export function wrapRows(plan, rows) {
  return { startAt: 0, maxResults: rows.length, total: rows.length, isLast: true, [plan.rowsKey]: rows };
}

/**
 * Every row of a cursor-paged twg list.
 *
 * twg reports no total, so completeness rests on the cursor: follow it until the
 * server says there is no next page, and fail rather than return rows when the
 * cursor repeats or two pages overlap — either would write a document that looks
 * complete and is not.
 */
export async function collectRows(fetchPage) {
  const rows = [];
  const seen = new Set();
  let cursor = null;

  for (let guard = 0; guard < 1000; guard++) {
    const page = await fetchPage(cursor);
    const data = page.data;
    rows.push(...(Array.isArray(data) ? data : []));
    const next = page.pageInfo?.hasNextPage ? page.pageInfo.nextCursor : null;
    if (!next) break;
    if (seen.has(next)) throw new Error(`twg returned a repeated cursor; refusing to write a partial document.`);
    seen.add(next);
    cursor = next;
  }

  if (rows.length && rows.every((r) => r && r.id !== undefined)) {
    const unique = new Set(rows.map((r) => String(r.id)));
    if (unique.size !== rows.length) {
      throw new Error(`twg returned ${rows.length} row(s) but only ${unique.size} distinct id(s); pages overlapped.`);
    }
  }
  return rows;
}

/** The twg binary: on PATH when it is there, else where its installer puts it. */
export function twgBinary() {
  const onPath = (process.env.PATH || '').split(':').some((dir) => existsSync(join(dir, 'twg')));
  if (onPath) return 'twg';
  const installed = join(homedir(), '.local', 'bin', 'twg');
  return existsSync(installed) ? installed : 'twg';
}

/** Run one twg command, for `site` when given, and return its parsed envelope. */
export function runTwg(args, site) {
  return new Promise((resolve, reject) => {
    execFile(
      twgBinary(),
      [...args, ...(site ? ['--site', site] : []), '-o', 'json', '--output-summary', 'none'],
      { maxBuffer: 512 * 1024 * 1024 },
      (error, stdout) => {
        try {
          resolve(parseOutput(stdout || ''));
        } catch (parseError) {
          reject(error && !stdout ? error : parseError);
        }
      },
    );
  });
}

/**
 * The REST response for `path`, served by twg. Throws with `status` 501 when twg
 * has no equivalent, so a soft caller records the gap and a hard caller stops.
 */
export async function twgGet(path, { site, devField, run = runTwg }) {
  const plan = planRequest(path);
  if (!plan) {
    const err = new Error(`Not available in twg mode: ${path}`);
    err.status = 501;
    throw err;
  }

  if (plan.shape === 'list') {
    const rows = await collectRows((cursor) => run(
      [...plan.args, '--first', PAGE_SIZE, ...(cursor ? ['--after', cursor] : [])], site,
    ));
    return wrapRows(plan, rows);
  }

  const envelope = await run(plan.args, site);
  const response = reshape({ ...plan, devField }, envelope.data, envelope.pageInfo);
  if (plan.shape === 'devSummary' && response.summary && !response.summary.pullrequest) {
    response.summary.pullrequest = { overall: { count: await linkedPullRequests(plan.args[3], site, run) } };
  }
  if (plan.names) {
    const meta = reshape({ shape: 'editmeta' }, (await run(
      ['jira', 'workitem', 'field', 'update-metadata', '--id', response.key, '--include-system-fields'], site,
    )).data);
    response.names = Object.fromEntries(Object.entries(meta.fields).map(([id, f]) => [id, f.name]));
  }
  return response;
}

/**
 * The pull requests linked to an issue, counted from the Teamwork Graph. The
 * development field's cached summary leaves pull requests out, so without this
 * twg mode would report 0 for an issue that has them.
 *
 * `--since` defaults to 7 days and the result pages across every relationship
 * type: on a live issue with 3 PRs, the default returned 1 and a 365-day window
 * with no filter returned 0. A wide window plus the one relationship returned 3.
 */
async function linkedPullRequests(issue, site, run) {
  const relationship = 'jira_work_item_links_external_pull_request';
  const envelope = await run(
    ['context', 'jira', 'workitem', '--issue', issue, '--since', '3650d', '--relationships', relationship, '--first', '200'],
    site,
  );
  return (envelope.data?.relationshipSummary || [])
    .filter((r) => r.relationshipName === relationship)
    .reduce((n, r) => n + (r.count || 0), 0);
}

/** Save one attachment's bytes to `dest`. `product` is `jira` or `confluence`. */
export async function twgDownload(product, attachmentId, dest, { site, run = runTwg }) {
  const args = product === 'confluence'
    ? ['confluence', 'content', 'attachments', 'download', '--attachment-id', attachmentId, '--out', dest, '--force']
    : ['jira', 'workitem', 'attachment', 'download', '--attachment-id', attachmentId, '--output-path', dest];
  await run(args, site);
}
