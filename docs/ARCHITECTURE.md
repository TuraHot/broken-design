# Lixyte — System Architecture

Component inventory, end-to-end flows, deployment configuration, and pre-launch known issues. Last reviewed on `main` after merging PR #15 (`kzwnjuy`), `Pek`, and `ham` (2026-11-17).
> **Authoritative Specs (Do Not Duplicate):**
> - **Access Control Matrix, Security Rules, Full API & DB Contracts & Test Commands:** [`AGENT.md`](../AGENT.md) (§3–§5, §7.2)
> - **Per-Page / Per-Route Task Status & Owners:** [`docs/TASKS.md`](TASKS.md) and [`README.md` §7](../README.md#7-การแบ่งงานภายในทีมผู้พัฒนา-6-คน-team-responsibilities)

## 1. Overview
Three runnable parts plus a database, split so heavy file upload/streaming never slows the main API.

```text
 Browser / 3rd-party site
   │  (pages, embed.js)                 (GLB / poster streaming)
   ▼                                          ▲
┌────────────┐   REST + JWT    ┌────────────┐ │   ┌──────────────┐
│  frontend  │ ───────────────▶│  core-api  │ │   │ cdn-service  │
│ Next.js    │                 │ Express 5  │ │   │ Express 5    │
│ :3000      │ ── upload ─────────────────────┼──▶│ :4001        │
└────────────┘                 └─────┬──────┘ └───│ /cdn/*       │
                                     │            └──────┬───────┘
                                     ▼                   ▼
                            ┌─────────────────┐   ┌───────────────┐
                            │ PostgreSQL      │   │ Storage       │
                            │ (Supabase)      │   │ local disk or │
                            └─────────────────┘   │ Supabase      │
                                                  └───────────────┘
```

Both backends read the same PostgreSQL database and verify the same JWT (`JWT_SECRET` must match in `services/core-api/.env` and `services/cdn-service/.env`).

## 2. Components

### `frontend/` — Next.js 15 (App Router), React 19, Tailwind 3 — port `3000`
| Path | Architectural Role |
| :--- | :--- |
| `src/app/layout.tsx` | Root layout (`Chakra Petch`, `Michroma`, `Share Tech Mono`), wraps `<LocaleProvider />` (language read from the `lang` cookie with `cookies()`, so every page renders per request), `<Navbar />`, `<Footer />` (hidden on auth & `/admin/*` via `lib/auth-paths.ts`), and `<ReportProvider />`; sets `<html lang>` |
| `src/app/page.tsx` | Landing page: hero (bold type left; the framed 3D lily right, `components/landing/HeroFrame.tsx` + `viewer/LilyScene.tsx`), scroll-down arrow and section dots (`landing/SectionDots.tsx`), Popular carousel, Categories, New arrivals, join banner. The lily fills its frame (no scroll burst): a full bloom in the dark theme, an ink-line closed bud in the light theme, rebuilt when the theme changes; it stops drawing while off screen, is a still frame under reduced motion, and publishes progress and camera angles to the status chip through `lib/lily-telemetry.ts` |
| `src/app/creator/page.tsx`, `src/components/creator/*` | Creator landing with Three.js butterfly (`ButterflyScene`/`CreatorViewer`; `SHOW_CALLOUTS` off) |
| `src/components/Navbar.tsx`, `AccountMenu.tsx` (with `notifications/NotificationBell.tsx`, the bell with the unread count and the latest notices), `AdminOnlyRedirect.tsx`, `lib/session.ts` | Global nav, search redirect (`/gallery?q=`), `localStorage` session reader (convenience only — backend re-checks roles), and admin redirect |
| `src/app/login/page.tsx`, `forgot-password/page.tsx`, `components/auth/*`, `lib/auth.ts` | Email-first auth flow (`/api/auth/check-email`, `login`, `register`) + UI-only Google button & forgot-password UI |
| `src/app/upload/page.tsx` | Multipart `.glb` upload to CDN service (`POST /api/models`) with live preview and `.toBlob()` poster capture |
| `src/app/gallery/page.tsx`, `components/gallery/*` | Server-rendered gallery reading URL params (`page`, `q`, `tag`, `license`, `price`) via `fetchModels` |
| `src/app/models/[id]/page.tsx`, `components/model/*` | Model detail page: CDN 3D preview (`ModelPreview`), download/checkout (`ModelActions`), `<vm-model>`/`<iframe>` snippets, license matrix |
| `src/app/creators/[handle]/page.tsx`, `components/profile/*` | Read-only creator profile built from creator's models + UI-only Donate card |
| `src/app/embed/[id]/page.tsx`, `components/viewer/EmbedIframeViewer.tsx`, `public/embed.js` | Cross-origin embed (`<iframe>` & `<vm-model>`) with automatic fallback to `preview.glb` when `embed_key` is invalid/revoked |
| `src/app/403/page.tsx`, `not-found.tsx`, `error.tsx` | Global system error boundaries (403 Forbidden, 404 Not Found, 500 System Error) |
| `src/components/report/*`, `components/ui/Modal.tsx`, `lib/complaints.ts` | Accessible modal dialog for reporting issues (`POST /api/complaints`) from account menu or footer |
| `src/app/admin/*`, `components/admin/*`, `lib/admin-api.ts` | Dedicated admin layout (`AdminShell`, `AdminList`) covering Overview, Models, Users, Purchases, and Complaints |
| `src/lib/api.ts`, `pagination.ts`, `types.ts` | Shared API client (`INTERNAL_CORE_API_URL` on SSR, `CORE_API_URL` in browser) |
| `src/app/me/page.tsx`, `src/app/seller/page.tsx` | Buyer dashboard (`/me`: purchases, `embed_key` copy/regenerate, watermarked `.glb` download, seller toggle) and Seller dashboard (`/seller`: revenue/sales summary, uploaded models table, soft delete) |
| `src/app/docs`, `licenses`, `terms`, `privacy`, `seller-terms`, `refunds`, `dmca`, `components/content/*`, `lib/legal.ts` | Static text pages (server components, no API calls). `components/content/prose.tsx` (`PageHeader`, `Section`, `P`, `UL`, `OL`, `C`, `Callout`, `DataTable`), `DocLayout` (table of contents + sections), `CodeBlock` (copy button) and `LegalPage` (draft notice, sections, links to the other documents). `/licenses` reads `lib/licenses.ts` |
| `src/lib/theme.ts`, `components/ThemeSync.tsx`, `ThemeToggle.tsx`, colour tokens in `app/globals.css` + `tailwind.config.ts` | Light/dark theme. `resolveTheme` picks the theme: always dark unless the route is in `THEME_READY_ROUTES`, then the `theme` cookie, then the system setting. An inline script in `<head>` sets `<html data-theme>` before paint (no flash); `ThemeSync` keeps it right on client navigation. `THEME_READY_ROUTES` is empty until the landing page is converted. |
| `src/lib/i18n/*` (`messages.ts`, `server.ts`, `client.tsx`, `admin-error.ts`), `components/LanguageSwitch.tsx` | English / Thai. The choice lives in the `lang` cookie (1 year, set in the browser, no URL change). `messages.ts` joins the text of every area in `en` and `th` (TypeScript requires both): the older keys are in the file itself and each newer area has its own file in `lib/i18n/messages/` (`auth.ts`, `system.ts`, ...) that is spread into the two tables, so a page's text does not clash with other people's changes. `auth-error.ts` turns an `AuthError` into text in the visitor's language. Client components call `useT()`, server components `getT()` from `lib/i18n/server`. The language button is in the Navbar and in the admin layout. Long text pages (`/docs`, `/licenses`, the five legal pages) keep the English page in `page.tsx` and the Thai page in `th.tsx` next to it; **a text change must be made in both files**. Translated so far: Navbar, Footer, account menu, report popup, `/contact`, `/settings` (part), `/docs`, `/licenses`, legal pages, `/admin/*`, the account pages (`/login`, `/register`, `/forgot-password`, `/reset-password`), the system pages (`403`, `404`, `500`, loading screens), `/embed` (language by `?lang=th|en`, because the cookie is not sent inside other sites) and the browsing pages (landing, `/gallery`, `/models/[id]`, `/creator`, `/creators/[handle]`; text in `messages/discover.ts`, gallery tag names through `lib/i18n/tag.ts`); the signed-in pages (`/me`, `/seller`, `/upload`, the avatar box and the rest of `/settings`; text in `messages/account.ts`, profile and avatar errors through `AuthError`); the buying flow (`/checkout/[id]`, `/checkout/success`, `/pay/mock/[id]`; text in `messages/pay.ts`, shared status/error type in `lib/i18n/msg.ts`). Every page is now translated. Messages that come from an API stay as the server wrote them |
| `src/app/settings/page.tsx`, `src/app/contact/page.tsx` | `/settings`: profile read from the saved session and Log out (password change, name/email change and account deletion are shown as "not available yet": no API). `/contact`: report popup button and links to DMCA, Docs, Licenses and Refunds; the support email is `[TO DECIDE]` |
| `src/app/pay/mock/[id]`, `components/playground/` | Pending pages tracked in [`docs/TASKS.md`](TASKS.md) |

`next.config.ts` sets CSP: `frame-ancestors *` for `/embed/*` and `frame-ancestors 'self'` for all other routes.

### `services/core-api/` — Express 5, TypeScript — port `4000`
Business logic and metadata (`middlewares/auth.middleware.ts`, `middlewares/error.middleware.ts`, `config/cors.ts` allowing `localhost`/`127.0.0.1` twins outside production).
- **`modules/auth/`:** `check-email`, `register`, `login` (blocks suspended users).
- **`modules/models/`:** Catalogue search/filter/pagination, model detail (`fileUrl` omitted when paid), soft delete (`PATCH /api/models/:id` is a stub).
- **`modules/payments/`:** Checkout with locked price/currency/license, mock confirmation (`PAYMENT_PROVIDER=mock`), purchase list, `embed_key` rotation (`POST /api/webhooks/stripe` is a stub).
- **`modules/seller/`:** Enable seller mode, seller status, owned models, sales summary (DB check).
- **`modules/admin/` & `modules/complaints/`:** Database-verified `requireActiveAdmin` guard (`role = 'admin' AND suspended_at IS NULL`), overview analytics, user suspend/restore with a written reason and an optional end time (one SQL statement updates `users`, writes `user_suspensions` and creates the `notifications` row; `modules/admin/suspensionSweeper.ts` clears `suspended_at` when `suspended_until` has passed, every 60 s, so every existing `suspended_at` check in core-api and cdn-service works unchanged; `login` puts the reason and end date in its 403 message because a suspended person cannot read notices), model hide/restore, model license change with a reason (one SQL statement updates `models`, writes `model_license_changes` and creates the owner's `notifications` row; existing purchases keep their license; the stored original GLB keeps its old embedded license text), purchase audit (without `embed_key`), user complaint submission (`5/hr` cap) and admin complaint resolution.
- **`modules/interactions/`:** Stub routes for likes and comments.
- **`scripts/seedAdmin.ts`:** Seeds default admin and creator accounts (`schema.sql` holds schema + seed rows).

### `services/cdn-service/` — Express 5, TypeScript — port `4001`
High-I/O upload, multi-layer `.glb` watermarking, and streaming (`upload/upload.routes.ts`, `upload/limitedDiskStorage.ts` (per-field size limits enforced while the file arrives: main 50 MB, preview 5 MB, poster 1 MB; an oversize field answers `413 FILE_TOO_LARGE` and leaves no temp file), `cdn/cdn.routes.ts`, `cdn/cdn.service.ts`, `cdn/range.ts`, `utils/glbValidator.ts`, `utils/glbWatermark.ts`, `storage/*`).
- Validates `.glb` magic bytes & sizes, embeds dual-layer HMAC metadata + 64-vertex X-coordinate steganography (`original` on upload, buyer `purchaseId` on paid download), stores by `sha256` behind `StorageAdapter` (`LocalDiskStorage` / `SupabaseStorage`), and streams with HTTP Range (`206`/`416`), `ETag`/`304`, `express-rate-limit`, constant-time `embed_key` checks, and `POST /cdn/verify-watermark`. Full endpoint & header spec: [`AGENT.md` §4.1 & §5](../AGENT.md#41-cdn-service-servicescdn-service--พอร์ต-4001).

## 3. Key end-to-end flows
1. **Sign in:** `/login` → `check-email` → `login` or `register` → JWT saved in `localStorage` (`token`, `accessToken`, `user`) → sent as `Authorization: Bearer` to both backends.
2. **Upload:** `/upload` → `cdn-service` `POST /api/models` → seller & DB suspension checks → validate GLB header → embed original watermark → `sha256` → `StorageAdapter.put` → insert `models` row → visible in `GET /api/models`.
3. **Browse:** Gallery SSR reads `page, q, tag, license, price` from URL → `core-api` `GET /api/models` (via `INTERNAL_CORE_API_URL` in Docker) → renders cards + `/cdn/models/:id/poster.webp`.
4. **Embed (free & paid):** `<vm-model>` or `/embed/[id]` loads `/cdn/models/:id/preview.glb` (or `/file.glb?key=...` for paid models verified via `crypto.timingSafeEqual`); `401`/`403` falls back to `preview.glb` with a notice.
5. **Purchase (mock) & Download:** `ModelActions` → `POST /api/models/:id/checkout` → `/pay/mock/<id>` *(pending page)* → `confirm-mock` sets `status = 'paid'` (checkout, confirm, pay and key change are refused for a suspended account by `requireNotSuspended`, which asks the database on every call) → buyer reads/regenerates `embed_key` in `/me` or downloads watermarked `.glb` via `GET /cdn/models/:id/download`.
6. **Moderation:** User submits complaint (`POST /api/complaints`) or admin sets `hidden_at` / `suspended_at` (`PATCH /api/admin/...`) → CDN immediately returns `403 MODEL_UNAVAILABLE` across all routes, including for buyers.

## 4. Environment & deployment
- Env vars are documented in [`frontend/.env.example`](../frontend/.env.example), [`services/core-api/.env.example`](../services/core-api/.env.example), and [`services/cdn-service/.env.example`](../services/cdn-service/.env.example).
- `docker-compose.yml` loads `.env.example` then overrides with `.env` / `.env.local`, and injects `INTERNAL_CORE_API_URL=http://core-api:4000` for `frontend` SSR. On Windows Docker Desktop, `DATABASE_URL` must use the **Supabase IPv4 Session Pooler** (`aws-0-<region>.pooler.supabase.com:5432`) because `db.<ref>.supabase.co` is IPv6-only (`ENETUNREACH` on Docker's IPv4 bridge).
- Planned hosting: Vercel (`frontend`), Render (`core-api`, `cdn-service`; set `TRUST_PROXY=1`), Supabase (PostgreSQL + `models` bucket). `embed.js` defaults `cdn-base` to `http://localhost:4001`; pass `cdn-base` attribute in production.

## 5. Known issues to fix before launch
1. Both services fall back to JWT secret `'dev-secret'`, and `cdn-service` falls back to a fixed `WATERMARK_SECRET` in the repo — fail startup in production when missing.
2. Shared `requireAdmin` and `requireSeller` in `services/core-api/src/middlewares/auth.middleware.ts` trust JWT claims without querying the DB (`modules/admin/` and `modules/seller/` currently re-check in their own middleware — consolidate in shared middleware per `AGENT.md` §3.2).
3. `jwt.verify` results are cast to `AuthUser` without schema validation, and `algorithms: ['HS256']` is not pinned (both services).
4. `cdn-service` configures `cors({ origin: '*' })` globally (including `POST /api/models`); restrict `*` to public `/cdn/*` streaming routes.
5. No rate limiting on `/api/auth/*` (notably `check-email` allows account enumeration) or `POST /api/models` upload.
6. Stripe webhook needs raw request body for signature verification, while `app.ts` applies `express.json()` globally first (currently a stub).
7. Passing `embed_key` in query string (`?key=`) exposes it to access logs and referrers; consider headers or short-lived tokens.
8. Seed credentials in `schema.sql`, `seedAdmin.ts`, and `README.md` must be rotated/disabled before production.
9. `frontend/src/app/upload/page.tsx` still embeds a fallback `DEV_CREATOR_TOKEN`; remove it before shipping.
10. `/pay/mock/[id]` and `PATCH /api/models/:id` are not completed yet (see [`docs/TASKS.md`](TASKS.md)).
