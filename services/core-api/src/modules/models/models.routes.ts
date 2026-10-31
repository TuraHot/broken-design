import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';

export const modelsRouter = Router();

// [Member 4] GET /api/models?q=&tag=&license=&price=free|paid&page=
modelsRouter.get('/', async (_req, res) => {
  res.json({ items: [], page: 1, total: 0 });
});

// [Member 3 & 5] GET /api/models/:id
modelsRouter.get('/:id', async (req, res) => {
  res.json({ id: req.params.id, title: 'Sample 3D Asset' });
});

// [Member 3] PATCH /api/models/:id (Update metadata)
modelsRouter.patch('/:id', requireAuth, async (req, res) => {
  res.json({ message: `TODO [Member 3]: Update model ${req.params.id}` });
});

// [Member 3] DELETE /api/models/:id (Soft delete if purchased)
modelsRouter.delete('/:id', requireAuth, async (req, res) => {
  res.json({ message: `TODO [Member 3]: Soft delete model ${req.params.id}` });
});

