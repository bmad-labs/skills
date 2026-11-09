import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adfToMarkdown, formatSeconds } from './adf.mjs';
import { buildWorklogsMarkdown } from './fetch-issue.mjs';

const doc = (...content) => ({ type: 'doc', content });

test('Should keep the URL When a blockCard holds a link', () => {
  // Arrange
  const url = 'https://docs.google.com/spreadsheets/d/abc/edit?gid=1';
  const input = doc({ type: 'blockCard', attrs: { url } });

  // Act
  const result = adfToMarkdown(input);

  // Assert
  assert.match(result, new RegExp(`<${url.replace(/[?.]/g, '\\$&')}>`));
});

test('Should keep the URL When an embedCard holds a link', () => {
  // Arrange
  const url = 'https://www.figma.com/file/xyz';
  const input = doc({ type: 'embedCard', attrs: { url } });

  // Act
  const result = adfToMarkdown(input);

  // Assert
  assert.match(result, /<https:\/\/www\.figma\.com\/file\/xyz>/);
});

test('Should count days of the given length When the site working day is not 8 hours', () => {
  // Arrange
  const secondsPerDay = 6.5 * 3600;
  const secs = 14 * 3600;

  // Act
  const result = formatSeconds(secs, secondsPerDay);

  // Assert
  assert.equal(result, '2d 1h');
});

test('Should count 8-hour days When no day length is given', () => {
  // Arrange
  const secs = 14 * 3600;

  // Act
  const result = formatSeconds(secs);

  // Assert
  assert.equal(result, '1d 6h');
});

test('Should write the worklog total in site days When the site working day is 6.5 hours', () => {
  // Arrange
  const cred = { domain: 'site.example.net' };
  const issue = { key: 'PROJ-1', fields: { summary: 'S' } };
  const entries = [{ issueKey: 'PROJ-1', author: 'Ann', started: '2026-05-21', seconds: 14 * 3600, timeSpent: '2d 1h' }];
  const secondsPerDay = 6.5 * 3600;

  // Act
  const result = buildWorklogsMarkdown(cred, issue, entries, false, secondsPerDay);

  // Assert
  assert.match(result, /\*\*Total logged: 2d 1h\*\*/);
});
