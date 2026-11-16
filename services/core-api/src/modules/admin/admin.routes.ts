// [เจี๊ยบ] โมดูลแอดมิน — overview, ผู้ใช้ (ระงับ/คืน), โมเดล (ซ่อน/คืน), รายการสั่งซื้อทั้งระบบ
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { db } from '../../config/db';
import { requireAuth } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';

export const adminRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Middleware: ตรวจแอดมินจากฐานข้อมูลจริง (AGENT.md §3.2) ───────────────────
// ไม่เชื่อ role ใน JWT: ต้องเป็น admin และยังไม่ถูกระงับ ณ ตอนเรียก
function requireActiveAdmin(req: Request, _res: Response, next: NextFunction) {
  db.query(`SELECT role, suspended_at FROM users WHERE id = $1`, [req.user!.id])
    .then((result) => {
      const row = result.rows[0];
      if (!row || row.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'Admin access required');
      }
      if (row.suspended_at) {
        throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
      }
      next();
    })
    .catch(next);
}

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
         (SELECT COUNT(*)::int FROM users) AS total_users,
         (SELECT COUNT(*)::int FROM users WHERE suspended_at IS NOT NULL) AS suspended_users,
         (SELECT COUNT(*)::int FROM users WHERE role = 'admin') AS admin_users,
         (SELECT COUNT(*)::int FROM users WHERE is_seller = TRUE AND role <> 'admin') AS seller_users,
         (SELECT COUNT(*)::int FROM users WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_7d,
         (SELECT COUNT(*)::int FROM models WHERE deleted_at IS NULL) AS total_models,
         (SELECT COUNT(*)::int FROM models WHERE deleted_at IS NULL AND hidden_at IS NOT NULL) AS hidden_models,
         (SELECT COUNT(*)::int FROM models WHERE deleted_at IS NULL AND price_cents = 0) AS free_models,
         (SELECT COUNT(*)::int FROM models WHERE deleted_at IS NULL AND created_at > NOW() - INTERVAL '7 days') AS new_models_7d,
         (SELECT COALESCE(SUM(download_count), 0) FROM models WHERE deleted_at IS NULL) AS total_downloads,
         (SELECT COALESCE(SUM(view_count), 0) FROM models WHERE deleted_at IS NULL) AS total_views,
         (SELECT COUNT(*)::int FROM purchases WHERE status = 'paid') AS paid_purchases,
         (SELECT COUNT(*)::int FROM purchases WHERE status = 'pending') AS pending_purchases,
         (SELECT COUNT(*)::int FROM complaints WHERE status = 'open') AS open_complaints,
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
       FROM users ORDER BY created_at DESC LIMIT 5`,
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
adminRouter.get('/users', async (req, res) => {
  const { page, pageSize, offset, q } = parsePaging(req.query);
  const search = q ? likePattern(q) : null;

  const where = search ? `WHERE email ILIKE $1 ESCAPE '\\' OR display_name ILIKE $1 ESCAPE '\\'` : '';
  const filterParams = search ? [search] : [];

  const total = await db.query(`SELECT COUNT(*)::int AS total FROM users ${where}`, filterParams);
  const rows = await db.query(
    `SELECT id, email, display_name, role, is_seller, suspended_at, created_at
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
    [...filterParams, pageSize, offset],
  );

  res.json({
    items: rows.rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      isSeller: u.is_seller,
      suspendedAt: u.suspended_at,
      createdAt: u.created_at,
    })),
    page,
    pageSize,
    total: total.rows[0].total,
  });
});

// ─── 3. PATCH /api/admin/users/:id/suspend ──────────────────────────────────
const suspendBody = z.object({ suspended: z.boolean() });

adminRouter.patch('/users/:id/suspend', async (req, res) => {
  const targetId = String(req.params.id);
  requireUuid(targetId);

  const body = suspendBody.safeParse(req.body);
  if (!body.success) {
    throw new AppError(400, 'INVALID_BODY', 'Body must be { "suspended": true | false }');
  }
  if (targetId === req.user!.id) {
    throw new AppError(400, 'CANNOT_SUSPEND_SELF', 'Admins cannot suspend their own account');
  }

  const result = await db.query(
    `UPDATE users
     SET suspended_at = CASE WHEN $2::boolean THEN COALESCE(suspended_at, NOW()) ELSE NULL END
     WHERE id = $1
     RETURNING id, suspended_at`,
    [targetId, body.data.suspended],
  );
  if (result.rowCount === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  res.json({
    id: result.rows[0].id,
    isSuspended: result.rows[0].suspended_at !== null,
    suspendedAt: result.rows[0].suspended_at,
  });
});

// ─── 4. GET /api/admin/models ───────────────────────────────────────────────
// รวมโมเดลที่ถูกซ่อนและถูกลบ
adminRouter.get('/models', async (req, res) => {
  const { page, pageSize, offset, q } = parsePaging(req.query);
  const search = q ? likePattern(q) : null;

  const where = search ? `WHERE m.title ILIKE $1 ESCAPE '\\' OR u.display_name ILIKE $1 ESCAPE '\\'` : '';
  const filterParams = search ? [search] : [];

  const total = await db.query(
    `SELECT COUNT(*)::int AS total FROM models m JOIN users u ON u.id = m.owner_id ${where}`,
    filterParams,
  );
  const rows = await db.query(
    `SELECT m.id, m.title, m.license, m.price_cents, m.currency, m.view_count, m.download_count,
            m.hidden_at, m.deleted_at, m.created_at,
            u.id AS owner_id, u.display_name AS owner_name, u.suspended_at AS owner_suspended_at
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
        isSuspended: m.owner_suspended_at !== null,
      },
      createdAt: m.created_at,
    })),
    page,
    pageSize,
    total: total.rows[0].total,
  });
});

// ─── 5. PATCH /api/admin/models/:id/hide ────────────────────────────────────
const hideBody = z.object({ hidden: z.boolean() });

adminRouter.patch('/models/:id/hide', async (req, res) => {
  const modelId = String(req.params.id);
  requireUuid(modelId);

  const body = hideBody.safeParse(req.body);
  if (!body.success) {
    throw new AppError(400, 'INVALID_BODY', 'Body must be { "hidden": true | false }');
  }

  const result = await db.query(
    `UPDATE models
     SET hidden_at = CASE WHEN $2::boolean THEN COALESCE(hidden_at, NOW()) ELSE NULL END
     WHERE id = $1
     RETURNING id, hidden_at`,
    [modelId, body.data.hidden],
  );
  if (result.rowCount === 0) {
    throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
  }

  res.json({
    id: result.rows[0].id,
    isHidden: result.rows[0].hidden_at !== null,
    hiddenAt: result.rows[0].hidden_at,
  });
});

// ─── 6. GET /api/admin/purchases ────────────────────────────────────────────
// ไม่ส่ง embed_key กลับ (เป็นความลับของผู้ซื้อ); ส่ง watermark_hash ไว้ตรวจย้อนรอย
adminRouter.get('/purchases', async (req, res) => {
  const { page, pageSize, offset, q } = parsePaging(req.query);
  const search = q ? likePattern(q) : null;

  const where = search
    ? `WHERE m.title ILIKE $1 ESCAPE '\\' OR u.email ILIKE $1 ESCAPE '\\' OR u.display_name ILIKE $1 ESCAPE '\\'`
    : '';
  const filterParams = search ? [search] : [];
  const joins = `FROM purchases p
     JOIN users u ON u.id = p.user_id
     JOIN models m ON m.id = p.model_id`;

  const total = await db.query(`SELECT COUNT(*)::int AS total ${joins} ${where}`, filterParams);
  const rows = await db.query(
    `SELECT p.id, p.status, p.amount_cents, p.currency, p.license_type, p.watermark_hash,
            p.paid_at, p.created_at,
            u.id AS buyer_id, u.email AS buyer_email, u.display_name AS buyer_name,
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
      `(c.message ILIKE $${n} ESCAPE '\\' OR u.display_name ILIKE $${n} ESCAPE '\\' OR u.email ILIKE $${n} ESCAPE '\\' OR m.title ILIKE $${n} ESCAPE '\\')`,
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
            u.id AS reporter_id, u.display_name AS reporter_name, u.email AS reporter_email,
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

  const result = await db.query(
    `UPDATE complaints
     SET status = $2,
         admin_note = CASE WHEN $3::boolean THEN $4::text ELSE admin_note END,
         handled_by = CASE WHEN $5::boolean THEN $6::uuid ELSE NULL END,
         handled_at = CASE WHEN $5::boolean THEN NOW() ELSE NULL END
     WHERE id = $1
     RETURNING id, status, admin_note, handled_at`,
    [id, status, adminNote !== undefined, adminNote ? adminNote : null, handled, req.user!.id],
  );
  if (result.rowCount === 0) {
    throw new AppError(404, 'COMPLAINT_NOT_FOUND', 'Complaint not found');
  }

  const r = result.rows[0];
  res.json({ id: r.id, status: r.status, adminNote: r.admin_note, handledAt: r.handled_at });
});
