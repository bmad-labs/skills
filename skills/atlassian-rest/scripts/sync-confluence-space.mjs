#!/usr/bin/env node

/**
 * Sync a Confluence page tree to local markdown files with attachments.
 *
 * Recursively fetches all pages under a root page, converts them to markdown,
 * downloads attachments, and generates an INDEX.md table of contents.
 *
 * Usage:
 *   node sync-confluence-space.mjs --root <pageId> --output <dir> [options]
 *
 * Options:
 *   --root <pageId>      Root Confluence page ID (required)
 *   --output <dir>       Output directory for markdown files (required)
 *   --assets-dir <dir>   Assets directory path (default: <output>/../assets)
 *   --skip-attachments   Skip downloading attachment files
 *   --dry-run            Show what would be synced without writing files
 *   --flatten            Don't create subdirectories, use flat file structure
 *
 * Env vars: ATLASSIAN_API_TOKEN, ATLASSIAN_EMAIL, ATLASSIAN_DOMAIN
 */

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { storageToMarkdown } from './confluence-format.mjs';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
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
      i += 1;
    }
  }
  return flags;
}

function printUsage() {
  const usage = `
Usage:
  node sync-confluence-space.mjs --root <pageId> --output <dir> [options]

Options:
  --root <pageId>      Root Confluence page ID (required)
  --output <dir>       Output directory for markdown files (required)
  --assets-dir <dir>   Assets directory path (default: <output>/../assets)
  --skip-attachments   Skip downloading attachment files
  --dry-run            Show what would be synced without writing files
  --flatten            Don't create subdirectories, use flat file structure
  --help               Show this help message

Environment variables:
  ATLASSIAN_API_TOKEN  API token from https://id.atlassian.com/manage-profile/security/api-tokens
  ATLASSIAN_EMAIL      Email associated with the Atlassian account
  ATLASSIAN_DOMAIN     e.g. mycompany.atlassian.net
`.trim();
  console.error(usage);
}

const flags = parseArgs(process.argv.slice(2));

if (flags.help) {
  printUsage();
  process.exit(0);
}

if (!flags.root || !flags.output) {
  console.error('Error: --root and --output are required.\n');
  printUsage();
  process.exit(1);
}

const ROOT_PAGE_ID = flags.root;
const OUT_DIR = resolve(flags.output);
const ASSETS_BASE = resolve(flags['assets-dir'] || join(OUT_DIR, '..', 'assets'));
const IMGS_DIR = join(ASSETS_BASE, 'imgs');
const PDFS_DIR = join(ASSETS_BASE, 'pdfs');
const OTHER_DIR = join(ASSETS_BASE, 'other');
const SKIP_ATTACHMENTS = !!flags['skip-attachments'];
const DRY_RUN = !!flags['dry-run'];
const FLATTEN = !!flags.flatten;

// ---------------------------------------------------------------------------
// Env config
// ---------------------------------------------------------------------------
const REQUIRED_VARS = ['ATLASSIAN_API_TOKEN', 'ATLASSIAN_EMAIL', 'ATLASSIAN_DOMAIN'];
const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`Missing environment variable(s): ${missing.join(', ')}`);
  console.error('Set them before running this script. See --help for details.');
  process.exit(1);
}

const EMAIL = process.env.ATLASSIAN_EMAIL;
const TOKEN = process.env.ATLASSIAN_API_TOKEN;
const DOMAIN = process.env.ATLASSIAN_DOMAIN;
const AUTH = `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')}`;

// ---------------------------------------------------------------------------
// Stats tracking
// ---------------------------------------------------------------------------
const stats = { pages: 0, attachments: 0, skippedAttachments: 0, errors: [] };

function log(msg) {
  process.stderr.write(msg + '\n');
}

// ---------------------------------------------------------------------------
// API helpers with rate limiting
// ---------------------------------------------------------------------------
const RATE_LIMIT_MS = 100;
let lastRequest = 0;

async function rateLimitedFetch(url, options) {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequest = Date.now();
  return fetch(url, options);
}

async function apiGet(path, params = {}) {
  let url = `https://${DOMAIN}${path}`;
  const qs = new URLSearchParams(params).toString();
  if (qs) url += `?${qs}`;

  const res = await rateLimitedFetch(url, {
    headers: { Authorization: AUTH, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} for ${path}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function downloadFile(url, destPath) {
  const res = await rateLimitedFetch(url, {
    headers: { Authorization: AUTH },
  });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  mkdirSync(dirname(destPath), { recursive: true });
  const ws = createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body), ws);
}

// ---------------------------------------------------------------------------
// Confluence API wrappers
// ---------------------------------------------------------------------------
async function fetchPage(pageId) {
  return apiGet(`/wiki/api/v2/pages/${pageId}`, { 'body-format': 'storage' });
}

async function fetchChildren(pageId) {
  const children = [];
  let cursor = null;
  while (true) {
    const params = { limit: '50' };
    if (cursor) params.cursor = cursor;
    const data = await apiGet(`/wiki/api/v2/pages/${pageId}/children`, params);
    children.push(...(data.results || []));
    if (data._links?.next) {
      const nextUrl = new URL(data._links.next, `https://${DOMAIN}`);
      cursor = nextUrl.searchParams.get('cursor');
      if (!cursor) break;
    } else {
      break;
    }
  }
  return children;
}

async function fetchAttachments(pageId) {
  const attachments = [];
  let start = 0;
  while (true) {
    const data = await apiGet(`/wiki/rest/api/content/${pageId}/child/attachment`, {
      limit: '100',
      start: String(start),
    });
    attachments.push(...(data.results || []));
    if (data.size < 100) break;
    start += 100;
  }
  return attachments;
}

// ---------------------------------------------------------------------------
// Build page tree recursively
// ---------------------------------------------------------------------------
async function buildTree(pageId, depth = 0) {
  const page = await fetchPage(pageId);
  log(`  Found: ${'  '.repeat(depth)}${page.title}`);

  const children = await fetchChildren(pageId);
  const childNodes = [];
  for (const child of children) {
    try {
      const node = await buildTree(child.id, depth + 1);
      childNodes.push(node);
    } catch (err) {
      const msg = `Failed to fetch page ${child.id} ("${child.title || 'unknown'}"): ${err.message}`;
      log(`  WARNING: ${msg}`);
      stats.errors.push(msg);
    }
  }

  return { page, children: childNodes, depth };
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------
function sanitize(name) {
  return name
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeForMd(filename) {
  return filename
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/ /g, '%20');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAssetDir(mediaType, filename) {
  if (mediaType && mediaType.startsWith('image/')) return IMGS_DIR;
  if (mediaType === 'application/pdf' || filename.endsWith('.pdf')) return PDFS_DIR;
  return OTHER_DIR;
}

function countPages(node) {
  return 1 + node.children.reduce((sum, c) => sum + countPages(c), 0);
}

// ---------------------------------------------------------------------------
// Process a single page: download attachments, write markdown
// ---------------------------------------------------------------------------
async function processPage(node, parentDir) {
  const { page, children } = node;
  const title = page.title;
  const safeName = sanitize(title);
  const hasChildren = children.length > 0;

  // Determine file path
  let filePath, fileDir;
  if (FLATTEN) {
    fileDir = OUT_DIR;
    filePath = join(OUT_DIR, `${safeName}.md`);
  } else if (hasChildren) {
    fileDir = join(parentDir, safeName);
    filePath = join(fileDir, 'index.md');
  } else {
    fileDir = parentDir;
    filePath = join(parentDir, `${safeName}.md`);
  }

  if (DRY_RUN) {
    log(`  [dry-run] Would write: ${relative(OUT_DIR, filePath)}`);
    stats.pages++;
    for (const child of children) {
      await processPage(child, hasChildren && !FLATTEN ? join(parentDir, safeName) : parentDir);
    }
    return;
  }

  mkdirSync(fileDir, { recursive: true });

  // Calculate relative path from this markdown file to the assets directory
  const fileAbsDir = dirname(filePath);
  const imgsRel = relative(fileAbsDir, IMGS_DIR);
  const pdfsRel = relative(fileAbsDir, PDFS_DIR);
  const otherRel = relative(fileAbsDir, OTHER_DIR);

  // Fetch and download attachments
  const attachmentMap = new Map(); // filename -> relative markdown path

  if (!SKIP_ATTACHMENTS) {
    try {
      const attachments = await fetchAttachments(page.id);

      for (const att of attachments) {
        const attFilename = att.title;
        const mediaType = att.metadata?.mediaType || att.extensions?.mediaType || '';
        const targetDir = getAssetDir(mediaType, attFilename);
        const localPath = join(targetDir, attFilename);

        // Determine relative path from markdown file to asset
        let relDir;
        if (targetDir === IMGS_DIR) relDir = imgsRel;
        else if (targetDir === PDFS_DIR) relDir = pdfsRel;
        else relDir = otherRel;
        const relPath = `${relDir}/${encodeForMd(attFilename)}`;
        attachmentMap.set(attFilename, relPath);

        if (!existsSync(localPath)) {
          try {
            const downloadUrl = `https://${DOMAIN}/wiki/rest/api/content/${page.id}/child/attachment/${att.id}/download`;
            await downloadFile(downloadUrl, localPath);
            stats.attachments++;
            log(`    attachment: ${attFilename}`);
          } catch (err) {
            const msg = `Failed to download "${attFilename}" from page "${title}": ${err.message}`;
            log(`    WARNING: ${msg}`);
            stats.errors.push(msg);
          }
        } else {
          stats.skippedAttachments++;
        }
      }
    } catch (err) {
      const msg = `Failed to fetch attachments for page "${title}": ${err.message}`;
      log(`    WARNING: ${msg}`);
      stats.errors.push(msg);
    }
  }

  // Convert page body to markdown
  const storageHtml = page.body?.storage?.value || '';
  let markdown = storageToMarkdown(storageHtml);

  // Rewrite attachment references in markdown
  for (const [filename, relPath] of attachmentMap) {
    const encodedFilename = encodeForMd(filename);

    // Rewrite image references
    const imgPatterns = [
      new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegex(filename)}\\)`, 'g'),
      new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegex(encodedFilename)}\\)`, 'g'),
      new RegExp(`!\\[([^\\]]*)\\]\\(https?://[^)]*attachment[^)]*${escapeRegex(filename)}[^)]*\\)`, 'g'),
    ];
    for (const pat of imgPatterns) {
      markdown = markdown.replace(pat, (_match, alt) => `![${alt || filename}](${relPath})`);
    }

    // Rewrite non-image attachment links (from view-file macros)
    const linkPatterns = [
      new RegExp(`(?<!!)(\\[${escapeRegex(filename)}\\])\\(${escapeRegex(filename)}\\)`, 'g'),
      new RegExp(`(?<!!)(\\[${escapeRegex(filename)}\\])\\(${escapeRegex(encodedFilename)}\\)`, 'g'),
    ];
    for (const pat of linkPatterns) {
      markdown = markdown.replace(pat, (_match, linkText) => `${linkText}(${relPath})`);
    }
  }

  // Prepend title with link back to Confluence
  // Use _links.base + _links.webui for correct URL (NOT env.domain + webui)
  const pageUrl = `${page._links.base}${page._links.webui}`;
  markdown = `# [${title}](${pageUrl})\n\n${markdown}`;

  writeFileSync(filePath, markdown, 'utf-8');
  stats.pages++;
  log(`  synced: ${relative(OUT_DIR, filePath)}`);

  // Process children
  const childDir = hasChildren && !FLATTEN ? join(parentDir, safeName) : parentDir;
  for (const child of children) {
    await processPage(child, childDir);
  }
}

// ---------------------------------------------------------------------------
// Generate INDEX.md with table of contents
// ---------------------------------------------------------------------------
function generateIndexLines(node, indent, parentPath) {
  const { page, children } = node;
  const safeName = sanitize(page.title);
  const hasChildren = children.length > 0;

  let link;
  if (FLATTEN) {
    link = `${safeName}.md`;
  } else if (parentPath) {
    link = hasChildren ? `${parentPath}/${safeName}/index.md` : `${parentPath}/${safeName}.md`;
  } else {
    link = hasChildren ? `${safeName}/index.md` : `${safeName}.md`;
  }

  const lines = [`${'  '.repeat(indent)}- [${page.title}](${encodeForMd(link)})`];

  for (const child of children) {
    const nextParent = FLATTEN
      ? ''
      : hasChildren
        ? `${parentPath ? parentPath + '/' : ''}${safeName}`
        : parentPath;
    lines.push(...generateIndexLines(child, indent + 1, nextParent));
  }
  return lines;
}

function writeIndex(tree) {
  const rootTitle = tree.page.title;
  const pageUrl = `${tree.page._links.base}${tree.page._links.webui}`;
  const lines = [
    `# ${rootTitle}\n`,
    `> Synced from [Confluence](${pageUrl})\n`,
    `## Table of Contents\n`,
  ];

  for (const child of tree.children) {
    lines.push(...generateIndexLines(child, 0, ''));
  }

  const indexPath = join(OUT_DIR, 'INDEX.md');
  writeFileSync(indexPath, lines.join('\n') + '\n', 'utf-8');
  log(`  wrote: INDEX.md`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log(`Confluence Space Sync`);
  log(`  Root page:  ${ROOT_PAGE_ID}`);
  log(`  Output:     ${OUT_DIR}`);
  log(`  Assets:     ${ASSETS_BASE}`);
  if (DRY_RUN) log(`  Mode:       DRY RUN`);
  if (FLATTEN) log(`  Structure:  FLAT`);
  if (SKIP_ATTACHMENTS) log(`  Attachments: SKIPPED`);
  log('');

  // Create directories
  if (!DRY_RUN) {
    mkdirSync(OUT_DIR, { recursive: true });
    if (!SKIP_ATTACHMENTS) {
      mkdirSync(IMGS_DIR, { recursive: true });
      mkdirSync(PDFS_DIR, { recursive: true });
      mkdirSync(OTHER_DIR, { recursive: true });
    }
  }

  // Phase 1: Build page tree
  log('Building page tree...');
  const tree = await buildTree(ROOT_PAGE_ID);
  const totalPages = countPages(tree);
  log(`\nFound ${totalPages} pages. Syncing...\n`);

  // Phase 2: Process pages
  await processPage(tree, OUT_DIR);

  // Phase 3: Write index
  if (!DRY_RUN) {
    writeIndex(tree);
  }

  // Phase 4: Summary
  log('');
  log('--- Sync Summary ---');
  log(`  Pages synced:          ${stats.pages}`);
  if (!SKIP_ATTACHMENTS) {
    log(`  Attachments downloaded: ${stats.attachments}`);
    log(`  Attachments skipped:   ${stats.skippedAttachments} (already exist)`);
  }
  if (stats.errors.length > 0) {
    log(`  Errors:                ${stats.errors.length}`);
    for (const err of stats.errors) {
      log(`    - ${err}`);
    }
  } else {
    log(`  Errors:                0`);
  }
  log('');
  if (DRY_RUN) {
    log('Dry run complete. No files were written.');
  } else {
    log(`Sync complete. Files written to ${OUT_DIR}`);
  }
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
