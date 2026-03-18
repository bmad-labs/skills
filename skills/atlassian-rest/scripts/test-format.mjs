#!/usr/bin/env node

/**
 * Tests for confluence-format.mjs — markdown ↔ Confluence storage format conversion.
 */

import { markdownToStorage, storageToMarkdown } from './confluence-format.mjs';

let passed = 0;
let failed = 0;

function assert(name, actual, expected) {
  // Normalize whitespace for comparison
  const a = actual.trim().replace(/\s+/g, ' ');
  const e = expected.trim().replace(/\s+/g, ' ');
  if (a === e) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Expected: ${e}`);
    console.log(`    Actual:   ${a}`);
  }
}

function assertContains(name, actual, substring) {
  if (actual.includes(substring)) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Expected to contain: ${substring}`);
    console.log(`    Actual: ${actual}`);
  }
}

function assertNotContains(name, actual, substring) {
  if (!actual.includes(substring)) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Expected NOT to contain: ${substring}`);
    console.log(`    Actual: ${actual}`);
  }
}

// -------------------------------------------------------------------------
// Forward conversion: markdown → Confluence storage format
// -------------------------------------------------------------------------

console.log('\n=== markdownToStorage ===\n');

// Code blocks
console.log('Code blocks:');
{
  const result = markdownToStorage('```javascript\nconsole.log("hello");\n```');
  assertContains('code block produces ac:structured-macro', result, 'ac:structured-macro ac:name="code"');
  assertContains('code block has language param', result, '<ac:parameter ac:name="language">javascript</ac:parameter>');
  assertContains('code block has CDATA body', result, '<![CDATA[console.log("hello");]]>');
}

// GitHub-style alerts → Confluence panel macros
console.log('\nGitHub alerts:');
{
  const note = markdownToStorage('> [!NOTE]\n> This is important info.');
  assertContains('NOTE → info macro', note, 'ac:name="info"');
  assertContains('NOTE has title', note, '<ac:parameter ac:name="title">Note</ac:parameter>');
  assertContains('NOTE has rich-text-body', note, '<ac:rich-text-body>');

  const warn = markdownToStorage('> [!WARNING]\n> Be careful here.');
  assertContains('WARNING → warning macro', warn, 'ac:name="warning"');

  const tip = markdownToStorage('> [!TIP]\n> Try this approach.');
  assertContains('TIP → tip macro', tip, 'ac:name="tip"');

  const important = markdownToStorage('> [!IMPORTANT]\n> Do not skip this.');
  assertContains('IMPORTANT → info macro', important, 'ac:name="info"');
  assertContains('IMPORTANT has title', important, '<ac:parameter ac:name="title">Important</ac:parameter>');

  const caution = markdownToStorage('> [!CAUTION]\n> This could break things.');
  assertContains('CAUTION → warning macro', caution, 'ac:name="warning"');
}

// Regular blockquotes (should NOT become panels)
console.log('\nRegular blockquotes:');
{
  const bq = markdownToStorage('> Just a regular quote.');
  assertContains('regular blockquote uses <blockquote>', bq, '<blockquote>');
  assertNotContains('regular blockquote does NOT use ac:structured-macro', bq, 'ac:structured-macro');
}

// Images
console.log('\nImages:');
{
  const extImg = markdownToStorage('![Alt text](https://example.com/img.png)');
  assertContains('external image uses ac:image', extImg, '<ac:image');
  assertContains('external image uses ri:url', extImg, '<ri:url ri:value="https://example.com/img.png"');
  assertContains('external image has alt', extImg, 'ac:alt="Alt text"');

  const attImg = markdownToStorage('![Diagram](architecture.png)');
  assertContains('attachment image uses ac:image', attImg, '<ac:image');
  assertContains('attachment image uses ri:attachment', attImg, '<ri:attachment ri:filename="architecture.png"');
}

// Task lists
console.log('\nTask lists:');
{
  const tasks = markdownToStorage('- [x] Done task\n- [ ] Todo task');
  assertContains('task list uses ac:task-list', tasks, '<ac:task-list>');
  assertContains('checked task is complete', tasks, '<ac:task-status>complete</ac:task-status>');
  assertContains('unchecked task is incomplete', tasks, '<ac:task-status>incomplete</ac:task-status>');
  assertContains('task has body', tasks, '<ac:task-body>');
}

// Regular lists (should NOT become task lists)
console.log('\nRegular lists:');
{
  const ul = markdownToStorage('- Item one\n- Item two');
  assertContains('unordered list uses <ul>', ul, '<ul>');
  assertNotContains('unordered list does NOT use ac:task-list', ul, 'ac:task-list');

  const ol = markdownToStorage('1. First\n2. Second');
  assertContains('ordered list uses <ol>', ol, '<ol>');
}

// Headings
console.log('\nHeadings:');
{
  const h1 = markdownToStorage('# Hello');
  assertContains('H1 heading', h1, '<h1>');

  const h3 = markdownToStorage('### Sub-heading');
  assertContains('H3 heading', h3, '<h3>');
}

// Tables
console.log('\nTables:');
{
  const table = markdownToStorage('| A | B |\n|---|---|\n| 1 | 2 |');
  assertContains('table has <table>', table, '<table>');
  assertContains('table has header', table, '<th>');
  assertContains('table has data cell', table, '<td>');
}

// Passthrough for pre-formatted storage format
console.log('\nPassthrough:');
{
  const raw = '<p>Already formatted</p>';
  const result = markdownToStorage(raw);
  assert('pre-formatted HTML passes through', result, raw);
}

// -------------------------------------------------------------------------
// Reverse conversion: Confluence storage format → markdown
// -------------------------------------------------------------------------

console.log('\n=== storageToMarkdown ===\n');

// Panel macros → GitHub alerts
console.log('Panel macros:');
{
  const info = storageToMarkdown(
    '<ac:structured-macro ac:name="info"><ac:parameter ac:name="title">Note</ac:parameter><ac:rich-text-body><p>Important info</p></ac:rich-text-body></ac:structured-macro>'
  );
  assertContains('info macro → [!NOTE]', info, '[!NOTE]');
  assertContains('info macro preserves body', info, 'Important info');

  const warn = storageToMarkdown(
    '<ac:structured-macro ac:name="warning"><ac:parameter ac:name="title">Warning</ac:parameter><ac:rich-text-body><p>Be careful</p></ac:rich-text-body></ac:structured-macro>'
  );
  assertContains('warning macro → [!WARNING]', warn, '[!WARNING]');
}

// Task lists
console.log('\nTask lists:');
{
  const tasks = storageToMarkdown(
    '<ac:task-list><ac:task><ac:task-status>complete</ac:task-status><ac:task-body>Done task</ac:task-body></ac:task>' +
    '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>Todo task</ac:task-body></ac:task></ac:task-list>'
  );
  assertContains('complete task → [x]', tasks, '- [x] Done task');
  assertContains('incomplete task → [ ]', tasks, '- [ ] Todo task');
}

// Image macros
console.log('\nImage macros:');
{
  const extImg = storageToMarkdown(
    '<ac:image ac:alt="Logo"><ri:url ri:value="https://example.com/logo.png" /></ac:image>'
  );
  assertContains('external image → markdown', extImg, '![Logo](https://example.com/logo.png)');

  const attImg = storageToMarkdown(
    '<ac:image ac:alt="Diagram"><ri:attachment ri:filename="arch.png" /></ac:image>'
  );
  assertContains('attachment image → markdown', attImg, '![Diagram](arch.png)');
}

// Code blocks
console.log('\nCode blocks:');
{
  const code = storageToMarkdown(
    '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">python</ac:parameter><ac:plain-text-body><![CDATA[print("hello")]]></ac:plain-text-body></ac:structured-macro>'
  );
  assertContains('code macro → fenced code', code, '```python');
  assertContains('code macro body preserved', code, 'print("hello")');
}

// Headings, lists, tables
console.log('\nBasic HTML elements:');
{
  const heading = storageToMarkdown('<h2>Section Title</h2>');
  assertContains('h2 → ##', heading, '## Section Title');

  const ul = storageToMarkdown('<ul><li>Alpha</li><li>Beta</li></ul>');
  assertContains('ul → bullets', ul, '- Alpha');

  const table = storageToMarkdown('<table><tr><th>Name</th><th>Value</th></tr><tr><td>x</td><td>1</td></tr></table>');
  assertContains('table has header row', table, '| Name | Value |');
  assertContains('table has separator', table, '| --- | --- |');
  assertContains('table has data row', table, '| x | 1 |');
}

// -------------------------------------------------------------------------
// Round-trip tests
// -------------------------------------------------------------------------

console.log('\n=== Round-trip ===\n');
{
  const md1 = '## Hello World\n\nSome **bold** and *italic* text.\n\n- Item A\n- Item B\n';
  const rt1 = storageToMarkdown(markdownToStorage(md1));
  assertContains('round-trip preserves heading', rt1, '## Hello World');
  assertContains('round-trip preserves bold', rt1, '**bold**');
  assertContains('round-trip preserves italic', rt1, '*italic*');
  assertContains('round-trip preserves list items', rt1, '- Item A');
}

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
