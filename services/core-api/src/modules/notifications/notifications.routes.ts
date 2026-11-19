// Owner's notification inbox: license-change notices and the like. Every query is scoped to the caller.
import { Router } from 'express';
import { db } from '../../config/db';
import { requireAuth } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';

export const notificationsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

notificationsRouter.use(requireAuth);

// GET /api/me/notifications — latest 50 plus the unread count
notificationsRouter.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT id, kind, model_id, data, read_at, created_at,
            (SELECT COUNT(*)::int FROM notifications WHERE user_id = $1 AND read_at IS NULL) AS unread
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.user!.id],
  );
  res.json({
    unread: result.rows[0] ? Number(result.rows[0].unread) : 0,
    items: result.rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      modelId: n.model_id,
      data: n.data,
      readAt: n.read_at,
      createdAt: n.created_at,
    })),
  });
});

// PATCH /api/me/notifications/read-all (declared before /:id so "read-all" is not read as an id)
notificationsRouter.patch('/read-all', async (req, res) => {
  const result = await db.query(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [req.user!.id],
  );
  res.json({ updated: result.rowCount ?? 0 });
});

// PATCH /api/me/notifications/:id/read
notificationsRouter.patch('/:id/read', async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) throw new AppError(400, 'INVALID_ID', 'Invalid id');

  const result = await db.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, req.user!.id],
  );
  if (result.rowCount === 0) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  res.json({ id });
});
