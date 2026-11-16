# Lixyte — Product Requirements (PRD)

Status tags: **[built]** works in code, **[partial]** part of it works (see the note), **[scaffold]** route/page exists but is a placeholder or stub, **[todo]** not started. Source of truth for scope; update when scope changes. Last checked against the code on branch `kzwnjuy` after merging `main` (2026-11-15). Who owns which page and what is still open: [`TASKS.md`](TASKS.md).

## 1. What it is
Lixyte is a **3D asset repository and WebGL CDN** — a library of 3D models you can embed on any site with one line of code. It stores, searches and streams standard `.glb` (binary glTF 2.0) models, and lets anyone embed a model on an external website with an `<iframe>` or a `<vm-model>` web component, without downloading or hosting the file.

## 2. Who it is for
- **Web developers / designers** who want 3D on a site with one line of code and no hosting.
- **3D creators** who want to publish models (free or paid), reach developers, and see usage.
- **Buyers** (a developer who buys a paid model) who need a stable embed key for their site.
- **Admins** who moderate the catalogue (hide models, suspend accounts, see all orders). Admin is set in the database only, cannot be self-registered, and cannot buy or sell.

One account covers buyer and seller: any user can switch on **seller mode** (`is_seller`).

## 3. Problem it solves
- Putting a 3D model on a website means finding a model, downloading it, hosting a heavy file, wiring a viewer and handling caching/CORS.
- Creators have no simple place to publish `.glb` files that can be used directly in the browser, with licensing and payment built in.

Lixyte makes a model usable by copying a snippet; the platform hosts, validates and streams it.

## 4. Goals
1. Find a model and embed it on any site in under a minute.
2. Models are safe and valid (`.glb` validated on upload) and stream fast (cache + HTTP Range).
3. Creators can publish free or paid models; buyers get an embed key they can rotate.
4. A downloaded file can be traced back to the buyer (two-layer watermark).

## 5. Non-goals (for now)
Model editing in the browser, formats other than `.glb`, real-time collaboration, in-app 3D authoring, manual light/dark switching, enterprise plans.

## 6. Features

### Must have (MVP)
| Feature | Description | Status |
|---|---|---|
| Landing page | Dark HUD hero with the 3D lily (it bursts apart on scroll), the headline "3D models, one line of code" and a short explanation, then Popular models, Categories, New arrivals and a join banner | [built] |
| Creator landing | Page at `/creator` for creators: what they can do, how it works in three steps, a glowing 3D butterfly, "Get started" → `/login`. Content only | [built] |
| Navbar / Footer | Logo, Gallery, Docs, Creator, search, Log in on every page (hidden on `/login` and `/forgot-password`). Search sends you to `/gallery?q=…`. After login the right side becomes an account menu (Library, Seller dashboard for sellers, Log out; admins do not use the public pages: after login they are sent to `/admin` and stay there, unless they press "View Website" in the admin layout); the Seller page it links to does not exist yet | [built] |
| Auth | core-api: `check-email`, `register`, `login` (bcrypt + JWT; roles `user`, `creator`, `admin`; suspended accounts get `403 ACCOUNT_SUSPENDED`). `/login` is connected: email first → password (known email) or display name + password (new email); the token is kept in `localStorage`. "Continue with Google" is **UI only**. There is no one-time-code step. `/forgot-password` is UI only (no endpoint) | [partial] |
| Seller mode | `POST /api/seller/enable`, `GET /api/seller/status`, `/models`, `/sales` in core-api (with tests). No seller page in the frontend yet | [partial] backend [built], page [todo] |
| Upload | `/upload` (live 3D preview, poster captured from the viewer) → cdn-service `POST /api/models`: seller only, account status checked in the database, `.glb` validated (magic bytes `glTF`, version 2, length = size; main ≤ 50 MB, preview ≤ 5 MB, poster ≤ 1 MB), original watermark embedded, stored by sha256. Paid models must include a preview file | [built] |
| Gallery | Paged grid of model cards. Real models come from core-api `GET /api/models` and are merged with the mock catalogue unless `NEXT_PUBLIC_USE_MOCK=false`. Search (`q`) and the Tag / License / Price dropdowns work and live in the URL | [built] |
| Model detail | `/models/[id]`: 3D preview streamed from the CDN (placeholder for sample catalogue models), description and tags, owner, stats, license rules, copy-ready embed code, "More from creator". Download streams through the CDN (login needed for paid models); "Buy" starts checkout. Not yet: like / comment, embed playground | [partial] |
| Creator profile | `/creators/[handle]` [UI only, mock data]: cover and photo (placeholders), stats, the creator's models, Donate box (no payment). Not yet: accounts, changing cover and photo, real donations, Commissions tab. Core-api has no `/api/creators/:handle` yet | [partial] |
| Embed | `<iframe>` page `/embed/[id]` and `public/embed.js` custom element `<vm-model>` (`model-id`, `key`, `cdn-base`, camera options). A wrong or rotated key falls back to `preview.glb` with a notice instead of breaking | [built] |
| Embed playground | Adjust viewer options, generate HTML / React / Vue / WordPress snippets | [todo] |
| CDN streaming | Free/preview GLB stream, paid GLB with embed key, poster, download, CORS, Cache-Control, HTTP Range, ETag, rate limits, hidden / suspended models blocked | [built] |
| Watermark | Two layers (signed metadata + vertex steganography) on upload and again on each paid download (with the buyer's purchase id); `POST /cdn/verify-watermark` checks a file | [built] backend, inspector page [todo] |
| Purchases | core-api: checkout (price, currency and license locked at purchase), mock confirmation, `GET /api/me/purchases`, regenerate key, `GET /api/purchases/:id` (with tests). Stripe webhook is a stub. The mock payment page `/pay/mock/[id]` does not exist yet | [partial] |
| Buyer dashboard | Purchase history, embed keys, regenerate (`/me`) | [scaffold] (page is one heading) |
| Creator dashboard | My models, sales, edit metadata, delete (`/seller`). `PATCH /api/models/:id` is a TODO; `DELETE` (soft delete) works | [scaffold] |
| Admin | Overview, hide / restore models, suspend / restore users, see orders (`/admin/*`). `/api/admin/*` and the four pages (`/admin`, `/admin/models`, `/admin/users`, `/admin/purchases`) are built; the CDN honours `hidden_at` and `suspended_at`. Hide / restore and suspend / restore ask "Sure?" first | [built] |
| Complaints | Any signed-in user can report a model, a person, a purchase or something else from a popup (account menu → "Report a problem", or the footer link; on a model page the model link is filled in) (a pasted model link fills in the model; max 5 reports an hour, 10 to 2000 characters). Admins read them at `/admin/complaints` (open first): "Read & respond" opens the whole complaint in a dialog where they change the status (open, in review, resolved, dismissed), add a note and hide the reported model | [built] |
| Likes & comments | Like a model, comment on a model | [scaffold] |

### Later
Docs site (`/docs`), licenses page, legal pages, a "Report" button on the model page that calls `openReport()` (the popup), system pages (global 404 / 403 / 500), forgot-password endpoint, usage statistics for creators, notifications, key lock to allowed domains, real Stripe checkout, automatic model optimisation (Draco / Meshopt).

## 7. Key user flows
1. **Discover → embed:** Landing → Gallery (search / filter) → Model detail → copy embed code → paste on own site.
2. **Publish:** Log in or sign up → turn on seller mode → Upload `.glb` + metadata → model appears in Gallery.
3. **Buy:** Model detail → Checkout → mock payment → embed key in `/me` → embed with `key=...`. (The payment page and `/me` are the missing pieces.)
4. **Moderate:** Admin hides a model or suspends an owner → the CDN stops serving it immediately, even to people who bought it. (Done from `/admin/models` and `/admin/users`.)

## 8. Content rules
- Licenses: `CC0`, `CC-BY`, `CC-BY-NC`, `COMMERCIAL`.
- Price in cents with a 3-letter currency (default USD); `0` = free.
- Deleting a model is a **soft delete** (`deleted_at`): it leaves the gallery, but buyers and the owner keep access.
- A **hidden** model (by an admin) or a model whose owner is **suspended** is blocked for everyone, buyers included.
- Free models need no login to view, stream or download. Paid models stream the full file only with a valid embed key, and download only for a paying buyer or the owner.

## 9. Success criteria
- A valid `.glb` uploaded by a creator can be embedded on a third-party page via both `<iframe>` and `<vm-model>`.
- A paid model streams only with a valid embed key; invalid keys are rejected.
- Gallery search/filter returns results through the URL (shareable links).
- Core pages work at 375px and desktop widths.

## 10. Open questions
- Payment provider for launch: mock only, or Stripe at launch?
- Platform fee / creator payout model.
- Moderation for uploaded files and comments (admin tools cover models, accounts and user complaints; comments have no moderation yet).
- Legal text (terms, privacy, refunds, DMCA) needs review by someone qualified before real payments.
- Landing copy: the headline is "3D models, one line of code"; confirm it with the team and the site name (Lixyte) before launch.
