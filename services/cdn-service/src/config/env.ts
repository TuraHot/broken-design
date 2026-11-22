import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_DEV_JWT_SECRET = 'dev-secret';
const DEFAULT_DEV_WATERMARK_SECRET = 'lixyte-broken-design-watermark-secret-2026';

export function assertProductionSecrets(
  nodeEnv = process.env.NODE_ENV,
  rawJwtSecret = process.env.JWT_SECRET,
  rawWatermarkSecret = process.env.WATERMARK_SECRET,
): void {
  if (nodeEnv !== 'production') return;
  const jwtSecret = (rawJwtSecret || '').trim();
  if (!jwtSecret || jwtSecret === DEFAULT_DEV_JWT_SECRET || jwtSecret.length < 16) {
    throw new Error(
      '[CDN-Service] Refusing to start in production without a strong JWT_SECRET (>= 16 characters, not dev-secret).',
    );
  }
  const wmSecret = (rawWatermarkSecret || '').trim();
  if (!wmSecret || wmSecret === DEFAULT_DEV_WATERMARK_SECRET || wmSecret.length < 16) {
    throw new Error(
      '[CDN-Service] Refusing to start in production without a strong WATERMARK_SECRET (>= 16 characters, not default).',
    );
  }
}

assertProductionSecrets();

export const env = {
  port: Number(process.env.PORT) || 4001,
  // Number of reverse proxies in front of the app (Render = 1). Needed so rate limits see the real client IP.
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  databaseUrl: process.env.DATABASE_URL || '',
  // Supabase session pooler (:5432) allows 15 clients across the whole team, so each process keeps few.
  dbPoolMax: Math.max(1, Number(process.env.DB_POOL_MAX) || 3),
  jwtSecret: process.env.JWT_SECRET || DEFAULT_DEV_JWT_SECRET,
  watermarkSecret: process.env.WATERMARK_SECRET || DEFAULT_DEV_WATERMARK_SECRET,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  storageProvider: (process.env.STORAGE_PROVIDER || 'local') as 'local' | 'supabase',
  storageDir: process.env.STORAGE_DIR || './storage_data',
  tmpUploadDir: process.env.TMP_UPLOAD_DIR || './tmp_uploads',
  maxCacheBytes:
    process.env.MAX_CACHE_BYTES !== undefined
      ? Math.max(0, Number(process.env.MAX_CACHE_BYTES) || 0)
      : 1024 * 1024 * 1024,
  tmpCleanupMaxAgeMs:
    process.env.TMP_CLEANUP_MAX_AGE_MS !== undefined
      ? Math.max(0, Number(process.env.TMP_CLEANUP_MAX_AGE_MS) || 0)
      : 60 * 60 * 1000,
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'models',
  supabaseAvatarBucket: process.env.SUPABASE_AVATAR_BUCKET || 'profile_logo',
  maxModelSizeBytes: Number(process.env.MAX_MODEL_SIZE_BYTES) || 52428800,
  maxPreviewSizeBytes: Number(process.env.MAX_PREVIEW_SIZE_BYTES) || 5242880,
  maxPosterSizeBytes: Number(process.env.MAX_POSTER_SIZE_BYTES) || 1048576,
};
