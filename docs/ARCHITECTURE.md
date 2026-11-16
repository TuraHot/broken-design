# Lixyte — System Architecture

Describes how the system is put together. Update when services, routes, data or flows change. Status tags as in `PRD.md`: **[built]**, **[partial]**, **[scaffold]**, **[todo]**. Last checked against the code on branch `kzwnjuy` after merging `main` (2026-11-15). For access rules and the security invariants see `AGENT.md`; for who owns what see `README.md` §7 and `TASKS.md`.

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

Both backends read the same PostgreSQL database and verify the same JWT (`JWT_SECRET` must match in `core-api` and `cdn-service`).

## 2. Components

### frontend — Next.js 15 (App Router), React 19, Tailwind 3 — port 3000
| Path | Role | Status |
|---|---|---|
| `src/app/layout.tsx` | Root layout: Chakra Petch body font plus Michroma (`font-display`) and Share Tech Mono (`font-mono`), `<Navbar />` and `<Footer />` (both hidden on the auth pages and `/admin/*`, see `lib/auth-paths.ts`); the page sits in a `min-h-dvh` flex column so the footer is always at the bottom; wrapped in `ReportProvider` | [built] |
| `src/app/page.tsx` | Landing: fixed 3D lily background that bursts on scroll, hero, then `components/landing/*` (Popular carousel, Categories), New arrivals and a join banner | [built] |
| `src/app/creator/page.tsx`, `src/components/creator/CreatorModel.tsx` | Creator landing (content only) with the butterfly scene; HUD callouts exist but are switched off (`SHOW_CALLOUTS`) | [built] |
| `src/components/viewer/ButterflyScene.tsx`, `CreatorViewer.tsx`, `LilyScene.tsx`, `LilyViewer.tsx` | Three.js scenes (client only, dynamic import). `CreatorScene.tsx` is an unused earlier version | [built] |
| `src/components/Navbar.tsx`, `AccountMenu.tsx`, `src/lib/session.ts` | Global navigation; the search box sends you to `/gallery?q=…`. The right side is "Log in" or, when `localStorage` holds a valid saved sign-in, an account menu (Library, Seller dashboard if `is_seller`, Admin if role `admin`, Log out). `session.ts` only reads and clears what `AuthForm` saved (`token`, `accessToken`, `user`) and treats an expired JWT (`exp`, signature not checked) or damaged data as signed out. The menu is a convenience, not access control | [built] |
| `src/app/login/page.tsx`, `src/components/auth/AuthForm.tsx`, `src/lib/auth.ts` | `/login`: email → `POST /api/auth/check-email` → password (`login`) or display name + password (`register`). On success the token is saved in `localStorage` (`token`, `accessToken`, `user`). "Continue with Google" is UI only | [built] |
| `src/app/forgot-password/page.tsx`, `components/auth/ForgotPasswordForm.tsx` | Validates the email and sends nothing (no endpoint yet) | [scaffold] |
| `src/app/upload/page.tsx` | Upload form with live 3D preview and poster capture; posts multipart to cdn-service `POST /api/models` with the stored token (in development it falls back to a dev token, see Known issues) | [built] |
| `src/app/models/[id]` | Model detail: server page + `components/model/*` (`ModelPreview` streams the 3D preview and accepts an embed key, `ModelActions` downloads through the CDN and starts checkout, `EmbedSnippets`, `LicenseRules`); data from `fetchModel` / `fetchMoreFromCreator` in `lib/api.ts` | [partial] |
| `src/app/creators/[handle]` | Creator profile (server page + `components/profile/*`); `fetchCreator` builds it from the creator's models, mock by default; core-api has no `GET /api/creators/:handle` | [partial] UI only |
| `src/app/embed/[id]/page.tsx`, `components/viewer/EmbedIframeViewer.tsx` | Iframe viewer; falls back to `preview.glb` when the key is wrong or rotated | [built] |
| `public/embed.js` | `<vm-model>` custom element wrapping `<model-viewer>`; same preview fallback | [built] |
| `src/app/gallery/page.tsx`, `error.tsx` | Gallery: server component reading `page, q, tag, license, price` from the URL → `fetchModels()` → card grid. The header comment in `page.tsx` still says "search and filters are UI only"; that is out of date | [built] |
| `src/components/gallery/` | `ModelCard`, `Pagination`, `FilterBar` / `FilterDropdown` (client; they push the chosen filter into the URL) | [built] |
| `src/lib/api.ts` | `fetchModels`, `fetchModel`, `fetchMoreFromCreator`, `fetchCreator`. Merges real core-api models with the mock catalogue unless `NEXT_PUBLIC_USE_MOCK=false`. On the server it uses `INTERNAL_CORE_API_URL` (Docker) if set, otherwise `NEXT_PUBLIC_CORE_API_URL`; `CDN_SERVICE_URL` from `NEXT_PUBLIC_CDN_SERVICE_URL` | [built] |
| `src/lib/pagination.ts`, `mock-models.ts`, `types.ts` | Search / filter / popularity sort / paging for the mock catalogue, `parseParams` / `buildHref`, shared types. Tests: `npm test` (`pagination.test.mjs`, 4 cases) | [built] |
| `src/app/me/page.tsx` | One heading ("My Dashboard") | [scaffold] |
| `components/report/ReportProvider.tsx` | `ReportProvider` (in `app/layout.tsx`) offers `useReport().openReport()`; the account menu and the footer call it to show `ReportForm` in a `components/ui/Modal.tsx` popup (on a real model page the model link is pre-filled). There is no `/report` page. Data goes through `lib/complaints.ts` | [built] |
| `src/app/admin/*` (`/admin`, `models`, `users`, `purchases`, `complaints`) | Client pages inside `components/admin/AdminShell.tsx` (its own layout: sidebar on desktop, top bar + tabs on phones, no public Navbar/Footer via `hidesPublicChrome` in `lib/auth-paths.ts`; gate: signed out → 401 notice, non-admin → 403 notice; the API still re-checks). Data comes from `lib/admin-api.ts` (attaches the token from `lib/session.ts`); the three lists share `components/admin/AdminList.tsx` (search, 25 per page, row actions with a two-step "Sure?" button) | [built] |
| `src/app/pay/mock/[id]`, `seller`, `docs` | Not created yet. core-api checkout already returns `/pay/mock/<purchase id>`; the Navbar links to `/docs` | [todo] |
| `src/components/playground` | Empty folder (embed playground) | [todo] |

`next.config.ts` sets CSP: `frame-ancestors *` for `/embed/*` (so it can be iframed anywhere), `frame-ancestors 'self'` for everything else.

### core-api — Express 5, TypeScript — port 4000
Business logic and metadata. JWT bearer auth (`middlewares/auth.middleware.ts`), error handler (`error.middleware.ts`, errors as `{ error: { code, message } }`), CORS limited to `FRONTEND_URL` (`config/cors.ts`; outside production its `localhost` / `127.0.0.1` twin is allowed too, since a browser treats them as different origins). Tests: 48 (`admin` 20, `auth` 2, `complaints` 5, `cors` 4, `payments` 12, `seller` 5), run with `npm test`.

| Module | Routes | Status |
|---|---|---|
| `auth` | `POST /api/auth/check-email`, `register`, `login` (suspended accounts: `403 ACCOUNT_SUSPENDED`) | [built] |
| `models` | `GET /api/models` (`q`, `tag`, `license`, `price`, `page`, `pageSize`; hides hidden, deleted and suspended-owner models), `GET /api/models/:id` (never returns the full-file link of a paid model), `DELETE /api/models/:id` (soft delete: owner or admin, blocked for suspended users). `PATCH /api/models/:id` is a TODO stub | [partial] |
| `payments` | `POST /api/models/:id/checkout` (locks price, currency, license; returns `checkoutUrl: /pay/mock/<id>`), `POST /api/purchases/:id/confirm-mock`, `POST /api/models/:id/pay-mock` (both only when `PAYMENT_PROVIDER=mock`), `GET /api/me/purchases`, `POST /api/purchases/:id/regenerate-key`, `GET /api/purchases/:id`. `POST /api/webhooks/stripe` is a stub | [partial] |
| `seller` | `POST /api/seller/enable`, `GET /status`, `/models`, `/sales` (role checked against the database) | [built] |
| `complaints` | `POST /api/complaints` (login needed; account status read from the database; `{ category, modelId?, message }`, model complaints need a model; at most 5 an hour per user, then `429 TOO_MANY_COMPLAINTS`). Table `complaints` in `schema.sql` | [built] |
| `interactions` | `POST /api/models/:id/like`, `GET` / `POST /api/models/:id/comments` | [scaffold] |
| `admin` | `GET /api/admin/overview` (totals, 7-day figures, free / paid and per-license counts, seller / admin counts, unpaid orders, top 5 models by downloads, 5 latest paid purchases and 5 newest users), `GET /users`, `PATCH /users/:id/suspend` (`{ suspended }`, not on yourself), `GET /models` (includes hidden and deleted), `PATCH /models/:id/hide` (`{ hidden }`), `GET /purchases` (never returns `embed_key`), `GET /complaints` (`?status=`, open first, with reporter, model and owner) and `PATCH /complaints/:id` (`{ status, adminNote? }`). Lists take `page`, `pageSize` (max 100) and `q`. Every route checks `role = 'admin'` and `suspended_at IS NULL` in the database (local `requireActiveAdmin` in the module, not the JWT role) | [built] |
| health | `GET /health` (also reports the database) | [built] |
| `scripts/seedAdmin.ts` | Creates the admin and a creator account (password from `ADMIN_SEED_PASSWORD`, with a default in code) | [built] |

### cdn-service — Express 5, TypeScript — port 4001
File upload and streaming. Tests: 23 (`modules/cdn/cdn.test.ts`), run with `npm test`.

| Route | Purpose | Status |
|---|---|---|
| `POST /api/models` | Multipart upload (`file`, `preview?`, `poster?`, metadata). `requireAuth` + `requireSeller`, then the account is checked in the database (suspended = `403`). Validates the GLB header, embeds the original watermark, computes sha256, stores, inserts the row. Limits: main 50 MB, preview 5 MB, poster 1 MB | [built] |
| `GET /cdn/models/:id/:hash.glb` | Free model or paid `preview_hash` only (a paid `file_hash` answers `401 KEY_REQUIRED`); `immutable` cache, Range, ETag | [built] |
| `GET /cdn/models/:id/preview.glb` | Public preview (free: full file, paid: the preview), short cache | [built] |
| `GET /cdn/models/:id/file.glb?key=` | Full file of a paid model for a valid embed key (`timingSafeEqual`), `private, no-store`, failed-key limiter | [built] |
| `GET /cdn/models/:id/download` | Download (`Content-Disposition: attachment`); paid models need the buyer's or owner's JWT; embeds the buyer's watermark and saves `watermark_hash`; counts the download only when the stream starts at byte 0 | [built] |
| `GET /cdn/models/:id/poster.webp` | Poster image | [built] |
| `POST /cdn/verify-watermark` (also `/verify-watermark`, `/api/verify-watermark`) | Checks a `.glb` for both watermark layers | [built] |

Every `/cdn/*` route supports `HEAD`, `If-None-Match` (304), `Range` (206 / 416) and sets `Cross-Origin-Resource-Policy: cross-origin`; errors are `Cache-Control: no-store`. Rate limits (`express-rate-limit`): streams 600 per minute, failed keys 30 per 15 minutes, downloads 30 per minute (tunable by env).

Storage sits behind `StorageAdapter` (`put`, `getStream`, `delete`) with `LocalDiskStorage` and `SupabaseStorage`, chosen by `STORAGE_PROVIDER`. Files are addressed by content hash. Watermarking is in `utils/glbWatermark.ts`, validation in `utils/glbValidator.ts`.

### Database — PostgreSQL (Supabase), `supabase/schema.sql`
- Enums: `user_role` (`user`, `creator`, `admin`), `license_type` (`CC0`, `CC-BY`, `CC-BY-NC`, `COMMERCIAL`), `purchase_status` (`pending`, `paid`).
- `users` (email unique, `password_hash`, `display_name`, `role`, `is_seller`, `suspended_at`).
- `models` (`owner_id`, title, description, `tags text[]` with GIN index, `license`, `file_hash`, `file_size`, `preview_hash`, `poster_hash`, `price_cents`, `currency`, `view_count`, `download_count`, `hidden_at` (admin hide), `deleted_at` (soft delete)).
- `purchases` (`user_id`, `model_id`, `status`, `amount_cents`, `currency`, `license_type`, `watermark_hash`, `paid_at`, `provider_session_id`, `embed_key` unique, unique per user + model).
- `likes`, `comments`.

## 3. Key flows

**Sign in:** `/login` → `check-email` → `login` or `register` → JWT saved in `localStorage` → sent as `Authorization: Bearer` to both backends.

**Upload:** `/upload` → cdn-service `POST /api/models` → seller + account checks → validate GLB header → embed original watermark → sha256 → `StorageAdapter.put` → insert `models` row → visible in `GET /api/models`.

**Browse:** gallery server component reads `page, q, tag, license, price` from the URL → core-api `GET /api/models` (merged with the mock catalogue unless disabled) → cards (poster via `/cdn/models/:id/poster.webp`).

**Embed (free):** `<vm-model model-id=...>` (or the `/embed/[id]` iframe) → `model-viewer` loads the file from `/cdn/models/:id/` (Range, CORS `*`, cached).

**Embed (paid):** `<vm-model model-id=... key=...>` → `/cdn/models/:id/file.glb?key=...` → key compared in constant time → stream; on `401` / `403` the viewer falls back to `preview.glb` with a notice.

**Purchase (mock):** `ModelActions` → `POST /api/models/:id/checkout` → `checkoutUrl /pay/mock/<id>` → (page missing) → `confirm-mock` marks `paid` → `GET /api/me/purchases` shows the embed key → `regenerate-key` rotates it.

**Download:** `ModelActions` → `GET /cdn/models/:id/download` with the JWT → buyer's watermark embedded → file streamed.

**Moderation:** an admin sets `hidden_at` / `suspended_at` from `/admin/models` or `/admin/users` (`PATCH /api/admin/...`) → the CDN answers `403 MODEL_UNAVAILABLE` at once, even for earlier buyers.

## 4. Environment & deployment
- Env per service from `.env.example`: core-api `PORT`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CDN_SERVICE_URL`, `PAYMENT_PROVIDER`, `STRIPE_*`; cdn-service `DATABASE_URL`, `JWT_SECRET`, `WATERMARK_SECRET`, `STORAGE_PROVIDER`, `STORAGE_DIR`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_STORAGE_BUCKET`, `MAX_*_SIZE_BYTES`, `TRUST_PROXY`, `CDN_*` rate limits; frontend `NEXT_PUBLIC_CORE_API_URL`, `NEXT_PUBLIC_CDN_SERVICE_URL`, `NEXT_PUBLIC_USE_MOCK`, `INTERNAL_CORE_API_URL` (set by Compose).
- Local: `docker compose up --build` (volumes for cdn storage and tmp uploads) or `npm run dev` per service. Compose reads `.env.example` first and then `.env` / `.env.local` over it.
- Planned hosting: Vercel (frontend), Render (core-api, cdn-service; set `TRUST_PROXY=1`), Supabase (DB + object storage).
- `embed.js` default CDN base is `http://localhost:4001`; set `cdn-base` in production.

## 5. Known issues to fix before launch
Open:
1. Both services fall back to JWT secret `'dev-secret'`, and cdn-service falls back to a fixed `WATERMARK_SECRET` that is in the repository. Fail startup in production if they are missing.
2. The shared `requireAdmin` (and `requireSeller` in core-api) trust the role in the JWT only (the `/api/admin/*` module has its own database check). `AGENT.md` §3.2 requires checking the current role and `suspended_at` in the database; a suspended admin keeps access until the token expires.
3. `jwt.verify` result is cast to `AuthUser` without validating the payload, and `algorithms: ['HS256']` is not pinned (both services).
4. cdn-service uses `cors({ origin: '*' })` globally, including the upload route; restrict `*` to the public streaming routes (the upload route does need a token now).
5. No rate limit on the auth routes or on upload. `check-email` tells anyone whether an email is registered, so it needs one.
6. Stripe webhook needs the raw request body for signature checks, but `express.json()` runs first in `app.ts` (the handler is only a stub today).
7. Embed key in the query string leaks into logs and referrers; consider a header or short-lived token.
8. The seed accounts and their default passwords are written in `schema.sql`, `seedAdmin.ts` and `README.md`; change them before any real deployment.
9. `frontend/src/app/upload/page.tsx` has a creator JWT hard-coded as `DEV_CREATOR_TOKEN`. It is signed with the dev secret, but it should not be in the repository (an earlier fix moved it to `.env.local` and the merge brought it back). Remember that `NEXT_PUBLIC_*` values are inlined into the browser bundle.
10. `/pay/mock/[id]` does not exist, so the checkout redirect lands on a 404 page. The frontend must never trust a `mock_paid` style query parameter.
11. `PATCH /api/models/:id` is a stub. The shared `requireAdmin` in `auth.middleware.ts` still trusts the JWT role (no database check); only the admin module uses its own database-checked guard.

Fixed since the last check: `embed.js` now has a `preview.glb` route to call; the `LocalDiskStorage.put` rename falls back to copy + unlink across volumes; upload size limits are enforced and the CDN has rate limits; Compose no longer uses only `.env.example`.
