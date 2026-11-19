import { Router, type NextFunction, type Request, type Response } from 'express';
import { db } from '../../config/db';
import { requireAuth } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';

export const interactionsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/models/:id/like (Current user's like state + total count)
interactionsRouter.get(
  '/models/:id/like',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      if (!UUID_RE.test(id)) {
        throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
      }

      const result = await db.query<{ liked: boolean; like_count: number }>(
        `SELECT
           EXISTS (SELECT 1 FROM likes WHERE user_id = $1 AND model_id = $2) AS liked,
           (SELECT COUNT(*)::int FROM likes WHERE model_id = $2) AS like_count`,
        [req.user!.id, id],
      );

      const row = result.rows[0];
      res.json({
        liked: Boolean(row?.liked),
        likeCount: Number(row?.like_count ?? 0),
      });
    } catch (err) {
      next(err);
    }
  },
);

// [Member 6] POST /api/models/:id/like (Toggle like/favorite — 1 heart per 1 account per 1 model)
interactionsRouter.post(
  '/models/:id/like',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const userId = req.user!.id;

      if (!UUID_RE.test(id)) {
        throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
      }

      const userCheck = await db.query<{ suspended_at: Date | null }>(
        `SELECT suspended_at FROM users WHERE id = $1`,
        [userId],
      );
      if (userCheck.rows[0]?.suspended_at !== null && userCheck.rows[0]?.suspended_at !== undefined) {
        throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
      }

      const modelCheck = await db.query<{ id: string }>(
        `SELECT id FROM models WHERE id = $1 AND hidden_at IS NULL AND deleted_at IS NULL`,
        [id],
      );
      if (modelCheck.rows.length === 0) {
        throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
      }

      const del = await db.query<{ user_id: string }>(
        `DELETE FROM likes WHERE user_id = $1 AND model_id = $2 RETURNING user_id`,
        [userId, id],
      );

      let liked = false;
      if ((del.rowCount ?? del.rows.length) === 0) {
        await db.query(
          `INSERT INTO likes (user_id, model_id) VALUES ($1, $2) ON CONFLICT (user_id, model_id) DO NOTHING`,
          [userId, id],
        );
        liked = true;
      }

      const countRes = await db.query<{ like_count: number }>(
        `SELECT COUNT(*)::int AS like_count FROM likes WHERE model_id = $1`,
        [id],
      );

      res.json({
        liked,
        likeCount: Number(countRes.rows[0]?.like_count ?? 0),
      });
    } catch (err) {
      next(err);
    }
  },
);

// [Member 6] GET /api/models/:id/comments
interactionsRouter.get('/models/:id/comments', async (req, res) => {
  res.json({ comments: [] });
});

// [Member 6] POST /api/models/:id/comments
interactionsRouter.post('/models/:id/comments', requireAuth, async (req, res) => {
  res.status(201).json({ message: `TODO [Member 6]: Add comment for model ${req.params.id}` });
});

