// [เจี๊ยบ] ฝั่งผู้ใช้ส่งคำร้องเรียน — แอดมินดูและปิดเรื่องผ่าน /api/admin/complaints
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../config/db';
import { requireAuth } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';

export const complaintsRouter = Router();

const COMPLAINT_CATEGORIES = ['model', 'account', 'purchase', 'other'] as const;

// กันสแปม: ผู้ใช้หนึ่งคนส่งได้ไม่เกินจำนวนนี้ต่อชั่วโมง
const MAX_PER_HOUR = 5;

const createBody = z
  .object({
    category: z.enum(COMPLAINT_CATEGORIES),
    modelId: z.string().uuid().optional(),
    message: z.string().trim().min(10).max(2000),
  })
  .refine((b) => b.category !== 'model' || b.modelId !== undefined, {
    message: 'A model complaint needs a model',
    path: ['modelId'],
  });

// ─── POST /api/complaints ───────────────────────────────────────────────────
complaintsRouter.post('/', requireAuth, async (req, res) => {
  const body = createBody.safeParse(req.body);
  if (!body.success) {
    throw new AppError(
      400,
      'INVALID_BODY',
      'Choose a type, a model for model complaints, and write 10 to 2000 characters.',
    );
  }
  const { category, modelId, message } = body.data;
  const userId = req.user!.id;

  // สถานะบัญชีเช็กจาก DB (ไม่เชื่อ JWT)
  const user = await db.query(`SELECT suspended_at FROM users WHERE id = $1`, [userId]);
  if (user.rowCount === 0) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  if (user.rows[0].suspended_at) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
  }

  const recent = await db.query(
    `SELECT COUNT(*)::int AS total FROM complaints
     WHERE reporter_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId],
  );
  if (recent.rows[0].total >= MAX_PER_HOUR) {
    throw new AppError(429, 'TOO_MANY_COMPLAINTS', 'You have sent several reports recently. Please try again later.');
  }

  if (modelId) {
    const model = await db.query(`SELECT id FROM models WHERE id = $1 AND deleted_at IS NULL`, [modelId]);
    if (model.rowCount === 0) throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
  }

  const result = await db.query(
    `INSERT INTO complaints (reporter_id, category, model_id, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, status, created_at`,
    [userId, category, modelId ?? null, message],
  );

  res.status(201).json({
    id: result.rows[0].id,
    status: result.rows[0].status,
    createdAt: result.rows[0].created_at,
  });
});
