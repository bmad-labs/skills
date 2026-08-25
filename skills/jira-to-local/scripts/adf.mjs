#!/usr/bin/env node
/**
 * adf.mjs — Atlassian Document Format to markdown.
 *
 * The conversion is mechanical: it cannot tell a heading from a bold line, and it
 * copies unfilled Jira template text verbatim. That is why every fetched file
 * gets a formatting pass afterwards. What this module guarantees is that no
 * content is lost or invented on the way through.
 */

/**
 * A paragraph opening with a bolded Given-When-Then keyword.
 *
 * Matched on the rendered markdown rather than the ADF, so it catches the keyword
 * however the author bolded it. The trailing boundary keeps `**GIVEN**` from also
 * matching a word that merely starts with it.
 */
const GWT_CLAUSE = /^\*\*(GIVEN|WHEN|THEN|AND|BUT)\s*\*\*/;

/**
 * Put the blank line back after the last item of a Given-When-Then run.
 *
 * Each clause is emitted with a single trailing newline so consecutive clauses form
 * one list. That leaves whatever follows the run — an image, a table, a paragraph —
 * glued to the final item, which MD032 catches from the other side. Done here
 * rather than per paragraph because only the assembled document shows where a run
 * ends.
 */
function closeGwtRuns(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    out.push(line);
    const isClause = /^- \*\*(GIVEN|WHEN|THEN|AND|BUT)\s*\*\*/.test(line);
    if (!isClause) return;
    const next = lines[i + 1];
    if (next === undefined) return;
    // A following clause continues the list; anything else needs the blank line.
    if (next.trim() !== '' && !/^- \*\*(GIVEN|WHEN|THEN|AND|BUT)\s*\*\*/.test(next)) {
      out.push('');
    }
  });
  return out.join('\n');
}

/**
 * Convert an ADF document to markdown.
 *
 * `mediaResolver` maps an ADF media node's attrs to a local image path, and
 * returns null when the media has no downloaded file — the caller then writes a
 * placeholder naming the attachment rather than a broken image link.
 */
export function adfToMarkdown(node, mediaResolver, depth = 0) {
  if (!node) return '';
  if (Array.isArray(node)) return node.map((n) => adfToMarkdown(n, mediaResolver, depth)).join('');

  const kids = (d = depth) => adfToMarkdown(node.content || [], mediaResolver, d);

  switch (node.type) {
    case 'doc':
      return closeGwtRuns(kids());
    case 'paragraph': {
      const body = kids();
      if (!body.trim()) return '';
      // A Given-When-Then clause becomes a list item, because that is the only way
      // it renders as its own line. Jira's authors write each clause as a separate
      // paragraph, and markdown folds consecutive lines into one paragraph, so
      // emitting them as written produces a wall of text — the defect the
      // gwt-not-list rule catches. Only the top level: inside a list the item
      // marker is already there.
      if (depth === 0 && GWT_CLAUSE.test(body.trimStart())) {
        // One newline, so consecutive clauses form one list. The blank line that
        // has to follow the last one is added by closeGwtRuns, which can see where
        // the run ends and a single paragraph cannot.
        return `- ${body.trim()}\n`;
      }
      return body + '\n\n';
    }
    case 'text': {
      let t = node.text || '';
      for (const m of node.marks || []) {
        if (m.type === 'strong') t = `**${t}**`;
        else if (m.type === 'em') t = `*${t}*`;
        else if (m.type === 'code') t = `\`${t}\``;
        else if (m.type === 'strike') t = `~~${t}~~`;
        else if (m.type === 'link') t = `[${t}](${m.attrs?.href || ''})`;
      }
      return t;
    }
    case 'heading':
      return `${'#'.repeat(node.attrs?.level || 1)} ${kids().trim()}\n\n`;
    case 'hardBreak':
      return '\n';
    case 'rule':
      return '---\n\n';
    case 'bulletList':
    case 'orderedList':
      return kids() + (depth === 0 ? '\n' : '');
    case 'listItem': {
      const body = kids(depth + 1).trim().replace(/\n/g, '\n' + '  '.repeat(depth + 1));
      return '  '.repeat(depth) + '- ' + body + '\n';
    }
    case 'codeBlock':
      return '```' + (node.attrs?.language || '') + '\n' + kids().trim() + '\n```\n\n';
    case 'blockquote':
    case 'panel':
      return kids().trim().split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
    case 'table':
      return renderTable(node, mediaResolver) + '\n';
    case 'mediaSingle':
    case 'mediaGroup':
      return kids();
    case 'media':
    case 'mediaInline': {
      const resolved = mediaResolver ? mediaResolver(node.attrs || {}) : null;
      // A comment's media node often carries no alt at all, so the file's own
      // name is the only label there is. Falling back to the word "attachment"
      // gave the reader a link named after nothing.
      const filename = resolved ? resolved.split('/').pop() : '';
      const alt = node.attrs?.alt || filename || 'attachment';
      // The placeholder means the media has no downloaded file — a skipped video,
      // say — not that the conversion failed.
      if (resolved) {
        // Image syntax on a PDF or a spreadsheet renders as a broken image, so
        // only an image is embedded; everything else is a link to the local copy.
        const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(resolved);
        return isImage ? `![${alt}](${resolved})\n\n` : `[${alt}](${resolved})\n\n`;
      }
      return `_[attachment: ${alt}]_\n\n`;
    }
    case 'inlineCard':
      return `<${node.attrs?.url || ''}>`;
    case 'mention':
      return `@${node.attrs?.text?.replace(/^@/, '') || 'user'}`;
    case 'emoji':
      return node.attrs?.text || node.attrs?.shortName || '';
    case 'status':
      return `\`${node.attrs?.text || ''}\``;
    case 'date':
      return node.attrs?.timestamp
        ? new Date(Number(node.attrs.timestamp)).toISOString().slice(0, 10)
        : '';
    default:
      // An unknown node still yields its children, so new ADF node types lose
      // their wrapper rather than their content.
      return kids();
  }
}

/**
 * Render an ADF table as a markdown table. Cell content is flattened to one line
 * and pipes are escaped, because a newline or a bare pipe inside a cell breaks
 * the table for every reader.
 */
function renderTable(tableNode, mediaResolver) {
  const rows = (tableNode.content || []).filter((r) => r.type === 'tableRow');
  if (!rows.length) return '';

  const cellText = (cell) =>
    adfToMarkdown(cell.content || [], mediaResolver)
      .replace(/\n+/g, ' ')
      .replace(/\|/g, '\\|')
      .trim();

  const out = [];
  rows.forEach((row, idx) => {
    const cells = (row.content || []).map(cellText);
    out.push('| ' + cells.join(' | ') + ' |');
    if (idx === 0) out.push('| ' + cells.map(() => '---').join(' | ') + ' |');
  });
  return out.join('\n') + '\n';
}

/** Every text run in an ADF document, joined. Used for previews and plain text. */
export function adfToPlainText(node) {
  const parts = [];
  const walk = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.text) parts.push(n.text);
    if (n.content) walk(n.content);
  };
  walk(node);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Render any Jira field value as markdown, or null when it carries nothing.
 * Returning null rather than an empty string lets the caller distinguish a field
 * with no value from one whose value is blank.
 */
export function renderValue(val, mediaResolver) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);

  if (Array.isArray(val)) {
    const parts = val.map((v) => renderValue(v, mediaResolver)).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }

  if (typeof val === 'object') {
    if (val.type === 'doc') {
      const md = adfToMarkdown(val, mediaResolver).trim();
      return md || null;
    }
    return val.displayName || val.name || val.value || val.key || null;
  }

  return null;
}

/**
 * The Development field is a Java toString dump with the real payload embedded as
 * `json={...}`. Brace-match that fragment and parse only it.
 *
 * The field answers two different questions, so it is split into two: what code
 * exists for this issue, and where that code has shipped.
 */
export function parseDevelopment(raw) {
  if (typeof raw !== 'string' || !raw.includes('json=')) return null;

  const start = raw.indexOf('json=') + 'json='.length;
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) return null;

  let summary;
  try {
    summary = JSON.parse(raw.slice(start, end))?.cachedValue?.summary;
  } catch {
    return null;
  }
  if (!summary) return null;

  const git = [];
  const pr = summary.pullrequest?.overall;
  if (pr?.count) git.push(`${pr.count} pull request(s), state ${pr.state}`);
  const build = summary.build?.overall;
  if (build?.count) {
    git.push(`${build.count} build(s): ${build.successfulBuildCount} passed, ${build.failedBuildCount} failed`);
  }

  const deployments = [];
  for (const envInfo of summary['deployment-environment']?.overall?.topEnvironments || []) {
    deployments.push(`${envInfo.title} (${envInfo.status})`);
  }

  return {
    git: git.length ? git.join('; ') : null,
    // An array, because a story deploys to several environments and a joined
    // string forces every reader to split it back apart.
    deployments,
  };
}

/** Jira's own duration format. Its working day is 8 hours, not 24. */
export function formatSeconds(secs) {
  if (!secs || !Number.isFinite(secs)) return '';
  const d = Math.floor(secs / 28800);
  const h = Math.floor((secs % 28800) / 3600);
  const m = Math.round((secs % 3600) / 60);
  return [d ? `${d}d` : '', h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ') || '0m';
}

/** Collapse a value into one table cell: no newlines, no unescaped pipes. */
export function cell(text) {
  if (text === null || text === undefined || text === '') return '—';
  return String(text).replace(/\s*\n+\s*/g, ' ').replace(/\|/g, '\\|').trim() || '—';
}
