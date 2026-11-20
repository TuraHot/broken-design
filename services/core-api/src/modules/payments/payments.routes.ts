// [ภีม] ระบบซื้อรายชิ้น (Single-Item Purchase) — รองรับ Stripe PromptPay QR และ Mock + embed_key
import { Router } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { requireAuth, requireBuyer, requireNotSuspended } from '../../middlewares/auth.middleware';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/error.middleware';

export const paymentsRouter = Router();

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new AppError(500, 'STRIPE_NOT_CONFIGURED', 'STRIPE_SECRET_KEY is not configured');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }
  return stripeClient;
}

function toThbSatang(amountCents: number, currency: string): number {
  const cur = (currency || 'USD').toUpperCase();
  // Stripe PromptPay requires THB in satang (minimum 1000 satang = 10 THB)
  const satang = cur === 'THB' ? amountCents : Math.round(amountCents * 35);
  return Math.max(1000, satang);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(id: string) {
  if (!UUID_RE.test(id)) {
    throw new AppError(400, 'INVALID_ID', 'Invalid id');
  }
}

async function createAndStorePromptPayIntent(params: {
  stripe: Stripe;
  purchaseId: string;
  modelId: string;
  userId: string;
  buyerEmail: string;
  title: string;
  amountCents: number;
  currency: string;
}): Promise<Stripe.PaymentIntent> {
  const amountSatang = toThbSatang(params.amountCents, params.currency);
  const paymentIntent = await params.stripe.paymentIntents.create({
    amount: amountSatang,
    currency: 'thb',
    payment_method_types: ['promptpay'],
    confirm: true,
    payment_method_data: {
      type: 'promptpay',
      billing_details: { email: params.buyerEmail },
    },
    description: `Lixyte: ${params.title}`,
    metadata: { purchaseId: params.purchaseId, modelId: params.modelId, userId: params.userId },
  });
  await db.query(`UPDATE purchases SET provider_session_id = $1 WHERE id = $2`, [
    paymentIntent.id,
    params.purchaseId,
  ]);
  return paymentIntent;
}

// ─── Helper ────────────────────────────────────────────────────────────────────

export function generateEmbedKey(): string {
  return crypto.randomBytes(24).toString('hex');
}

// ─── Middleware: ตรวจว่า mock payment เปิดได้เฉพาะเมื่อ PAYMENT_PROVIDER=mock ─
function requireMockProvider(
  _req: import('express').Request,
  _res: import('express').Response,
  next: import('express').NextFunction,
) {
  if (env.paymentProvider !== 'mock') {
    throw new AppError(403, 'MOCK_DISABLED', 'Mock payment is disabled in this environment');
  }
  next();
}

// ─── 1. POST /api/models/:id/checkout ───────────────────────────────────────
// สร้างคำสั่งซื้อรายชิ้น (pending) ล็อกราคา สกุลเงิน และประเภท License จากฐานข้อมูลจริง — กันซื้อซ้ำ
paymentsRouter.post('/models/:id/checkout', requireAuth, requireBuyer, async (req, res) => {
  const userId = req.user!.id;
  const modelId = String(req.params.id);
  requireUuid(modelId);

  // ดึงราคา ประเภท License และสถานะเจ้าของจากฐานข้อมูลจริง
  const modelRow = await db.query(
    `SELECT m.id, m.title, m.price_cents, m.currency, m.license, m.deleted_at, m.hidden_at, m.owner_id,
            u.suspended_at AS owner_suspended_at
     FROM models m
     LEFT JOIN users u ON u.id = m.owner_id
     WHERE m.id = $1`,
    [modelId],
  );
  if (modelRow.rowCount === 0) {
    throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
  }
  const model = modelRow.rows[0];

  if (model.deleted_at || model.hidden_at || model.owner_suspended_at) {
    throw new AppError(400, 'MODEL_UNAVAILABLE', 'This model is no longer available');
  }

  // ห้ามซื้อโมเดลของตัวเอง
  if (model.owner_id === userId) {
    throw new AppError(400, 'OWN_MODEL', 'You cannot purchase your own model');
  }

  // โมเดลฟรี → ซื้อได้เลยไม่ต้องจ่าย
  if (model.price_cents === 0) {
    throw new AppError(400, 'FREE_MODEL', 'This model is free — no checkout needed');
  }

  // ตรวจว่าซื้อแล้วหรือยัง (UNIQUE constraint: user_id + model_id)
  const existing = await db.query(
    `SELECT id, status FROM purchases WHERE user_id = $1 AND model_id = $2`,
    [userId, modelId],
  );
  if (existing.rowCount! > 0) {
    const purchase = existing.rows[0];
    if (purchase.status === 'paid') {
      throw new AppError(409, 'ALREADY_PURCHASED', 'You have already purchased this model');
    }
    // ถ้ายัง pending อยู่ → ส่ง checkout url เดิมกลับไป
    res.json({
      purchaseId: purchase.id,
      checkoutUrl: `/checkout/${purchase.id}`,
      provider: env.paymentProvider,
    });
    return;
  }

  // สร้างคำสั่งซื้อใหม่ status=pending พร้อมล็อก amount_cents, currency, license_type
  const embedKey = generateEmbedKey();
  const amountCents = Number(model.price_cents) || 0;
  const currency = String(model.currency || 'USD').trim();
  const licenseType = String(model.license || 'COMMERCIAL').trim();

  let purchaseId: string;
  try {
    const result = await db.query(
      `INSERT INTO purchases (user_id, model_id, status, embed_key, amount_cents, currency, license_type)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6)
       RETURNING id`,
      [userId, modelId, embedKey, amountCents, currency, licenseType],
    );
    purchaseId = result.rows[0].id;
  } catch (err: any) {
    if (err?.code === '23505') {
      const raced = await db.query(
        `SELECT id, status FROM purchases WHERE user_id = $1 AND model_id = $2`,
        [userId, modelId],
      );
      const existingPurchase = raced.rows[0];
      if (existingPurchase?.status === 'paid') {
        throw new AppError(409, 'ALREADY_PURCHASED', 'You have already purchased this model');
      }
      if (existingPurchase) {
        res.json({
          purchaseId: existingPurchase.id,
          checkoutUrl: `/checkout/${existingPurchase.id}`,
          provider: env.paymentProvider,
        });
        return;
      }
    }
    throw err;
  }

  res.json({
    purchaseId,
    checkoutUrl: `/checkout/${purchaseId}`,
    provider: env.paymentProvider,
  });
});

// ─── 1b. GET /api/models/:id/purchase ────────────────────────────────────────
// ตรวจสอบว่าผู้ใช้ปัจจุบันได้ซื้อโมเดลนี้ไปแล้วหรือยัง (เฉพาะ status = 'paid')
paymentsRouter.get('/models/:id/purchase', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const modelId = String(req.params.id);
  requireUuid(modelId);

  const result = await db.query(
    `SELECT id, status, embed_key, paid_at, created_at
     FROM purchases
     WHERE user_id = $1 AND model_id = $2 AND status = 'paid'`,
    [userId, modelId],
  );

  const purchased = (result.rowCount ?? 0) > 0;
  res.json({
    purchased,
    purchase: purchased
      ? {
          id: result.rows[0].id,
          modelId,
          embedKey: result.rows[0].embed_key,
          paidAt: result.rows[0].paid_at ?? result.rows[0].created_at,
        }
      : null,
  });
});

// ─── 2. POST /api/purchases/:id/confirm-mock ────────────────────────────────
// กดจ่ายจำลอง → เปลี่ยน status เป็น paid, บันทึก paid_at = NOW(), embed_key พร้อมใช้ทันที
// เปิดได้เฉพาะเมื่อ PAYMENT_PROVIDER=mock
paymentsRouter.post('/purchases/:id/confirm-mock', requireAuth, requireMockProvider, requireBuyer, async (req, res) => {
  const userId = req.user!.id;
  const purchaseId = String(req.params.id);
  requireUuid(purchaseId);

  const result = await db.query(
    `UPDATE purchases p
     SET status = 'paid', paid_at = NOW()
     FROM models m
     LEFT JOIN users o ON o.id = m.owner_id
     WHERE p.id = $1 AND p.user_id = $2 AND p.status = 'pending'
       AND m.id = p.model_id
       AND m.deleted_at IS NULL AND m.hidden_at IS NULL AND o.suspended_at IS NULL
     RETURNING p.id, p.model_id, p.embed_key, p.amount_cents, p.currency, p.license_type, p.paid_at`,
    [purchaseId, userId],
  );

  if (result.rowCount === 0) {
    // อาจจ่ายไปแล้ว, โมเดลถูกซ่อน/ลบ/เจ้าของถูกระงับ, หรือไม่ใช่ของตัวเอง
    const check = await db.query(
      `SELECT p.status, m.deleted_at, m.hidden_at, o.suspended_at AS owner_suspended_at
       FROM purchases p
       LEFT JOIN models m ON m.id = p.model_id
       LEFT JOIN users o ON o.id = m.owner_id
       WHERE p.id = $1 AND p.user_id = $2`,
      [purchaseId, userId],
    );
    if (check.rowCount! > 0) {
      const row = check.rows[0];
      if (row.status === 'paid') {
        throw new AppError(409, 'ALREADY_PAID', 'This purchase has already been paid');
      }
      if (row.deleted_at || row.hidden_at || row.owner_suspended_at) {
        throw new AppError(400, 'MODEL_UNAVAILABLE', 'This model is no longer available');
      }
    }
    throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
  }

  const purchase = result.rows[0];
  res.json({
    message: 'Payment confirmed (mock)',
    purchaseId: purchase.id,
    modelId: purchase.model_id,
    embedKey: purchase.embed_key,
    amountCents: purchase.amount_cents,
    currency: purchase.currency,
    licenseType: purchase.license_type,
    paidAt: purchase.paid_at,
  });
});

// ─── 2b. POST /api/models/:id/pay-mock (Alias by modelId for single-click mock pay) ─
paymentsRouter.post('/models/:id/pay-mock', requireAuth, requireMockProvider, requireBuyer, async (req, res) => {
  const userId = req.user!.id;
  const modelId = String(req.params.id);
  requireUuid(modelId);

  const result = await db.query(
    `UPDATE purchases p
     SET status = 'paid', paid_at = NOW()
     FROM models m
     LEFT JOIN users o ON o.id = m.owner_id
     WHERE p.model_id = $1 AND p.user_id = $2 AND p.status = 'pending'
       AND m.id = p.model_id
       AND m.deleted_at IS NULL AND m.hidden_at IS NULL AND o.suspended_at IS NULL
     RETURNING p.id, p.model_id, p.embed_key, p.amount_cents, p.currency, p.license_type, p.paid_at`,
    [modelId, userId],
  );

  if (result.rowCount === 0) {
    const check = await db.query(
      `SELECT p.id, p.model_id, p.embed_key, p.status, p.paid_at,
              m.deleted_at, m.hidden_at, o.suspended_at AS owner_suspended_at
       FROM purchases p
       LEFT JOIN models m ON m.id = p.model_id
       LEFT JOIN users o ON o.id = m.owner_id
       WHERE p.model_id = $1 AND p.user_id = $2`,
      [modelId, userId],
    );
    if (check.rowCount! > 0) {
      const row = check.rows[0];
      if (row.status === 'paid') {
        res.json({
          message: 'Payment already confirmed',
          purchaseId: row.id,
          modelId: row.model_id,
          embedKey: row.embed_key,
          paidAt: row.paid_at,
        });
        return;
      }
      if (row.deleted_at || row.hidden_at || row.owner_suspended_at) {
        throw new AppError(400, 'MODEL_UNAVAILABLE', 'This model is no longer available');
      }
    }
    throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Pending purchase not found for this model');
  }

  const purchase = result.rows[0];
  res.json({
    message: 'Payment confirmed (mock)',
    purchaseId: purchase.id,
    modelId: purchase.model_id,
    embedKey: purchase.embed_key,
    amountCents: purchase.amount_cents,
    currency: purchase.currency,
    licenseType: purchase.license_type,
    paidAt: purchase.paid_at,
  });
});

// ─── 2c. POST /api/purchases/:id/qr ─────────────────────────────────────────
// สร้าง QR Code สำหรับชำระเงิน (PromptPay ผ่าน Stripe เมื่อ PAYMENT_PROVIDER=stripe หรือ Mock QR)
paymentsRouter.post('/purchases/:id/qr', requireAuth, requireBuyer, async (req, res) => {
  const userId = req.user!.id;
  const purchaseId = String(req.params.id);
  requireUuid(purchaseId);

  const result = await db.query(
    `SELECT p.id, p.model_id, p.status, p.amount_cents, p.currency, p.provider_session_id,
            m.title, m.deleted_at, m.hidden_at,
            o.suspended_at AS owner_suspended_at
     FROM purchases p
     JOIN models m ON m.id = p.model_id
     LEFT JOIN users o ON o.id = m.owner_id
     WHERE p.id = $1 AND p.user_id = $2`,
    [purchaseId, userId],
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
  }

  const purchase = result.rows[0];
  if (purchase.status === 'paid') {
    throw new AppError(409, 'ALREADY_PAID', 'This purchase has already been paid');
  }
  if (purchase.deleted_at || purchase.hidden_at || purchase.owner_suspended_at) {
    throw new AppError(400, 'MODEL_UNAVAILABLE', 'This model is no longer available');
  }

  if (env.paymentProvider !== 'stripe') {
    res.json({
      provider: 'mock',
      purchaseId: purchase.id,
      qrImageUrl: null,
      amountSatang: toThbSatang(Number(purchase.amount_cents) || 0, purchase.currency),
      currency: 'THB',
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    });
    return;
  }

  const stripe = getStripe();
  let paymentIntent: Stripe.PaymentIntent | null = null;

  if (purchase.provider_session_id && String(purchase.provider_session_id).startsWith('pi_')) {
    const existingPi = await stripe.paymentIntents.retrieve(purchase.provider_session_id);
    if (existingPi.status === 'succeeded') {
      await db.query(
        `UPDATE purchases SET status = 'paid', paid_at = NOW() WHERE id = $1 AND status = 'pending'`,
        [purchase.id],
      );
      throw new AppError(409, 'ALREADY_PAID', 'This purchase has already been paid');
    }
    if (existingPi.status === 'requires_action' && existingPi.next_action?.promptpay_display_qr_code) {
      paymentIntent = existingPi;
    }
  }

  if (!paymentIntent) {
    paymentIntent = await createAndStorePromptPayIntent({
      stripe,
      purchaseId: purchase.id,
      modelId: purchase.model_id,
      userId,
      buyerEmail: req.user!.email,
      title: purchase.title,
      amountCents: Number(purchase.amount_cents) || 0,
      currency: purchase.currency,
    });
  }

  const qr = paymentIntent.next_action?.promptpay_display_qr_code;
  res.json({
    provider: 'stripe',
    purchaseId: purchase.id,
    paymentIntentId: paymentIntent.id,
    qrImageUrl: qr?.image_url_png || qr?.image_url_svg || null,
    hostedUrl: qr?.hosted_instructions_url || null,
    qrData: qr?.data || null,
    amountSatang: paymentIntent.amount,
    currency: 'THB',
  });
});

// ─── 3. POST /api/webhooks/stripe ────────────────────────────────────────────
// Stripe webhook: ตรวจลายเซ็นแล้วอัปเดต purchase เป็น paid
paymentsRouter.post('/webhooks/stripe', async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  if (!env.stripeWebhookSecret || typeof sig !== 'string') {
    throw new AppError(400, 'INVALID_WEBHOOK', 'Missing Stripe webhook signature or secret');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.stripeWebhookSecret);
  } catch (err: any) {
    throw new AppError(400, 'INVALID_WEBHOOK_SIGNATURE', err?.message || 'Invalid signature');
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    await db.query(
      `UPDATE purchases
       SET status = 'paid', paid_at = NOW()
       WHERE provider_session_id = $1 AND status = 'pending'`,
      [pi.id],
    );
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    await db.query(
      `UPDATE purchases
       SET status = 'paid', paid_at = NOW()
       WHERE (provider_session_id = $1 OR id = $2) AND status = 'pending'`,
      [session.id, session.metadata?.purchaseId || null],
    );
  }

  res.json({ received: true });
});

// ─── 4. GET /api/me/purchases ────────────────────────────────────────────────
// รายการที่ซื้อแล้ว (เฉพาะ status=paid) พร้อม embed_key, license_type, paid_at, watermark_hash
paymentsRouter.get('/me/purchases', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const result = await db.query(
    `SELECT p.id, p.model_id, p.embed_key, p.amount_cents, p.currency AS purchase_currency,
            p.license_type, p.watermark_hash, p.paid_at, p.created_at,
            m.title, m.price_cents, m.currency, m.license
     FROM purchases p
     JOIN models m ON m.id = p.model_id
     WHERE p.user_id = $1 AND p.status = 'paid'
     ORDER BY p.created_at DESC`,
    [userId],
  );

  res.json({
    purchases: result.rows.map((r) => ({
      id: r.id,
      modelId: r.model_id,
      title: r.title,
      priceCents: r.amount_cents ?? r.price_cents,
      amountCents: r.amount_cents ?? r.price_cents,
      currency: r.purchase_currency ?? r.currency,
      licenseType: r.license_type ?? r.license ?? 'COMMERCIAL',
      watermarkHash: r.watermark_hash ?? null,
      embedKey: r.embed_key,
      paidAt: r.paid_at ?? r.created_at,
      purchasedAt: r.paid_at ?? r.created_at,
    })),
  });
});

// ─── 5. POST /api/purchases/:id/regenerate-key ──────────────────────────────
// ขอ embed_key ใหม่ → รหัสเก่าใช้ไม่ได้ทันที
paymentsRouter.post('/purchases/:id/regenerate-key', requireAuth, requireNotSuspended, async (req, res) => {
  const userId = req.user!.id;
  const purchaseId = String(req.params.id);
  requireUuid(purchaseId);
  const newKey = generateEmbedKey();

  const result = await db.query(
    `UPDATE purchases
     SET embed_key = $1
     WHERE id = $2 AND user_id = $3 AND status = 'paid'
     RETURNING id, model_id`,
    [newKey, purchaseId, userId],
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found or not yet paid');
  }

  res.json({
    purchaseId: result.rows[0].id,
    modelId: result.rows[0].model_id,
    embedKey: newKey,
  });
});

// ─── 6. GET /api/purchases/:id ──────────────────────────────────────────────
// ดึงข้อมูลคำสั่งซื้อ (สำหรับหน้าชำระเงิน QR)
paymentsRouter.get('/purchases/:id', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const purchaseId = String(req.params.id);
  requireUuid(purchaseId);

  const result = await db.query(
    `SELECT p.id, p.model_id, p.status, p.amount_cents, p.currency AS purchase_currency,
            p.license_type, p.watermark_hash, p.paid_at, p.created_at, p.provider_session_id,
            m.title, m.price_cents, m.currency, m.license,
            u.display_name AS seller_name
     FROM purchases p
     JOIN models m ON m.id = p.model_id
     LEFT JOIN users u ON u.id = m.owner_id
     WHERE p.id = $1 AND p.user_id = $2`,
    [purchaseId, userId],
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
  }

  const r = result.rows[0];
  let status = r.status;
  let paidAt = r.paid_at ?? null;

  // Sync status from Stripe PaymentIntent if still pending
  if (
    status === 'pending' &&
    env.paymentProvider === 'stripe' &&
    env.stripeSecretKey &&
    r.provider_session_id &&
    String(r.provider_session_id).startsWith('pi_')
  ) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(r.provider_session_id);
      if (pi.status === 'succeeded') {
        const upd = await db.query(
          `UPDATE purchases SET status = 'paid', paid_at = NOW()
           WHERE id = $1 AND status = 'pending'
           RETURNING status, paid_at`,
          [r.id],
        );
        if (upd.rowCount! > 0) {
          status = upd.rows[0].status;
          paidAt = upd.rows[0].paid_at;
        } else {
          status = 'paid';
        }
      }
    } catch {
      // Ignore transient Stripe poll errors
    }
  }

  res.json({
    id: r.id,
    modelId: r.model_id,
    title: r.title,
    sellerName: r.seller_name ?? 'Creator',
    priceCents: r.amount_cents ?? r.price_cents,
    amountCents: r.amount_cents ?? r.price_cents,
    currency: r.purchase_currency ?? r.currency,
    licenseType: r.license_type ?? r.license ?? 'COMMERCIAL',
    watermarkHash: r.watermark_hash ?? null,
    status,
    provider: env.paymentProvider,
    paidAt,
    createdAt: r.created_at,
  });
});
