#!/usr/bin/env node

/**
 * Tests for confluence-format.mjs — markdown ↔ Confluence storage format conversion.
 */

import { markdownToStorage, storageToMarkdown, htmlInlineToMarkdown } from './confluence-format.mjs';

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

function assertExact(name, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
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

// New storageToMarkdown tests for formatting fixes
// -------------------------------------------------------------------------

// Fix 1-4: Table with <tbody>, attributes, <colgroup>
console.log('\nTables with <tbody> and attributes:');
{
  const table = storageToMarkdown(
    '<table data-table-width="760"><colgroup><col style="width: 50%;" /><col style="width: 50%;" /></colgroup><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>'
  );
  assertContains('table with tbody and attrs has cells', table, '| A | B |');
}

// Fix 6: Code block without language param
console.log('\nCode block without language:');
{
  const code = storageToMarkdown(
    '<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[hello]]></ac:plain-text-body></ac:structured-macro>'
  );
  assertContains('code block without lang has fences', code, '```');
  assertContains('code block without lang has body', code, 'hello');
}

// Fix 6: Code block with width + language params
console.log('\nCode block with width + language:');
{
  const code = storageToMarkdown(
    '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">java</ac:parameter><ac:parameter ac:name="width">wide1800</ac:parameter><ac:plain-text-body><![CDATA[System.out.println("hi");]]></ac:plain-text-body></ac:structured-macro>'
  );
  assertContains('code block with width uses language', code, '```java');
  assertNotContains('code block with width ignores width param', code, 'wide1800');
}

// Fix 7: Task list with <ac:task-id>
console.log('\nTask list with task-id:');
{
  const tasks = storageToMarkdown(
    '<ac:task-list><ac:task><ac:task-id>abc-123</ac:task-id><ac:task-status>complete</ac:task-status><ac:task-body>Done item</ac:task-body></ac:task></ac:task-list>'
  );
  assertContains('task with task-id → [x]', tasks, '- [x] Done item');
}

// Fix 8: Links with extra attributes
console.log('\nLinks with extra attributes:');
{
  const link = storageToMarkdown(
    '<a href="https://example.com" data-card-appearance="inline">Click me</a>'
  );
  assertContains('link with attrs → markdown link', link, '[Click me](https://example.com)');
}

// Fix 9: Headings with attributes
console.log('\nHeadings with attributes:');
{
  const heading = storageToMarkdown('<h2 local-id="abc123">Title Here</h2>');
  assertContains('heading with attrs → ##', heading, '## Title Here');
}

// Fix 10: Paragraph separation
console.log('\nParagraph separation:');
{
  const paras = storageToMarkdown('<p>First paragraph</p><p>Second paragraph</p>');
  assertContains('paragraphs have first', paras, 'First paragraph');
  assertContains('paragraphs have second', paras, 'Second paragraph');
  // They should be separated by a blank line
  assert('paragraphs separated by blank line', paras, 'First paragraph\n\nSecond paragraph');
}

// Fix 11: HTML entity decoding
console.log('\nHTML entity decoding:');
{
  const decoded = storageToMarkdown('<p>&rsquo; &ldquo; &rarr; &nbsp; &#123;</p>');
  assertContains('rsquo decoded', decoded, '\u2019');
  assertContains('ldquo decoded', decoded, '\u201C');
  assertContains('rarr decoded', decoded, '\u2192');
  assertContains('numeric entity decoded', decoded, '{');
}

// Fix 12: Jira macro
console.log('\nJira macro:');
{
  const jira = storageToMarkdown(
    '<ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">NCOP-123</ac:parameter><ac:parameter ac:name="server">Jira</ac:parameter></ac:structured-macro>'
  );
  assertContains('jira macro → key text', jira, 'NCOP-123');
}

// Fix 13: Expand macro
console.log('\nExpand macro:');
{
  const expand = storageToMarkdown(
    '<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">Details</ac:parameter><ac:rich-text-body><p>Hidden content</p></ac:rich-text-body></ac:structured-macro>'
  );
  assertContains('expand macro has details tag', expand, '<details>');
  assertContains('expand macro has summary', expand, '<summary>Details</summary>');
  assertContains('expand macro has body', expand, 'Hidden content');
}

// Fix 14: TOC macro stripped
console.log('\nTOC macro stripped:');
{
  const toc = storageToMarkdown(
    '<ac:structured-macro ac:name="toc"><ac:parameter ac:name="maxLevel">3</ac:parameter></ac:structured-macro>'
  );
  assert('toc macro stripped to empty', toc, '');
}

// Fix 15: Span with style
console.log('\nSpan with style:');
{
  const span = storageToMarkdown('<p><span style="color:red">important text</span></p>');
  assertContains('span with style → text only', span, 'important text');
  assertNotContains('span tag removed', span, '<span');
}

// -------------------------------------------------------------------------
// Bug regression tests
// -------------------------------------------------------------------------

console.log('\n=== Bug regression tests ===\n');

// Bug 1: Expand macro with breakoutWidth parameter leaking "1800"
console.log('Expand with extra params:');
{
  const expand = storageToMarkdown(
    '<ac:structured-macro ac:name="expand" ac:schema-version="1"><ac:parameter ac:name="title">Details</ac:parameter><ac:parameter ac:name="breakoutWidth">1800</ac:parameter><ac:rich-text-body><p>Content here</p></ac:rich-text-body></ac:structured-macro>'
  );
  assertContains('expand with breakoutWidth has details', expand, '<details>');
  assertNotContains('no leaked breakoutWidth value', expand, '1800');
  assertContains('expand body preserved', expand, 'Content here');
}

// Bug 2: Lists with local-id attributes not converting to bullets
console.log('\nLists with local-id:');
{
  const result = storageToMarkdown(
    '<ul local-id="abc"><li local-id="def"><p>Item A</p></li><li local-id="ghi"><p>Item B</p></li></ul>'
  );
  assertContains('ul with local-id → bullet A', result, '- Item A');
  assertContains('ul with local-id → bullet B', result, '- Item B');
}

// Bug 3: view-file macro producing empty list items
console.log('\nView-file macro:');
{
  const result = storageToMarkdown(
    '<ac:structured-macro ac:name="view-file" ac:schema-version="1"><ac:parameter ac:name="name"><ri:attachment ri:filename="diagrams.drawio" ri:version-at-save="1" /></ac:parameter></ac:structured-macro>'
  );
  assertContains('view-file → link', result, '[diagrams.drawio]');
}

// Expand body with nested code blocks
console.log('\nExpand with code blocks:');
{
  const expand = storageToMarkdown(
    '<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">Code</ac:parameter><ac:rich-text-body>' +
    '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">js</ac:parameter><ac:plain-text-body><![CDATA[const x = 1;]]></ac:plain-text-body></ac:structured-macro>' +
    '</ac:rich-text-body></ac:structured-macro>'
  );
  assertContains('expand+code has details', expand, '<details>');
  assertContains('expand+code has fenced block', expand, '```js');
  assertContains('expand+code preserves body', expand, 'const x = 1;');
  assertNotContains('no null bytes', expand, '\x00');
}

// Expand body with images
console.log('\nExpand with images:');
{
  const expand = storageToMarkdown(
    '<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">Screenshots</ac:parameter><ac:rich-text-body>' +
    '<ac:image ac:alt="screenshot"><ri:attachment ri:filename="screen.png" /></ac:image>' +
    '</ac:rich-text-body></ac:structured-macro>'
  );
  assertContains('expand+image has details', expand, '<details>');
  assertContains('expand+image has md image', expand, '![screenshot](screen.png)');
}

// Expand body with table
console.log('\nExpand with tables:');
{
  const expand = storageToMarkdown(
    '<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">Data</ac:parameter><ac:rich-text-body>' +
    '<table><tr><th>Col A</th></tr><tr><td>Val 1</td></tr></table>' +
    '</ac:rich-text-body></ac:structured-macro>'
  );
  assertContains('expand+table has details', expand, '<details>');
  assertContains('expand+table has md table', expand, '| Col A |');
}

// Unknown macro with rich-text-body preserved
console.log('\nUnknown macro catch-all:');
{
  const result = storageToMarkdown(
    '<ac:structured-macro ac:name="some-unknown-macro"><ac:rich-text-body><p>Preserved content</p></ac:rich-text-body></ac:structured-macro>'
  );
  assertContains('unknown macro body preserved', result, 'Preserved content');
}
{
  const result = storageToMarkdown(
    '<ac:structured-macro ac:name="noformat"><ac:plain-text-body><![CDATA[raw text here]]></ac:plain-text-body></ac:structured-macro>'
  );
  assertContains('noformat macro → code block', result, 'raw text here');
}

// htmlInlineToMarkdown with attributes on inline tags
console.log('\nInline tags with attributes:');
{
  assertContains('strong with class', htmlInlineToMarkdown('<strong class="bold">text</strong>'), '**text**');
  assertContains('em with style', htmlInlineToMarkdown('<em style="color:red">text</em>'), '*text*');
  assertContains('code with data attr', htmlInlineToMarkdown('<code data-x="1">text</code>'), '`text`');
}

// -------------------------------------------------------------------------
// Formatting: newline separation around block elements
// -------------------------------------------------------------------------

console.log('\n=== Formatting: newline separation ===\n');

// Fix C: Headings get newlines
console.log('Heading separation:');
{
  const result = storageToMarkdown('<p>Some text</p><h2>Title</h2><p>More text</p>');
  assertExact('heading separated from surrounding content', result,
    'Some text\n\n## Title\n\nMore text');
}
{
  const result = storageToMarkdown('<h1>First</h1><h2>Second</h2>');
  assertExact('adjacent headings separated', result, '# First\n\n## Second');
}

// Fix D: Images get newlines
console.log('\nImage separation:');
{
  const result = storageToMarkdown(
    '<ac:image ac:alt="pic"><ri:url ri:value="https://example.com/img.png" /></ac:image><p><strong>Caption</strong></p>'
  );
  assertContains('image separated from following bold', result, '![pic](https://example.com/img.png)\n\n**Caption**');
}
{
  const result = storageToMarkdown(
    '<ac:image ac:alt="pic"><ri:attachment ri:filename="img.png" /></ac:image><h2>Next</h2>'
  );
  assertContains('attachment image separated from heading', result, '![pic](img.png)\n\n## Next');
}

// Fix E: HR gets newlines
console.log('\nHR separation:');
{
  const result = storageToMarkdown('<p>Above</p><hr/><p>Below</p>');
  assertExact('hr separated from content', result, 'Above\n\n---\n\nBelow');
}

// Fix F: Lists get newlines
console.log('\nList separation:');
{
  const result = storageToMarkdown('<p>Intro</p><ul><li>A</li><li>B</li></ul><p>After</p>');
  assertExact('ul separated from surrounding', result, 'Intro\n\n- A\n- B\n\nAfter');
}
{
  const result = storageToMarkdown('<p>Intro</p><ol><li>A</li><li>B</li></ol><p>After</p>');
  assertExact('ol separated from surrounding', result, 'Intro\n\n1. A\n2. B\n\nAfter');
}

// Fix A: <br> inside inline context preserved
console.log('\nBR preservation:');
{
  const result = storageToMarkdown('<p>Line one<br/>Line two</p>');
  assertExact('br inside paragraph preserved', result, 'Line one\nLine two');
}

// Fix G: Code block separated and content protected
console.log('\nCode block separation and protection:');
{
  const result = storageToMarkdown(
    '<h1>Sample</h1><ac:structured-macro ac:name="code"><ac:parameter ac:name="language">typescript</ac:parameter><ac:plain-text-body><![CDATA[let x: Array<string> = [];]]></ac:plain-text-body></ac:structured-macro>'
  );
  assertContains('code block separated from heading', result, '# Sample\n\n```typescript');
  assertContains('angle brackets preserved in code block', result, 'Array<string>');
}
{
  const result = storageToMarkdown(
    '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">typescript</ac:parameter><ac:plain-text-body><![CDATA[let m: DeepMocked<Repository<FilterConfig>>;]]></ac:plain-text-body></ac:structured-macro>'
  );
  assertContains('generic types preserved in code block', result, 'DeepMocked<Repository<FilterConfig>>');
}

// Compound: image + heading (bug-template pattern)
console.log('\nCompound patterns:');
{
  const result = storageToMarkdown(
    '<ac:image ac:alt=""><ri:attachment ri:filename="screenshot.png" /></ac:image><h2>Section</h2>'
  );
  assertContains('image does not merge with heading', result, '![screenshot.png](screenshot.png)\n\n## Section');
}
{
  const result = storageToMarkdown(
    '<h1>Overall flow</h1><h5><strong>UAT bug</strong></h5><p>Log bug here</p>'
  );
  const lines = result.split('\n').filter(l => l.trim());
  assertExact('h1 on own line', lines[0], '# Overall flow');
  assertExact('h5 on own line', lines[1], '##### **UAT bug**');
  assertExact('paragraph on own line', lines[2], 'Log bug here');
}

// -------------------------------------------------------------------------
// Additional fixes: bold spacing, image encoding, angle bracket escaping
// -------------------------------------------------------------------------

console.log('\n=== Additional formatting fixes ===\n');

// Fix 1: Bold/italic with trailing space
console.log('Bold/italic trailing space:');
{
  const result = storageToMarkdown('<p><strong>Expected result: </strong></p>');
  assertContains('bold trailing space trimmed', result, '**Expected result:**');
  assertNotContains('no broken bold marker', result, '** ');
}
{
  const result = storageToMarkdown('<p><em>italic text </em></p>');
  assertContains('italic trailing space trimmed', result, '*italic text*');
}

// Fix 3: Parentheses and spaces in image filenames
console.log('\nImage filename encoding:');
{
  const result = storageToMarkdown(
    '<ac:image ac:alt="pic"><ri:attachment ri:filename="unnamed (1).png" /></ac:image>'
  );
  assertContains('parentheses encoded in image URL', result, 'unnamed%20%281%29.png');
}
{
  const result = storageToMarkdown(
    '<ac:image><ri:attachment ri:filename="Screenshot 2025-11-05 at 16.50.02.png" /></ac:image>'
  );
  assertContains('spaces encoded in image URL', result, 'Screenshot%202025-11-05%20at%2016.50.02.png');
  assertNotContains('no raw spaces in image URL', result, 'Screenshot 2025-11-05 at 16.50.02.png)');
}
{
  // Empty alt text should use filename as fallback
  const result = storageToMarkdown(
    '<ac:image><ri:attachment ri:filename="diagram.png" /></ac:image>'
  );
  assertContains('empty alt uses filename', result, '![diagram.png]');
}

// Fix 5: Stray angle brackets escaped
console.log('\nAngle bracket escaping:');
{
  const result = storageToMarkdown('<p>&lt;Re-consuming Kafka Message&gt;</p>');
  assertContains('angle brackets escaped', result, '\\<Re-consuming Kafka Message\\>');
}
{
  // Code blocks should NOT have their <> escaped
  const result = storageToMarkdown(
    '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">ts</ac:parameter><ac:plain-text-body><![CDATA[let x: Array<string>;]]></ac:plain-text-body></ac:structured-macro>'
  );
  assertContains('code block angle brackets NOT escaped', result, 'Array<string>');
  assertNotContains('no escaped brackets in code', result, 'Array\\<string\\>');
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
