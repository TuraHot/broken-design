import { Router } from 'express';

export const authRouter = Router();

// [Member 1] POST /api/auth/register
authRouter.post('/register', async (_req, res) => {
  res.status(201).json({ message: 'TODO [Member 1]: Register user with bcrypt & return JWT' });
});

// [Member 1] POST /api/auth/login
authRouter.post('/login', async (_req, res) => {
  res.json({ message: 'TODO [Member 1]: Verify credentials & issue JWT' });
});

