#!/usr/bin/env node
/**
 * jira-api.mjs — Authenticated Jira REST access, and the one paged GET.
 *
 * The domain comes from the config; the two secrets come from the environment,
 * so no credential is ever written to a file in the repository.
 *
 * `getAllPages` exists because a single-page read is the defect this skill was
 * built to avoid. Jira caps a list response — comments default to 20 — and a
 * caller that reads `response.comments` once writes a short file and reports
 * success. Every list therefore goes through one helper that pages to the
 * server's own `total` and refuses to return fewer rows than that.
 *
 * Usage as a CLI, for checking credentials:
 *   jira-api.mjs whoami
 *   jira-api.mjs get /rest/api/3/issue/PROJ-123?fields=summary
 *   jira-api.mjs count /rest/api/3/issue/PROJ-123/comment
 *   jira-api.mjs pages /rest/api/3/issue/PROJ-123/comment comments [--page-size N]
 */

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './config.mjs';

/**
 * Jira accepts up to 100 rows per request on the endpoints used here. Asking for
 * the maximum keeps a long comment thread to one or two round trips.
 */
const DEFAULT_PAGE_SIZE = 100;

/**
 * Build the credentials from the config plus the environment. The env var names
 * are themselves in the config, so a site that uses different ones needs no code
 * change.
 */
export function credentials(config) {
  const emailVar = config.auth?.envVars?.email || 'ATLASSIAN_EMAIL';
  const tokenVar = config.auth?.envVars?.token || 'ATLASSIAN_API_TOKEN';
  const domain = config.jira?.domain;

  const email = process.env[emailVar];
  const token = process.env[tokenVar];

  const missing = [];
  if (!email) missing.push(emailVar);
  if (!token) missing.push(tokenVar);

  if (missing.length || !domain) {
    if (!domain) {
      console.error('The config has no jira.domain. Run the setup workflow: workflows/setup.md');
    }
    if (missing.length) {
      console.error(`Missing environment variable(s): ${missing.join(', ')}`);
      console.error('');
      console.error('Create a token at:');
      console.error('  https://id.atlassian.com/manage-profile/security/api-tokens');
      console.error('');
      console.error('Then export both, and add them to your shell profile so every');
      console.error('node call sees them, not just this session:');
      console.error(`  export ${emailVar}="you@example.com"`);
      console.error(`  export ${tokenVar}="your-api-token"`);
    }
    process.exit(1);
  }

  return {
    domain,
    email,
    auth: 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64'),
  };
}

/** Read the config and the credentials together, the usual entry point. */
export function connect(options = {}) {
  const { config, path, root } = loadConfig(options);
  return { config, configPath: path, root, cred: credentials(config) };
}

function describeStatus(status, path) {
  if (status === 401) return 'The token or email is wrong, or the token has expired.';
  if (status === 403) return 'The account lacks permission for this resource.';
  if (status === 404) return `Not found. Check the key and jira.domain: ${path}`;
  if (status === 429) return 'Rate limited. Wait briefly and retry.';
  return null;
}

/** A GET that fails loudly. Use when the caller cannot continue without it. */
export async function apiGet(cred, path) {
  const res = await fetch(`https://${cred.domain}${path}`, {
    headers: { Authorization: cred.auth, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`GET ${path} failed: ${res.status} ${res.statusText}`);
    const hint = describeStatus(res.status, path);
    if (hint) console.error(hint);
    process.exit(1);
  }
  return res.json();
}

/**
 * A GET that returns null instead of exiting. Use for a resource whose absence
 * is a fact to record rather than a failure — a subtask the account cannot read
 * becomes a row that says so.
 */
export async function apiGetSoft(cred, path) {
  const res = await fetch(`https://${cred.domain}${path}`, {
    headers: { Authorization: cred.auth, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * A GraphQL POST that fails quietly, for the one thing REST will not serve.
 *
 * Jira's Deployments tab reads its rows through GraphQL and no REST endpoint
 * publishes them, so this is the only way to see a deployment list. Still a read:
 * a GraphQL query mutates nothing, and Rule 1 holds.
 *
 * Soft on every failure mode, including a 200 carrying an `errors` array — the
 * caller treats a null the same way it treats an empty REST detail, and names the
 * gap in the document rather than failing the part.
 */
export async function graphqlSoft(cred, operationName, query, variables) {
  const res = await fetch(`https://${cred.domain}/jsw2/graphql?operation=${encodeURIComponent(operationName)}`, {
    method: 'POST',
    headers: {
      Authorization: cred.auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ operationName, query, variables }),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  if (!body || body.errors) return null;
  return body.data ?? null;
}

/** Append a query parameter to a path that may or may not already have a query. */
function withParams(path, params) {
  const sep = path.includes('?') ? '&' : '?';
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${path}${sep}${query}`;
}

/**
 * Read every row of a paginated Jira list.
 *
 * Returns `{ rows, total }` where `rows.length === total`, and throws when the
 * server's own count and the rows collected disagree. That assertion is the
 * point of this function: a caller cannot accidentally write a partial file,
 * because a partial read raises instead of returning.
 *
 * `key` is the property holding the rows — `comments`, `worklogs`, `values`.
 * `pageSize` is settable so a test can force many pages against a real ticket.
 */
export async function getAllPages(cred, path, key, { pageSize = DEFAULT_PAGE_SIZE, soft = false } = {}) {
  const rows = [];
  let startAt = 0;
  let total = null;

  for (let guard = 0; guard < 1000; guard++) {
    const page = await (soft ? apiGetSoft : apiGet)(cred, withParams(path, { startAt, maxResults: pageSize }));

    // A soft read of a resource the account cannot see: report nothing found
    // rather than claiming zero rows out of a total the server never gave.
    if (!page) return { rows: [], total: 0, unreadable: true };

    const batch = Array.isArray(page[key]) ? page[key] : [];

    // Trust the server's own echo of where this page starts. A server that
    // ignores `startAt` and replays the first page would otherwise let the row
    // count climb to `total` on duplicates, which reads as a complete document
    // and is the worst possible failure: wrong content, no error.
    const echoed = typeof page.startAt === 'number' ? page.startAt : startAt;
    if (echoed !== startAt) {
      throw new Error(
        `GET ${path} was asked for startAt=${startAt} and answered startAt=${echoed}. ` +
          `Refusing to write a document assembled from unaligned pages.`
      );
    }

    rows.push(...batch);

    // `total` is authoritative; take it from the first response and hold it, so
    // a server that stops reporting it mid-listing cannot silently shrink the job.
    if (total === null) total = typeof page.total === 'number' ? page.total : batch.length;

    if (rows.length >= total) break;

    // An empty page before the total is reached means the listing cannot
    // progress. Stopping here would write a short file, so fail instead.
    if (!batch.length) {
      throw new Error(
        `GET ${path} returned no rows at startAt=${startAt} but reported total=${total}; ` +
          `got ${rows.length}. Refusing to write a partial document.`
      );
    }

    startAt = rows.length;
  }

  if (rows.length !== total) {
    throw new Error(
      `GET ${path} yielded ${rows.length} of ${total} row(s). ` +
        `Refusing to write a partial document.`
    );
  }

  // A duplicated id means pages overlapped, so the count can look right while
  // the content is wrong. Only check when the rows carry ids.
  if (rows.length && rows.every((r) => r && r.id !== undefined)) {
    const unique = new Set(rows.map((r) => String(r.id)));
    if (unique.size !== rows.length) {
      throw new Error(
        `GET ${path} returned ${rows.length} row(s) but only ${unique.size} distinct id(s). ` +
          `Pages overlapped; refusing to write a document with duplicates.`
      );
    }
  }

  return { rows, total, unreadable: false };
}

/**
 * The count alone, without the rows. Used by the pull workflow to check a
 * written file against Jira: `maxResults=0` returns the total and no data.
 */
export async function countOnly(cred, path, { soft = false } = {}) {
  const page = await (soft ? apiGetSoft : apiGet)(cred, withParams(path, { startAt: 0, maxResults: 0 }));
  if (!page) return null;
  return typeof page.total === 'number' ? page.total : null;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    console.log('Usage:');
    console.log('  jira-api.mjs whoami');
    console.log('  jira-api.mjs get <path>');
    console.log('  jira-api.mjs count <path>');
    console.log('  jira-api.mjs pages <path> <rowsKey> [--page-size N]');
    process.exit(command ? 0 : 1);
  }

  const { cred } = connect();

  if (command === 'whoami') {
    const me = await apiGet(cred, '/rest/api/3/myself');
    console.log(JSON.stringify(
      { displayName: me.displayName, emailAddress: me.emailAddress, accountId: me.accountId },
      null, 2
    ));
    return;
  }

  if (command === 'get') {
    const path = rest[0];
    if (!path) { console.error('Required: a path, e.g. /rest/api/3/myself'); process.exit(1); }
    console.log(JSON.stringify(await apiGet(cred, path), null, 2));
    return;
  }

  if (command === 'count') {
    const path = rest[0];
    if (!path) { console.error('Required: a path'); process.exit(1); }
    console.log(JSON.stringify({ path, total: await countOnly(cred, path) }, null, 2));
    return;
  }

  if (command === 'pages') {
    const [path, key] = rest;
    if (!path || !key) {
      console.error('Required: a path and the property holding the rows, e.g. comments');
      process.exit(1);
    }
    const sizeFlag = rest.indexOf('--page-size');
    const pageSize = sizeFlag > -1 ? Number(rest[sizeFlag + 1]) : DEFAULT_PAGE_SIZE;
    if (!Number.isFinite(pageSize) || pageSize < 1) {
      console.error('--page-size needs a positive number');
      process.exit(1);
    }
    const { rows, total } = await getAllPages(cred, path, key, { pageSize });
    console.log(JSON.stringify({ path, key, pageSize, collected: rows.length, total }, null, 2));
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
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
