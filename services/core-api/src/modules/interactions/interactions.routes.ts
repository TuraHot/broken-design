import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';

export const interactionsRouter = Router();

// [Member 6] POST /api/models/:id/like (Toggle like/favorite)
interactionsRouter.post('/models/:id/like', requireAuth, async (req, res) => {
  res.json({ message: `TODO [Member 6]: Toggle like for model ${req.params.id}` });
});

// [Member 6] GET /api/models/:id/comments
interactionsRouter.get('/models/:id/comments', async (req, res) => {
  res.json({ comments: [] });
});

// [Member 6] POST /api/models/:id/comments
interactionsRouter.post('/models/:id/comments', requireAuth, async (req, res) => {
  res.status(201).json({ message: `TODO [Member 6]: Add comment for model ${req.params.id}` });
});

