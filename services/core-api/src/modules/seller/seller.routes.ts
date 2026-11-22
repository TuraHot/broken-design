// [ภีม] แดชบอร์ดคนขาย — โมเดลของฉัน, ยอดขาย, กระเป๋าเงิน, และระบบสมัครเป็นครีเอเตอร์
import { Router } from 'express';
import { requireActiveSeller, requireAuth, isSuspended } from '../../middlewares/auth.middleware';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/error.middleware';
import { ownerActiveSql } from '../models/availability';

export const sellerRouter = Router();

export function calculateWithdrawalBreakdown(grossAmountCents: number, feeRateBps = env.platformFeeBps) {
  const safeGross = Math.max(0, Math.round(grossAmountCents));
  const platformFeeCents = Math.round((safeGross * feeRateBps) / 10000);
  const netAmountCents = Math.max(0, safeGross - platformFeeCents);
  return {
    grossAmountCents: safeGross,
    platformFeeCents,
    netAmountCents,
    feeRateBps,
    feeRatePercent: feeRateBps / 100,
  };
}

// ─── 1. GET /api/seller/models ──────────────────────────────────────────────
// โมเดลของฉัน (คนขาย)
sellerRouter.get('/models', requireAuth, requireActiveSeller, async (req, res) => {
  const userId = req.user!.id;

  const result = await db.query(
    `SELECT id, title, description, license, price_cents, currency, view_count, download_count,
            poster_hash, hidden_at, created_at
     FROM models
     WHERE owner_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );

  res.json({
    models: result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      license: r.license ?? 'CC0',
      priceCents: r.price_cents,
      currency: r.currency,
      viewCount: r.view_count,
      downloadCount: r.download_count,
      posterUrl: r.poster_hash ? `${env.cdnServiceUrl}/cdn/models/${r.id}/poster.webp` : null,
      isHidden: r.hidden_at !== null,
      createdAt: r.created_at,
    })),
  });
});

// ─── 3. GET /api/seller/sales ───────────────────────────────────────────────
// ยอดขายของคนขาย — ใช้ราคาที่ล็อกไว้ตอนซื้อ (purchases.amount_cents) เพื่อให้ตรงกับประวัติจริงแม้แก้ราคาภายหลัง
sellerRouter.get('/sales', requireAuth, requireActiveSeller, async (req, res) => {
  const userId = req.user!.id;

  // รายการขายทั้งหมด (เฉพาะ paid)
  const salesResult = await db.query(
    `SELECT p.id AS purchase_id, p.model_id, COALESCE(p.paid_at, p.created_at) AS sold_at,
            m.title,
            COALESCE(NULLIF(p.amount_cents, 0), m.price_cents) AS price_cents,
            COALESCE(NULLIF(p.currency, ''), m.currency) AS currency,
            u.display_name AS buyer_name
     FROM purchases p
     JOIN models m ON m.id = p.model_id
     JOIN users u ON u.id = p.user_id
     WHERE m.owner_id = $1 AND p.status = 'paid'
     ORDER BY COALESCE(p.paid_at, p.created_at) DESC`,
    [userId],
  );

  // สรุปรายได้รวม (ล็อกจากราคาตอนซื้อจริง)
  const summaryResult = await db.query(
    `SELECT COALESCE(SUM(COALESCE(NULLIF(p.amount_cents, 0), m.price_cents)), 0) AS total_revenue,
            COUNT(*)::int AS total_sales
     FROM purchases p
     JOIN models m ON m.id = p.model_id
     WHERE m.owner_id = $1 AND p.status = 'paid'`,
    [userId],
  );

  const summary = summaryResult.rows[0];

  res.json({
    totalRevenue: Number(summary.total_revenue),
    totalSales: summary.total_sales,
    sales: salesResult.rows.map((r) => ({
      purchaseId: r.purchase_id,
      modelId: r.model_id,
      title: r.title,
      priceCents: Number(r.price_cents),
      currency: r.currency,
      buyerName: r.buyer_name,
      soldAt: r.sold_at,
    })),
  });
});

// ─── 4. GET /api/seller/status ──────────────────────────────────────────────
// ตรวจสถานะคนขาย (ไม่ต้อง requireActiveSeller — ใครก็เรียกได้)
sellerRouter.get('/status', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const result = await db.query(
    `SELECT is_seller FROM users WHERE id = $1`,
    [userId],
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  res.json({ isSeller: result.rows[0].is_seller });
});

// The wallet is single-currency (Thai baht, amounts in satang): only THB sales count toward the balance and payouts are
// recorded as THB, so a sale in another currency is never added to the total as if it were satang.
const WALLET_CURRENCY = 'THB';

type Queryable = Pick<typeof db, 'query'>;

async function getSellerWalletTotals(sellerId: string, runner: Queryable = db) {
  const earnedRes = await runner.query(
    `SELECT COALESCE(SUM(COALESCE(NULLIF(p.amount_cents, 0), m.price_cents)), 0) AS gross_earned
     FROM purchases p
     JOIN models m ON m.id = p.model_id
     WHERE m.owner_id = $1 AND p.status = 'paid'
       AND UPPER(COALESCE(NULLIF(p.currency, ''), m.currency)) = $2`,
    [sellerId, WALLET_CURRENCY],
  );
  const withdrawnRes = await runner.query(
    `SELECT COALESCE(SUM(gross_amount_cents), 0) AS gross_withdrawn
     FROM creator_withdrawals
     WHERE seller_id = $1 AND currency = $2 AND status IN ('pending', 'approved', 'paid')`,
    [sellerId, WALLET_CURRENCY],
  );
  const grossEarnedCents = Number(earnedRes.rows[0]?.gross_earned ?? 0);
  const withdrawnGrossCents = Number(withdrawnRes.rows[0]?.gross_withdrawn ?? 0);
  const availableGrossCents = Math.max(0, grossEarnedCents - withdrawnGrossCents);
  return { grossEarnedCents, withdrawnGrossCents, availableGrossCents };
}

// ─── 5. GET /api/seller/wallet ──────────────────────────────────────────────
// ยอดเงินที่เว็บถือไว้ให้คนขาย + คำนวณส่วนต่างค่าธรรมเนียมแพลตฟอร์ม + ประวัติการถอน
sellerRouter.get('/wallet', requireAuth, requireActiveSeller, async (req, res) => {
  const userId = req.user!.id;

  const [{ grossEarnedCents, withdrawnGrossCents, availableGrossCents }, historyRes] = await Promise.all([
    getSellerWalletTotals(userId),
    db.query(
      `SELECT id, gross_amount_cents, platform_fee_cents, net_amount_cents, fee_rate_bps,
              currency, payout_method, payout_account, status, created_at, processed_at
       FROM creator_withdrawals
       WHERE seller_id = $1
       ORDER BY created_at DESC`,
      [userId],
    ),
  ]);
  const breakdown = calculateWithdrawalBreakdown(availableGrossCents);

  res.json({
    wallet: {
      grossEarnedCents,
      withdrawnGrossCents,
      availableGrossCents,
      feeRateBps: breakdown.feeRateBps,
      feeRatePercent: breakdown.feeRatePercent,
      estimatedFeeCents: breakdown.platformFeeCents,
      estimatedNetCents: breakdown.netAmountCents,
    },
    withdrawals: historyRes.rows.map((r) => ({
      id: r.id,
      grossAmountCents: r.gross_amount_cents,
      platformFeeCents: r.platform_fee_cents,
      netAmountCents: r.net_amount_cents,
      feeRateBps: r.fee_rate_bps,
      currency: r.currency,
      payoutMethod: r.payout_method,
      payoutAccount: r.payout_account,
      status: r.status,
      createdAt: r.created_at,
      processedAt: r.processed_at,
    })),
  });
});

// ─── 6. POST /api/seller/withdraw ───────────────────────────────────────────
// ขอถอนเงินใน Transaction + Row Lock บน users เพื่อกัน Race Condition (TOCTOU double-spend)
sellerRouter.post('/withdraw', requireAuth, requireActiveSeller, async (req, res) => {
  const userId = req.user!.id;
  const payoutMethod = String(req.body?.payoutMethod || 'promptpay').trim().toLowerCase();
  const payoutAccount = String(req.body?.payoutAccount || '').trim();

  if (!['promptpay', 'bank'].includes(payoutMethod)) {
    throw new AppError(400, 'INVALID_PAYOUT_METHOD', 'Payout method must be promptpay or bank');
  }
  if (!payoutAccount || payoutAccount.length < 4 || payoutAccount.length > 255) {
    throw new AppError(400, 'INVALID_PAYOUT_ACCOUNT', 'Please enter a valid PromptPay ID or bank account');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Serialize all concurrent withdrawal attempts for this seller by locking their user row first.
    const lockedUser = await client.query<{ is_seller: boolean; role: string; suspended_at: Date | string | null; suspended_until: Date | string | null }>(
      `SELECT is_seller, role, suspended_at, suspended_until FROM users WHERE id = $1 FOR UPDATE`,
      [userId],
    );
    const u = lockedUser.rows[0];
    if (!u) throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
    if (isSuspended(u)) {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
    }
    if (u.role === 'admin') {
      throw new AppError(403, 'ADMIN_CANNOT_SELL', 'Admin accounts cannot act as sellers');
    }
    if (!u.is_seller) {
      throw new AppError(403, 'NOT_SELLER', 'You must be an approved creator to access seller tools');
    }

    const { availableGrossCents } = await getSellerWalletTotals(userId, client);
    if (availableGrossCents <= 0) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'No available balance to withdraw');
    }

    const requestedCents =
      req.body?.amountCents !== undefined && req.body?.amountCents !== null
        ? Math.round(Number(req.body.amountCents))
        : availableGrossCents;

    if (!Number.isFinite(requestedCents) || requestedCents <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Withdrawal amount must be greater than 0');
    }
    if (requestedCents > availableGrossCents) {
      throw new AppError(400, 'EXCEEDS_BALANCE', 'Withdrawal amount exceeds available platform balance');
    }

    const breakdown = calculateWithdrawalBreakdown(requestedCents);

    const inserted = await client.query(
      `INSERT INTO creator_withdrawals
         (seller_id, gross_amount_cents, platform_fee_cents, net_amount_cents, fee_rate_bps, currency, payout_method, payout_account, status)
       VALUES ($1, $2, $3, $4, $5, $8, $6, $7, 'pending')
       RETURNING id, gross_amount_cents, platform_fee_cents, net_amount_cents, fee_rate_bps,
                 currency, payout_method, payout_account, status, created_at`,
      [
        userId,
        breakdown.grossAmountCents,
        breakdown.platformFeeCents,
        breakdown.netAmountCents,
        breakdown.feeRateBps,
        payoutMethod,
        payoutAccount,
        WALLET_CURRENCY,
      ],
    );

    await client.query('COMMIT');

    const r = inserted.rows[0];
    res.status(201).json({
      withdrawal: {
        id: r.id,
        grossAmountCents: r.gross_amount_cents,
        platformFeeCents: r.platform_fee_cents,
        netAmountCents: r.net_amount_cents,
        feeRateBps: r.fee_rate_bps,
        currency: r.currency,
        payoutMethod: r.payout_method,
        payoutAccount: r.payout_account,
        status: r.status,
        createdAt: r.created_at,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
});

// ─── 7. GET /api/seller/application ─────────────────────────────────────────
// ดูสถานะคำขอเป็น Creator ล่าสุดของผู้ใช้ปัจจุบัน
sellerRouter.get('/application', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const result = await db.query(
    `SELECT id, note, status, admin_note, created_at, reviewed_at
     FROM creator_applications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  if (result.rowCount === 0) {
    res.json({ application: null });
    return;
  }
  const r = result.rows[0];
  res.json({
    application: {
      id: r.id,
      note: r.note ?? '',
      status: r.status,
      adminNote: r.admin_note ?? null,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at ?? null,
    },
  });
});

// ─── 8. POST /api/seller/apply ──────────────────────────────────────────────
// ส่งคำขอเป็น Creator (หลังยอมรับกฎ) — ถ้ามี Creator Invite Code ที่ถูกต้องจะเป็น Creator ทันทีแบบ Atomic CTE ถ้าไม่มีจะส่งให้แอดมินอนุมัติ
sellerRouter.post('/apply', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
  const rawInviteCode = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim() : '';

  const userRes = await db.query(
    `SELECT is_seller, role, suspended_at, suspended_until FROM users WHERE id = $1`,
    [userId],
  );
  if (userRes.rowCount === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  const u = userRes.rows[0];
  if (u.role === 'admin') {
    throw new AppError(403, 'ADMIN_CANNOT_SELL', 'Admin accounts cannot become creators');
  }
  if (isSuspended(u)) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
  }
  if (u.is_seller || u.role === 'creator') {
    res.json({
      approved: true,
      application: { id: null, status: 'approved', note: '', adminNote: null },
      message: 'Your account is already approved as a creator',
    });
    return;
  }

  // กรณีมี Creator Invite Code → ตัดสิทธิ์โค้ด + เปิดครีเอเตอร์ + บันทึกคำขอใน SQL CTE เดียว (Atomic)
  if (rawInviteCode) {
    const codeUpper = rawInviteCode.toUpperCase();
    const atomicRes = await db.query(
      `WITH used_code AS (
         UPDATE creator_invite_codes
         SET used_count = used_count + 1
         WHERE UPPER(code) = $1
           AND used_count < max_uses
           AND (expires_at IS NULL OR expires_at > NOW())
         RETURNING id, code
       ),
       promote AS (
         UPDATE users
         SET is_seller = TRUE,
             role = CASE WHEN role = 'user' THEN 'creator'::user_role ELSE role END
         WHERE id = $2
           AND role <> 'admin'
           AND ${ownerActiveSql('users')}
           AND EXISTS (SELECT 1 FROM used_code)
         RETURNING id
       ),
       app_row AS (
         INSERT INTO creator_applications (user_id, note, status, admin_note, reviewed_at)
         SELECT $2, $3, 'approved', 'Approved via invite code: ' || uc.code, NOW()
         FROM used_code uc
         WHERE EXISTS (SELECT 1 FROM promote)
         RETURNING id, note, status, admin_note, created_at, reviewed_at
       )
       SELECT id, note, status, admin_note, created_at, reviewed_at FROM app_row`,
      [codeUpper, userId, note],
    );

    if (atomicRes.rowCount === 0) {
      throw new AppError(400, 'INVALID_INVITE_CODE', 'Invalid, expired, or fully used Creator Invite Code');
    }

    const r = atomicRes.rows[0];
    res.status(201).json({
      approved: true,
      application: {
        id: r.id,
        note: r.note ?? '',
        status: r.status,
        adminNote: r.admin_note ?? null,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at ?? null,
      },
      message: 'Invite code accepted! You are now a creator.',
    });
    return;
  }

  const pendingRes = await db.query(
    `SELECT id, note, status, admin_note, created_at, reviewed_at
     FROM creator_applications
     WHERE user_id = $1 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  if (pendingRes.rowCount! > 0) {
    const p = pendingRes.rows[0];
    res.json({
      approved: false,
      application: {
        id: p.id,
        note: p.note ?? '',
        status: p.status,
        adminNote: p.admin_note ?? null,
        createdAt: p.created_at,
        reviewedAt: p.reviewed_at ?? null,
      },
      message: 'Your creator application is already pending admin review',
    });
    return;
  }

  const inserted = await db.query(
    `INSERT INTO creator_applications (user_id, note, status)
     VALUES ($1, $2, 'pending')
     RETURNING id, note, status, admin_note, created_at, reviewed_at`,
    [userId, note],
  );
  const r = inserted.rows[0];
  res.status(201).json({
    approved: false,
    application: {
      id: r.id,
      note: r.note ?? '',
      status: r.status,
      adminNote: r.admin_note ?? null,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at ?? null,
    },
    message: 'Application submitted for admin approval',
  });
});
