import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubUrl, resolveRef } from './fetch-github.mjs';

const REPO = 'https://github.com/org/repo';

test('Should take the whole branch name When a tree link names a branch with a slash', () => {
  // Arrange
  const target = parseGitHubUrl(`${REPO}/tree/base/login-flow`);
  const refs = ['base/login-flow'];

  // Act
  const result = resolveRef(target, refs);

  // Assert
  assert.deepEqual([result.ref, result.path], ['base/login-flow', '']);
});

test('Should split at the longest known branch When a file path follows a branch with a slash', () => {
  // Arrange
  const target = parseGitHubUrl(`${REPO}/blob/feat/x/src/a.ts`);
  const refs = ['feat', 'feat/x'];

  // Act
  const result = resolveRef(target, refs);

  // Assert
  assert.deepEqual([result.ref, result.path], ['feat/x', 'src/a.ts']);
});

test('Should keep the first segment as the ref When no known branch matches', () => {
  // Arrange
  const target = parseGitHubUrl(`${REPO}/tree/main/libs/thing`);
  const refs = [];

  // Act
  const result = resolveRef(target, refs);

  // Assert
  assert.deepEqual([result.ref, result.path], ['main', 'libs/thing']);
});
