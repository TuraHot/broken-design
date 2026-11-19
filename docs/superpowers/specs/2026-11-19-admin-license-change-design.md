# Admin license change with a warning notice to the owner

Status: waiting for approval. Size: a small feature (one table pair, two endpoints, one dialog, one inbox).

## Intent
An admin can change the license of a model (for example a model uploaded as `CC0` that is really a copied commercial asset). The owner must be told what changed and why, like a warning notice, and the platform must keep a record.

## Goals
- Admin changes a model's license from `/admin/models` and must write a reason.
- The owner gets a notice in the website (inbox in `/seller`, unread counter in the account menu).
- Every change is recorded (old license, new license, reason, which admin, when).

## Non-goals
- No email in this version. The notice is created in one function (`createNotification`) so an email sender can be added later without touching the routes.
- No change to existing purchases: `purchases.license_type` is locked at purchase time and stays as bought.
- No re-watermarking of the stored original GLB (its embedded `original` license text keeps the old value; new buyers get the new license embedded at download time, as today).
- No notices for other admin actions yet (hide, suspend, complaints).

## Approaches
- A. In-website notice only (chosen by the user). No outside service needed, and a record stays in the database. Trade-off: the owner sees it only after logging in.
- B. Email only: needs an email service and keys, and leaves no record if sending fails.
- C. A first, with a single send point for email later. This is how A is built here.

## Design
**Database (`supabase/schema.sql`, `IF NOT EXISTS` style)**
- `notifications(id, user_id → users, kind, title, body, model_id → models ON DELETE SET NULL, read_at, created_at)`, index on `(user_id, read_at, created_at DESC)`.
- `model_license_changes(id, model_id → models, admin_id → users, old_license, new_license, reason, created_at)`.

**core-api**
- `PATCH /api/admin/models/:id/license` body `{ license, reason }` (zod): `license` is one of `CC0 | CC-BY | CC-BY-NC | COMMERCIAL`, `reason` is 10 to 1000 characters after trimming. Refuses the same license (400), unknown model (404). The update, the history row and the notice are written in ONE transaction. Response: `{ id, license }`.
- `GET /api/me/notifications` (unread count and the latest 50), `PATCH /api/me/notifications/:id/read`, `PATCH /api/me/notifications/read-all`. All need `requireAuth` and only touch the caller's own rows.
- `notifications.service.ts` with `createNotification(client, {...})`, the only place that inserts notices.
- Notice text (stored in English as a template with the data, shown in the reader's language by the frontend through `messages.ts`): kind `license_changed`, data `{ modelTitle, oldLicense, newLicense, reason }`. The reason is written by the admin and shown as written.

**Frontend**
- `/admin/models`: a "Change license" action per row opens a dialog (license select, reason textarea with counter, shows the warning that the owner will be notified and buyers keep their license). Text goes through `messages.ts` in English and Thai.
- `/seller`: a notices box (unread first, "mark as read").
- Account menu: unread counter on the existing menu entry for sellers.

**Security and rules**
- Admin routes keep `requireAuth` + admin check; role comes from the database.
- The owner only reads their own notices; no model owner id is accepted from the client.
- Notice and history are written in the same transaction as the license update, so a notice never exists without the change (and the other way round).
- Tests (node:test, mocked `db` like the other admin tests): admin only, validation (reason length, same license), writes all three rows in one transaction, user can only read and mark their own notices.

## Left to the builder
Exact wording of the Thai and English notice text, the visual style of the inbox (follow `docs/DESIGN_SYSTEM.md`), and updating `docs/TASKS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md` and `AGENT.md` §4–§5 for the new endpoints and tables in the same change.

## Open points for the owners
- `routes` of `/api/me/*` and `/seller` belong to other members; the notice box in `/seller` touches their file.
- Database: the two new tables must be run on the shared database (`schema.sql` is the source).
