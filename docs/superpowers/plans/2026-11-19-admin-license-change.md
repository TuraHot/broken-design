# Admin license change with notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin changes a model's license with a written reason; the owner gets an in-website notice and the change is recorded.

**Architecture:** One atomic SQL statement (CTEs) updates `models`, inserts the history row and the notice, so no transaction client is needed and the three writes cannot be split. A small `notifications` module serves the owner's inbox. Frontend adds an admin dialog and a notice box in `/seller`.

**Tech Stack:** Express 5 + zod + pg (core-api), node:test with mocked `db.query`, Next.js 15 / React 19, `lib/i18n/messages.ts` (en + th).

**Spec:** `docs/superpowers/specs/2026-11-19-admin-license-change-design.md` (the notice stores structured `data jsonb`, not title/body, so the reader's language is chosen in the frontend).

## Global Constraints

- Licenses: `CC0 | CC-BY | CC-BY-NC | COMMERCIAL`. Reason: 10 to 1000 characters after trim. Same license is refused (400).
- Role comes from the database (`requireActiveAdmin`), never from the JWT. Owners only read and mark their own notices.
- Existing purchases keep `purchases.license_type`; the stored GLB is not re-watermarked.
- Every visible string goes through `messages.ts` in en and th. Replies in Thai, code and commit messages in English. Use `npx.cmd`. No email in this version.

## Review Focus

- Deleted or unknown model id: 404, nothing written.
- Reason that is only spaces or 9 characters: 400 before any write.
- Two admins change the same model at once: the second sees the new license as "old" (row lock in the CTE), history stays consistent.
- A user marks another user's notice as read: 404, nothing changes.
- Model owner suspended or an admin editing their own model: still allowed, notice is still created.

---

### Task 1: Schema and admin endpoint

**Files:** Modify `supabase/schema.sql`, `services/core-api/src/modules/admin/admin.routes.ts`, `services/core-api/src/modules/admin/admin.test.ts`.

**Interfaces:** Produces `PATCH /api/admin/models/:id/license` body `{license, reason}` → `{id, license}`; rows `model_license_changes`, `notifications(kind='license_changed', data{modelTitle,oldLicense,newLicense,reason})`.

- [ ] Add tests: 400 for short reason, 400 same license, 404 unknown model, 200 happy path asserting ONE query containing `INSERT INTO model_license_changes` and `INSERT INTO notifications`, 403 for non-admin.
- [ ] Run `npx.cmd tsx --test src/modules/admin/admin.test.ts`; expect the new tests to FAIL.
- [ ] Add the two tables (`IF NOT EXISTS`) and the route (zod body, one CTE statement, read result `found`/`changed`).
- [ ] Re-run; expect all PASS.

### Task 2: Owner notifications API

**Files:** Create `services/core-api/src/modules/notifications/notifications.routes.ts` and `.test.ts`; Modify `services/core-api/src/app.ts`.

**Interfaces:** Produces `GET /api/me/notifications` → `{unread:number, items:[{id,kind,data,modelId,readAt,createdAt}]}` (latest 50), `PATCH /api/me/notifications/:id/read`, `PATCH /api/me/notifications/read-all`.

- [ ] Tests: 401 without token; list is queried with the caller's id; mark-read of a foreign id returns 404; read-all returns `{updated}`.
- [ ] Implement with `requireAuth`; every query filters `user_id = $1`; register `app.use("/api/me/notifications", ...)` before `interactionsRouter`.
- [ ] Run `npx.cmd tsx --test src/modules/notifications/notifications.test.ts`; expect PASS.

### Task 3: Admin dialog (frontend)

**Files:** Modify `frontend/src/lib/admin-api.ts` (`setModelLicense(id, license, reason)`), `frontend/src/app/admin/models/page.tsx`, create `frontend/src/components/admin/EditModelDialog.tsx` (one Edit button per row: license change plus hide/restore), modify `frontend/src/lib/i18n/messages.ts`.

**Interfaces:** Consumes Task 1 endpoint. Produces component `EditModelDialog({model, onClose, onLicenseChanged(license), onHiddenChanged(isHidden)})`.

- [ ] Dialog: license select (current disabled), reason textarea with counter (10–1000), warning text, submit disabled until valid; error via `adminErrorText`.
- [ ] Add "Change license" button per row (not for deleted models); update the row on success.
- [ ] Add `admin.license.*` keys in en and th; `npx.cmd tsc --noEmit` must pass.

### Task 4: Owner inbox (frontend)

**Files:** Create `frontend/src/components/notifications/NoticeBox.tsx`; Modify `frontend/src/lib/api.ts` (fetch/mark helpers), `frontend/src/app/seller/page.tsx`, `frontend/src/components/AccountMenu.tsx`, `frontend/src/lib/i18n/messages.ts`.

**Interfaces:** Consumes Task 2 endpoints. Produces `NoticeBox({token})` and an unread dot/count in the account menu next to "Seller dashboard".

- [ ] `NoticeBox` lists notices (unread first), renders the `license_changed` text from `data` through `t()`, button "Mark as read" and "Mark all as read".
- [ ] Insert the box at the top of the seller dashboard; show the unread count in `AccountMenu` for sellers.
- [ ] `npx.cmd tsc --noEmit` passes; check in the browser at 360px and desktop in both languages.

### Task 5: Docs

**Files:** Modify `docs/TASKS.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `AGENT.md` (§4–§5 endpoints and tables).

- [ ] Document the endpoints, tables, the "buyers keep their license" rule and the open points (email later, shared DB must run the new schema).
