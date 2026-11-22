// CDN routes — mounted at /cdn in app.ts
//
//   GET /cdn/models/:id/:hash.glb        public file by content hash (free main file, or any preview) — immutable cache
//   GET /cdn/models/:id/preview.glb      public version (free → main file, paid → preview) — used by embed.js without key
//   GET /cdn/models/:id/file.glb?key=    full file; paid models need a valid embed_key — private, no-store
//   GET /cdn/models/:id/download         attachment; paid models need login + purchase (or owner); counts downloads
//   GET /cdn/models/:id/poster.webp      poster image
//
// Every route supports HEAD, HTTP Range (206/416) and ETag. Hidden models and models of suspended owners return 403.
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { pipeline } from "stream";
import express, {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/error.middleware";
import { isAccountDeleted, verifyJwtToken, type AuthUser } from "../../middlewares/auth.middleware";
import { touchCacheFile } from "../../storage";
import { validateGlbHeader } from "../../utils/glbValidator";
import {
  computeWatermarkSignature,
  embedLicenseAndWatermark,
  verifyGlbWatermark,
} from "../../utils/glbWatermark";
import { parseRangeSpec, resolveRange } from "./range";
import {
  CONTENT_TYPES,
  assertCanDownloadPaid,
  assertServable,
  assertValidEmbedKey,
  contentDisposition,
  incrementDownloadCount,
  isContentHash,
  isPaid,
  loadModel,
  loadUserAvatar,
  readAssetBuffer,
  savePurchaseWatermarkHash,
  sendAsset,
  type CdnModel,
  type PaidDownloadAccess,
} from "./cdn.service";
import { avatarKey, candidateKeys } from "../../storage/keys";

export { verifyEmbedKeyConstantTime } from "./cdn.service";

const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : fallback;
};

const CACHE = {
  immutable: "public, max-age=31536000, immutable", // URL contains the content hash
  // URLs without a hash (preview.glb, poster.webp, free file.glb) can change (new poster, admin hides model),
  // so keep them short to let hide/suspend take effect quickly.
  publicShort: `public, max-age=${num(process.env.CDN_PUBLIC_MAX_AGE, 300)}`,
  private: "private, no-store",
};

// ─── Rate limits (per IP) ───────────────────────────────────────────────────
const limitHandler = (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res
    .status(429)
    .json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests, please slow down",
      },
    });
};
const limiter = (
  windowMs: number,
  limit: number,
  extra: Partial<Parameters<typeof rateLimit>[0]> = {},
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: limitHandler,
    ...extra,
  });

// model-viewer + Range requests can make several hits per view, so the general limit is generous.
const streamLimiter = limiter(
  60_000,
  num(process.env.CDN_RATE_LIMIT_PER_MIN, 600),
);
// Brute-force guard for embed keys: only failed requests count.
const keyFailureLimiter = limiter(
  15 * 60_000,
  num(process.env.CDN_KEY_FAILURES_PER_15MIN, 30),
  {
    skipSuccessfulRequests: true,
  },
);
const downloadLimiter = limiter(
  60_000,
  num(process.env.CDN_DOWNLOADS_PER_MIN, 30),
);
// Watermark verification loads up to 50 MB in memory and may scan DB vertex signatures.
export const verifyWatermarkLimiter = limiter(
  60_000,
  num(process.env.CDN_VERIFY_RATE_LIMIT_PER_MIN, 15),
);

export const cdnRouter = Router();

cdnRouter.use(
  streamLimiter,
  (_req: Request, res: Response, next: NextFunction) => {
    // Defaults for every response (errors included); success responses override Cache-Control in sendAsset.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); // embeddable on any site, even with COEP
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges, ETag, Content-Disposition",
    );
    next();
  },
);

/** Optional JWT: returns the user if a valid Bearer token is sent, `null` if none, 401 if invalid or the account is deleted. */
async function optionalUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header) return null;
  if (!header.startsWith("Bearer "))
    throw new AppError(401, "UNAUTHORIZED", "Invalid Authorization header");
  let user: AuthUser;
  try {
    user = verifyJwtToken(header.slice(7));
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Invalid or expired JWT token");
  }
  if (await isAccountDeleted(user.id))
    throw new AppError(401, "ACCOUNT_DELETED", "This account has been deleted");
  return user;
}

// ─── GET /cdn/models/:id/file.glb?key= ─────────────────────────────────────
cdnRouter.get("/models/:id/file.glb", keyFailureLimiter, async (req, res) => {
  const model = await loadModel(String(req.params.id));

  if (!isPaid(model)) {
    assertServable(model);
    await sendAsset(req, res, {
      storageKey: candidateKeys(model.id, "model", model.file_hash),
      etag: model.file_hash,
      contentType: CONTENT_TYPES.glb,
      cacheControl: CACHE.publicShort,
    });
    return;
  }

  assertServable(model, { allowDeleted: true }); // buyers keep access after soft delete
  await assertValidEmbedKey(model.id, req.query.key);
  await sendAsset(req, res, {
    storageKey: candidateKeys(model.id, "model", model.file_hash),
    etag: model.file_hash,
    contentType: CONTENT_TYPES.glb,
    cacheControl: CACHE.private,
  });
});

// ─── GET /cdn/models/:id/preview.glb ───────────────────────────────────────
cdnRouter.get("/models/:id/preview.glb", async (req, res) => {
  const model = await loadModel(req.params.id);
  assertServable(model);

  const paid = isPaid(model);
  const hash = paid ? model.preview_hash : model.file_hash;
  if (!hash)
    throw new AppError(
      404,
      "PREVIEW_NOT_FOUND",
      "This model has no preview file",
    );

  await sendAsset(req, res, {
    storageKey: candidateKeys(model.id, paid ? "preview" : "model", hash),
    etag: hash,
    contentType: CONTENT_TYPES.glb,
    cacheControl: CACHE.publicShort,
  });
});

interface WatermarkedAssetInfo {
  cachedPath: string;
  totalSize: number;
  signature: string;
}

const inFlightWatermarks = new Map<string, Promise<WatermarkedAssetInfo | null>>();

/**
 * Cache buyer-watermarked GLBs on disk keyed by `(model.file_hash, watermark signature)` and deduplicate
 * concurrent builds so HTTP Range chunk requests can stream slices without re-embedding the whole file.
 */
async function getOrBuildWatermarkedAsset(
  model: CdnModel,
  purchaseId: string,
  licenseToEmbed: string,
): Promise<WatermarkedAssetInfo | null> {
  const signature = computeWatermarkSignature({
    modelId: model.id,
    ownerId: model.owner_id,
    license: licenseToEmbed,
    purchaseId,
  });
  const cachedPath = path.join(env.tmpUploadDir, `wm-${model.file_hash}-${signature}.glb`);

  try {
    const stat = await fsp.stat(cachedPath);
    if (stat.isFile() && stat.size > 0) {
      touchCacheFile(cachedPath);
      return { cachedPath, totalSize: stat.size, signature };
    }
  } catch {
    // Cache miss — build below.
  }

  let buildPromise = inFlightWatermarks.get(cachedPath);
  if (!buildPromise) {
    buildPromise = (async () => {
      const rawBuffer = await readAssetBuffer(
        candidateKeys(model.id, "model", model.file_hash),
      );
      if (!validateGlbHeader(rawBuffer, rawBuffer.length)) {
        return null;
      }

      const { buffer: watermarkedBuffer, signature: embeddedSig } =
        await embedLicenseAndWatermark(rawBuffer, {
          modelId: model.id,
          ownerId: model.owner_id,
          license: licenseToEmbed,
          purchaseId,
        });

      await fsp.mkdir(env.tmpUploadDir, { recursive: true });
      const tmpPath = `${cachedPath}.tmp.${process.pid}.${Date.now()}`;
      try {
        await fsp.writeFile(tmpPath, watermarkedBuffer);
        await fsp.rename(tmpPath, cachedPath);
      } catch (err) {
        await fsp.unlink(tmpPath).catch(() => undefined);
        throw err;
      }

      return {
        cachedPath,
        totalSize: watermarkedBuffer.length,
        signature: embeddedSig,
      };
    })().finally(() => {
      if (inFlightWatermarks.get(cachedPath) === buildPromise) {
        inFlightWatermarks.delete(cachedPath);
      }
    });

    inFlightWatermarks.set(cachedPath, buildPromise);
  }

  return buildPromise;
}

// ─── GET /cdn/models/:id/download ──────────────────────────────────────────
cdnRouter.get("/models/:id/download", downloadLimiter, async (req, res) => {
  const user = await optionalUser(req);
  const model = await loadModel(String(req.params.id));
  let purchaseInfo: PaidDownloadAccess | null = null;

  // Block any authenticated owner from downloading their own uploaded model regardless of stale JWT role
  if (user && model.owner_id === user.id) {
    throw new AppError(
      403,
      "OWN_MODEL",
      "Creators cannot download their own uploaded models",
    );
  }

  if (isPaid(model)) {
    assertServable(model, { allowDeleted: true });
    if (!user)
      throw new AppError(
        401,
        "LOGIN_REQUIRED",
        "Log in to download this paid model",
      );
    purchaseInfo = await assertCanDownloadPaid(model, user.id);
  } else {
    assertServable(model);
  }

  // Always embed buyer's purchaseId & license_type for paid downloads (cached on disk so Range chunks avoid re-embedding).
  if (purchaseInfo?.purchaseId) {
    const licenseToEmbed =
      purchaseInfo.licenseType || model.license || "COMMERCIAL";
    const watermarked = await getOrBuildWatermarkedAsset(
      model,
      purchaseInfo.purchaseId,
      licenseToEmbed,
    );
    if (watermarked) {
      const { cachedPath, totalSize, signature } = watermarked;
      if (purchaseInfo.watermarkHash !== signature) {
        await savePurchaseWatermarkHash(purchaseInfo.purchaseId, signature);
      }

      const etag = `"${signature}"`;
      const ifRange = req.headers["if-range"];
      const spec =
        ifRange && ifRange !== etag ? null : parseRangeSpec(req.headers.range);

      let range = null;
      if (spec) {
        range = resolveRange(spec, totalSize);
        if (!range) {
          res.setHeader("Content-Range", `bytes */${totalSize}`);
          res.setHeader("Cache-Control", "no-store");
          throw new AppError(
            416,
            "RANGE_NOT_SATISFIABLE",
            "Requested range is outside the file",
          );
        }
      }

      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", CACHE.private);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Type", CONTENT_TYPES.glb);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", contentDisposition(model.title));

      if (range) {
        res.status(206);
        res.setHeader(
          "Content-Range",
          `bytes ${range.start}-${range.end}/${totalSize}`,
        );
        res.setHeader("Content-Length", String(range.end - range.start + 1));
      } else {
        res.status(200);
        res.setHeader("Content-Length", String(totalSize));
      }

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      // Count only complete file transfers (200 or full-file Range 0..end), never probe chunks like bytes=0-0.
      const isFullDownload =
        !range || (totalSize > 0 && range.start === 0 && range.end === totalSize - 1);
      if (isFullDownload) {
        res.once("finish", () => {
          incrementDownloadCount(model.id).catch((err) =>
            console.error("[CDN] download_count update failed:", err.message),
          );
        });
      }

      const stream = fs.createReadStream(
        cachedPath,
        range ? { start: range.start, end: range.end } : undefined,
      );
      pipeline(stream, res, (err) => {
        if (err && (err as any).code !== "ERR_STREAM_PREMATURE_CLOSE") {
          console.error("[CDN] watermarked stream error:", err.message);
        }
      });
      return;
    }
  }

  const result = await sendAsset(req, res, {
    storageKey: candidateKeys(model.id, "model", model.file_hash),
    etag: model.file_hash,
    contentType: CONTENT_TYPES.glb,
    cacheControl: CACHE.private,
    downloadName: model.title,
  });

  // Count only complete file transfers (200 or full-file Range 0..end), never partial/probe chunks.
  const isFullDownload =
    !result.range ||
    (result.size > 0 &&
      result.range.start === 0 &&
      result.range.end === result.size - 1);
  if (req.method === "GET" && isFullDownload) {
    res.once("finish", () => {
      incrementDownloadCount(model.id).catch((err) =>
        console.error("[CDN] download_count update failed:", err.message),
      );
    });
  }
});

// ─── POST /cdn/verify-watermark (and /verify-watermark) ────────────────────
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxModelSizeBytes },
});
const rawGlbParser = express.raw({
  type: ["model/gltf-binary", "application/octet-stream"],
  limit: env.maxModelSizeBytes,
});

export const verifyWatermarkMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) {
    return memoryUpload.any()(req, res, next);
  }
  return rawGlbParser(req, res, next);
};

export const verifyWatermarkHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const uploadedFiles = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : req.file
        ? [req.file]
        : [];

    let glbBuffer: Buffer | null = null;
    if (uploadedFiles.length > 0 && uploadedFiles[0].buffer) {
      glbBuffer = uploadedFiles[0].buffer;
    } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      glbBuffer = req.body;
    }

    if (!glbBuffer || glbBuffer.length === 0) {
      throw new AppError(
        400,
        "BAD_REQUEST",
        "GLB file is required for watermark verification",
      );
    }

    const rawExpectedModelId =
      (typeof req.body === "object" && req.body !== null
        ? req.body.expectedModelId || req.body.modelId
        : undefined) ||
      req.query.expectedModelId ||
      req.query.modelId;

    const expectedModelId =
      typeof rawExpectedModelId === "string" && rawExpectedModelId.trim() !== ""
        ? rawExpectedModelId.trim()
        : undefined;

    const verification = await verifyGlbWatermark(glbBuffer, expectedModelId);
    res.status(200).json(verification);
  } catch (err) {
    next(err);
  }
};

cdnRouter.post(
  "/verify-watermark",
  verifyWatermarkLimiter,
  verifyWatermarkMiddleware,
  verifyWatermarkHandler,
);

// ─── GET /cdn/users/:id/avatar.webp ────────────────────────────────────────
cdnRouter.get("/users/:id/avatar.webp", async (req, res) => {
  const user = await loadUserAvatar(String(req.params.id));
  await sendAsset(req, res, {
    storageKey: avatarKey(user.id, user.avatar_hash),
    etag: user.avatar_hash,
    contentType: CONTENT_TYPES.webp,
    cacheControl: CACHE.publicShort,
    bucketName: env.supabaseAvatarBucket,
  });
});

// ─── GET /cdn/models/:id/poster.webp ───────────────────────────────────────
cdnRouter.get("/models/:id/poster.webp", async (req, res) => {
  const model = await loadModel(req.params.id);
  assertServable(model);
  if (!model.poster_hash)
    throw new AppError(404, "POSTER_NOT_FOUND", "This model has no poster");

  await sendAsset(req, res, {
    storageKey: candidateKeys(model.id, "poster", model.poster_hash),
    etag: model.poster_hash,
    contentType: CONTENT_TYPES.webp,
    cacheControl: CACHE.publicShort,
  });
});

// ─── GET /cdn/models/:id/:hash.glb ─────────────────────────────────────────
// Registered last so the literal file.glb / preview.glb routes above win.
cdnRouter.get("/models/:id/:hash.glb", async (req, res) => {
  const { hash } = req.params;
  if (!isContentHash(hash))
    throw new AppError(404, "FILE_NOT_FOUND", "File not found");

  const model = await loadModel(req.params.id);
  assertServable(model);

  if (hash === model.file_hash && isPaid(model)) {
    // Never leak the full paid file through the public hash URL.
    throw new AppError(
      401,
      "KEY_REQUIRED",
      "This is a paid model. Use /file.glb?key=YOUR_EMBED_KEY",
    );
  }
  if (hash !== model.preview_hash && hash !== model.file_hash) {
    throw new AppError(404, "FILE_NOT_FOUND", "File not found");
  }

  await sendAsset(req, res, {
    storageKey: candidateKeys(
      model.id,
      hash === model.file_hash ? "model" : "preview",
      hash,
    ),
    etag: hash,
    contentType: CONTENT_TYPES.glb,
    cacheControl: CACHE.immutable,
  });
});
