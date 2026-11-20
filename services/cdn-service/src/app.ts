import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { allowedOrigins } from "./config/cors";
import { supabase } from "./config/supabase";
import { uploadRouter } from "./modules/upload/upload.routes";
import { avatarRouter } from "./modules/upload/avatar.routes";
import {
  cdnRouter,
  verifyWatermarkLimiter,
  verifyWatermarkMiddleware,
  verifyWatermarkHandler,
} from "./modules/cdn/cdn.routes";
import { errorHandler } from "./middlewares/error.middleware";
import { testDbConnection } from "./config/db";
import { cleanupStaleTmpUploads } from "./storage/cacheManager";
import { ensureSupabaseModelsBucket } from "./storage/supabase.storage";

export const app = express();

app.set("trust proxy", env.trustProxy);
app.use(express.json());

const apiCors = cors({ origin: allowedOrigins(), credentials: true });
const publicCdnCors = cors({ origin: "*" });

app.options("/health", apiCors);
app.get("/health", apiCors, async (_req, res) => {
  const dbStatus = await testDbConnection();
  res.json({
    service: "broken-design-cdn-service",
    status: "ok",
    database: dbStatus,
  });
});

app.use("/api", apiCors, uploadRouter);
app.use("/api", apiCors, avatarRouter);
app.use("/cdn", publicCdnCors, cdnRouter);
app.options("/verify-watermark", apiCors);
app.post("/verify-watermark", apiCors, verifyWatermarkLimiter, verifyWatermarkMiddleware, verifyWatermarkHandler);
app.options("/api/verify-watermark", apiCors);
app.post("/api/verify-watermark", apiCors, verifyWatermarkLimiter, verifyWatermarkMiddleware, verifyWatermarkHandler);

app.use(errorHandler);

const isTest =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test"));

if (!isTest) {
  void cleanupStaleTmpUploads(env.tmpUploadDir, env.tmpCleanupMaxAgeMs)
    .then(({ removedFiles }) => {
      if (removedFiles > 0) {
        console.log(`[CDN-Service] Cleaned up ${removedFiles} stale temporary upload(s)`);
      }
    })
    .catch((err) => {
      console.warn("[CDN-Service] Failed to clean stale tmp uploads:", err?.message || err);
    });

  if (env.storageProvider === "supabase" && supabase) {
    for (const bucket of [env.supabaseStorageBucket, env.supabaseAvatarBucket]) {
      void ensureSupabaseModelsBucket(bucket).catch((err) => {
        console.warn(`[CDN-Service] Could not enforce Supabase bucket "${bucket}" settings:`, err?.message || err);
      });
    }
  }

  app.listen(env.port, () => {
    console.log(`[Lixyte CDN-Service] running on http://localhost:${env.port}`);
  });
}
