// Run: npm test  (Node's built-in runner; imports the TS source via type stripping)
import test from 'node:test';
import assert from 'node:assert/strict';
import { isThemeReady, readCookie, resolveTheme } from './theme.ts';

const routes = ['/', '/about'];

test('isThemeReady matches exact routes only, ignoring a trailing slash, query and hash', () => {
  assert.equal(isThemeReady('/', routes), true);
  assert.equal(isThemeReady('/gallery', routes), false);
  assert.equal(isThemeReady('/about/', routes), true);
  assert.equal(isThemeReady('/about/x', routes), false);
  assert.equal(isThemeReady('/about?x=1#top', routes), true);
});

test('a locked route is always dark', () => {
  assert.equal(resolveTheme('/gallery', 'light', true, routes), 'dark');
});

test('on a ready route the saved choice beats the system setting', () => {
  assert.equal(resolveTheme('/', 'light', false, routes), 'light');
  assert.equal(resolveTheme('/', 'dark', true, routes), 'dark');
});

test('with no saved choice the system setting decides', () => {
  assert.equal(resolveTheme('/', null, true, routes), 'light');
  assert.equal(resolveTheme('/', null, false, routes), 'dark');
});

test('a garbage cookie is treated as no cookie', () => {
  assert.equal(resolveTheme('/', 'blue', true, routes), 'light');
  assert.equal(resolveTheme('/', '', false, routes), 'dark');
});

test('with the default (empty) route list nothing is light', () => {
  assert.equal(resolveTheme('/', 'light', true), 'dark');
});

test('readCookie finds the named cookie only', () => {
  assert.equal(readCookie('a=1; theme=light; b=2', 'theme'), 'light');
  assert.equal(readCookie('', 'theme'), null);
  assert.equal(readCookie('xtheme=light', 'theme'), null);
});
