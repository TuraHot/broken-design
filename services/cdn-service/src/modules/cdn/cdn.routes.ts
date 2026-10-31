import { Router } from 'express';
import crypto from 'crypto';

export const cdnRouter = Router();

export function verifyEmbedKeyConstantTime(providedKey: string, storedKey: string): boolean {
  const a = Buffer.from(providedKey);
  const b = Buffer.from(storedKey);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// [Member 5] GET /cdn/models/:id/:hash.glb (Free & Preview streaming)
cdnRouter.get('/models/:id/:hash.glb', async (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, immutable, max-age=31536000');
  res.setHeader('Accept-Ranges', 'bytes');
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'TODO [Member 5]: Stream free/preview GLB with Range support' } });
});

// [Member 5] GET /cdn/models/:id/file.glb?key= (Paid streaming with embed_key)
cdnRouter.get('/models/:id/file.glb', async (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'TODO [Member 5]: Verify embed_key & stream paid GLB' } });
});

// [Member 5] GET /cdn/models/:id/download (Trigger download & increment download_count)
cdnRouter.get('/models/:id/download', async (_req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="model.glb"');
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'TODO [Member 5]: Authenticated file download & increment download_count' } });
});

// [Member 5] GET /cdn/models/:id/poster.webp
cdnRouter.get('/models/:id/poster.webp', async (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, immutable, max-age=31536000');
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'TODO [Member 5]: Stream poster image' } });
});

