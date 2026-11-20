# Landing redesign with a light/dark theme

Status: waiting for approval. Date: 2026-11-20. Owner: เจี๊ยบ (Navbar/Footer/Landing).

## Intent

The landing page should feel like a product, not a poster: a bold "cyber brutalism" first screen (reference image from the
user), a scroll-down cue and quick jumps between sections, and a theme the visitor can switch.

- **Dark** keeps today's colours (black canvas, `hud` blue, violet, amber) and the spectral lily in full bloom.
- **Light** uses the reference palette (off-white canvas, near-black ink, purple accent, lime highlight) and the lily
  becomes a **bud** drawn with ink lines.
- Both themes share one layout.

## Goals

1. A theme system that can be adopted one page at a time, with no page ever shown half-themed.
2. The new hero (section 1) in both themes, matching the approved mockup.
3. The lily moves into a framed area on the right of the hero, no longer bursts apart on scroll, and scrolls away with the
   hero.
4. Scroll-down arrow plus section dots; free scrolling stays (like the Zenless site), nothing is forced to snap.
5. Landing, Navbar and Footer fully themed. All other pages stay dark until the user asks for them, one at a time.

## Non-goals and anti-goals

- Not converting the other ~85 files that use fixed colours in this change. Each page is migrated when the user says so.
- Not a redesign of sections 2–5 (popular, categories, new arrivals, join). They only become theme-aware. Their redesign is
  a later request.
- No forced full-page snapping, no scroll-jacking library.
- Anti-goal: any page showing white text on a white canvas, or a theme flash on load, including for visitors whose system is light.

## Constraints

- `AGENT.md`/`CLAUDE.md` say "dark-first HUD". That rule is amended: dark is the default, light is supported on migrated
  pages. `docs/DESIGN_SYSTEM.md` records the light palette and the per-page rule.
- Three.js rules stay: `'use client'`, `dynamic(..., { ssr: false })`, clean up renderer, geometries, materials,
  listeners and RAF on unmount, respect `prefers-reduced-motion`.
- All UI text through `t()` in English and Thai. Verify at 360 px. Do not run `npm run build` while `npm run dev` runs.
- Today about 1,500 uses of `text-white`, `bg-black`, `border-white/…`, `bg-white/…` live in 89 files, and `globals.css`
  pins `color-scheme: dark`.

## Approaches considered

| | What | Trade-off |
|---|---|---|
| A | Theme only the landing page | Fast, but Navbar/Footer are shared, so the theme jumps when the visitor opens `/gallery`. |
| B | Theme the whole site at once | Complete, but 1,500 edits in one change cannot be checked page by page. |
| **C (chosen)** | Shared tokens and a toggle now; migrate page by page; unmigrated pages locked to dark | Slower to finish, never broken in between. |

The user chose C and asked to proceed gradually and check each page as they direct.

## Design

### Tokens and Tailwind

Semantic colours become CSS variables (space-separated RGB so opacity modifiers keep working), declared on `:root` for
dark and overridden under `html[data-theme="light"]`:

| Token | Tailwind name | Dark | Light |
|---|---|---|---|
| canvas | `canvas` | `#000000` | `#F6F6F4` |
| ink | `ink` | `#FFFFFF` | `#0D0D0D` |
| ink-soft | `ink-soft` | white at 65 % | `#3B3B3B` |
| line | `line` | white at 10 % | `#CFCFCF` |
| card | `card` | `#0B1018` | `#FFFFFF` |
| accent | `accent` | `#8FD3FF` | `#7B4FE0` |
| highlight | `highlight` | `#B892FF` | `#C9F23D` |

Migration is mechanical: `text-white` → `text-ink`, `bg-black` → `bg-canvas`, `border-white/10` → `border-line`,
`text-hud` → `text-accent`, `bg-white text-black` → `bg-ink text-canvas`. `color-scheme` and the native `<select>`
styling follow the theme. Light palette values were read by eye from the reference image; the builder confirms them
(see "Left to the builder").

### Theme state, no flash, per-page lock

- The theme follows the operating system (`prefers-color-scheme`) until the visitor uses the toggle. The toggle saves cookie
  `theme` = `light` | `dark` (one year), which then wins over the system setting. While no cookie exists, a change of the
  system setting is applied live.
- `lib/theme.ts` holds `THEME_READY_ROUTES` (starts as exactly `/`). A page is **migrated** when its route is listed.
- A small inline script in `<head>` sets `<html data-theme>` before first paint: on a migrated route the cookie value, or the
  system setting when there is no cookie; `dark` everywhere else. `<html>` carries `suppressHydrationWarning` because the
  script changes the attribute before React hydrates. A client `ThemeSync` re-applies it on client-side navigation.
- `ThemeToggle` (lucide `Sun`/`Moon`, in the Navbar next to the language button) is shown only on migrated routes. Its
  label goes through `t()`.
- Adding a page to the light theme = convert its classes, add the route to `THEME_READY_ROUTES`, verify, done.

### Fonts

Dark keeps Michroma (display) and Share Tech Mono (labels). Light uses a condensed bold display face and a monospace
text face as in the reference. `--font-display` and `--font-mono` change per theme. Thai glyphs fall back to Chakra
Petch in both, as today.

### Hero (section 1), both themes

Left column: `/01` label, three-line condensed title, tagline in accent colour, short body, a solid primary button
and a text link with a viewfinder icon, a vertical side label. Right column: a framed grid area holding the lily, a status
chip, a lime info box and a corner tag. The section is one screen tall.

- Title lines, tagline and body are new i18n keys (English and Thai).
- The status chip shows scene start-up progress, then "LIVE". The info box shows the real camera angles, refreshed a few
  times per second. No invented numbers.

### Lily

- The WebGL canvas moves from a fixed full-screen page background into the hero's right-hand frame, so it scrolls away
  with the hero. Rendering pauses while the hero is off screen.
- The burst code (triangle scatter and sparks, `uBurst`, the `scrollY` link) is deleted, not parked.
- `variant`: `bloom` (dark, as today) and `bud` (light). Bud = closed petals. Light render uses normal blending with dark
  line colours and purple/lime accents, because additive glow is invisible on a light canvas.
- Reduced motion: a still frame, no auto-rotation.

### Scroll cue and section dots

An arrow at the bottom centre of the hero (clear of the lily and the right column) and a vertical dot list on the right
edge (hero, popular, categories, new arrivals, join). Click scrolls smoothly (instant under reduced motion). The current
section is tracked with `IntersectionObserver`. Sections get `scroll-margin-top` so the Navbar does not cover them. Dots
move out of the way on narrow screens. Labels and `aria-current` go through `t()`.

### Other landing sections, Navbar, Footer

Converted to tokens only, so they read correctly in both themes. Layout unchanged.

## Order of work

1. Tokens, Tailwind mapping, `lib/theme.ts`, head script, `ThemeSync`, `ThemeToggle`, docs rule change.
2. Navbar and Footer on tokens (checked in both themes on `/` and unchanged on a locked page).
3. Hero layout, copy and scroll cue (without the new lily).
4. Lily: move into the frame, remove the burst, add `bud` and the light render.
5. Rest of the landing page on tokens.
6. Full check on `/` and `/gallery`.

Each step is checked in the browser before the next. Later pages are separate requests.

## Acceptance for a migrated page

Both themes (and a system-light visitor with no cookie) at desktop and 360 px, no horizontal overflow, reduced-motion behaviour, no flash on reload, body text at
least 4.5:1 contrast (purple `#7B4FE0` on `#F6F6F4` is about 4.8:1; lime is only ever a fill with dark text), `tsc`
passes, Thai and English.

## Left to the builder

- Confirm the light colours against the original reference image and adjust the tokens.
- Choose the exact condensed and monospace font families (Barlow Condensed and JetBrains Mono were used in the mockup).
- Tune the bud shape and the light line colours until it reads well at small sizes.

## Calls made without the user (please check)

- (Decided by the user) With no saved choice the theme follows the system setting; migrated pages only. Locked pages are always dark, even for a visitor whose system is light.
- The toggle is hidden on pages that are not migrated, instead of disabled.
- The lily canvas lives inside the hero and scrolls away, instead of staying fixed behind the page.
- The status chip and info box show real data.
