import { Router } from 'express';

export const uploadRouter = Router();

// [Member 2] POST /api/models (Multipart upload: file, preview?, poster?, metadata)
uploadRouter.post('/models', async (_req, res) => {
  res.status(201).json({
    message: 'TODO [Member 2]: Validate GLB magic bytes, compute sha256, store via LocalDiskStorage, and insert into models table',
  });
});

