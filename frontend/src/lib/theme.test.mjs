// Run: npm test  (Node's built-in runner; imports the TS source via type stripping)
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { isThemeReady, readCookie, resolveTheme, themeBootstrapScript } from './theme.ts';

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

// The pre-paint script is hand-written ES5 (it cannot import), so run it for real and check it agrees with resolveTheme.
function runBootstrap(routes, { pathname, cookie = '', systemLight = false, noMatchMedia = false, cookieThrows = false }) {
  const dataset = {};
  const doc = { documentElement: { dataset } };
  Object.defineProperty(doc, 'cookie', {
    get() {
      if (cookieThrows) throw new Error('blocked');
      return cookie;
    },
  });
  const ctx = { document: doc, location: { pathname } };
  if (!noMatchMedia) ctx.matchMedia = () => ({ matches: systemLight });
  vm.runInNewContext(themeBootstrapScript(routes), ctx);
  return dataset.theme;
}

test('bootstrap script agrees with resolveTheme for every combination', () => {
  for (const pathname of ['/', '/gallery', '/about/', '/about/x']) {
    for (const saved of [null, 'light', 'dark', 'blue']) {
      for (const systemLight of [true, false]) {
        const cookie = saved === null ? 'a=1' : 'a=1; theme=' + saved;
        assert.equal(
          runBootstrap(routes, { pathname, cookie, systemLight }),
          resolveTheme(pathname, saved, systemLight, routes),
          pathname + ' ' + saved + ' ' + systemLight,
        );
      }
    }
  }
});

test('bootstrap script falls back to dark when matchMedia is missing or the cookie cannot be read', () => {
  assert.equal(runBootstrap(routes, { pathname: '/', noMatchMedia: true }), 'dark');
  assert.equal(runBootstrap(routes, { pathname: '/', cookieThrows: true }), 'dark');
});
