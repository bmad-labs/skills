import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTextEdit, lineDiff, fenceFor, toChanges } from './history.mjs';
import { buildHistoryMarkdown } from './fetch-issue.mjs';

const cred = { domain: 'site.example.net' };

const row = (id, created, items, author = 'Ann') => ({
  id, created, author: { displayName: author }, items,
});

test('Should mark the changed line with its context When one line of three changes', () => {
  // Arrange
  const from = 'a\nb\nc';
  const to = 'a\nB\nc';

  // Act
  const result = lineDiff(from, to);

  // Assert
  assert.deepEqual(result, ['@@ -1,3 +1,3 @@', ' a', '-b', '+B', ' c']);
});

test('Should split into separate hunks and drop far lines When two changes are far apart', () => {
  // Arrange
  const from = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].join('\n');
  const to = ['X', '2', '3', '4', '5', '6', '7', '8', '9', 'Y'].join('\n');

  // Act
  const result = lineDiff(from, to, 1);

  // Assert
  assert.deepEqual(result, [
    '@@ -1,2 +1,2 @@', '-1', '+X', ' 2',
    '@@ -9,2 +9,2 @@', ' 9', '-10', '+Y',
  ]);
});

test('Should write every line as added When the field had no value before', () => {
  // Arrange
  const from = null;
  const to = 'first\nsecond';

  // Act
  const result = lineDiff(from, to);

  // Assert
  assert.deepEqual(result, ['@@ -0,0 +1,2 @@', '+first', '+second']);
});

test('Should treat a value as a text edit When it holds a newline or more than 120 characters', () => {
  // Arrange
  const multiLine = 'one\ntwo';
  const long = 'x'.repeat(121);
  const short = 'In Progress';

  // Act
  const result = [isTextEdit(multiLine), isTextEdit(long), isTextEdit(short), isTextEdit(null)];

  // Assert
  assert.deepEqual(result, [true, true, false, false]);
});

test('Should open the fence with more backticks than the text holds When the text contains a fence', () => {
  // Arrange
  const text = 'before\n````\ncode\n````';

  // Act
  const result = fenceFor(text);

  // Assert
  assert.equal(result, '`````');
});

test('Should sort changes oldest first and prefer display strings When normalizing changelog rows', () => {
  // Arrange
  const rows = [
    row('2', '2026-06-10T10:00:00.000+0700', [{ field: 'status', from: '1', fromString: 'To Do', to: '3', toString: 'Done' }]),
    row('1', '2026-06-09T09:00:00.000+0700', [{ field: 'Sprint', from: null, fromString: null, to: '42', toString: null }]),
  ];

  // Act
  const result = toChanges(rows);

  // Assert
  assert.deepEqual(result, [
    { id: '1', author: 'Ann', created: '2026-06-09T09:00:00.000+0700', items: [{ field: 'Sprint', from: null, to: '42' }] },
    { id: '2', author: 'Ann', created: '2026-06-10T10:00:00.000+0700', items: [{ field: 'status', from: 'To Do', to: 'Done' }] },
  ]);
});

test('Should write a table row per field change and a diff per text edit When building the history document', () => {
  // Arrange
  const issue = { key: 'P-1', fields: { summary: 'Story' } };
  const histories = [
    {
      key: 'P-1', summary: 'Story', total: 2, readable: true,
      changes: [
        { id: '1', author: 'Ann', created: '2026-06-09T09:00:00.000+0700', items: [{ field: 'status', from: 'To Do', to: 'A|B' }] },
        { id: '2', author: 'Bo', created: '2026-06-10T10:00:00.000+0700', items: [{ field: 'Acceptance Criteria', from: 'a\nb', to: 'a\nc' }] },
      ],
    },
    { key: 'P-2', summary: 'Sub', total: 0, readable: true, changes: [] },
  ];

  // Act
  const result = buildHistoryMarkdown(cred, issue, histories);

  // Assert
  assert.match(result, /^---\nschema: jira-to-local\/history-v1\njira_key: P-1\n/);
  assert.match(result, /\ntotal: 2\nitems: 2\nissues: 2\n/);
  assert.match(result, /\| 2026-06-09 09:00 \+0700 \| Ann \| status \| To Do \| A\\\|B \|/);
  assert.match(result, /\| 2026-06-10 10:00 \+0700 \| Bo \| Acceptance Criteria \| Text edit 1 \| Text edit 1 \|/);
  assert.match(result, /#### Text edit 1 — Acceptance Criteria\n\n2026-06-10 10:00 \+0700, Bo\.\n\n```diff\n@@ -1,2 \+1,2 @@\n a\n-b\n\+c\n```/);
  assert.match(result, /## \[P-2\]\(https:\/\/site\.example\.net\/browse\/P-2\) — Sub\n\n_No changes recorded\._/);
});
