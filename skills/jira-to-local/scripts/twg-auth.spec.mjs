import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ptyCommand, readLoginScreen, browserCommand } from './twg-auth.mjs';

test('Should feed script through cat with the BSD argument order When running on macOS', () => {
  // Arrange
  const platform = 'darwin';

  // Act
  const command = ptyCommand(platform, 'twg', ['login', '--site', 'x.atlassian.net']);

  // Assert
  assert.deepEqual(command, ['/bin/sh', ['-c', "cat | script -q /dev/null 'twg' 'login' '--site' 'x.atlassian.net'"]]);
});

test('Should feed script through cat with twg as one quoted command When running on Linux', () => {
  // Arrange
  const platform = 'linux';

  // Act
  const command = ptyCommand(platform, '/home/u/.local/bin/twg', ['login', '--site', 'x.atlassian.net']);

  // Assert
  assert.deepEqual(command, ['/bin/sh', ['-c', String.raw`cat | script -qec ''\''/home/u/.local/bin/twg'\'' '\''login'\'' '\''--site'\'' '\''x.atlassian.net'\''' /dev/null`]]);
});

test('Should refuse When the platform has no script command', () => {
  // Arrange
  const platform = 'win32';

  // Act
  const act = () => ptyCommand(platform, 'twg', ['login']);

  // Assert
  assert.throws(act, /terminal/);
});

test('Should find the link, the code and the browser question When the screen shows them', () => {
  // Arrange
  const screen = '\u001b[2m│\u001b[22m  Visit: https://auth.atlassian.com/oauth/activate?user_code=4FF6-E134\r\n'
    + '  Code:  4FF6-E134\r\n\u001b[36m◆\u001b[39m  Open in browser?\r\n';

  // Act
  const found = readLoginScreen(screen);

  // Assert
  assert.deepEqual(found, {
    url: 'https://auth.atlassian.com/oauth/activate?user_code=4FF6-E134',
    code: '4FF6-E134',
    asksBrowser: true,
  });
});

test('Should find the browser question When twg draws it one letter per frame', () => {
  // Arrange
  const screen = ['O', 'p', 'e', 'n', ' ', 'i', 'n', ' ', 'b', 'r', 'o', 'w', 's', 'e', 'r', '?']
    .map((ch) => `\u001b[90m│\u001b[39m  ${ch}`).join('');

  // Act
  const found = readLoginScreen(screen);

  // Assert
  assert.equal(found.asksBrowser, true);
});

test('Should find the browser question When every byte arrives on its own line', () => {
  // Arrange
  const frames = ['O', 'p', 'e', 'n', ' ', 'i', 'n', ' ', 'b', 'r', 'o', 'w', 's', 'e', 'r', '?']
    .map((ch) => `\u001b[90m│\u001b[39m  ${ch}`).join('');
  const screen = [...frames].join('\r\n');

  // Act
  const found = readLoginScreen(screen);

  // Assert
  assert.equal(found.asksBrowser, true);
});

test('Should report nothing found When the screen is still empty', () => {
  // Arrange
  const screen = '';

  // Act
  const found = readLoginScreen(screen);

  // Assert
  assert.deepEqual(found, { url: null, code: null, asksBrowser: false });
});

for (const [platform, expected] of [
  ['darwin', ['open', ['https://auth.atlassian.com/oauth/activate?user_code=AB12-CD34']]],
  ['linux', ['xdg-open', ['https://auth.atlassian.com/oauth/activate?user_code=AB12-CD34']]],
  ['win32', null],
]) {
  test(`Should pick the system browser opener When running on ${platform}`, () => {
    // Arrange
    const url = 'https://auth.atlassian.com/oauth/activate?user_code=AB12-CD34';

    // Act
    const command = browserCommand(platform, url);

    // Assert
    assert.deepEqual(command, expected);
  });
}
