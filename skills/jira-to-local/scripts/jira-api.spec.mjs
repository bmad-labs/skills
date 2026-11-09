import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credentials, connect, parseDotEnv, readDotEnv } from './jira-api.mjs';

test('Should need no API token When the config picks the twg transport', () => {
  // Arrange
  const config = {
    transport: 'twg',
    jira: { domain: 'x.atlassian.net' },
    auth: { envVars: { email: 'UNSET_EMAIL_VAR_FOR_TEST', token: 'UNSET_TOKEN_VAR_FOR_TEST' } },
  };

  // Act
  const cred = credentials(config);

  // Assert
  assert.deepEqual(cred, { transport: 'twg', domain: 'x.atlassian.net', devField: null });
});

test('Should carry the development field id When the config maps one', () => {
  // Arrange
  const config = {
    transport: 'twg',
    jira: { domain: 'x.atlassian.net' },
    project: { metaFields: { development: 'customfield_10000' } },
  };

  // Act
  const cred = credentials(config);

  // Assert
  assert.equal(cred.devField, 'customfield_10000');
});

test('Should build Basic auth from the environment When the config picks REST', () => {
  // Arrange
  process.env.JTL_TEST_EMAIL = 'me@example.com';
  process.env.JTL_TEST_TOKEN = 'secret';
  const config = {
    jira: { domain: 'x.atlassian.net' },
    auth: { envVars: { email: 'JTL_TEST_EMAIL', token: 'JTL_TEST_TOKEN' } },
  };

  // Act
  const cred = credentials(config);

  // Assert
  assert.deepEqual(cred, {
    transport: 'rest',
    domain: 'x.atlassian.net',
    email: 'me@example.com',
    auth: 'Basic ' + Buffer.from('me@example.com:secret').toString('base64'),
  });
});

test('Should connect through REST from the recorded setup connection When no config exists yet', () => {
  // Arrange
  const root = mkdtempSync(join(tmpdir(), 'jtl-connect-'));
  mkdirSync(join(root, '.jira-setup-choices'));
  writeFileSync(join(root, '.jira-setup-choices', 'connection.json'),
    JSON.stringify({ transport: 'twg', jira: { domain: 'x.atlassian.net' } }));
  process.env.ATLASSIAN_EMAIL ??= 'me@example.com';
  process.env.ATLASSIAN_API_TOKEN ??= 'secret';

  // Act
  const { cred, configPath } = connect({ startDir: root });

  // Assert
  assert.deepEqual([cred.transport, cred.domain, configPath], ['rest', 'x.atlassian.net', null]);
});

// -- the temporary token setup reads from .env -------------------------------

test('Should read each key and value When parsing a .env file', () => {
  // Arrange
  const text = [
    '# temporary token for jira-to-local setup',
    '',
    'ATLASSIAN_EMAIL=me@example.com',
    'export ATLASSIAN_API_TOKEN="abc=123"',
    "OTHER='single quoted'",
  ].join('\n');

  // Act
  const env = parseDotEnv(text);

  // Assert
  assert.deepEqual(env, {
    ATLASSIAN_EMAIL: 'me@example.com',
    ATLASSIAN_API_TOKEN: 'abc=123',
    OTHER: 'single quoted',
  });
});

test('Should return nothing When the workspace has no .env file', () => {
  // Arrange
  const root = mkdtempSync(join(tmpdir(), 'jtl-env-'));

  // Act
  const env = readDotEnv(root);

  // Assert
  assert.deepEqual(env, {});
});

test('Should take the token from the given environment When building REST credentials', () => {
  // Arrange
  const config = { jira: { domain: 'x.atlassian.net' }, auth: { envVars: { email: 'E', token: 'T' } } };
  const env = { E: 'me@example.com', T: 'from-dotenv' };

  // Act
  const cred = credentials(config, env);

  // Assert
  assert.equal(cred.auth, 'Basic ' + Buffer.from('me@example.com:from-dotenv').toString('base64'));
});
