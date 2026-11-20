# Landing theme, step 1: theme system — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A light/dark theme system (tokens, no-flash bootstrap, per-route lock, toggle) that changes nothing visible on any page yet.

**Architecture:** Semantic colours become CSS variables (dark = today's values) mapped into Tailwind. `lib/theme.ts` holds one pure `resolveTheme` function; an inline `<head>` script (built from that same function) and a client `ThemeSync` both use it, so first paint and client navigation agree. A route is "light-ready" only when listed in `THEME_READY_ROUTES`; every other route is always dark.

**Tech Stack:** Next.js 15 App Router, Tailwind 3, React 19, `node --test` (type-stripped TS imports, like `pagination.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-20-landing-theme-design.md` (this plan covers its "Order of work" step 1 only).

## Global Constraints

- Default with no saved choice: follow `prefers-color-scheme`. Saved cookie `theme` = `light` | `dark`, max-age one year, wins over the system.
- Locked (not light-ready) routes are always `dark`, whatever the cookie or system says.
- `THEME_READY_ROUTES` starts **empty** in this step. (Spec says it starts as `/`; `/` is added in a later step once Navbar, Footer and the landing page are on tokens, otherwise light would show white text on white.)
- Dark token values equal today's look, so dark pages must not change visibly.
- Tokens: canvas `0 0 0` / `246 246 244`; ink `255 255 255` / `13 13 13`; ink-soft `166 166 166` / `59 59 59`; line `26 26 26` / `207 207 207`; card `11 16 24` / `255 255 255`; accent `143 211 255` / `123 79 224`; highlight `184 146 255` / `201 242 61` (dark / light, space-separated RGB).
- Existing Tailwind colours (`hud`, `violet`, `amber`, `brand`) stay.
- All UI text through `t()` in English and Thai. No `npm run build` while `npm run dev` runs; verify with `npx.cmd tsc --noEmit`. `<html>` gets `suppressHydrationWarning`.

## Review Focus

- Cookie holds garbage (`theme=blue`): behave as if there is no cookie.
- No cookie and the system setting flips while the page is open: the page follows live; with a cookie it does not.
- Client-side navigation from a ready route to a locked one (and back) switches the theme without a reload and without a flash.
- A system-light visitor on a locked route sees dark, and the toggle is not rendered there.
- Pre-paint script must never throw (blocked cookies, `matchMedia` missing): fall back to dark.

---

### Task 1: `resolveTheme` and route lock

**Files:**
- Create: `frontend/src/lib/theme.ts`
- Test: `frontend/src/lib/theme.test.mjs`

**Interfaces:**
- Produces:
  - `type Theme = 'light' | 'dark'`
  - `THEME_COOKIE = 'theme'`, `THEME_READY_ROUTES: readonly string[]` (empty)
  - `isThemeReady(pathname: string, routes?: readonly string[]): boolean` — exact match on the path without query or hash, trailing slash ignored (`/` matches only `/`).
  - `resolveTheme(pathname: string, saved: string | null, systemLight: boolean, routes?: readonly string[]): Theme` — `dark` unless the route is ready; on a ready route `saved` (only if exactly `light` or `dark`) wins, else `systemLight ? 'light' : 'dark'`.
  - `readCookie(cookieString: string, name: string): string | null`

- [ ] **Step 1: Write the failing tests** in `theme.test.mjs` (import from `./theme.ts`). Cases, with `routes = ['/', '/about']` passed as the last argument:
  - `isThemeReady('/', routes)` true; `('/gallery', routes)` false; `('/about/', routes)` true; `('/about/x', routes)` false.
  - `resolveTheme('/gallery', 'light', true, routes) === 'dark'` (locked wins over everything).
  - `resolveTheme('/', 'light', false, routes) === 'light'`; `resolveTheme('/', 'dark', true, routes) === 'dark'` (cookie beats system).
  - `resolveTheme('/', null, true, routes) === 'light'`; `resolveTheme('/', null, false, routes) === 'dark'`.
  - `resolveTheme('/', 'blue', true, routes) === 'light'` (garbage cookie ignored).
  - With the default (empty) routes, `resolveTheme('/', 'light', true) === 'dark'`.
  - `readCookie('a=1; theme=light; b=2', 'theme') === 'light'`; `readCookie('', 'theme') === null`; `readCookie('xtheme=light', 'theme') === null`.
- [ ] **Step 2: Run** `npm.cmd test` in `frontend`. Expected: FAIL, cannot find `./theme.ts` exports.
- [ ] **Step 3: Implement** the signatures above in `theme.ts`. `resolveTheme` and `readCookie` must be self-contained (no outer references) because Task 3 serialises them with `.toString()`.
- [ ] **Step 4: Run** `npm.cmd test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(theme): resolveTheme and per-route lock`.

### Task 2: Tokens and Tailwind mapping

**Files:**
- Modify: `frontend/src/app/globals.css`, `frontend/tailwind.config.ts`

**Interfaces:**
- Produces: Tailwind colours `canvas`, `ink`, `ink-soft`, `line`, `card`, `accent`, `highlight`, each `rgb(var(--c-<name>) / <alpha-value>)`, so `text-ink/65` and `bg-canvas/80` work.

- [ ] **Step 1: In `globals.css`** declare `--c-canvas`, `--c-ink`, `--c-ink-soft`, `--c-line`, `--c-card`, `--c-accent`, `--c-highlight` on `:root` with the dark values from Global Constraints, and override all seven under `html[data-theme='light']` with the light values.
- [ ] **Step 2: Make `html, body`** use `background: rgb(var(--c-canvas))`, and `color-scheme` and the `select`/`select option` colours follow the theme (`dark` vs `light`, option background `rgb(var(--c-card))`, colour `rgb(var(--c-ink))`). With no `data-theme` attribute the page is dark.
- [ ] **Step 3: In `tailwind.config.ts`** add the seven colours under `theme.extend.colors`.
- [ ] **Step 4: Verify** `npx.cmd tsc --noEmit` passes; start dev, open `/gallery` and `/`, confirm nothing changed in dark (same black canvas, same select list colours).
- [ ] **Step 5: Commit** `feat(theme): colour tokens and Tailwind mapping`.

### Task 3: No-flash bootstrap and `ThemeSync`

**Files:**
- Modify: `frontend/src/lib/theme.ts` (add `themeBootstrapScript`), `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/ThemeSync.tsx`

**Interfaces:**
- Consumes: `resolveTheme`, `readCookie`, `THEME_COOKIE`, `THEME_READY_ROUTES` from Task 1.
- Produces:
  - `themeBootstrapScript(routes: readonly string[]): string` — JS source that serialises `resolveTheme` and `readCookie`, reads `location.pathname`, `document.cookie` and `matchMedia('(prefers-color-scheme: light)')`, and sets `document.documentElement.dataset.theme`. Wrapped in try/catch; on any error sets `dark`.
  - `ThemeSync` (client, renders `null`): on pathname change and on `matchMedia` change events, sets `document.documentElement.dataset.theme` using `resolveTheme`. The `matchMedia` listener is only active while no valid cookie exists.

- [ ] **Step 1: Write the failing test** in `theme.test.mjs`: evaluate `themeBootstrapScript(['/'])` with `node:vm` in a context that fakes `location.pathname`, `document.cookie`, `document.documentElement.dataset` and `matchMedia`; assert `dataset.theme` is `light` for (`/`, no cookie, system light), `dark` for (`/gallery`, cookie `theme=light`), `dark` when `matchMedia` is undefined, `dark` when reading the cookie throws.
- [ ] **Step 2: Run** `npm.cmd test`. Expected: FAIL, `themeBootstrapScript` is not exported.
- [ ] **Step 3: Implement** `themeBootstrapScript` in `theme.ts` and `ThemeSync.tsx`.
- [ ] **Step 4: In `layout.tsx`** add `suppressHydrationWarning` to `<html>`, render `<script dangerouslySetInnerHTML={{ __html: themeBootstrapScript(THEME_READY_ROUTES) }} />` first inside `<head>`, and mount `<ThemeSync />` next to `NavigationProgress`.
- [ ] **Step 5: Run** `npm.cmd test` (pass) and `npx.cmd tsc --noEmit` (pass).
- [ ] **Step 6: Commit** `feat(theme): no-flash bootstrap and client sync`.

### Task 4: Toggle in the Navbar

**Files:**
- Create: `frontend/src/components/ThemeToggle.tsx`
- Modify: `frontend/src/components/Navbar.tsx` (render next to `<LanguageSwitch />`), `frontend/src/lib/i18n/messages.ts` (keys `theme.toLight`, `theme.toDark`)

**Interfaces:**
- Consumes: `isThemeReady`, `resolveTheme`, `readCookie`, `THEME_COOKIE`, `THEME_READY_ROUTES`.
- Produces: `ThemeToggle` — renders `null` when `!isThemeReady(pathname)`. Otherwise a button (lucide `Moon` when current theme is light, `Sun` when dark) with `aria-label`/`title` from `t('theme.toDark')` / `t('theme.toLight')`. Click sets `document.documentElement.dataset.theme` to the other theme and writes `theme=<value>; path=/; max-age=31536000; samesite=lax`. Same button style as `LanguageSwitch` (`h-9`).

- [ ] **Step 1: Add the two keys** in English and Thai ("Switch to dark theme" / "Switch to light theme"; Thai: "เปลี่ยนเป็นโทนมืด" / "เปลี่ยนเป็นโทนสว่าง").
- [ ] **Step 2: Implement** `ThemeToggle` and mount it in `Navbar.tsx`. Initial state must not mismatch hydration: read the current theme from `document.documentElement.dataset.theme` in an effect and render `null` until it is known.
- [ ] **Step 3: Verify in the browser** (dev server on 3300). With `THEME_READY_ROUTES` temporarily set to `['/']` (do not commit this): (a) `/` shows the toggle and `/gallery` does not; (b) clicking toggles `html[data-theme]` and sets the cookie; (c) reload keeps it with no flash; (d) delete the cookie, emulate a light system via `resize_window` `colorScheme: 'light'`, reload `/`: light; open `/gallery` by client link: dark; back: light; (e) set `theme=blue` by hand: behaves as no cookie. Revert the temporary change; confirm `THEME_READY_ROUTES` is empty and no toggle is visible anywhere.
- [ ] **Step 4: Run** `npx.cmd tsc --noEmit` and `npm.cmd test`. Expected: pass.
- [ ] **Step 5: Commit** `feat(theme): navbar toggle on light-ready routes`.

### Task 5: Docs and rule change

**Files:**
- Modify: `CLAUDE.md` (the "Dark-first HUD styling" line), `docs/DESIGN_SYSTEM.md` (the dark-first line plus a Theme section with the token table and the "migrate a page" checklist), `docs/ARCHITECTURE.md` (theme files), `docs/TASKS.md` (new row, status `[~]`)

- [ ] **Step 1: Edit** the rule to: dark is the default; light is supported on routes listed in `THEME_READY_ROUTES`; new UI uses the semantic tokens (`text-ink`, `bg-canvas`, …), not `text-white`/`bg-black`.
- [ ] **Step 2: Add** the migration checklist: convert classes, add the route, check both themes, 360 px, reduced motion, no flash, contrast, `tsc`.
- [ ] **Step 3: Commit** `docs(theme): light/dark rule, tokens and migration checklist`.
