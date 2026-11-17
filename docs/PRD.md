# Lixyte — Product Requirements (PRD)

Source of truth for product scope, goals, and content rules. Last reviewed on `main` after merging PR #15 (`kzwnjuy`) and `Pek` (2026-11-17).
> **Live implementation status, test counts & task owners:** See [`docs/TASKS.md`](TASKS.md) and [`AGENT.md` §6](../AGENT.md#6-เส้นทางการพัฒนาของโปรเจกต์-development-roadmap--agent-action-plan).

## 1. What it is
Lixyte is a **3D asset repository and WebGL CDN** — a library of 3D models you can embed on any site with one line of code. It stores, searches and streams standard `.glb` (binary glTF 2.0) models, and lets anyone embed a model on an external website with an `<iframe>` or a `<vm-model>` web component, without downloading or hosting the file.

## 2. Who it is for
- **Web developers / designers** who want 3D on a site with one line of code and no hosting.
- **3D creators** who want to publish models (free or paid), reach developers, and see usage.
- **Buyers** (a developer who buys a paid model) who need a stable embed key for their site.
- **Admins** who moderate the catalogue (hide models, suspend accounts, resolve complaints, view all orders). Admin is set in the database only, cannot be self-registered, and cannot buy or sell.

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

## 6. Product Scope

### Must have (MVP)
- **Landing & Discovery:** Dark HUD landing page (`/`) with interactive 3D lily hero, creator onboarding landing (`/creator`), global Navbar/Footer with role-aware account menu, and `/gallery` with URL-backed search (`q`) and Tag / License / Price filters.
- **Authentication & Account Mode:** Email-first login/sign-up (`/login`), suspended account blocking (`403 ACCOUNT_SUSPENDED`), and one-click seller mode activation (`is_seller`).
- **Creator Upload & Catalogue Management:** Validated `.glb` + preview/poster upload (`/upload`) with automatic `<model-viewer>.toBlob()` poster capture, content-addressable storage, plus creator model editing/soft-deletion (`/seller`).
- **Model Detail & Cross-Origin Embed:** Model showcase (`/models/[id]`) with 3D preview, license breakdown, copyable `<vm-model>` and `<iframe>` snippets (`/embed/[id]`), and automatic graceful fallback to `preview.glb` when an embed key is missing/invalid/rotated.
- **Single-Item Purchase & Downloads:** Checkout locking price, currency, and license type at purchase time, mock payment confirmation (`/pay/mock/[id]`), buyer library (`/me`) with `embed_key` viewing/regeneration, and authenticated downloads.
- **CDN & Multi-Layer GLB Watermarking:** Range/ETag/CORS-enabled CDN streaming plus two-layer GLB watermarking (metadata HMAC signature + 64-vertex X-coordinate steganography) on upload and paid downloads, backed by `/cdn/verify-watermark`.
- **Moderation, Complaints & System Error Pages:** User report modal (`openReport`) for flagging models/accounts/purchases, Admin dashboards (`/admin/*`) for overview, model hide/restore, user suspend/restore, purchases, and complaint resolution, plus global `403` / `404` / `500` error pages.

### Later (Post-v1)
Docs site (`/docs`), licenses comparison page (`/licenses`), legal pages (Terms, Privacy, Refunds, DMCA), "Report" trigger button directly on `/models/[id]`, forgot-password email flow, creator profile accounts/avatars/donations, embed playground (`/models/[id]/embed`), watermark inspector UI (`/verify`), creator usage stats, key domain locking, real Stripe checkout, likes/comments moderation, and automatic 3D compression (Draco / Meshopt).

## 7. Key user flows
1. **Discover → embed:** Landing → Gallery (search / filter) → Model detail → copy embed code → paste on own site.
2. **Publish:** Log in or sign up → turn on seller mode → Upload `.glb` + metadata → model appears in Gallery.
3. **Buy:** Model detail → Checkout → payment confirmation → copy `embed_key` or download watermarked `.glb` in `/me`.
4. **Moderate:** User submits a complaint or Admin reviews models/users in `/admin/*` → hiding a model or suspending an owner blocks CDN streaming immediately, including for earlier buyers.

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
