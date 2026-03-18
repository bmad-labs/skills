#!/usr/bin/env node

// BMAD Document ↔ Jira/Confluence Sync Engine — Node.js 18+

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { markdownToAdf as mdToAdf } from 'marklassian';
import { markdownToStorage, storageToMarkdown } from './confluence-format.mjs';

// ---------------------------------------------------------------------------
// Helpers (shared patterns from jira.mjs / confluence.mjs)
// ---------------------------------------------------------------------------

function checkEnv() {
  const required = ['ATLASSIAN_API_TOKEN', 'ATLASSIAN_EMAIL', 'ATLASSIAN_DOMAIN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\n` +
        'Run: node <skill-path>/scripts/setup.mjs'
    );
    process.exit(1);
  }
}

function jiraBaseUrl() {
  return `https://${process.env.ATLASSIAN_DOMAIN}/rest/api/3`;
}

function confluenceBaseUrl(version = 'v2') {
  const domain = process.env.ATLASSIAN_DOMAIN;
  return version === 'v1'
    ? `https://${domain}/wiki/rest/api`
    : `https://${domain}/wiki/api/v2`;
}

function authHeader() {
  const cred = Buffer.from(
    `${process.env.ATLASSIAN_EMAIL}:${process.env.ATLASSIAN_API_TOKEN}`
  ).toString('base64');
  return `Basic ${cred}`;
}

async function request(url, { method = 'GET', body, query } = {}) {
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }
  const opts = {
    method,
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    console.error(`HTTP ${res.status} ${res.statusText} — ${method} ${url}`);
    if (detail) console.error(detail);
    process.exit(1);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function deleteIssue(issueKey) {
  const url = `${jiraBaseUrl()}/issue/${issueKey}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: authHeader(), Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Failed to delete ${issueKey}: ${res.status} ${res.statusText} ${detail}`);
  }
}

function askConfirmation(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ---------------------------------------------------------------------------
// Argument parsing (same as jira.mjs)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
        i += 1;
      } else {
        flags[key] = next;
        i += 2;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { positional, flags };
}

function requirePositional(positional, index, label) {
  if (positional[index] === undefined) {
    console.error(`Missing required argument: <${label}>`);
    process.exit(1);
  }
  return positional[index];
}

// ---------------------------------------------------------------------------
// Paths — resolve relative to this script's directory
// ---------------------------------------------------------------------------

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const SKILL_DIR = resolve(SCRIPT_DIR, '..');
const MEMORY_DIR = join(SKILL_DIR, 'memory');
const SYNC_STATE_DIR = join(MEMORY_DIR, 'sync-state');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Simple YAML parser (flat key-value: strings, arrays, booleans)
// ---------------------------------------------------------------------------

function parseSimpleYaml(text) {
  const result = {};
  const lines = text.split('\n');
  let currentKey = null;
  let inArray = false;
  let arrayValues = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;

    // Array item (  - value)
    if (inArray && /^\s+-\s+(.*)/.test(line)) {
      const val = line.match(/^\s+-\s+(.*)/)[1].trim();
      arrayValues.push(unquote(val));
      continue;
    }

    // If we were in an array but hit a non-array line, save it
    if (inArray) {
      result[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
      currentKey = null;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const rawVal = kvMatch[2].trim();

      if (rawVal === '' || rawVal === '[]') {
        // Could be start of array block or empty value
        currentKey = key;
        if (rawVal === '[]') {
          result[key] = [];
        } else {
          inArray = true;
          arrayValues = [];
        }
      } else {
        result[key] = parseYamlValue(rawVal);
      }
    }
  }

  // Flush trailing array
  if (inArray && currentKey) {
    result[currentKey] = arrayValues;
  }

  return result;
}

function unquote(s) {
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function quoteYamlValue(str) {
  // Use double quotes if value contains single quotes, otherwise use single quotes
  if (str.includes("'")) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return `'${str}'`;
}

function parseYamlValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  // Inline array: [a, b, c]
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map((v) => unquote(v.trim())).filter(Boolean);
  }
  return unquote(raw);
}

// ---------------------------------------------------------------------------
// BMAD Document Parser
// ---------------------------------------------------------------------------

function parseBmadDoc(content) {
  const lines = content.split('\n');
  let i = 0;
  let frontmatter = {};
  let hasFrontmatter = false;

  // Parse frontmatter
  if (lines[0]?.trim() === '---') {
    hasFrontmatter = true;
    i = 1;
    const fmLines = [];
    while (i < lines.length && lines[i].trim() !== '---') {
      fmLines.push(lines[i]);
      i++;
    }
    i++; // skip closing ---
    frontmatter = parseSimpleYaml(fmLines.join('\n'));
  }

  // Parse sections by heading level
  const sections = [];
  let currentSection = null;
  let preamble = '';

  for (; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      currentSection = {
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        content: '',
        line: i,
      };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.content += lines[i] + '\n';
    } else {
      preamble += lines[i] + '\n';
    }
  }

  // Trim trailing newlines from section content
  for (const s of sections) {
    s.content = s.content.replace(/\n+$/, '');
  }

  return { frontmatter, hasFrontmatter, sections, preamble: preamble.trim(), raw: content };
}

// ---------------------------------------------------------------------------
// Document type detection
// ---------------------------------------------------------------------------

function detectDocType(parsed) {
  const { frontmatter, sections } = parsed;

  // PRD: workflowType = 'prd'
  if (frontmatter.workflowType === 'prd') return 'prd';

  // Tech spec: has tech_stack or files_to_modify or title starts with Tech-Spec
  if (frontmatter.tech_stack || frontmatter.files_to_modify || frontmatter.code_patterns) return 'story';
  const h1 = sections.find((s) => s.level === 1);
  if (h1 && /^Tech-Spec:/i.test(h1.title)) return 'story';

  // Epic: has ## Epic N: pattern
  const hasEpicHeading = sections.some((s) => s.level === 2 && /^Epic\s+\d+:/i.test(s.title));
  if (hasEpicHeading) return 'epic';

  // Story: has "As a ... I want ... So that" pattern
  const fullContent = sections.map((s) => s.content).join('\n');
  if (/As a .+,?\s*\nI want .+,?\s*\n[Ss]o that/i.test(fullContent)) return 'story';

  // Architecture: has architecture-related headings
  const hasArchHeading = sections.some((s) =>
    /^(Technical Design|Architecture|System Design|Infrastructure)/i.test(s.title)
  );
  if (hasArchHeading) return 'architecture';

  // Default: unknown
  return null;
}

function targetForDocType(docType) {
  if (docType === 'epic' || docType === 'story') return 'jira';
  if (docType === 'prd' || docType === 'architecture') return 'confluence';
  return null;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function computeHash(content) {
  return 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex');
}

function computeSectionHashes(sections) {
  const hashes = {};
  for (const s of sections) {
    const key = s.title;
    hashes[key] = computeHash(s.content);
  }
  return hashes;
}

function computeDocHash(content) {
  return computeHash(content);
}

// ---------------------------------------------------------------------------
// Sync State persistence
// ---------------------------------------------------------------------------

function stateFileName(filePath) {
  const absPath = resolve(filePath);
  const hash = createHash('sha256').update(absPath, 'utf8').digest('hex').slice(0, 16);
  return `${hash}.json`;
}

function loadSyncState(filePath) {
  ensureDir(SYNC_STATE_DIR);
  const statePath = join(SYNC_STATE_DIR, stateFileName(filePath));
  if (!existsSync(statePath)) return null;
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

function saveSyncState(filePath, state) {
  ensureDir(SYNC_STATE_DIR);
  const statePath = join(SYNC_STATE_DIR, stateFileName(filePath));
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Field Mapping persistence
// ---------------------------------------------------------------------------

function mappingFileName(docType) {
  const target = targetForDocType(docType);
  return `${target}-${docType}-field-mapping.json`;
}

function loadFieldMapping(docType) {
  ensureDir(MEMORY_DIR);
  const mapPath = join(MEMORY_DIR, mappingFileName(docType));
  if (!existsSync(mapPath)) return null;
  return JSON.parse(readFileSync(mapPath, 'utf8'));
}

function saveFieldMapping(docType, mapping) {
  ensureDir(MEMORY_DIR);
  const mapPath = join(MEMORY_DIR, mappingFileName(docType));
  writeFileSync(mapPath, JSON.stringify(mapping, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Link discovery
// ---------------------------------------------------------------------------

function findLink(parsed) {
  const { frontmatter, sections } = parsed;

  // 1. Check frontmatter
  if (frontmatter.jira_ticket_id) return { target: 'jira', linkId: frontmatter.jira_ticket_id };
  if (frontmatter.confluence_page_id) return { target: 'confluence', linkId: frontmatter.confluence_page_id };

  // 2. Check title for [KEY-123] pattern
  const h1 = sections.find((s) => s.level === 1);
  if (h1) {
    const m = h1.title.match(/^\[([A-Z]+-\d+)\]\s*/);
    if (m) return { target: 'jira', linkId: m[1] };
    const pageM = h1.title.match(/^\[page:(\d+)\]\s*/);
    if (pageM) return { target: 'confluence', linkId: pageM[1] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Write link back to document
// ---------------------------------------------------------------------------

function addLinkToDoc(filePath, parsed, target, linkId) {
  let content = parsed.raw;

  if (parsed.hasFrontmatter) {
    // Add to YAML frontmatter
    const prop = target === 'jira' ? 'jira_ticket_id' : 'confluence_page_id';
    const lines = content.split('\n');
    // Find second --- and insert before it
    let dashCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        dashCount++;
        if (dashCount === 2) {
          lines.splice(i, 0, `${prop}: '${linkId}'`);
          break;
        }
      }
    }
    content = lines.join('\n');
  } else {
    // Prefix title with [KEY]
    const h1Match = content.match(/^(#{1,6}\s+)(.*)/m);
    if (h1Match) {
      const prefix = target === 'jira' ? `[${linkId}] ` : `[page:${linkId}] `;
      content = content.replace(/^(#{1,6}\s+)(.*)/m, `$1${prefix}$2`);
    }
  }

  writeFileSync(filePath, content, 'utf8');
  return content;
}

// ---------------------------------------------------------------------------
// Story extraction from epic docs
// ---------------------------------------------------------------------------

function extractStories(sections) {
  const stories = [];
  let currentStory = null;

  for (const s of sections) {
    const storyMatch = s.title.match(/^Story\s+(\d+\.\d+):\s+(.*)/i);
    if (storyMatch && s.level === 3) {
      if (currentStory) stories.push(currentStory);
      currentStory = {
        id: `Story ${storyMatch[1]}: ${storyMatch[2]}`,
        number: storyMatch[1],
        title: storyMatch[2],
        heading: s.title,
        content: s.content,
        level: s.level,
      };
    } else if (currentStory && s.level > 3) {
      // Sub-sections of the current story
      currentStory.content += `\n${'#'.repeat(s.level)} ${s.title}\n${s.content}`;
    } else {
      if (currentStory) stories.push(currentStory);
      currentStory = null;
    }
  }
  if (currentStory) stories.push(currentStory);
  return stories;
}

// ---------------------------------------------------------------------------
// Markdown ↔ ADF conversion (using marklassian)
// ---------------------------------------------------------------------------

function markdownToAdf(markdown) {
  return mdToAdf(markdown || '');
}

function adfToMarkdown(adf) {
  if (!adf || !adf.content) return '';
  return adf.content.map(nodeToMarkdown).join('\n\n');
}

function nodeToMarkdown(node) {
  switch (node.type) {
    case 'paragraph':
      return inlineNodesToMd(node.content || []);
    case 'heading':
      return '#'.repeat(node.attrs?.level || 1) + ' ' + inlineNodesToMd(node.content || []);
    case 'bulletList':
      return (node.content || []).map((li) =>
        '- ' + (li.content || []).map(nodeToMarkdown).join('\n')
      ).join('\n');
    case 'orderedList':
      return (node.content || []).map((li, idx) =>
        `${idx + 1}. ` + (li.content || []).map(nodeToMarkdown).join('\n')
      ).join('\n');
    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      const text = (node.content || []).map((c) => c.text || '').join('');
      return '```' + lang + '\n' + text + '\n```';
    }
    case 'blockquote':
      return (node.content || []).map(nodeToMarkdown).map((l) => '> ' + l).join('\n');
    case 'rule':
      return '---';
    case 'table':
      return tableNodeToMd(node);
    case 'listItem':
      return (node.content || []).map(nodeToMarkdown).join('\n');
    default:
      return inlineNodesToMd(node.content || []);
  }
}

function tableNodeToMd(node) {
  const rows = (node.content || []).map((row) =>
    (row.content || []).map((cell) =>
      (cell.content || []).map(nodeToMarkdown).join(' ')
    )
  );
  if (rows.length === 0) return '';
  const header = '| ' + rows[0].join(' | ') + ' |';
  const sep = '| ' + rows[0].map(() => '---').join(' | ') + ' |';
  const body = rows.slice(1).map((r) => '| ' + r.join(' | ') + ' |').join('\n');
  return [header, sep, body].filter(Boolean).join('\n');
}

function inlineNodesToMd(nodes) {
  return (nodes || []).map((n) => {
    let text = n.text || '';
    if (n.marks) {
      for (const mark of n.marks) {
        if (mark.type === 'strong') text = `**${text}**`;
        if (mark.type === 'em') text = `*${text}*`;
        if (mark.type === 'code') text = '`' + text + '`';
        if (mark.type === 'link') text = `[${text}](${mark.attrs?.href || ''})`;
      }
    }
    return text;
  }).join('');
}

// Confluence storage format conversion now imported from confluence-format.mjs

// ---------------------------------------------------------------------------
// Document rebuilding
// ---------------------------------------------------------------------------

function rebuildDoc(frontmatter, hasFrontmatter, sections, preamble) {
  const parts = [];

  if (hasFrontmatter) {
    parts.push('---');
    for (const [key, val] of Object.entries(frontmatter)) {
      if (Array.isArray(val)) {
        if (val.length === 0) {
          parts.push(`${key}: []`);
        } else {
          parts.push(`${key}:`);
          for (const item of val) {
            parts.push(`  - ${typeof item === 'string' ? quoteYamlValue(item) : item}`);
          }
        }
      } else if (typeof val === 'string') {
        parts.push(`${key}: ${quoteYamlValue(val)}`);
      } else if (val === null) {
        parts.push(`${key}: null`);
      } else {
        parts.push(`${key}: ${val}`);
      }
    }
    parts.push('---');
    parts.push('');
  }

  if (preamble) {
    parts.push(preamble);
    parts.push('');
  }

  for (const s of sections) {
    parts.push('#'.repeat(s.level) + ' ' + s.title);
    if (s.content) {
      parts.push(s.content);
    }
    parts.push('');
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// ---------------------------------------------------------------------------
// Diff logic
// ---------------------------------------------------------------------------

function diffSections(localSections, remoteSections, stateHashes) {
  const diffs = [];

  const localHashes = computeSectionHashes(localSections);
  const remoteHashes = {};
  for (const s of remoteSections) {
    remoteHashes[s.title] = computeHash(s.content);
  }

  // All known section titles
  const allTitles = new Set([
    ...Object.keys(localHashes),
    ...Object.keys(remoteHashes),
    ...Object.keys(stateHashes || {}),
  ]);

  for (const title of allTitles) {
    const local = localHashes[title];
    const remote = remoteHashes[title];
    const synced = stateHashes?.[title];

    const localChanged = local !== synced;
    const remoteChanged = remote !== synced;

    let status;
    if (!local && remote) {
      status = remoteChanged ? 'added-remote' : 'remote-only';
    } else if (local && !remote) {
      status = localChanged ? 'added-local' : 'local-only';
    } else if (localChanged && remoteChanged) {
      status = 'conflict';
    } else if (localChanged) {
      status = 'local-changed';
    } else if (remoteChanged) {
      status = 'remote-changed';
    } else {
      status = 'unchanged';
    }

    diffs.push({
      title,
      status,
      localHash: local || null,
      remoteHash: remote || null,
      syncedHash: synced || null,
    });
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Shell out to jira.mjs / confluence.mjs
// ---------------------------------------------------------------------------

function runScript(scriptName, args) {
  const scriptPath = join(SCRIPT_DIR, scriptName);
  try {
    const result = execFileSync('node', [scriptPath, ...args], {
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(result);
  } catch (err) {
    console.error(`Error running ${scriptName}: ${err.stderr || err.message}`);
    process.exit(1);
  }
}

function jira(...args) { return runScript('jira.mjs', args); }
function confluence(...args) { return runScript('confluence.mjs', args); }

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

async function cmdStatus(positional, _flags) {
  const filePath = requirePositional(positional, 0, 'file');
  const absPath = resolve(filePath);

  if (!existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const content = readFileSync(absPath, 'utf8');
  const parsed = parseBmadDoc(content);
  const docType = detectDocType(parsed);
  const target = targetForDocType(docType);
  const link = findLink(parsed);
  const state = loadSyncState(absPath);
  const mapping = loadFieldMapping(docType);
  if (mapping?.instructions) {
    console.log(`\n📋 Mapping instructions for "${docType}":\n   ${mapping.instructions}\n`);
  }

  const result = {
    file: absPath,
    docType,
    target,
    linked: !!(link || state),
    linkId: link?.linkId || state?.linkId || null,
    hasFrontmatter: parsed.hasFrontmatter,
    hasMapping: !!mapping,
    sectionCount: parsed.sections.length,
  };

  if (state) {
    const currentHash = computeDocHash(content);
    result.localChanged = currentHash !== state.localHash;
    result.lastSyncedAt = state.lastSyncedAt;
    result.lastSyncDirection = state.lastSyncDirection;
  }

  console.log(JSON.stringify(result, null, 2));
}

async function cmdLink(positional, flags) {
  const filePath = requirePositional(positional, 0, 'file');
  const absPath = resolve(filePath);
  const content = readFileSync(absPath, 'utf8');
  const parsed = parseBmadDoc(content);
  const docType = flags.type || detectDocType(parsed);

  if (!docType) {
    console.error('Cannot detect document type. Use --type <epic|story|prd|architecture>');
    process.exit(1);
  }

  const target = targetForDocType(docType);
  let linkId;

  if (target === 'jira') {
    if (flags.ticket) {
      // Link to existing ticket
      linkId = flags.ticket;
    } else if (flags.project && flags.create) {
      // Create new ticket
      checkEnv();
      const h1 = parsed.sections.find((s) => s.level === 1);
      const summary = h1?.title || parsed.frontmatter?.title || basename(absPath, '.md');
      const issueType = docType === 'epic' ? 'Epic' : 'Story';

      // Build description from Overview section
      const overview = parsed.sections.find((s) => /^Overview$/i.test(s.title));
      const descArgs = ['create', '--project', flags.project, '--type', issueType, '--summary', summary];
      if (overview) {
        descArgs.push('--description', overview.content.trim());
      }

      const result = jira(...descArgs);
      linkId = result.key;
      console.error(`Created ${issueType}: ${linkId}`);

      // Create child stories for epics
      if (docType === 'epic') {
        const stories = extractStories(parsed.sections);
        const childLinks = [];
        for (const story of stories) {
          const storyArgs = ['create', '--project', flags.project, '--type', 'Story',
            '--summary', story.title, '--parent', linkId];
          if (story.content) {
            storyArgs.push('--description', story.content.trim());
          }
          const storyResult = jira(...storyArgs);
          console.error(`  Created Story: ${storyResult.key} — ${story.title}`);
          childLinks.push({
            bmadSectionId: story.id,
            remoteId: storyResult.key,
            localHash: computeHash(story.content),
            remoteHash: computeHash(story.content),
          });
        }
        // Save state with child links
        const docHash = computeDocHash(content);
        saveSyncState(absPath, {
          '$schema': 'sync-state-v1',
          localFilePath: absPath,
          docType,
          target,
          linkId,
          linkedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          lastSyncDirection: 'local-to-remote',
          localHash: docHash,
          remoteHash: docHash,
          childLinks,
          sectionHashes: computeSectionHashes(parsed.sections),
        });

        // Write link to doc
        addLinkToDoc(absPath, parsed, target, linkId);
        console.log(JSON.stringify({ linked: linkId, children: childLinks.map((c) => c.remoteId) }, null, 2));
        return;
      }
    } else {
      console.error('For Jira: use --ticket <KEY> or --project <KEY> --create');
      process.exit(1);
    }
  } else {
    // Confluence
    if (flags['page-id']) {
      linkId = flags['page-id'];
    } else if (flags.space && flags.create) {
      checkEnv();
      const h1 = parsed.sections.find((s) => s.level === 1);
      const title = h1?.title || parsed.frontmatter?.title || parsed.frontmatter?.project_name || basename(absPath, '.md');
      const body = markdownToStorage(parsed.sections.map((s) => '#'.repeat(s.level) + ' ' + s.title + '\n' + s.content).join('\n\n'));

      // Write body to temp file for large content
      const tmpFile = join(SYNC_STATE_DIR, '_tmp_body.html');
      ensureDir(SYNC_STATE_DIR);
      writeFileSync(tmpFile, body, 'utf8');

      const result = confluence('create-page', '--space', flags.space, '--title', title, '--body-file', tmpFile);
      linkId = result.id?.toString() || result.id;
      console.error(`Created Confluence page: ${linkId}`);

      // Cleanup temp file
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    } else {
      console.error('For Confluence: use --page-id <ID> or --space <KEY> --create');
      process.exit(1);
    }
  }

  // Save sync state
  const docHash = computeDocHash(content);
  saveSyncState(absPath, {
    '$schema': 'sync-state-v1',
    localFilePath: absPath,
    docType,
    target,
    linkId,
    linkedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    lastSyncDirection: 'local-to-remote',
    localHash: docHash,
    remoteHash: docHash,
    childLinks: [],
    sectionHashes: computeSectionHashes(parsed.sections),
  });

  // Write link to document
  addLinkToDoc(absPath, parsed, target, linkId);
  console.log(JSON.stringify({ linked: linkId, docType, target }, null, 2));
}

async function cmdPush(positional, _flags) {
  const filePath = requirePositional(positional, 0, 'file');
  const absPath = resolve(filePath);
  const content = readFileSync(absPath, 'utf8');
  const parsed = parseBmadDoc(content);
  const state = loadSyncState(absPath);

  if (!state) {
    console.error('Document is not linked. Run: sync.mjs link <file> first');
    process.exit(1);
  }

  checkEnv();
  const mapping = loadFieldMapping(state.docType);
  if (mapping?.instructions) {
    console.log(`\n📋 Mapping instructions for "${state.docType}":\n   ${mapping.instructions}\n`);
  }
  const results = [];

  if (state.target === 'jira') {
    // Push mapped fields to Jira
    if (mapping) {
      const editArgs = [state.linkId];
      const customFields = {};
      for (const fm of mapping.fieldMappings || []) {
        const value = extractBmadValue(parsed, fm);
        if (value === null) continue;
        if (fm.jiraFieldId === 'summary') {
          editArgs.push('--summary', value);
        } else if (fm.jiraFieldId === 'description') {
          editArgs.push('--description', value);
        } else if (fm.jiraFieldId.startsWith('customfield_')) {
          // Custom fields — build body for direct API call
          if (fm.transform === 'markdownToAdf') {
            customFields[fm.jiraFieldId] = markdownToAdf(value);
          } else {
            customFields[fm.jiraFieldId] = value;
          }
        }
      }
      if (editArgs.length > 1) {
        jira('edit', ...editArgs);
        results.push({ action: 'pushed', target: state.linkId, status: 'updated' });
      }
      // Push custom fields via direct API call
      if (Object.keys(customFields).length > 0) {
        await request(`${jiraBaseUrl()}/issue/${state.linkId}`, {
          method: 'PUT',
          body: { fields: customFields },
        });
        results.push({ action: 'pushed', target: state.linkId, fields: Object.keys(customFields), status: 'custom-fields-updated' });
      }
    } else {
      // Fallback: push summary + description
      const h1 = parsed.sections.find((s) => s.level === 1);
      const overview = parsed.sections.find((s) => /^Overview$/i.test(s.title));
      const editArgs = [state.linkId];
      if (h1) editArgs.push('--summary', h1.title);
      if (overview) editArgs.push('--description', overview.content.trim());
      if (editArgs.length > 1) {
        jira('edit', ...editArgs);
        results.push({ action: 'pushed', target: state.linkId, status: 'updated' });
      }
    }

    // Handle child stories for epics
    if (state.docType === 'epic') {
      const stories = extractStories(parsed.sections);
      const existingLinks = state.childLinks || [];

      for (const story of stories) {
        const existing = existingLinks.find((cl) => cl.bmadSectionId === story.id);
        const storyHash = computeHash(story.content);

        if (existing) {
          if (storyHash !== existing.localHash) {
            // Story changed, update ticket
            jira('edit', existing.remoteId, '--summary', story.title, '--description', story.content.trim());
            existing.localHash = storyHash;
            existing.remoteHash = storyHash;
            results.push({ action: 'pushed', target: existing.remoteId, section: story.id, status: 'updated' });
          }
        } else {
          // New story, create ticket
          const projectKey = mapping?.projectKey || state.linkId.replace(/-\d+$/, '');
          const storyResult = jira('create', '--project', projectKey, '--type', 'Story',
            '--summary', story.title, '--parent', state.linkId,
            '--description', story.content.trim());
          existingLinks.push({
            bmadSectionId: story.id,
            remoteId: storyResult.key,
            localHash: storyHash,
            remoteHash: storyHash,
          });
          results.push({ action: 'pushed', target: storyResult.key, section: story.id, status: 'created' });
        }
      }

      // Detect orphaned stories (section removed from local doc but ticket exists in Jira)
      const currentIds = stories.map((s) => s.id);
      const orphaned = existingLinks.filter((cl) => !currentIds.includes(cl.bmadSectionId));
      if (orphaned.length > 0 && _flags['delete-orphans']) {
        console.log(`\n⚠️  Found ${orphaned.length} orphaned subtask(s) — section removed from local doc but Jira ticket still exists:`);
        for (const o of orphaned) {
          console.log(`   - ${o.remoteId} (section: "${o.bmadSectionId}")`);
        }
        for (const o of orphaned) {
          // Safety check: only allow deletion of Sub-* issue types
          let issueTypeName = '';
          try {
            const issueData = jira('get', o.remoteId, '--fields', 'issuetype');
            issueTypeName = issueData?.fields?.issuetype?.name || '';
          } catch { /* ignore — will block deletion */ }

          if (!issueTypeName.startsWith('Sub-')) {
            console.log(`   ⊘ Skipping ${o.remoteId} — issue type "${issueTypeName}" is not a Sub-* type (deletion restricted to subtasks only)`);
            o.orphaned = true;
            results.push({ action: 'orphaned', target: o.remoteId, section: o.bmadSectionId, status: 'not-subtask-skipped' });
            continue;
          }

          const confirmed = await askConfirmation(`\n   Delete ${o.remoteId} [${issueTypeName}] ("${o.bmadSectionId}") from Jira? (y/N): `);
          if (confirmed) {
            try {
              await deleteIssue(o.remoteId);
              // Remove from childLinks
              const idx = existingLinks.indexOf(o);
              if (idx !== -1) existingLinks.splice(idx, 1);
              results.push({ action: 'deleted', target: o.remoteId, section: o.bmadSectionId, status: 'deleted' });
            } catch (err) {
              console.error(`   ✗ ${err.message}`);
              o.orphaned = true;
              results.push({ action: 'orphaned', target: o.remoteId, section: o.bmadSectionId, status: 'delete-failed' });
            }
          } else {
            o.orphaned = true;
            results.push({ action: 'orphaned', target: o.remoteId, section: o.bmadSectionId, status: 'kept' });
          }
        }
      } else {
        for (const o of orphaned) {
          results.push({ action: 'orphaned', target: o.remoteId, section: o.bmadSectionId, status: 'needs-user-decision' });
        }
      }

      state.childLinks = existingLinks;
    }
  } else {
    // Confluence push
    const h1 = parsed.sections.find((s) => s.level === 1);
    const title = h1?.title || parsed.frontmatter?.title || parsed.frontmatter?.project_name || '';
    const body = markdownToStorage(parsed.sections.map((s) => '#'.repeat(s.level) + ' ' + s.title + '\n' + s.content).join('\n\n'));

    const tmpFile = join(SYNC_STATE_DIR, '_tmp_body.html');
    ensureDir(SYNC_STATE_DIR);
    writeFileSync(tmpFile, body, 'utf8');

    confluence('update-page', state.linkId, '--title', title, '--body-file', tmpFile);
    results.push({ action: 'pushed', target: `page:${state.linkId}`, status: 'updated' });

    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  // Update sync state
  const newHash = computeDocHash(content);
  state.localHash = newHash;
  state.remoteHash = newHash;
  state.lastSyncedAt = new Date().toISOString();
  state.lastSyncDirection = 'local-to-remote';
  state.sectionHashes = computeSectionHashes(parsed.sections);
  saveSyncState(absPath, state);

  console.log(JSON.stringify({ results }, null, 2));
}

async function cmdPull(positional, _flags) {
  const filePath = requirePositional(positional, 0, 'file');
  const absPath = resolve(filePath);
  const content = readFileSync(absPath, 'utf8');
  const parsed = parseBmadDoc(content);
  const state = loadSyncState(absPath);

  if (!state) {
    console.error('Document is not linked. Run: sync.mjs link <file> first');
    process.exit(1);
  }

  checkEnv();
  const results = [];

  if (state.target === 'jira') {
    // Fetch remote issue
    const issue = jira('get', state.linkId);
    const remoteTitle = issue.fields?.summary || '';
    const remoteDesc = issue.fields?.description ? adfToMarkdown(issue.fields.description) : '';

    // Update local sections
    const h1 = parsed.sections.find((s) => s.level === 1);
    if (h1 && remoteTitle && h1.title !== remoteTitle) {
      // Preserve link prefix
      const linkPrefix = h1.title.match(/^\[.+?\]\s*/)?.[0] || '';
      h1.title = linkPrefix + remoteTitle;
      results.push({ action: 'pulled', field: 'title', status: 'updated' });
    }

    const overview = parsed.sections.find((s) => /^Overview$/i.test(s.title));
    if (overview && remoteDesc) {
      overview.content = remoteDesc;
      results.push({ action: 'pulled', field: 'description', status: 'updated' });
    }

    // Handle child stories for epics
    if (state.docType === 'epic') {
      const children = jira('search', `parent = ${state.linkId}`, '--max', '50');
      const childIssues = children.issues || [];
      const existingLinks = state.childLinks || [];

      for (const child of childIssues) {
        const existing = existingLinks.find((cl) => cl.remoteId === child.key);
        if (existing) {
          // Match section by bmadSectionId (which is the full heading like "Story 1.1: Title")
          const storySection = parsed.sections.find((s) => s.title === existing.bmadSectionId);
          if (storySection) {
            // Fetch full child ticket content for comparison
            const fullChild = jira('get', child.key);
            const remoteDesc = fullChild.fields?.description ? adfToMarkdown(fullChild.fields.description) : '';
            const remoteHash = computeHash(remoteDesc);
            if (remoteHash !== existing.remoteHash) {
              storySection.content = remoteDesc;
              storySection.title = `Story ${existing.bmadSectionId.match(/(\d+\.\d+)/)?.[1] || ''}: ${fullChild.fields?.summary || child.summary}`;
              existing.remoteHash = remoteHash;
              existing.localHash = remoteHash;
              results.push({ action: 'pulled', section: existing.bmadSectionId, target: child.key, status: 'updated' });
            } else {
              results.push({ action: 'pulled', section: existing.bmadSectionId, target: child.key, status: 'unchanged' });
            }
          }
        } else {
          // New remote child — append section
          const storyNum = existingLinks.length + 1;
          const epicNum = parsed.sections.find((s) => /^Epic\s+\d+:/i.test(s.title))?.title.match(/Epic\s+(\d+):/)?.[1] || '1';
          const newSection = {
            level: 3,
            title: `Story ${epicNum}.${storyNum}: ${child.summary}`,
            content: child.status ? `Status: ${child.status}\n` : '',
          };
          parsed.sections.push(newSection);
          existingLinks.push({
            bmadSectionId: `Story ${epicNum}.${storyNum}: ${child.summary}`,
            remoteId: child.key,
            localHash: computeHash(newSection.content),
            remoteHash: computeHash(newSection.content),
          });
          results.push({ action: 'pulled', section: newSection.title, target: child.key, status: 'added' });
        }
      }

      state.childLinks = existingLinks;
    }

    // Rebuild and write document
    const newContent = rebuildDoc(parsed.frontmatter, parsed.hasFrontmatter, parsed.sections, parsed.preamble);
    writeFileSync(absPath, newContent, 'utf8');
  } else {
    // Confluence pull
    const page = confluence('get-page', state.linkId);
    const remoteBody = page.body?.storage?.value || page.body?.view?.value || '';
    const remoteMd = storageToMarkdown(remoteBody);

    // Parse remote content as sections
    const remoteParsed = parseBmadDoc(remoteMd);

    // Update local sections from remote
    for (const remoteSection of remoteParsed.sections) {
      const localSection = parsed.sections.find((s) => s.title === remoteSection.title);
      if (localSection) {
        localSection.content = remoteSection.content;
        results.push({ action: 'pulled', section: remoteSection.title, status: 'updated' });
      } else {
        parsed.sections.push(remoteSection);
        results.push({ action: 'pulled', section: remoteSection.title, status: 'added' });
      }
    }

    const newContent = rebuildDoc(parsed.frontmatter, parsed.hasFrontmatter, parsed.sections, parsed.preamble);
    writeFileSync(absPath, newContent, 'utf8');
  }

  // Update sync state
  const updatedContent = readFileSync(absPath, 'utf8');
  const updatedParsed = parseBmadDoc(updatedContent);
  state.localHash = computeDocHash(updatedContent);
  state.remoteHash = state.localHash;
  state.lastSyncedAt = new Date().toISOString();
  state.lastSyncDirection = 'remote-to-local';
  state.sectionHashes = computeSectionHashes(updatedParsed.sections);
  saveSyncState(absPath, state);

  console.log(JSON.stringify({ results }, null, 2));
}

async function cmdDiff(positional, _flags) {
  const filePath = requirePositional(positional, 0, 'file');
  const absPath = resolve(filePath);
  const content = readFileSync(absPath, 'utf8');
  const parsed = parseBmadDoc(content);
  const state = loadSyncState(absPath);

  if (!state) {
    console.error('Document is not linked. Run: sync.mjs link <file> first');
    process.exit(1);
  }

  checkEnv();

  // Get remote content
  let remoteSections = [];
  if (state.target === 'jira') {
    const issue = jira('get', state.linkId);
    const desc = issue.fields?.description ? adfToMarkdown(issue.fields.description) : '';
    const remoteParsed = parseBmadDoc(desc);
    remoteSections = remoteParsed.sections;

    // Add summary as a virtual section
    remoteSections.unshift({
      title: parsed.sections.find((s) => s.level === 1)?.title || 'Title',
      content: issue.fields?.summary || '',
    });
  } else {
    const page = confluence('get-page', state.linkId);
    const body = page.body?.storage?.value || page.body?.view?.value || '';
    const remoteParsed = parseBmadDoc(storageToMarkdown(body));
    remoteSections = remoteParsed.sections;
  }

  const diffs = diffSections(parsed.sections, remoteSections, state.sectionHashes);

  // Format output
  const output = diffs.map((d) => {
    let indicator;
    switch (d.status) {
      case 'local-changed': indicator = '→'; break;
      case 'remote-changed': indicator = '←'; break;
      case 'conflict': indicator = '⚡'; break;
      case 'added-local': indicator = '+ local'; break;
      case 'added-remote': indicator = '+ remote'; break;
      case 'unchanged': indicator = '='; break;
      default: indicator = '?';
    }
    return { section: d.title, status: d.status, indicator };
  });

  console.log(JSON.stringify({ diffs: output }, null, 2));
}

async function cmdSetupMapping(_positional, flags) {
  const docType = flags.type;
  const sample = flags.sample;

  if (!docType) {
    console.error('Required: --type <epic|story|prd|architecture>');
    process.exit(1);
  }
  if (!sample) {
    console.error('Required: --sample <TICKET-KEY or PAGE-ID>');
    process.exit(1);
  }

  checkEnv();
  const target = targetForDocType(docType);

  if (target === 'jira') {
    const issue = jira('get', sample);
    const fields = Object.keys(issue.fields || {});
    const fieldDetails = fields.map((f) => {
      const val = issue.fields[f];
      const type = val === null ? 'null' : Array.isArray(val) ? 'array' : typeof val === 'object' ? 'object' : typeof val;
      return { id: f, value: val, type };
    });

    // Auto-detect common fields
    const mapping = {
      '$schema': 'field-mapping-v1',
      docType,
      projectKey: issue.fields?.project?.key || sample.replace(/-\d+$/, ''),
      issueType: issue.fields?.issuetype?.name || (docType === 'epic' ? 'Epic' : 'Story'),
      sampleTicket: sample,
      createdAt: new Date().toISOString(),
      instructions: '',
      fieldMappings: [],
    };

    // Map well-known fields
    const wellKnown = {
      summary: { bmadSource: 'title', jiraFieldType: 'string', transform: 'direct' },
      description: { bmadSource: 'section', bmadSectionHeading: 'Overview', jiraFieldType: 'adf', transform: 'markdownToAdf' },
    };

    for (const [fieldId, config] of Object.entries(wellKnown)) {
      if (fields.includes(fieldId)) {
        mapping.fieldMappings.push({
          bmadSource: config.bmadSource,
          bmadSectionHeading: config.bmadSectionHeading || null,
          jiraField: fieldId.charAt(0).toUpperCase() + fieldId.slice(1),
          jiraFieldId: fieldId,
          jiraFieldType: config.jiraFieldType,
          transform: config.transform,
        });
      }
    }

    // Detect custom fields
    const customFields = fieldDetails.filter((f) => f.id.startsWith('customfield_') && f.value !== null);
    for (const cf of customFields) {
      mapping.fieldMappings.push({
        bmadSource: 'section',
        bmadSectionHeading: '?',
        jiraField: cf.id,
        jiraFieldId: cf.id,
        jiraFieldType: cf.type === 'object' ? 'adf' : 'string',
        transform: 'direct',
        _detectedValue: typeof cf.value === 'object' ? JSON.stringify(cf.value).slice(0, 100) : String(cf.value).slice(0, 100),
        _needsReview: true,
      });
    }

    // Add child mapping for epics
    if (docType === 'epic') {
      mapping.childMapping = {
        enabled: true,
        sectionPattern: '^### Story (\\\\d+\\\\.\\\\d+): (.+)',
        issueType: 'Story',
        parentLinkField: 'parent',
        fieldMappings: [
          { bmadSource: 'storyTitle', jiraField: 'Summary', jiraFieldId: 'summary', transform: 'direct' },
          { bmadSource: 'storyBody', jiraField: 'Description', jiraFieldId: 'description', jiraFieldType: 'adf', transform: 'markdownToAdf' },
        ],
      };
    }

    // Output for agent review
    console.log(JSON.stringify(mapping, null, 2));

  } else {
    // Confluence
    const page = confluence('get-page', sample);
    const mapping = {
      '$schema': 'field-mapping-v1',
      docType,
      spaceKey: page.spaceId || '',
      samplePageId: sample,
      createdAt: new Date().toISOString(),
      instructions: '',
      titleSource: 'frontmatter.title',
      titleFallback: 'heading.1',
      bodyTransform: 'markdownToStorage',
      sectionMappings: [],
      frontmatterAsMetadata: {},
    };

    // Parse remote page to discover sections
    const body = page.body?.storage?.value || page.body?.view?.value || '';
    const remoteParsed = parseBmadDoc(storageToMarkdown(body));
    for (const s of remoteParsed.sections) {
      mapping.sectionMappings.push({
        bmadSectionHeading: s.title,
        confluenceHeading: s.title,
        includeSubsections: true,
      });
    }

    console.log(JSON.stringify(mapping, null, 2));
  }
}

async function cmdInitBatch(_positional, flags) {
  const configPath = flags.config || join(MEMORY_DIR, 'batch-sync-config.json');

  // Try to find BMAD config
  let projectRoot = process.cwd();
  // Walk up to find _bmad/bmm/config.yaml
  let searchDir = projectRoot;
  let bmadConfig = null;
  for (let depth = 0; depth < 10; depth++) {
    const candidate = join(searchDir, '_bmad', 'bmm', 'config.yaml');
    if (existsSync(candidate)) {
      bmadConfig = parseSimpleYaml(readFileSync(candidate, 'utf8'));
      projectRoot = searchDir;
      break;
    }
    const parent = dirname(searchDir);
    if (parent === searchDir) break;
    searchDir = parent;
  }

  const scanPaths = [];

  if (bmadConfig) {
    const planningDir = (bmadConfig.planning_artifacts || '').replace('{project-root}', projectRoot);
    const implDir = (bmadConfig.implementation_artifacts || '').replace('{project-root}', projectRoot);

    // Make paths relative to project root
    const relPlanning = planningDir.replace(projectRoot + '/', '');
    const relImpl = implDir.replace(projectRoot + '/', '');

    if (planningDir && existsSync(planningDir)) {
      // Scan for subdirectories to determine doc types
      const subdirs = readdirSync(planningDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const sub of subdirs) {
        let docType = null;
        let target = null;
        if (/epic/i.test(sub)) { docType = 'epic'; target = 'jira'; }
        else if (/prd/i.test(sub)) { docType = 'prd'; target = 'confluence'; }
        else if (/architect/i.test(sub)) { docType = 'architecture'; target = 'confluence'; }
        else if (/research/i.test(sub)) continue; // skip research docs

        if (docType) {
          scanPaths.push({
            glob: `${relPlanning}/${sub}/**/*.md`,
            docType,
            target,
          });
        }
      }
    }

    if (implDir && existsSync(implDir)) {
      scanPaths.push({
        glob: `${relImpl}/**/*.md`,
        docType: 'story',
        target: 'jira',
      });
    }
  }

  // If no BMAD config found, create minimal config
  if (scanPaths.length === 0) {
    scanPaths.push(
      { glob: 'docs/epics/**/*.md', docType: 'epic', target: 'jira' },
      { glob: 'docs/specs/**/*.md', docType: 'story', target: 'jira' },
    );
  }

  const batchConfig = {
    bmadConfigPath: bmadConfig ? '_bmad/bmm/config.yaml' : null,
    projectRoot,
    scanPaths,
  };

  ensureDir(dirname(configPath));
  writeFileSync(configPath, JSON.stringify(batchConfig, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(batchConfig, null, 2));
}

async function cmdBatch(_positional, flags) {
  const configPath = flags.config || join(MEMORY_DIR, 'batch-sync-config.json');

  if (!existsSync(configPath)) {
    console.error(`Batch config not found: ${configPath}\nRun: sync.mjs init-batch`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const results = [];

  for (const scan of config.scanPaths || []) {
    const searchDir = resolve(config.projectRoot, dirname(scan.glob));
    if (!existsSync(searchDir)) continue;

    // Simple recursive file discovery
    const files = findFiles(searchDir, '.md');
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const parsed = parseBmadDoc(content);
      const docType = detectDocType(parsed) || scan.docType;
      const link = findLink(parsed);
      const state = loadSyncState(file);

      const entry = {
        file: file.replace(config.projectRoot + '/', ''),
        docType,
        linked: !!(link || state),
        linkId: link?.linkId || state?.linkId || null,
      };

      if (state) {
        const currentHash = computeDocHash(content);
        entry.localChanged = currentHash !== state.localHash;
      }

      results.push(entry);
    }
  }

  console.log(JSON.stringify({ files: results }, null, 2));
}

function findFiles(dir, ext) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFiles(fullPath, ext));
      } else if (entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

// ---------------------------------------------------------------------------
// Extract value from BMAD doc based on field mapping
// ---------------------------------------------------------------------------

function extractBmadValue(parsed, fieldMapping) {
  const { bmadSource, bmadSectionHeading } = fieldMapping;

  if (bmadSource === 'title') {
    const h1 = parsed.sections.find((s) => s.level === 1);
    return h1?.title || null;
  }

  if (bmadSource?.startsWith('frontmatter.')) {
    const key = bmadSource.replace('frontmatter.', '');
    return parsed.frontmatter[key] || null;
  }

  if (bmadSource === 'section' && bmadSectionHeading) {
    const section = parsed.sections.find((s) => s.title === bmadSectionHeading);
    return section?.content?.trim() || null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`Usage: sync.mjs <command> [args] [--flags]

Commands:
  status <file>                                Show sync status for a document
  link <file> --type T --ticket KEY            Link to existing Jira ticket
  link <file> --type T --project P --create    Create new Jira ticket and link
  link <file> --type T --page-id ID            Link to existing Confluence page
  link <file> --type T --space S --create      Create new Confluence page and link
  push <file> [--delete-orphans]               Push local changes to remote
  pull <file>                                  Pull remote changes to local
  diff <file>                                  Show per-section diff
  setup-mapping --type T --sample KEY          Setup field mapping from sample
  init-batch [--config path]                   Generate batch config from BMAD config
  batch [--config path]                        Scan and report batch sync status

Document types (--type): epic, story, prd, architecture

Environment variables (required for remote operations):
  ATLASSIAN_EMAIL      Your Atlassian account email
  ATLASSIAN_API_TOKEN  API token
  ATLASSIAN_DOMAIN     e.g. yoursite.atlassian.net`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const COMMANDS = {
  status: cmdStatus,
  link: cmdLink,
  push: cmdPush,
  pull: cmdPull,
  diff: cmdDiff,
  'setup-mapping': cmdSetupMapping,
  'init-batch': cmdInitBatch,
  batch: cmdBatch,
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

  const { positional, flags } = parseArgs(args.slice(1));
  await handler(positional, flags);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
