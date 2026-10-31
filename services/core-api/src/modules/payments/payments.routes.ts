import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../../middlewares/auth.middleware';

export const paymentsRouter = Router();

export function generateEmbedKey(): string {
  return crypto.randomBytes(24).toString('hex');
}

// [Member 6] POST /api/models/:id/checkout
paymentsRouter.post('/models/:id/checkout', requireAuth, async (req, res) => {
  res.json({ checkoutUrl: `/me?mock_paid=${req.params.id}` });
});

// [Member 6] POST /api/webhooks/stripe
paymentsRouter.post('/webhooks/stripe', async (_req, res) => {
  res.json({ received: true });
});

// [Member 6] GET /api/me/purchases
paymentsRouter.get('/me/purchases', requireAuth, async (_req, res) => {
  res.json({ purchases: [] });
});

// [Member 6] POST /api/purchases/:id/regenerate-key
paymentsRouter.post('/purchases/:id/regenerate-key', requireAuth, async (_req, res) => {
  res.json({ embedKey: generateEmbedKey() });
});

