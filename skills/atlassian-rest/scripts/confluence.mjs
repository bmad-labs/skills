#!/usr/bin/env node

/**
 * Confluence REST API v2 CLI — subcommand-based interface.
 * Node.js 18+ — uses built-in fetch.
 *
 * Usage:
 *   node confluence.mjs search <CQL> [--max N]
 *   node confluence.mjs get-page <pageId> [--format storage|view]
 *   node confluence.mjs create-page --space S --title T --body B [--parent P] [--body-file F]
 *   node confluence.mjs update-page <pageId> --title T --body B [--body-file F]
 *   node confluence.mjs comment <pageId> <body>
 *   node confluence.mjs spaces [--max N]
 *   node confluence.mjs descendants <pageId>
 *   node confluence.mjs attach <pageId> <filePath> [--comment C]
 *   node confluence.mjs list-attachments <pageId> [--max N]
 *
 * Env vars: ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, ATLASSIAN_DOMAIN
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { markdownToStorage } from './confluence-format.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_VARS = ['ATLASSIAN_API_TOKEN', 'ATLASSIAN_EMAIL', 'ATLASSIAN_DOMAIN'];

function checkEnv() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(`Missing environment variable(s): ${missing.join(', ')}`);
    console.error('');
    console.error('Set them before running this script:');
    console.error('  export ATLASSIAN_EMAIL="you@example.com"');
    console.error('  export ATLASSIAN_DOMAIN="mycompany.atlassian.net"');
    console.error('  export ATLASSIAN_API_TOKEN="your-api-token"');
    console.error('');
    console.error('Run `node setup.mjs` for full setup instructions.');
    process.exit(1);
  }
  return {
    email: process.env.ATLASSIAN_EMAIL,
    token: process.env.ATLASSIAN_API_TOKEN,
    domain: process.env.ATLASSIAN_DOMAIN,
  };
}

function authHeader(email, token) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { positional, flags };
}

async function request(method, path, { email, token, domain, body, params } = {}) {
  let url = `https://${domain}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {
    Authorization: authHeader(email, token),
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    process.exit(1);
  }

  const text = await response.text();

  if (!response.ok) {
    console.error(`HTTP ${response.status} ${response.statusText}`);
    console.error(text);
    process.exit(1);
  }

  return text ? JSON.parse(text) : null;
}

/**
 * Raw fetch helper — does NOT set Content-Type (needed for multipart/form-data).
 * Accepts extra headers and passes body directly without JSON.stringify.
 */
async function requestRaw(method, path, { email, token, domain, body, params, extraHeaders } = {}) {
  let url = `https://${domain}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {
    Authorization: authHeader(email, token),
    Accept: 'application/json',
    ...extraHeaders,
  };

  let response;
  try {
    response = await fetch(url, { method, headers, body });
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    process.exit(1);
  }

  const text = await response.text();

  if (!response.ok) {
    console.error(`HTTP ${response.status} ${response.statusText}`);
    console.error(text);
    process.exit(1);
  }

  return text ? JSON.parse(text) : null;
}

// toStorageFormat replaced by shared markdownToStorage from confluence-format.mjs

function printUsage() {
  console.log(`Usage:
  node confluence.mjs search <CQL> [--max N]
  node confluence.mjs get-page <pageId> [--format storage|view]
  node confluence.mjs create-page --space S --title T --body B [--parent P] [--body-file F]
  node confluence.mjs update-page <pageId> --title T --body B [--body-file F]
  node confluence.mjs comment <pageId> <body> [--body-file F]
  node confluence.mjs spaces [--max N]
  node confluence.mjs descendants <pageId>
  node confluence.mjs attach <pageId> <filePath> [--comment C]
  node confluence.mjs list-attachments <pageId> [--max N]

Note: Delete operations are restricted. Use the Atlassian web UI to delete resources.`);
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

async function cmdSearch(env, positional, flags) {
  const cql = positional[0];
  if (!cql) {
    console.error('Error: CQL query is required.\nUsage: node confluence.mjs search <CQL> [--max N]');
    process.exit(1);
  }
  const limit = flags.max || '25';
  const data = await request('GET', '/wiki/rest/api/content/search', {
    ...env,
    params: { cql, limit },
  });

  const results = (data.results || []).map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    space: r._expandable?.space?.split('/').pop() || r.space?.key || null,
    excerpt: r.excerpt || null,
  }));

  console.log(JSON.stringify(results, null, 2));
}

async function cmdGetPage(env, positional, flags) {
  const pageId = positional[0];
  if (!pageId) {
    console.error('Error: pageId is required.\nUsage: node confluence.mjs get-page <pageId> [--format storage|view]');
    process.exit(1);
  }
  const format = flags.format || 'storage';
  if (format !== 'storage' && format !== 'view') {
    console.error('Error: --format must be "storage" or "view".');
    process.exit(1);
  }

  const data = await request('GET', `/wiki/api/v2/pages/${pageId}`, {
    ...env,
    params: { 'body-format': format },
  });

  console.log(JSON.stringify(data, null, 2));
}

async function cmdCreatePage(env, _positional, flags) {
  const spaceId = flags.space;
  const title = flags.title;
  const bodyRaw = flags['body-file'] ? readFileSync(flags['body-file'], 'utf-8') : flags.body;

  if (!spaceId || !title || !bodyRaw) {
    console.error('Error: --space, --title, and (--body or --body-file) are required.');
    console.error('Usage: node confluence.mjs create-page --space S --title T --body B [--parent P] [--body-file F]');
    process.exit(1);
  }

  const payload = {
    spaceId,
    status: 'current',
    title,
    body: {
      representation: 'storage',
      value: markdownToStorage(bodyRaw),
    },
  };

  if (flags.parent) {
    payload.parentId = flags.parent;
  }

  const data = await request('POST', '/wiki/api/v2/pages', { ...env, body: payload });
  console.log(JSON.stringify(data, null, 2));
}

async function cmdUpdatePage(env, positional, flags) {
  const pageId = positional[0];
  const title = flags.title;
  const bodyRaw = flags['body-file'] ? readFileSync(flags['body-file'], 'utf-8') : flags.body;

  if (!pageId || !title || !bodyRaw) {
    console.error('Error: pageId, --title, and (--body or --body-file) are required.');
    console.error('Usage: node confluence.mjs update-page <pageId> --title T --body B [--body-file F]');
    process.exit(1);
  }

  // Fetch current page to get version number
  const current = await request('GET', `/wiki/api/v2/pages/${pageId}`, {
    ...env,
    params: { 'body-format': 'storage' },
  });
  const currentVersion = current.version?.number;
  if (currentVersion === undefined) {
    console.error('Error: could not determine current page version.');
    process.exit(1);
  }

  const payload = {
    id: pageId,
    status: 'current',
    title,
    body: {
      representation: 'storage',
      value: markdownToStorage(bodyRaw),
    },
    version: {
      number: currentVersion + 1,
    },
  };

  const data = await request('PUT', `/wiki/api/v2/pages/${pageId}`, { ...env, body: payload });
  console.log(JSON.stringify(data, null, 2));
}

async function cmdComment(env, positional, flags) {
  const pageId = positional[0];
  const bodyRaw = flags['body-file'] ? readFileSync(flags['body-file'], 'utf-8') : positional[1];

  if (!pageId || !bodyRaw) {
    console.error('Error: pageId and (body or --body-file) are required.');
    console.error('Usage: node confluence.mjs comment <pageId> <body> | --body-file F');
    process.exit(1);
  }

  const payload = {
    body: {
      representation: 'storage',
      value: markdownToStorage(bodyRaw),
    },
  };

  const data = await request('POST', `/wiki/api/v2/pages/${pageId}/footer-comments`, {
    ...env,
    body: payload,
  });
  console.log(JSON.stringify(data, null, 2));
}

async function cmdSpaces(env, _positional, flags) {
  const limit = flags.max || '25';
  const data = await request('GET', '/wiki/api/v2/spaces', {
    ...env,
    params: { limit },
  });

  const results = (data.results || []).map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    type: s.type,
  }));

  console.log(JSON.stringify(results, null, 2));
}

async function cmdDescendants(env, positional, _flags) {
  const pageId = positional[0];
  if (!pageId) {
    console.error('Error: pageId is required.\nUsage: node confluence.mjs descendants <pageId>');
    process.exit(1);
  }

  const data = await request('GET', `/wiki/api/v2/pages/${pageId}/children`, { ...env });
  console.log(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Attachment subcommands (V1 API — V2 is read-only for attachments)
// ---------------------------------------------------------------------------

async function cmdAttach(env, positional, flags) {
  const pageId = positional[0];
  const filePath = positional[1];

  if (!pageId || !filePath) {
    console.error('Error: pageId and filePath are required.');
    console.error('Usage: node confluence.mjs attach <pageId> <filePath> [--comment C]');
    process.exit(1);
  }

  const fileData = readFileSync(filePath);
  const blob = new Blob([fileData]);
  const form = new FormData();
  form.append('file', blob, basename(filePath));
  if (flags.comment) form.append('comment', flags.comment);

  const data = await requestRaw('POST', `/wiki/rest/api/content/${pageId}/child/attachment`, {
    ...env,
    body: form,
    extraHeaders: { 'X-Atlassian-Token': 'nocheck' },
  });

  const results = (data.results || [data]).map((a) => ({
    id: a.id,
    title: a.title,
    mediaType: a.metadata?.mediaType || a.extensions?.mediaType || null,
    fileSize: a.extensions?.fileSize || null,
  }));

  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
}

async function cmdListAttachments(env, positional, flags) {
  const pageId = positional[0];

  if (!pageId) {
    console.error('Error: pageId is required.');
    console.error('Usage: node confluence.mjs list-attachments <pageId> [--max N]');
    process.exit(1);
  }

  const limit = flags.max || '25';
  const data = await request('GET', `/wiki/rest/api/content/${pageId}/child/attachment`, {
    ...env,
    params: { limit },
  });

  const results = (data.results || []).map((a) => ({
    id: a.id,
    title: a.title,
    mediaType: a.metadata?.mediaType || a.extensions?.mediaType || null,
    fileSize: a.extensions?.fileSize || null,
    downloadLink: a._links?.download || null,
  }));

  console.log(JSON.stringify(results, null, 2));
}

async function cmdDeleteAttachment(_env, _positional, _flags) {
  console.error('Delete operations are restricted in this skill. Use the Atlassian web UI to delete attachments.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const COMMANDS = {
  search: cmdSearch,
  'get-page': cmdGetPage,
  'create-page': cmdCreatePage,
  'update-page': cmdUpdatePage,
  comment: cmdComment,
  spaces: cmdSpaces,
  descendants: cmdDescendants,
  attach: cmdAttach,
  'list-attachments': cmdListAttachments,
  'delete-attachment': cmdDeleteAttachment,
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const handler = COMMANDS[command];

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  const env = checkEnv();
  const { positional, flags } = parseArgs(args.slice(1));
  await handler(env, positional, flags);
}

main();
