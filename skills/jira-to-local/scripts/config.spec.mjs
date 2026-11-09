import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfigFile, connectionRecord, readSetupConnection, loadConfig, localOverride, findWorkspaceRoot, outputDirFor } from './config.mjs';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'jira.config.json');

function configWith(transport) {
  const config = JSON.parse(readFileSync(TEMPLATE, 'utf8'));
  config.transport = transport;
  const path = join(mkdtempSync(join(tmpdir(), 'jtl-config-')), '.jira.config.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}

for (const transport of ['rest', 'twg']) {
  test(`Should accept the config When transport is ${transport}`, () => {
    // Arrange
    const path = configWith(transport);

    // Act
    const result = validateConfigFile(path);

    // Assert
    assert.equal(result.ok, true, result.output);
  });
}

test('Should reject the config When transport names an unknown method', () => {
  // Arrange
  const path = configWith('acli');

  // Act
  const result = validateConfigFile(path);

  // Assert
  assert.equal(result.ok, false);
});

// -- the connection setup records before the config exists ------------------

test('Should keep the bare host When the site is pasted as a URL', () => {
  // Arrange
  const site = 'https://x.atlassian.net/';

  // Act
  const record = connectionRecord(site);

  // Assert
  assert.deepEqual(record, { jira: { domain: 'x.atlassian.net' } });
});

test('Should reject the connection When no site is given', () => {
  // Arrange
  const site = '';

  // Act
  const act = () => connectionRecord(site);

  // Assert
  assert.throws(act, /site domain/);
});

test('Should return the recorded connection as a config When setup has written one and no config exists', () => {
  // Arrange
  const root = mkdtempSync(join(tmpdir(), 'jtl-setup-'));
  mkdirSync(join(root, '.jira-setup-choices'));
  writeFileSync(join(root, '.jira-setup-choices', 'connection.json'), JSON.stringify(connectionRecord('x.atlassian.net')));

  // Act
  const config = readSetupConnection(root);

  // Assert
  assert.deepEqual(config, { jira: { domain: 'x.atlassian.net' } });
});

test('Should return null When setup has recorded no connection', () => {
  // Arrange
  const root = mkdtempSync(join(tmpdir(), 'jtl-setup-'));

  // Act
  const config = readSetupConnection(root);

  // Assert
  assert.equal(config, null);
});

// -- a person's own transport, beside a shared config ------------------------

function workspaceWith(sharedTransport, local) {
  const root = mkdtempSync(join(tmpdir(), 'jtl-local-'));
  const config = JSON.parse(readFileSync(TEMPLATE, 'utf8'));
  config.transport = sharedTransport;
  writeFileSync(join(root, '.jira.config.json'), JSON.stringify(config));
  if (local) writeFileSync(join(root, '.jira.config.local.json'), JSON.stringify(local));
  return root;
}

test('Should use the local transport When a local file sits beside the shared config', () => {
  // Arrange
  const root = workspaceWith('rest', { transport: 'twg' });

  // Act
  const { config } = loadConfig({ startDir: root });

  // Assert
  assert.equal(config.transport, 'twg');
});

test('Should keep the shared transport When there is no local file', () => {
  // Arrange
  const root = workspaceWith('rest', null);

  // Act
  const { config } = loadConfig({ startDir: root });

  // Assert
  assert.equal(config.transport, 'rest');
});

test('Should hold only the transport When building a local override', () => {
  // Arrange
  const transport = 'twg';

  // Act
  const local = localOverride(transport);

  // Assert
  assert.deepEqual(local, { transport: 'twg' });
});

test('Should reject the local override When the transport is unknown', () => {
  // Arrange
  const transport = 'acli';

  // Act
  const act = () => localOverride(transport);

  // Assert
  assert.throws(act, /rest or twg/);
});

// -- where pulls land --------------------------------------------------------

test('Should use the folder holding the config as the root When a subfolder has its own .git', () => {
  // Arrange
  const root = workspaceWith('rest', null);
  const sub = join(root, 'services', 'api');
  mkdirSync(join(sub, '.git'), { recursive: true });

  // Act
  const found = findWorkspaceRoot(sub);

  // Assert
  assert.equal(found, root);
});

test('Should write under jira-issues When the config sets no output folder', () => {
  // Arrange
  const config = { output: {} };

  // Act
  const dir = outputDirFor(config, 'PROJ-1', '/work');

  // Assert
  assert.equal(dir, '/work/jira-issues/PROJ-1');
});
