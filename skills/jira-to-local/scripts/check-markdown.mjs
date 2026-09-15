#!/usr/bin/env node
/**
 * check-markdown.mjs — Check a fetched ticket document against the formatting
 * checklist in SKILL.md.
 *
 * Run it after the cleanup pass. Every finding is a rendering or readability
 * defect that the ADF conversion leaves behind, and each one names the rule it
 * comes from so the fix is unambiguous.
 *
 * Usage: check-markdown.mjs <file.md> [more.md ...]
 * Exit code 0 when clean, 1 when any finding is reported.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Index every line that sits inside a fenced code block, so checks skip them. */
function fencedLines(lines) {
  const inFence = new Set();
  let open = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { open = !open; inFence.add(i); return; }
    if (open) inFence.add(i);
  });
  return inFence;
}

function checkFile(path) {
  const src = readFileSync(path, 'utf8');
  const lines = src.split('\n');
  const fenced = fencedLines(lines);
  const findings = [];
  const add = (line, rule, msg) => findings.push({ line: line + 1, rule, msg });

  let prevLevel = 0;
  let inFrontmatter = lines[0] === '---';

  lines.forEach((line, i) => {
    if (inFrontmatter) {
      if (i > 0 && line === '---') inFrontmatter = false;
      return;
    }
    if (fenced.has(i)) return;

    // CommonMark: a closing ** must be right-flanking, so it cannot be preceded
    // by whitespace. "**GIVEN **text" never closes and renders literal
    // asterisks. Walk the delimiters in pairs — testing every `**...**` span
    // would also match the gap between two valid pairs and report it wrongly.
    const delims = [...line.matchAll(/\*\*/g)].map((m) => m.index);
    for (let d = 0; d + 1 < delims.length; d += 2) {
      const inner = line.slice(delims[d] + 2, delims[d + 1]);
      if (inner.length && /[ \t]$/.test(inner)) {
        add(i, 'emphasis', `space before the closing ** renders literal asterisks: **${inner.trim().slice(0, 30)} **`);
      }
      // The mirror defect: an opening ** must be left-flanking, so whitespace
      // straight after it never opens. "now** in Production**" renders the
      // asterisks literally, and walking pairs makes `inner` end in a word, so
      // the closing-space test above cannot see it.
      if (inner.length && /^[ \t]/.test(inner)) {
        add(i, 'emphasis', `space after the opening ** renders literal asterisks: ** ${inner.trim().slice(0, 30)}**`);
      }
    }

    // MD001: heading levels increment by one.
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) {
      const level = h[1].length;
      if (prevLevel && level > prevLevel + 1) {
        add(i, 'MD001', `heading jumps from h${prevLevel} to h${level}`);
      }
      prevLevel = level;
      if (/^\*\*.*\*\*$/.test(h[2].trim())) add(i, 'heading-bold', 'bold markers inside a heading are redundant');
      if (/[:.]$/.test(h[2].trim())) add(i, 'heading-punct', 'heading ends with punctuation');
    }

    // MD012: no runs of blank lines.
    if (line === '' && lines[i - 1] === '' && lines[i - 2] === '') {
      add(i, 'MD012', 'more than one consecutive blank line');
    }

    // A table row whose every cell is empty carries nothing.
    if (/^\s*\|(\s*\|)+\s*$/.test(line)) add(i, 'empty-row', 'table row has no content');

    // Unfilled Jira template text describes no ticket.
    if (/<Insert[^>]*>|_{5,}/.test(line)) add(i, 'boilerplate', 'unfilled Jira template placeholder');

    // Jira auto-linkifies field names that look like hostnames.
    for (const m of line.matchAll(/\[([^\]]+)\]\(https?:\/\/([^)]+)\)/g)) {
      const [, text, url] = m;
      if (url.replace(/^www\./, '') === text.replace(/^www\./, '')) {
        add(i, 'bogus-link', `link text equals a non-URL target, likely auto-linkified: ${text}`);
      }
    }

    // MD034: a bare URL should be a link or code.
    if (/(^|\s)https?:\/\/\S+/.test(line) && !/\]\(|<https?:/.test(line)) {
      add(i, 'MD034', 'bare URL should be a labelled link');
    }

    // A long statement in inline code belongs in a fenced block.
    //
    // Spans are taken in pairs from the left, so the text BETWEEN two spans is
    // never measured. Scanning for any run of 60 non-backtick characters between
    // backticks reported `a` … prose … `b` as one long span, and the only way to
    // silence it was to unmark one of two real code identifiers.
    const spans = line.split('`');
    for (let s = 1; s < spans.length; s += 2) {
      if (spans[s].length >= 60) {
        add(i, 'inline-code', `${spans[s].length}-char statement in inline code belongs in a fenced block`);
      }
    }

    // WCAG 1.1.1: an image needs alt text that says what it shows.
    for (const m of line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      const [, alt, target] = m;
      if (!alt.trim()) add(i, 'WCAG-1.1.1', 'image has no alt text');
      else if (/^(image|screenshot)[-_ ]?\d{6,}|\.(png|jpe?g|gif|svg)$/i.test(alt.trim())) {
        add(i, 'WCAG-1.1.1', `alt text is a filename, not a description: ${alt}`);
      }
      if (!/^https?:/.test(target)) {
        const abs = join(dirname(path), target);
        if (!existsSync(abs)) add(i, 'broken-image', `image file not found: ${target}`);
      }
    }

    // WCAG 2.4.4: link text must describe its destination.
    for (const m of line.matchAll(/\[([^\]]+)\]\([^)]+\)/g)) {
      if (/^(here|click here|link|this|read more)$/i.test(m[1].trim())) {
        add(i, 'WCAG-2.4.4', `link text "${m[1]}" does not describe its target`);
      }
    }

    // A doubled list marker renders as a stray bullet character.
    if (/^\s*[-*+]\s+[-*+]\s/.test(line)) add(i, 'list-marker', 'doubled list marker');

    // A thematic break needs three markers. Two renders as literal text, or —
    // when the line above holds content — silently turns it into a setext h2.
    // Jira authors type it as a separator, so the intent is a rule either way.
    if (/^\s*(-{2}|\*{2}|_{2})\s*$/.test(line)) {
      add(i, 'short-rule', `"${line.trim()}" is not a thematic break; a rule needs three markers ("---")`);
    }

    // Each GIVEN/WHEN/THEN clause is a list item. As a bare paragraph line it
    // folds into the line above — a single newline is a softbreak, so the whole
    // scenario renders as one wall of text. Case-insensitive: authors write
    // "**Given**" as often as "**GIVEN**", and the render is equally broken.
    const kw = line.match(/^\*\*(GIVEN|WHEN|THEN|AND|BUT)\*\*/i);
    if (kw) {
      add(i, 'gwt-not-list', `**${kw[1]}** clause should be a list item ("- **${kw[1]}** …"), or it folds into the line above`);
    }

    // The story-format triple has the same softbreak defect and the same fix,
    // but none of the GWT keywords, so the rule above never sees it. Only the
    // glued case is a defect: a clause with a blank line after it is already its
    // own paragraph and renders correctly, so requiring a list there is noise.
    const sf = line.match(/^\*\*(AS A|I WANT|SO THAT)\*\*/i);
    if (sf && lines[i + 1] !== undefined && lines[i + 1].trim() !== '') {
      add(i, 'story-format-not-list', `**${sf[1]}** clause folds into the line below; make it a list item ("- **${sf[1]}** …")`);
    }
  });

  // MD032: lists need a blank line before them, or the list merges into the
  // paragraph above and renders as running text.
  let inList = false;
  lines.forEach((line, i) => {
    if (fenced.has(i)) return;
    const isItem = /^\s*([-*+]|\d+\.)\s+/.test(line);
    const prev = lines[i - 1];

    if (line.trim() === '') { /* a blank line does not end a loose list */ }
    else if (isItem) {
      // Only the first item of a list needs a blank line above it. A wrapped
      // continuation line keeps the list open, so the next item is not a new list.
      if (!inList && prev !== undefined && prev.trim() !== '') {
        add(i, 'MD032', 'list needs a blank line before it');
      }
      inList = true;
    } else if (!/^\s+\S/.test(line)) {
      inList = false;   // an unindented non-item line closes the list
    }
  });

  // A run of "Label: VALUE" bullets is reference data; a table scans better.
  let runStart = -1;
  let run = 0;
  const flush = (end) => {
    if (run >= 6) findings.push({ line: runStart + 1, rule: 'table-candidate', msg: `${run} consecutive "Label: value" bullets — a two-column table reads better` });
    run = 0;
    runStart = -1;
  };
  lines.forEach((line, i) => {
    if (fenced.has(i)) return;
    // A bullet that leads with a link is already a scannable list (subtasks,
    // linked issues); the colon it contains belongs to the URL, not a label.
    const isLabelled = /^\s*[-*+]\s+[^:]{2,60}:\s*\S/.test(line) && !/^\s*[-*+]\s*[[!]/.test(line);
    if (isLabelled) {
      if (run === 0) runStart = i;
      run++;
    } else if (line.trim() !== '') flush(i);
  });
  flush(lines.length);

  return findings;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.log('Usage: check-markdown.mjs <file.md> [more.md ...]');
  process.exit(1);
}

let total = 0;
for (const f of files) {
  if (!existsSync(f)) { console.error(`not found: ${f}`); process.exit(1); }
  const findings = checkFile(f);
  total += findings.length;
  console.log(`\n${f}: ${findings.length} finding(s)`);
  const byRule = {};
  for (const x of findings) (byRule[x.rule] ||= []).push(x);
  for (const rule of Object.keys(byRule).sort()) {
    console.log(`  ${rule} (${byRule[rule].length})`);
    for (const x of byRule[rule].slice(0, 5)) console.log(`    line ${x.line}: ${x.msg}`);
    if (byRule[rule].length > 5) console.log(`    ... ${byRule[rule].length - 5} more`);
  }
}
console.log(`\nTotal: ${total} finding(s)`);
process.exit(total ? 1 : 0);
