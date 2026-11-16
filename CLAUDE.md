# CLAUDE.md — Claude Code Instructions for Lixyte (Broken Design)

Before writing code, editing files, or running commands in this repository, you **MUST** read and strictly follow **[AGENT.md](./AGENT.md)** (engineering specification, security invariants and roadmap).

Project: **Lixyte**, a 3D asset repository and WebGL CDN (a library of 3D models you embed with one line of code). Monorepo with `frontend/` (Next.js), `services/core-api/` and `services/cdn-service/` (Express 5), `supabase/schema.sql`.

## Read first
| File | When |
|---|---|
| `AGENT.md` | **always**: security rules, access matrix, API contract, roadmap |
| `docs/PRD.md` | what the product is, scope, features, status |
| `docs/ARCHITECTURE.md` | services, routes, data flow, known issues |
| `docs/DESIGN_SYSTEM.md` | **before any UI work** (colors, fonts, spacing, buttons, cards, icons, patterns) |
| `docs/TASKS.md` | which pages and routes exist, what is missing, who owns what |
| `README.md` | team split (6 members, §7), folder structure, setup |

If code and these docs disagree, say so and fix one of them. Update the docs in the same change when scope, architecture or UI rules change.

## Working with the user
- The user writes Thai. **Reply in Thai**, keep code, identifiers, file names and commit messages in English.
- Be concise; lead with the result. Say plainly what was verified and what wasn't.
- New features: brainstorm first (short design, get a "yes") before writing code. Small, clearly specified changes can go straight to implementation.
- Commit or push **only when asked**. Never put secrets in git (`.env*` is ignored except `.env.example`; keep placeholders only in the example files).

## Commands
| Task | Command |
|---|---|
| Frontend dev | `cd frontend && npm run dev` → http://localhost:3000 |
| Type check (safe anytime) | `cd frontend && npx tsc --noEmit`; same with `-p .` in `services/core-api` and `services/cdn-service` |
| Tests | `npm test` inside `frontend/` (pagination), `services/core-api/` (auth, payments, seller) and `services/cdn-service/` (CDN, watermark) |
| Production build | `cd frontend && npm run build` — **never while `npm run dev` is running** (shared `.next`; it breaks the dev server with a 500). Stop dev first, restart after. |
| Everything via Docker | `docker compose up --build` |
| core-api / cdn-service dev | `npm run dev` inside each folder (ports 4000 / 4001) |

On Windows PowerShell with a script policy, use `npx.cmd` / `npm.cmd`. Run `npm install` in a service folder before type-checking it.

The built-in browser preview can start the frontend via `.claude/launch.json`. If port 3000 is already used by the user's dev server, preview that instead; don't kill processes you didn't start.

## Code rules
- TypeScript strict. Match the style of surrounding code (comment density, naming).
- **No new dependencies** unless asked. UI icons come from `lucide-react`; 3D uses `three`.
- Respect folder ownership in `README.md` §7 when touching shared areas; don't rewrite another area casually.
- WebGL/Three.js code is client-only: use `'use client'` and load with `dynamic(..., { ssr: false })`. Clean up renderers, geometries, materials, listeners and animation frames in effect cleanup (React Strict Mode runs effects twice).
- Respect `prefers-reduced-motion`.
- Backend: validate input (zod is planned), never trust client-supplied roles/prices (check role and `suspended_at` in the database, `AGENT.md` §3.2), constant-time compare for keys, and don't widen CORS. See "Known issues" in `docs/ARCHITECTURE.md` before touching auth, CDN, payments or Docker env.
- Standard error body for every API: `{ "error": { "code", "message" } }`.

## UI rules (summary — full rules in `docs/DESIGN_SYSTEM.md`)
Dark-first, black canvas, thin `white/10` lines, Chakra Petch body font, `rounded-lg` controls, one primary (white) button per view, `lucide-react` icons only. Verify visually at desktop and 375px before calling a UI change done.

## Current state (keep updated; the full list is in `docs/TASKS.md`)
- Working: landing page, Gallery (search and Tag / License / Price filters work through the URL; real models from core-api are merged with the mock catalogue unless `NEXT_PUBLIC_USE_MOCK=false`), model detail (3D preview from the CDN, download, start of checkout), `/login` connected to core-api (`check-email`, `login`, `register`, token in `localStorage`; "Continue with Google" is UI only), `/upload` (3D preview, poster capture, goes to cdn-service), `/embed/[id]` and `public/embed.js`, Creator landing `/creator` (HUD callouts off with `SHOW_CALLOUTS = false`), creator profile `/creators/[handle]` (UI only, mock data, read-only).
- Backend working: auth, models list/detail/delete, payments (mock), seller, admin (`/api/admin/*` with the four `/admin/*` pages), CDN streaming, watermark. Still stubs or missing: `PATCH /api/models/:id`, forgot-password, `/api/creators/:handle`, likes/comments, Stripe webhook.
- Pages still missing: `/pay/mock/[id]` (checkout already redirects there, so it 404s), `/seller`, `/me` (one heading only), `/docs`, `/licenses`, legal pages, embed playground, global 404 / 403 / 500. After login the Navbar shows an account menu (`components/AccountMenu.tsx`; its Seller link leads to a page that does not exist yet; the four `/admin/*` pages exist; a signed-in admin is redirected to `/admin` by `components/AdminOnlyRedirect.tsx` unless they pressed "View Website" in that tab).
- `/forgot-password` is UI only. Navbar link `/docs` has no page yet — leave the link as it is.
