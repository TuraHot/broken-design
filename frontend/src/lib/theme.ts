// Light/dark theme: which routes may be light, and which theme a visitor gets.
// Dark is today's look and the default. A route is "light-ready" only once its page uses the colour tokens
// (see docs/DESIGN_SYSTEM.md); every other route is always dark, whatever the visitor chose.
export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'theme';

/** Routes whose pages are converted to the colour tokens. Add a route here only after checking both themes. */
export const THEME_READY_ROUTES: readonly string[] = [];

const normalize = (pathname: string) => {
  const path = pathname.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path || '/';
};

/** Exact match on the path (no query, hash or trailing slash): `/` matches only `/`. */
export function isThemeReady(pathname: string, routes: readonly string[] = THEME_READY_ROUTES): boolean {
  return routes.includes(normalize(pathname));
}

/**
 * The theme for a route: dark unless the route is light-ready; there, the saved choice (only `light` or `dark`) wins,
 * and with no valid choice the system setting decides.
 */
export function resolveTheme(
  pathname: string,
  saved: string | null,
  systemLight: boolean,
  routes: readonly string[] = THEME_READY_ROUTES,
): Theme {
  if (!isThemeReady(pathname, routes)) return 'dark';
  if (saved === 'light' || saved === 'dark') return saved;
  return systemLight ? 'light' : 'dark';
}

/** The value of one cookie from a `document.cookie` string, or null. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}
