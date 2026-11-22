// [เจี๊ยบ] โมดูลแอดมิน — overview, ผู้ใช้ (ระงับ/คืน), โมเดล (ซ่อน/คืน), รายการสั่งซื้อทั้งระบบ
import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../config/db';
import { isSuspended, requireActiveAdmin, requireAuth } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { disconnectUser } from '../../config/socket';

export const adminRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

adminRouter.use(requireAuth, requireActiveAdmin);

// ─── helpers ────────────────────────────────────────────────────────────────
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
});

function parsePaging(query: unknown) {
  const parsed = pageQuery.safeParse(query);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_QUERY', 'Invalid paging or search parameters');
  }
  const { page, pageSize, q } = parsed.data;
  return { page, pageSize, offset: (page - 1) * pageSize, q: q ? q : undefined };
}

// escape % _ \ เพื่อให้ค้นหาเป็นข้อความตรงตัว
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function requireUuid(id: string) {
  if (!UUID_RE.test(id)) {
    throw new AppError(400, 'INVALID_ID', 'Invalid id');
  }
}

// ─── 1. GET /api/admin/overview ─────────────────────────────────────────────
// ตัวเลขรวม + รายการสั้นๆ สำหรับหน้า Overview (นับเฉพาะโมเดลที่ยังไม่ถูกลบ ยกเว้นระบุไว้)
adminRouter.get('/overview', async (_req, res) => {
  const [counts, licenses, top, purchases, users] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) AS total_users,
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND suspended_at IS NOT NULL AND (suspended_until IS NULL OR suspended_until > NOW())) AS suspended_users,
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND role = 'admin') AS admin_users,
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND is_seller = TRUE AND role <> 'admin') AS seller_users,
         (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND created_at > NOW() - INTERVAL '7 days') AS new_users_7d,
         (SELECT COUNT(*)::int FROM models WHERE deleted_at IS NULL) AS total_models,
         (SELECT COUNT(*)::int FROM models WHERE deleted_at IS NULL AND hidden_at IS NOT NULL) AS hidden_models,
         (SELECT COUNT(*)::int FROM models WHERE deleted_at IS NULL AND price_cents = 0) AS free_models,
         (SELECT COUNT(*)::int FROM models WHERE deleted_at IS NULL AND created_at > NOW() - INTERVAL '7 days') AS new_models_7d,
         (SELECT COALESCE(SUM(download_count), 0) FROM models WHERE deleted_at IS NULL) AS total_downloads,
         (SELECT COALESCE(SUM(view_count), 0) FROM models WHERE deleted_at IS NULL) AS total_views,
         (SELECT COUNT(*)::int FROM purchases WHERE status = 'paid') AS paid_purchases,
         (SELECT COUNT(*)::int FROM purchases WHERE status = 'pending') AS pending_purchases,
         (SELECT COUNT(*)::int FROM complaints WHERE status = 'open') AS open_complaints,
         (SELECT COUNT(*)::int FROM creator_applications ca JOIN users u ON u.id = ca.user_id WHERE ca.status = 'pending' AND u.deleted_at IS NULL) AS pending_applications,
         (SELECT COUNT(*)::int FROM creator_withdrawals WHERE status = 'pending') AS pending_withdrawals,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM purchases WHERE status = 'paid') AS total_revenue_cents,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM purchases
            WHERE status = 'paid' AND paid_at > NOW() - INTERVAL '7 days') AS revenue_7d_cents`,
    ),
    db.query(
      `SELECT license, COUNT(*)::int AS count
       FROM models WHERE deleted_at IS NULL
       GROUP BY license ORDER BY count DESC, license`,
    ),
    db.query(
      `SELECT m.id, m.title, m.download_count, m.view_count, u.display_name AS owner_name
       FROM models m JOIN users u ON u.id = m.owner_id
       WHERE m.deleted_at IS NULL
       ORDER BY m.download_count DESC, m.created_at DESC
       LIMIT 5`,
    ),
    db.query(
      `SELECT p.id, p.amount_cents, p.currency, p.paid_at,
              u.display_name AS buyer_name, m.id AS model_id, m.title AS model_title
       FROM purchases p
       JOIN users u ON u.id = p.user_id
       JOIN models m ON m.id = p.model_id
       WHERE p.status = 'paid'
       ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
       LIMIT 5`,
    ),
    db.query(
      `SELECT id, display_name, email, role, created_at
       FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`,
    ),
  ]);
  const r = counts.rows[0];

  res.json({
    totalUsers: r.total_users,
    suspendedUsers: r.suspended_users,
    adminUsers: r.admin_users,
    sellerUsers: r.seller_users,
    newUsers7d: r.new_users_7d,
    totalModels: r.total_models,
    hiddenModels: r.hidden_models,
    freeModels: r.free_models,
    newModels7d: r.new_models_7d,
    totalDownloads: Number(r.total_downloads),
    totalViews: Number(r.total_views),
    paidPurchases: r.paid_purchases,
    pendingPurchases: r.pending_purchases,
    openComplaints: r.open_complaints,
    pendingApplications: Number(r.pending_applications ?? 0),
    pendingWithdrawals: Number(r.pending_withdrawals ?? 0),
    totalRevenueCents: Number(r.total_revenue_cents),
    revenue7dCents: Number(r.revenue_7d_cents),
    licenseBreakdown: licenses.rows.map((l) => ({ license: l.license, count: l.count })),
    topModels: top.rows.map((m) => ({
      id: m.id,
      title: m.title,
      ownerName: m.owner_name,
      downloadCount: Number(m.download_count),
      viewCount: Number(m.view_count),
    })),
    recentPurchases: purchases.rows.map((p) => ({
      id: p.id,
      buyerName: p.buyer_name,
      model: { id: p.model_id, title: p.model_title },
      amountCents: p.amount_cents,
      currency: p.currency,
      paidAt: p.paid_at,
    })),
    recentUsers: users.rows.map((u) => ({
      id: u.id,
      displayName: u.display_name,
      email: u.email,
      role: u.role,
      createdAt: u.created_at,
    })),
  });
});

// ─── 2. GET /api/admin/users ────────────────────────────────────────────────
const userFilters = z.object({
  role: z.enum(['user', 'creator', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  seller: z.enum(['yes', 'no']).optional(),
});

adminRouter.get('/users', async (req, res) => {
  const { page, pageSize, offset, q } = parsePaging(req.query);
  const filters = userFilters.safeParse(req.query);
  if (!filters.success) {
    throw new AppError(400, 'INVALID_QUERY', 'role must be user, creator or admin; status must be active, suspended or deleted; seller must be yes or no');
  }
  const { role, status, seller } = filters.data;
  const search = q ? likePattern(q) : null;

  const conditions: string[] = [];
  const filterParams: unknown[] = [];

  // A deleted account is searched by the address it had (original_email); its email column holds a placeholder.
  if (search) {
    filterParams.push(search);
    const n = filterParams.length;
    conditions.push(`(email ILIKE $${n} ESCAPE '\\' OR display_name ILIKE $${n} ESCAPE '\\' OR original_email ILIKE $${n} ESCAPE '\\')`);
  }

  if (role) {
    filterParams.push(role);
    conditions.push(`role = $${filterParams.length}`);
  }

  if (seller === 'yes') {
    conditions.push(`is_seller = TRUE`);
  } else if (seller === 'no') {
    conditions.push(`is_seller = FALSE`);
  }

  if (status === 'active') {
    conditions.push(`deleted_at IS NULL AND (suspended_at IS NULL OR suspended_until <= NOW())`);
  } else if (status === 'suspended') {
    conditions.push(`deleted_at IS NULL AND suspended_at IS NOT NULL AND (suspended_until IS NULL OR suspended_until > NOW())`);
  } else if (status === 'deleted') {
    conditions.push(`deleted_at IS NOT NULL`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = await db.query(`SELECT COUNT(*)::int AS total FROM users ${where}`, filterParams);
  const rows = await db.query(
    `SELECT id, email, display_name, role, is_seller, suspended_at, suspended_until, suspension_reason, created_at,
            deleted_at, deleted_reason, original_email
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
    [...filterParams, pageSize, offset],
  );

  res.json({
    items: rows.rows.map((u) => ({
      id: u.id,
      email: u.deleted_at ? u.original_email : u.email, // never show the placeholder of a deleted account
      displayName: u.display_name,
      role: u.role,
      isSeller: u.is_seller,
      suspendedAt: u.suspended_at,
      suspendedUntil: u.suspended_until,
      suspensionReason: u.suspension_reason,
      createdAt: u.created_at,
      deletedAt: u.deleted_at,
      deletedReason: u.deleted_reason,
    })),
    page,
    pageSize,
    total: total.rows[0].total,
  });
});

// ─── 3. PATCH /api/admin/users/:id/suspend ──────────────────────────────────
// Suspending needs a written reason (10-1000 characters) and may have an end time (in the future, at most 365 days).
// No end time = suspended until an admin restores the account. Restoring may carry a reason too.
// One statement updates the user, writes the history row and creates the notice, so the three cannot be split.
const MAX_SUSPENSION_MS = 365 * 24 * 60 * 60 * 1000;
const suspendBody = z
  .object({
    suspended: z.boolean(),
    reason: z.string().trim().max(1000).optional(),
    until: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((b, ctx) => {
    if (b.suspended) {
      if (!b.reason || b.reason.length < 10) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'reason is required (10-1000 characters)' });
      if (b.until) {
        const ms = new Date(b.until).getTime() - Date.now();
        if (ms <= 0 || ms > MAX_SUSPENSION_MS) ctx.addIssue({ code: 'custom', path: ['until'], message: 'until must be in the future and within 365 days' });
      }
    } else if (b.until) {
      ctx.addIssue({ code: 'custom', path: ['until'], message: 'a restore has no end time' });
    }
  });

adminRouter.patch('/users/:id/suspend', async (req, res) => {
  const targetId = String(req.params.id);
  requireUuid(targetId);

  if (targetId === req.user!.id) {
    throw new AppError(400, 'CANNOT_SUSPEND_SELF', 'Admins cannot suspend their own account');
  }

  const body = suspendBody.safeParse(req.body);
  if (!body.success) {
    throw new AppError(
      400,
      'INVALID_BODY',
      'Body must be { "suspended": boolean, "reason": 10-1000 characters (required to suspend), "until": future ISO date within 365 days (optional, suspend only) }',
    );
  }

  const { suspended } = body.data;
  const reason = body.data.reason ? body.data.reason : null;
  const until = suspended && body.data.until ? new Date(body.data.until).toISOString() : null;

  const result = await db.query<{ found: number; changed: number; target_role: string | null; suspended_at: string | null; suspended_until: string | null }>(
    `WITH old AS (
       SELECT id, role, suspended_at, suspended_until FROM users WHERE id = $1 FOR UPDATE
     ),
     upd AS (
       UPDATE users u
       SET suspended_at = CASE WHEN $2::boolean THEN COALESCE(old.suspended_at, NOW()) ELSE NULL END,
           suspended_until = CASE WHEN $2::boolean THEN $3::timestamptz ELSE NULL END,
           suspension_reason = CASE WHEN $2::boolean THEN $4::text ELSE NULL END
       FROM old
       WHERE u.id = old.id
         AND (NOT $2::boolean OR old.role <> 'admin') -- an admin cannot be suspended, but one suspended earlier can be restored
         AND ($2::boolean OR old.suspended_at IS NOT NULL)
       RETURNING u.id, u.suspended_at, u.suspended_until
     ),
     hist AS (
       INSERT INTO user_suspensions (user_id, admin_id, action, reason, until)
       SELECT id, $5::uuid, CASE WHEN $2::boolean THEN 'suspend' ELSE 'restore' END::varchar, $4::text, $3::timestamptz FROM upd
       RETURNING id
     ),
     note AS (
       INSERT INTO notifications (user_id, kind, data)
       SELECT id, CASE WHEN $2::boolean THEN 'account_suspended' ELSE 'account_restored' END::varchar,
              jsonb_build_object('reason', $4::text, 'until', $3::timestamptz)
       FROM upd
       RETURNING id
     )
     SELECT (SELECT COUNT(*) FROM old)::int AS found,
            (SELECT COUNT(*) FROM upd)::int AS changed,
            (SELECT role::text FROM old) AS target_role,
            CASE WHEN EXISTS (SELECT 1 FROM upd) THEN (SELECT suspended_at FROM upd) ELSE (SELECT suspended_at FROM old) END AS suspended_at,
            CASE WHEN EXISTS (SELECT 1 FROM upd) THEN (SELECT suspended_until FROM upd) ELSE (SELECT suspended_until FROM old) END AS suspended_until`,
    [targetId, suspended, until, reason, req.user!.id],
  );

  const row = result.rows[0];
  if (!row || row.found === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  if (suspended && row.target_role === 'admin') {
    // Two admins suspending each other would leave nobody able to restore anyone. Admins are managed in the database.
    throw new AppError(403, 'CANNOT_SUSPEND_ADMIN', 'Admin accounts cannot be suspended');
  }

  res.json({
    id: targetId,
    isSuspended: row.suspended_at !== null,
    suspendedAt: row.suspended_at,
    suspendedUntil: row.suspended_until,
  });
});

// ─── 3b. GET /api/admin/users/:id/suspensions ───────────────────────────────
// Who suspended or restored this account, when, why and until when (newest first, latest 50).
// admin is null when the suspension ended by itself.
adminRouter.get('/users/:id/suspensions', async (req, res) => {
  const id = String(req.params.id);
  requireUuid(id);

  const result = await db.query(
    `SELECT s.id, s.action, s.reason, s.until, s.created_at, a.id AS admin_id, a.display_name AS admin_name
     FROM user_suspensions s
     LEFT JOIN users a ON a.id = s.admin_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT 50`,
    [id],
  );
  res.json({
    items: result.rows.map((h) => ({
      id: h.id,
      action: h.action,
      reason: h.reason,
      until: h.until,
      createdAt: h.created_at,
      admin: h.admin_id ? { id: h.admin_id, displayName: h.admin_name } : null,
    })),
  });
});

// ─── 3c. DELETE /api/admin/users/:id ────────────────────────────────────────
// Deletes an account but keeps its history: the row stays (so models, purchases, complaints and suspensions that point at
// it stay intact), the email is replaced by a unique placeholder and the real address moves to original_email. That frees
// the address: signing up with it again makes a brand-new account (a new id), never the old one. The account can no longer
// log in (no row has its email) or use an old token (requireAuth asks the database). Admins cannot be deleted and nobody
// deletes their own account here, same as suspending. Needs a written reason (10-1000 characters). The person cannot be
// told (the account is gone), so there is no notice. One statement does the update.
const deleteBody = z.object({ reason: z.string().trim().min(10).max(1000) });

adminRouter.delete('/users/:id', async (req, res) => {
  const targetId = String(req.params.id);
  requireUuid(targetId);

  if (targetId === req.user!.id) {
    throw new AppError(400, 'CANNOT_DELETE_SELF', 'Admins cannot delete their own account');
  }

  const body = deleteBody.safeParse(req.body);
  if (!body.success) {
    throw new AppError(400, 'INVALID_BODY', 'Body must be { "reason": 10-1000 characters }');
  }

  const result = await db.query<{ found: number; changed: number; already_deleted: boolean | null }>(
    `WITH old AS (
       SELECT id, role, email, deleted_at FROM users WHERE id = $1 FOR UPDATE
     ),
     upd AS (
       UPDATE users u
       SET deleted_at = NOW(),
           deleted_by = $2::uuid,
           deleted_reason = $3::text,
           original_email = old.email,
           email = 'deleted-' || old.id::text || '@deleted.invalid',
           password_hash = '!deleted', -- not a valid hash, nothing can match it
           is_seller = FALSE
       FROM old
       WHERE u.id = old.id AND old.deleted_at IS NULL AND old.role <> 'admin'
       RETURNING u.id
     )
     SELECT (SELECT COUNT(*) FROM old)::int AS found,
            (SELECT COUNT(*) FROM upd)::int AS changed,
            (SELECT deleted_at IS NOT NULL FROM old) AS already_deleted`,
    [targetId, req.user!.id, body.data.reason],
  );

  const row = result.rows[0];
  if (!row || row.found === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  if (row.changed === 0) {
    if (row.already_deleted) throw new AppError(409, 'ALREADY_DELETED', 'This account is already deleted');
    // Admins are managed in the database, so no admin can remove another one from here.
    throw new AppError(403, 'CANNOT_DELETE_ADMIN', 'Admin accounts cannot be deleted');
  }

  disconnectUser(targetId); // open sockets of the deleted account are closed now, not at their next reconnect
  res.json({ id: targetId, isDeleted: true });
});

// ─── 4. GET /api/admin/models ───────────────────────────────────────────────
// รวมโมเดลที่ถูกซ่อนและถูกลบ
// Filters for the list: ?status=visible|hidden|deleted and ?license=CC0|CC-BY|CC-BY-NC|COMMERCIAL (both optional, combined with AND).
const modelFilters = z.object({
  status: z.enum(['visible', 'hidden', 'deleted']).optional(),
  license: z.enum(['CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL']).optional(),
});
const MODEL_STATUS_SQL = {
  visible: 'm.deleted_at IS NULL AND m.hidden_at IS NULL',
  hidden: 'm.deleted_at IS NULL AND m.hidden_at IS NOT NULL',
  deleted: 'm.deleted_at IS NOT NULL',
} as const;

adminRouter.get('/models', async (req, res) => {
  const { page, pageSize, offset, q } = parsePaging(req.query);
  const filters = modelFilters.safeParse(req.query);
  if (!filters.success) {
    throw new AppError(400, 'INVALID_QUERY', 'status must be visible, hidden or deleted; license must be CC0, CC-BY, CC-BY-NC or COMMERCIAL');
  }
  const { status, license } = filters.data;

  const conditions: string[] = [];
  const filterParams: unknown[] = [];
  if (q) {
    filterParams.push(likePattern(q));
    const n = filterParams.length;
    conditions.push(`(m.title ILIKE $${n} ESCAPE '\\' OR u.display_name ILIKE $${n} ESCAPE '\\')`);
  }
  if (status) conditions.push(MODEL_STATUS_SQL[status]);
  if (license) {
    filterParams.push(license);
    conditions.push(`m.license = $${filterParams.length}::license_type`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = await db.query(
    `SELECT COUNT(*)::int AS total FROM models m JOIN users u ON u.id = m.owner_id ${where}`,
    filterParams,
  );
  const rows = await db.query(
    `SELECT m.id, m.title, m.license, m.price_cents, m.currency, m.view_count, m.download_count,
            m.hidden_at, m.deleted_at, m.created_at,
            u.id AS owner_id, u.display_name AS owner_name, u.suspended_at AS owner_suspended_at,
            u.suspended_until AS owner_suspended_until
     FROM models m
     JOIN users u ON u.id = m.owner_id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
    [...filterParams, pageSize, offset],
  );

  res.json({
    items: rows.rows.map((m) => ({
      id: m.id,
      title: m.title,
      license: m.license,
      priceCents: m.price_cents,
      currency: m.currency,
      viewCount: Number(m.view_count),
      downloadCount: Number(m.download_count),
      isHidden: m.hidden_at !== null,
      isDeleted: m.deleted_at !== null,
      owner: {
        id: m.owner_id,
        displayName: m.owner_name,
        isSuspended: isSuspended({
          suspended_at: m.owner_suspended_at,
          suspended_until: m.owner_suspended_until,
        }),
      },
      createdAt: m.created_at,
    })),
    page,
    pageSize,
    total: total.rows[0].total,
  });
});

// ─── 5. PATCH /api/admin/models/:id/hide ────────────────────────────────────
// Hiding a model blocks it everywhere (gallery and CDN, buyers included), so it needs a written reason like a
// suspension does. One statement updates the model, writes the history row and notifies the owner.
// Hiding a model that is already hidden (or restoring a visible one) changes nothing and writes nothing.
const hideBody = z
  .object({ hidden: z.boolean(), reason: z.string().trim().max(1000).optional() })
  .superRefine((b, ctx) => {
    if (b.hidden && (!b.reason || b.reason.length < 10)) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'reason is required (10-1000 characters)' });
    }
  });

adminRouter.patch('/models/:id/hide', async (req, res) => {
  const modelId = String(req.params.id);
  requireUuid(modelId);

  const body = hideBody.safeParse(req.body);
  if (!body.success) {
    throw new AppError(
      400,
      'INVALID_BODY',
      'Body must be { "hidden": boolean, "reason": 10-1000 characters (required to hide, optional to restore) }',
    );
  }
  const { hidden } = body.data;
  const reason = body.data.reason ? body.data.reason : null;

  const result = await db.query<{ found: number; changed: number; hidden_at: string | null }>(
    `WITH old AS (
       SELECT id, owner_id, title, hidden_at FROM models WHERE id = $1 AND deleted_at IS NULL FOR UPDATE
     ),
     upd AS (
       UPDATE models m
       SET hidden_at = CASE WHEN $2::boolean THEN NOW() ELSE NULL END
       FROM old
       WHERE m.id = old.id AND ($2::boolean = (old.hidden_at IS NULL)) -- hide only a visible model, restore only a hidden one
       RETURNING m.id, m.hidden_at, old.owner_id, old.title
     ),
     hist AS (
       INSERT INTO model_visibility_changes (model_id, admin_id, action, reason)
       SELECT id, $3::uuid, CASE WHEN $2::boolean THEN 'hide' ELSE 'restore' END::varchar, $4::text FROM upd
       RETURNING id
     ),
     note AS (
       INSERT INTO notifications (user_id, kind, model_id, data)
       SELECT owner_id, CASE WHEN $2::boolean THEN 'model_hidden' ELSE 'model_restored' END::varchar, id,
              jsonb_build_object('modelTitle', title, 'reason', $4::text)
       FROM upd
       RETURNING id
     )
     SELECT (SELECT COUNT(*) FROM old)::int AS found,
            (SELECT COUNT(*) FROM upd)::int AS changed,
            CASE WHEN EXISTS (SELECT 1 FROM upd) THEN (SELECT hidden_at FROM upd) ELSE (SELECT hidden_at FROM old) END AS hidden_at`,
    [modelId, hidden, req.user!.id, reason],
  );

  const row = result.rows[0];
  if (!row || row.found === 0) {
    throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
  }

  res.json({
    id: modelId,
    isHidden: row.hidden_at !== null,
    hiddenAt: row.hidden_at,
  });
});

// ─── 5b. PATCH /api/admin/models/:id/license ────────────────────────────────
// Changes the license, records who/why and notifies the owner in ONE statement, so the three
// writes can never be split. Existing purchases keep purchases.license_type (locked at purchase).
const LICENSES = ['CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL'] as const;
const licenseBody = z.object({
  license: z.enum(LICENSES),
  reason: z.string().trim().min(10).max(1000),
});

adminRouter.patch('/models/:id/license', async (req, res) => {
  const modelId = String(req.params.id);
  requireUuid(modelId);

  const body = licenseBody.safeParse(req.body);
  if (!body.success) {
    throw new AppError(
      400,
      'INVALID_BODY',
      'Body must be { "license": "CC0" | "CC-BY" | "CC-BY-NC" | "COMMERCIAL", "reason": 10-1000 characters }',
    );
  }
  const { license, reason } = body.data;

  const result = await db.query<{ found: number; changed: number }>(
    `WITH old AS (
       SELECT id, owner_id, title, license FROM models WHERE id = $1 AND deleted_at IS NULL FOR UPDATE
     ),
     upd AS (
       UPDATE models m SET license = $2::license_type
       FROM old
       WHERE m.id = old.id AND old.license <> $2::license_type
       RETURNING m.id, old.owner_id, old.title, old.license AS old_license
     ),
     hist AS (
       INSERT INTO model_license_changes (model_id, admin_id, old_license, new_license, reason)
       SELECT id, $3::uuid, old_license, $2::license_type, $4::text FROM upd
       RETURNING id
     ),
     note AS (
       INSERT INTO notifications (user_id, kind, model_id, data)
       SELECT owner_id, 'license_changed'::varchar, id,
              jsonb_build_object('modelTitle', title, 'oldLicense', old_license, 'newLicense', $2::text, 'reason', $4::text)
       FROM upd
       RETURNING id
     )
     SELECT (SELECT COUNT(*) FROM old)::int AS found, (SELECT COUNT(*) FROM upd)::int AS changed`,
    [modelId, license, req.user!.id, reason],
  );

  const row = result.rows[0];
  if (!row || row.found === 0) {
    throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
  }
  if (row.changed === 0) {
    throw new AppError(400, 'LICENSE_UNCHANGED', 'The model already has this license');
  }

  res.json({ id: modelId, license });
});

// ─── 5c. GET /api/admin/models/:id/history ──────────────────────────────────
// Every license change and every hide / restore of one model, with the reason and the admin (newest first, latest 50).
adminRouter.get('/models/:id/history', async (req, res) => {
  const id = String(req.params.id);
  requireUuid(id);

  const result = await db.query(
    `SELECT 'license'::text AS kind, c.id, c.old_license::text AS old_license, c.new_license::text AS new_license,
            NULL::text AS action, c.reason, c.created_at, a.id AS admin_id, a.display_name AS admin_name
     FROM model_license_changes c
     LEFT JOIN users a ON a.id = c.admin_id
     WHERE c.model_id = $1
     UNION ALL
     SELECT 'visibility'::text, v.id, NULL::text, NULL::text, v.action::text, v.reason, v.created_at, a.id, a.display_name
     FROM model_visibility_changes v
     LEFT JOIN users a ON a.id = v.admin_id
     WHERE v.model_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [id],
  );
  res.json({
    items: result.rows.map((h) => {
      const admin = h.admin_id ? { id: h.admin_id, displayName: h.admin_name } : null;
      return h.kind === 'license'
        ? { kind: 'license', id: h.id, oldLicense: h.old_license, newLicense: h.new_license, reason: h.reason, createdAt: h.created_at, admin }
        : { kind: 'visibility', id: h.id, action: h.action, reason: h.reason, createdAt: h.created_at, admin };
    }),
  });
});

// ─── 6. GET /api/admin/purchases ────────────────────────────────────────────
// ไม่ส่ง embed_key กลับ (เป็นความลับของผู้ซื้อ); ส่ง watermark_hash ไว้ตรวจย้อนรอย
// Filters for the list: ?status=paid|pending and ?from= / ?to= (YYYY-MM-DD, both days included, by created_at).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// A text like 2026-02-30 or 2026-13-40 is not a date; toISOString() throws on an invalid Date, so test it first.
const isRealDate = (v: string) => {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const purchaseFilters = z
  .object({
    status: z.enum(['paid', 'pending']).optional(),
    from: z.string().refine(isRealDate).optional(),
    to: z.string().refine(isRealDate).optional(),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to);

adminRouter.get('/purchases', async (req, res) => {
  const { page, pageSize, offset, q } = parsePaging(req.query);
  const filters = purchaseFilters.safeParse(req.query);
  if (!filters.success) {
    throw new AppError(400, 'INVALID_QUERY', 'status must be paid or pending; from and to must be real dates (YYYY-MM-DD) with from not after to');
  }
  const { status, from, to } = filters.data;

  const conditions: string[] = [];
  const filterParams: unknown[] = [];
  if (q) {
    filterParams.push(likePattern(q));
    const n = filterParams.length;
    conditions.push(`(m.title ILIKE $${n} ESCAPE '\\' OR COALESCE(u.original_email, u.email) ILIKE $${n} ESCAPE '\\' OR u.display_name ILIKE $${n} ESCAPE '\\')`);
  }
  if (status) {
    filterParams.push(status);
    conditions.push(`p.status = $${filterParams.length}::purchase_status`);
  }
  if (from) {
    filterParams.push(from);
    conditions.push(`p.created_at >= $${filterParams.length}::date`);
  }
  if (to) {
    filterParams.push(to);
    conditions.push(`p.created_at < ($${filterParams.length}::date + 1)`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const joins = `FROM purchases p
     JOIN users u ON u.id = p.user_id
     JOIN models m ON m.id = p.model_id`;

  const total = await db.query(`SELECT COUNT(*)::int AS total ${joins} ${where}`, filterParams);
  const rows = await db.query(
    `SELECT p.id, p.status, p.amount_cents, p.currency, p.license_type, p.watermark_hash,
            p.paid_at, p.created_at,
            u.id AS buyer_id, COALESCE(u.original_email, u.email) AS buyer_email, u.display_name AS buyer_name,
            m.id AS model_id, m.title AS model_title
     ${joins}
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
    [...filterParams, pageSize, offset],
  );

  res.json({
    items: rows.rows.map((p) => ({
      id: p.id,
      status: p.status,
      amountCents: p.amount_cents,
      currency: p.currency,
      licenseType: p.license_type,
      watermarkHash: p.watermark_hash,
      paidAt: p.paid_at,
      createdAt: p.created_at,
      buyer: { id: p.buyer_id, email: p.buyer_email, displayName: p.buyer_name },
      model: { id: p.model_id, title: p.model_title },
    })),
    page,
    pageSize,
    total: total.rows[0].total,
  });
});

// ─── 6b. GET /api/admin/purchases/:id ───────────────────────────────────────
// One order in full, for checking it. embed_key is never selected (it is the buyer's secret).
adminRouter.get('/purchases/:id', async (req, res) => {
  const id = String(req.params.id);
  requireUuid(id);

  const result = await db.query(
    `SELECT p.id, p.status, p.amount_cents, p.currency, p.license_type, p.watermark_hash,
            p.provider_session_id, p.paid_at, p.created_at,
            u.id AS buyer_id, COALESCE(u.original_email, u.email) AS buyer_email, u.display_name AS buyer_name, u.suspended_at AS buyer_suspended_at,
            m.id AS model_id, m.title AS model_title, m.license AS model_license,
            m.hidden_at AS model_hidden_at, m.deleted_at AS model_deleted_at,
            o.id AS owner_id, COALESCE(o.original_email, o.email) AS owner_email, o.display_name AS owner_name
     FROM purchases p
     JOIN users u ON u.id = p.user_id
     JOIN models m ON m.id = p.model_id
     JOIN users o ON o.id = m.owner_id
     WHERE p.id = $1`,
    [id],
  );
  const p = result.rows[0];
  if (!p) throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');

  res.json({
    id: p.id,
    status: p.status,
    amountCents: p.amount_cents,
    currency: p.currency,
    licenseType: p.license_type,
    watermarkHash: p.watermark_hash,
    providerSessionId: p.provider_session_id,
    paidAt: p.paid_at,
    createdAt: p.created_at,
    buyer: { id: p.buyer_id, email: p.buyer_email, displayName: p.buyer_name, isSuspended: p.buyer_suspended_at !== null },
    model: {
      id: p.model_id,
      title: p.model_title,
      currentLicense: p.model_license,
      isHidden: p.model_hidden_at !== null,
      isDeleted: p.model_deleted_at !== null,
    },
    owner: { id: p.owner_id, email: p.owner_email, displayName: p.owner_name },
  });
});

// ─── 7. GET /api/admin/complaints ───────────────────────────────────────────
// คำร้องเรียนจากผู้ใช้ (เรื่องที่ยังไม่จัดการขึ้นก่อน); กรองด้วย ?status= ได้
const COMPLAINT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'] as const;
const statusQuery = z.enum(COMPLAINT_STATUSES).optional();

adminRouter.get('/complaints', async (req, res) => {
  const { page, pageSize, offset, q } = parsePaging(req.query);
  const status = statusQuery.safeParse(req.query.status || undefined);
  if (!status.success) {
    throw new AppError(400, 'INVALID_QUERY', 'Unknown complaint status');
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status.data) {
    params.push(status.data);
    conditions.push(`c.status = $${params.length}`);
  }
  if (q) {
    params.push(likePattern(q));
    const n = params.length;
    conditions.push(
      `(c.message ILIKE $${n} ESCAPE '\\' OR u.display_name ILIKE $${n} ESCAPE '\\' OR COALESCE(u.original_email, u.email) ILIKE $${n} ESCAPE '\\' OR m.title ILIKE $${n} ESCAPE '\\')`,
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joins = `FROM complaints c
     JOIN users u ON u.id = c.reporter_id
     LEFT JOIN models m ON m.id = c.model_id
     LEFT JOIN users o ON o.id = m.owner_id
     LEFT JOIN users h ON h.id = c.handled_by`;

  const total = await db.query(`SELECT COUNT(*)::int AS total ${joins} ${where}`, params);
  const rows = await db.query(
    `SELECT c.id, c.category, c.message, c.status, c.admin_note, c.handled_at, c.created_at,
            u.id AS reporter_id, u.display_name AS reporter_name, COALESCE(u.original_email, u.email) AS reporter_email,
            m.id AS model_id, m.title AS model_title, m.hidden_at AS model_hidden_at,
            o.id AS owner_id, o.display_name AS owner_name, o.suspended_at AS owner_suspended_at,
            h.display_name AS handled_by_name
     ${joins}
     ${where}
     ORDER BY CASE c.status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END, c.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset],
  );

  res.json({
    items: rows.rows.map((c) => ({
      id: c.id,
      category: c.category,
      message: c.message,
      status: c.status,
      adminNote: c.admin_note,
      handledAt: c.handled_at,
      handledByName: c.handled_by_name,
      createdAt: c.created_at,
      reporter: { id: c.reporter_id, displayName: c.reporter_name, email: c.reporter_email },
      model: c.model_id ? { id: c.model_id, title: c.model_title, isHidden: c.model_hidden_at !== null } : null,
      owner: c.owner_id
        ? { id: c.owner_id, displayName: c.owner_name, isSuspended: c.owner_suspended_at !== null }
        : null,
    })),
    page,
    pageSize,
    total: total.rows[0].total,
  });
});

// ─── 8. PATCH /api/admin/complaints/:id ─────────────────────────────────────
// เปลี่ยนสถานะ (และโน้ตของแอดมิน; ไม่ส่ง adminNote = ไม่แตะโน้ตเดิม, ส่งค่าว่าง = ลบโน้ต)
const complaintBody = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  adminNote: z.string().trim().max(1000).optional(),
});

adminRouter.patch('/complaints/:id', async (req, res) => {
  const id = String(req.params.id);
  requireUuid(id);

  const body = complaintBody.safeParse(req.body);
  if (!body.success) {
    throw new AppError(
      400,
      'INVALID_BODY',
      'Body must be { "status": "open" | "in_review" | "resolved" | "dismissed", "adminNote"?: string }',
    );
  }
  const { status, adminNote } = body.data;
  const handled = status !== 'open';

  // One statement: update the complaint and, when it has just been closed (resolved or dismissed) and was not
  // closed with that same status before, put a notice in the reporter's inbox with the result and the admin's note.
  // Saving the same result again, or moving to open / in_review, sends nothing. A deleted reporter gets no notice.
  const result = await db.query(
    `WITH old AS (
       SELECT id, status, reporter_id, category, model_id FROM complaints WHERE id = $1 FOR UPDATE
     ), upd AS (
       UPDATE complaints c
       SET status = $2,
           admin_note = CASE WHEN $3::boolean THEN $4::text ELSE c.admin_note END,
           handled_by = CASE WHEN $5::boolean THEN $6::uuid ELSE NULL END,
           handled_at = CASE WHEN $5::boolean THEN NOW() ELSE NULL END
       FROM old
       WHERE c.id = old.id
       RETURNING c.id, c.status, c.admin_note, c.handled_at
     ), note AS (
       INSERT INTO notifications (user_id, kind, model_id, data)
       SELECT old.reporter_id, 'complaint_' || upd.status, old.model_id,
              jsonb_build_object('complaintId', upd.id, 'category', old.category, 'note', upd.admin_note)
       FROM upd JOIN old ON old.id = upd.id
       JOIN users u ON u.id = old.reporter_id AND u.deleted_at IS NULL
       WHERE upd.status IN ('resolved', 'dismissed') AND old.status <> upd.status
       RETURNING id
     )
     SELECT upd.*, EXISTS (SELECT 1 FROM note) AS notified FROM upd`,
    [id, status, adminNote !== undefined, adminNote ? adminNote : null, handled, req.user!.id],
  );
  if (result.rowCount === 0) {
    throw new AppError(404, 'COMPLAINT_NOT_FOUND', 'Complaint not found');
  }

  const r = result.rows[0];
  res.json({ id: r.id, status: r.status, adminNote: r.admin_note, handledAt: r.handled_at, reporterNotified: r.notified === true });
});

// ─── Creator Applications (Admin Approval) ──────────────────────────────────

adminRouter.get('/creator-applications', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'pending';
  const validStatuses = ['pending', 'approved', 'rejected', 'all'];
  if (!validStatuses.includes(status)) {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid status filter');
  }

  const result = await db.query(
    `SELECT ca.id, ca.user_id, ca.note, ca.status, ca.admin_note, ca.created_at, ca.reviewed_at,
            u.email, u.display_name, u.role, u.is_seller, u.suspended_at
     FROM creator_applications ca
     JOIN users u ON u.id = ca.user_id
     WHERE ($1 = 'all' OR ca.status = $1)
       AND u.deleted_at IS NULL -- the applicant's account was deleted: nothing left to approve
     ORDER BY ca.created_at DESC
     LIMIT 100`,
    [status],
  );

  res.json({
    applications: result.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      role: r.role,
      isSeller: r.is_seller,
      suspendedAt: r.suspended_at,
      note: r.note ?? '',
      status: r.status,
      adminNote: r.admin_note ?? null,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at ?? null,
    })),
  });
});

adminRouter.patch('/creator-applications/:id', async (req, res) => {
  const id = String(req.params.id);
  requireUuid(id);

  const status = req.body?.status;
  const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim().slice(0, 500) : null;

  if (status !== 'approved' && status !== 'rejected') {
    throw new AppError(400, 'BAD_REQUEST', 'Status must be approved or rejected');
  }

  // Atomic CTE: lock application & user, validate pending/not-deleted/role/suspension, update application, promote user, and notify applicant.
  const result = await db.query<{
    found: number;
    prev_status: string | null;
    user_role: string | null;
    user_suspended_at: Date | string | null;
    user_deleted_at: Date | string | null;
    id: string | null;
    user_id: string | null;
    status: string | null;
    admin_note: string | null;
    reviewed_at: Date | string | null;
  }>(
    `WITH target AS (
       SELECT ca.id, ca.user_id, ca.status, u.role AS user_role, u.suspended_at AS user_suspended_at, u.deleted_at AS user_deleted_at
       FROM creator_applications ca
       JOIN users u ON u.id = ca.user_id
       WHERE ca.id = $1
       FOR UPDATE OF ca, u
     ),
     upd_app AS (
       UPDATE creator_applications ca
       SET status = $2::varchar,
           admin_note = COALESCE($3::text, ca.admin_note),
           reviewed_by = $4::uuid,
           reviewed_at = NOW()
       FROM target t
       WHERE ca.id = t.id
         AND t.user_deleted_at IS NULL
         AND t.status = 'pending'
         AND ($2::varchar <> 'approved' OR (t.user_role <> 'admin' AND t.user_suspended_at IS NULL))
       RETURNING ca.id, ca.user_id, ca.status, ca.admin_note, ca.reviewed_at
     ),
     promote AS (
       UPDATE users u
       SET is_seller = TRUE,
           role = CASE WHEN u.role = 'user' THEN 'creator'::user_role ELSE u.role END
       FROM upd_app a
       WHERE u.id = a.user_id AND $2::varchar = 'approved'
       RETURNING u.id
     ),
     note AS (
       INSERT INTO notifications (user_id, kind, data)
       SELECT a.user_id,
              CASE WHEN $2::varchar = 'approved' THEN 'creator_application_approved' ELSE 'creator_application_rejected' END::varchar,
              jsonb_build_object('adminNote', a.admin_note)
       FROM upd_app a
       RETURNING id
     )
     SELECT
       (SELECT COUNT(*) FROM target)::int AS found,
       (SELECT status FROM target) AS prev_status,
       (SELECT user_role::text FROM target) AS user_role,
       (SELECT user_suspended_at FROM target) AS user_suspended_at,
       (SELECT user_deleted_at FROM target) AS user_deleted_at,
       a.id,
       a.user_id,
       a.status,
       a.admin_note,
       a.reviewed_at
     FROM (SELECT 1) _row
     LEFT JOIN upd_app a ON TRUE`,
    [id, status, adminNote, req.user!.id],
  );

  const row = result.rows[0];
  if (!row || row.found === 0) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Creator application not found');
  }
  // An admin deleted this account: it must not be turned into a seller again.
  if (row.user_deleted_at !== null) {
    throw new AppError(409, 'ACCOUNT_DELETED', "The applicant's account has been deleted");
  }
  if (row.prev_status !== 'pending') {
    throw new AppError(409, 'ALREADY_REVIEWED', 'This creator application has already been reviewed');
  }
  if (status === 'approved' && row.user_role === 'admin') {
    throw new AppError(403, 'ADMIN_CANNOT_SELL', 'Admin accounts cannot become creators');
  }
  if (status === 'approved' && row.user_suspended_at !== null) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Cannot approve a suspended account');
  }

  res.json({
    application: {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      adminNote: row.admin_note ?? null,
      reviewedAt: row.reviewed_at,
    },
  });
});

// ─── Admin notifications: what is waiting for an admin right now ────────────
// There is no table of notices for admins. The items are the things that need an admin and have not been handled yet:
// creator applications still pending and complaints still open, newest first. An item stops being listed the moment it is
// handled, so "unread" means "still needs action" and is the same for every admin. Each item says what it is; the page
// links it to the page that handles it (/admin/creator-approvals, /admin/complaints). Applications of deleted accounts
// are skipped (nothing left to approve).
const WAITING_COUNTS_SQL = `SELECT
     (SELECT COUNT(*)::int FROM creator_applications ca
        JOIN users u ON u.id = ca.user_id
        WHERE ca.status = 'pending' AND u.deleted_at IS NULL) AS creator_applications,
     (SELECT COUNT(*)::int FROM complaints WHERE status = 'open') AS complaints`;

function waitingCounts(row: { creator_applications: number; complaints: number }) {
  return {
    creatorApplications: row.creator_applications,
    complaints: row.complaints,
    total: row.creator_applications + row.complaints,
  };
}

// Counts only: the sidebar asks for this every minute.
adminRouter.get('/notifications/summary', async (_req, res) => {
  const result = await db.query(WAITING_COUNTS_SQL);
  res.json(waitingCounts(result.rows[0]));
});

adminRouter.get('/notifications', async (_req, res) => {
  const [counts, items] = await Promise.all([
    db.query(WAITING_COUNTS_SQL),
    db.query(
      `SELECT * FROM (
         SELECT 'creator_application'::text AS kind, ca.id, ca.created_at,
                u.id AS person_id, u.display_name AS person_name, COALESCE(u.original_email, u.email) AS person_email,
                ca.note AS text, NULL::text AS category, NULL::text AS model_title
         FROM creator_applications ca
         JOIN users u ON u.id = ca.user_id
         WHERE ca.status = 'pending' AND u.deleted_at IS NULL
         UNION ALL
         SELECT 'complaint'::text, c.id, c.created_at,
                u.id, u.display_name, COALESCE(u.original_email, u.email),
                c.message, c.category::text, m.title
         FROM complaints c
         JOIN users u ON u.id = c.reporter_id
         LEFT JOIN models m ON m.id = c.model_id
         WHERE c.status = 'open'
       ) waiting
       ORDER BY created_at DESC
       LIMIT 50`,
    ),
  ]);
  res.json({
    counts: waitingCounts(counts.rows[0]),
    items: items.rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      createdAt: r.created_at,
      person: { id: r.person_id, displayName: r.person_name, email: r.person_email },
      text: r.text ? String(r.text).slice(0, 300) : '',
      category: r.category,
      modelTitle: r.model_title,
    })),
  });
});

// ─── Creator Invite Codes (Admin) ───────────────────────────────────────────

const inviteCodeBody = z.object({
  code: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => s === '' || /^[A-Z0-9_-]{4,64}$/.test(s), {
      message: 'Code must be 4-64 characters using A-Z, 0-9, _ or -',
    })
    .optional(),
  maxUses: z.coerce.number().int().min(1).max(1000).default(1),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .refine((v) => new Date(v).getTime() > Date.now(), {
      message: 'expiresAt must be in the future',
    })
    .optional(),
});

adminRouter.get('/invite-codes', async (_req, res) => {
  const result = await db.query(
    `SELECT id, code, max_uses, used_count, expires_at, created_at
     FROM creator_invite_codes
     ORDER BY created_at DESC
     LIMIT 50`,
  );
  res.json({
    codes: result.rows.map((r) => ({
      id: r.id,
      code: r.code,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    })),
  });
});

adminRouter.post('/invite-codes', async (req, res) => {
  const parsed = inviteCodeBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new AppError(
      400,
      'INVALID_BODY',
      parsed.error.issues[0]?.message || 'Invalid invite code parameters',
    );
  }

  const code = parsed.data.code || `LIXYTE-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const { maxUses, expiresAt } = parsed.data;

  try {
    const result = await db.query(
      `INSERT INTO creator_invite_codes (code, max_uses, created_by, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, code, max_uses, used_count, expires_at, created_at`,
      [code, maxUses, req.user!.id, expiresAt ?? null],
    );
    const r = result.rows[0];
    res.status(201).json({
      code: {
        id: r.id,
        code: r.code,
        maxUses: r.max_uses,
        usedCount: r.used_count,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      },
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      throw new AppError(409, 'CODE_EXISTS', 'An invite code with this value already exists');
    }
    throw err;
  }
});

// ─── Creator Withdrawals (Admin Payout Review) ──────────────────────────────

const WITHDRAWAL_STATUSES = ['pending', 'approved', 'paid', 'rejected'] as const;
const withdrawalStatusQuery = z.enum(WITHDRAWAL_STATUSES).optional();
const updateWithdrawalBody = z.object({
  status: z.enum(['approved', 'paid', 'rejected']),
  reason: z.string().trim().max(500).optional(),
});

adminRouter.get('/withdrawals', async (req, res) => {
  const { page, pageSize, offset, q } = parsePaging(req.query);
  const status = withdrawalStatusQuery.safeParse(req.query.status || undefined);
  if (!status.success) {
    throw new AppError(400, 'INVALID_QUERY', 'Unknown withdrawal status');
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status.data) {
    params.push(status.data);
    conditions.push(`w.status = $${params.length}`);
  }
  if (q) {
    params.push(likePattern(q));
    const n = params.length;
    conditions.push(
      `(u.display_name ILIKE $${n} ESCAPE '\\' OR COALESCE(u.original_email, u.email) ILIKE $${n} ESCAPE '\\' OR w.payout_account ILIKE $${n} ESCAPE '\\')`,
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joins = `FROM creator_withdrawals w JOIN users u ON u.id = w.seller_id`;

  const [total, rows] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total ${joins} ${where}`, params),
    db.query(
      `SELECT w.id, w.seller_id, w.gross_amount_cents, w.platform_fee_cents, w.net_amount_cents,
              w.fee_rate_bps, w.currency, w.payout_method, w.payout_account, w.status,
              w.created_at, w.processed_at,
              u.display_name AS seller_name, COALESCE(u.original_email, u.email) AS seller_email
       ${joins}
       ${where}
       ORDER BY CASE w.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, w.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    ),
  ]);

  res.json({
    items: rows.rows.map((w) => ({
      id: w.id,
      grossAmountCents: Number(w.gross_amount_cents),
      platformFeeCents: Number(w.platform_fee_cents),
      netAmountCents: Number(w.net_amount_cents),
      feeRateBps: Number(w.fee_rate_bps),
      currency: w.currency,
      payoutMethod: w.payout_method,
      payoutAccount: w.payout_account,
      status: w.status,
      createdAt: w.created_at,
      processedAt: w.processed_at,
      seller: {
        id: w.seller_id,
        displayName: w.seller_name,
        email: w.seller_email,
      },
    })),
    page,
    pageSize,
    total: total.rows[0].total,
  });
});

adminRouter.patch('/withdrawals/:id', async (req, res) => {
  const id = String(req.params.id);
  requireUuid(id);

  const parsed = updateWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      'INVALID_BODY',
      'Body must be { "status": "approved" | "paid" | "rejected", "reason"?: string }',
    );
  }
  const { status } = parsed.data;
  const reason = parsed.data.reason ? parsed.data.reason : null;

  // Atomic CTE: lock withdrawal row, validate transition (pending -> approved/paid/rejected; approved -> paid/rejected),
  // update status/processed_at, and notify the creator. Rejecting automatically restores balance in getSellerWalletTotals.
  const result = await db.query<{
    found: number;
    prev_status: string | null;
    id: string | null;
    status: string | null;
    processed_at: string | null;
  }>(
    `WITH target AS (
       SELECT id, seller_id, net_amount_cents, currency, payout_method, status
       FROM creator_withdrawals
       WHERE id = $1
       FOR UPDATE
     ),
     upd AS (
       UPDATE creator_withdrawals w
       SET status = $2::varchar,
           processed_at = CASE WHEN $2::varchar IN ('paid', 'rejected') THEN NOW() ELSE w.processed_at END
       FROM target t
       WHERE w.id = t.id
         AND (
           (t.status = 'pending' AND $2::varchar IN ('approved', 'paid', 'rejected'))
           OR (t.status = 'approved' AND $2::varchar IN ('paid', 'rejected'))
         )
       RETURNING w.id, w.seller_id, w.net_amount_cents, w.currency, w.payout_method, w.status, w.processed_at
     ),
     note AS (
       INSERT INTO notifications (user_id, kind, data)
       SELECT u.seller_id,
              ('withdrawal_' || u.status)::varchar,
              jsonb_build_object(
                'netAmountCents', u.net_amount_cents,
                'currency', u.currency,
                'payoutMethod', u.payout_method,
                'reason', $3::text
              )
       FROM upd u
       RETURNING id
     )
     SELECT
       (SELECT COUNT(*) FROM target)::int AS found,
       (SELECT status FROM target) AS prev_status,
       u.id,
       u.status,
       u.processed_at
     FROM (SELECT 1) _row
     LEFT JOIN upd u ON TRUE`,
    [id, status, reason],
  );

  const row = result.rows[0];
  if (!row || row.found === 0) {
    throw new AppError(404, 'WITHDRAWAL_NOT_FOUND', 'Withdrawal request not found');
  }
  if (!row.id) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot change withdrawal from "${row.prev_status}" to "${status}"`,
    );
  }

  res.json({
    id: row.id,
    status: row.status,
    processedAt: row.processed_at,
  });
});
