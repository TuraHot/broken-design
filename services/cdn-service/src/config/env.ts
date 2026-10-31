import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 4001,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  storageDir: process.env.STORAGE_DIR || './storage_data',
  tmpUploadDir: process.env.TMP_UPLOAD_DIR || './tmp_uploads',
  maxModelSizeBytes: Number(process.env.MAX_MODEL_SIZE_BYTES) || 52428800,
  maxPreviewSizeBytes: Number(process.env.MAX_PREVIEW_SIZE_BYTES) || 5242880,
  maxPosterSizeBytes: Number(process.env.MAX_POSTER_SIZE_BYTES) || 1048576,
};

