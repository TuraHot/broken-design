import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { env } from '../../config/env';
import { db } from '../../config/db';
import { supabase } from '../../config/supabase';
import { getStorage, type StorageAdapter } from '../../storage';
import { assetKey } from '../../storage/keys';
import { validateGlbFile, computeFileSha256 } from '../../utils/glbValidator';
import {
  detectForeignPlatformAsset,
  embedLicenseAndWatermark,
} from '../../utils/glbWatermark';
import { requireAuth, requireSeller } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { limitedDiskStorage } from './limitedDiskStorage';

export const uploadRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uploadLimitNum = (() => {
  const n = Number(process.env.CDN_UPLOADS_PER_15MIN);
  return Number.isFinite(n) && n > 0 ? n : 20;
})();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: uploadLimitNum,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENFORCE_UPLOAD_RATE_LIMIT !== 'true',
  handler: (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many model uploads, please slow down.',
      },
    });
  },
});

// Ensure temporary upload directory exists
fs.mkdirSync(path.resolve(env.tmpUploadDir), { recursive: true });

// Each field has its own size limit, enforced while the file is still arriving (see limitedDiskStorage.ts).
const storageEngine = limitedDiskStorage(
  env.tmpUploadDir,
  {
    file: { bytes: env.maxModelSizeBytes, label: 'Model file' },
    preview: { bytes: env.maxPreviewSizeBytes, label: 'Preview file' },
    poster: { bytes: env.maxPosterSizeBytes, label: 'Poster file' },
  },
  { bytes: env.maxModelSizeBytes, label: 'File' },
);

const upload = multer({ storage: storageEngine });

const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'preview', maxCount: 1 },
  { name: 'poster', maxCount: 1 },
]);

// Helper to remove temporary files
async function cleanupFiles(files?: { [fieldname: string]: Express.Multer.File[] }) {
  if (!files) return;
  for (const field of Object.keys(files)) {
    for (const file of files[field]) {
      await fsp.unlink(file.path).catch(() => undefined);
    }
  }
}

async function preparePosterToWebp(posterFile: Express.Multer.File): Promise<void> {
  if (posterFile.size > env.maxPosterSizeBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', `Poster file exceeds limit of ${env.maxPosterSizeBytes} bytes`);
  }
  const allowedMime = ['image/webp', 'image/png', 'image/jpeg'];
  const ext = path.extname(posterFile.originalname).toLowerCase();
  if (!allowedMime.includes(posterFile.mimetype) && !['.webp', '.png', '.jpg', '.jpeg'].includes(ext)) {
    throw new AppError(400, 'INVALID_POSTER', 'Poster must be a valid image file (.webp, .png, or .jpg)');
  }
  try {
    const webpBuffer = await sharp(posterFile.path).webp({ quality: 82 }).toBuffer();
    await fsp.writeFile(posterFile.path, webpBuffer);
  } catch {
    throw new AppError(
      400,
      'INVALID_POSTER',
      'Poster could not be processed as a valid image (.webp, .png, or .jpg)'
    );
  }
}

async function readAndCheckForeignGlb(
  file: Express.Multer.File,
  opts: { kind: 'model' | 'preview'; maxBytes: number; ownerId: string },
): Promise<Buffer> {
  const isPreview = opts.kind === 'preview';
  if (file.size > opts.maxBytes) {
    throw new AppError(
      413,
      'FILE_TOO_LARGE',
      `${isPreview ? 'Preview' : 'Model'} file exceeds limit of ${opts.maxBytes} bytes`,
    );
  }
  const validation = await validateGlbFile(file.path);
  if (!validation.valid) {
    throw new AppError(
      400,
      'INVALID_GLB',
      isPreview ? 'Preview file is not a valid GLB (glTF v2)' : validation.reason || 'File is not a valid Binary glTF (GLB v2)',
    );
  }
  const rawBuffer = await fsp.readFile(file.path);
  const foreignMatch = await detectForeignPlatformAsset(rawBuffer, opts.ownerId);
  if (foreignMatch) {
    throw new AppError(
      409,
      'WATERMARK_CONFLICT',
      isPreview
        ? 'Upload rejected: the preview GLB already belongs to another creator on Lixyte (detected via platform watermark) and cannot be re-uploaded.'
        : 'Upload rejected: this 3D model already belongs to another creator on Lixyte (detected via platform watermark) and cannot be re-uploaded.',
    );
  }
  return rawBuffer;
}

// POST /api/models (Upload 3D Asset: file, preview?, poster?, metadata)
// requireSeller verifies live DB status (is_seller, role <> 'admin', suspended_at IS NULL) BEFORE Multer buffers files.
uploadRouter.post(
  '/models',
  uploadLimiter,
  requireAuth,
  requireSeller,
  uploadFields,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const uploadedKeys: string[] = [];
    let storage: StorageAdapter | null = null;

    try {
      // 1. Extract and validate metadata upfront
      const {
        title,
        description = '',
        tags = '[]',
        license = 'CC0',
        price_cents = 0,
        currency = 'USD',
      } = req.body;

      if (!title || typeof title !== 'string' || title.trim() === '') {
        throw new AppError(400, 'BAD_REQUEST', 'Model title is required');
      }
      if (title.trim().length > 255) {
        throw new AppError(400, 'BAD_REQUEST', 'Model title must not exceed 255 characters');
      }

      // Validate License Enum against Postgres license_type enum ('CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL')
      const VALID_LICENSES = ['CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL'] as const;
      const normalizedLicense = String(license || 'CC0').trim().toUpperCase();
      if (!VALID_LICENSES.includes(normalizedLicense as any)) {
        throw new AppError(
          400,
          'INVALID_LICENSE',
          `Invalid license: "${license}". Allowed values: ${VALID_LICENSES.join(', ')}`
        );
      }

      const parsedPrice = Math.max(0, parseInt(String(price_cents), 10) || 0);

      // Business Rule (project.md Section 5): Paid models MUST have a preview GLB file for public rotation
      const previewFile = files?.['preview']?.[0];
      if (parsedPrice > 0 && !previewFile) {
        throw new AppError(
          400,
          'PREVIEW_REQUIRED',
          'Paid models require a preview GLB file (under 5 MB) for public rotation'
        );
      }

      // 2. Validate, inspect, and enforce foreign-asset watermark checks BEFORE writing anything to storage
      const modelId = crypto.randomUUID();
      const ownerId = req.user!.id;

      const modelFile = files?.['file']?.[0];
      if (!modelFile) {
        throw new AppError(400, 'BAD_REQUEST', 'Main GLB file is required');
      }

      const rawGlbBuffer = await readAndCheckForeignGlb(modelFile, {
        kind: 'model',
        maxBytes: env.maxModelSizeBytes,
        ownerId,
      });

      let rawPreviewBuffer: Buffer | null = null;
      if (previewFile) {
        rawPreviewBuffer = await readAndCheckForeignGlb(previewFile, {
          kind: 'preview',
          maxBytes: env.maxPreviewSizeBytes,
          ownerId,
        });
      }

      const posterFile = files?.['poster']?.[0];
      if (posterFile) {
        await preparePosterToWebp(posterFile);
      }

      // Embed platform origin license & vertex steganography watermark (purchaseId: 'original' / 'preview')
      let finalFileSize = modelFile.size;
      try {
        const { buffer: watermarkedBuffer } = await embedLicenseAndWatermark(rawGlbBuffer, {
          modelId,
          ownerId,
          license: normalizedLicense,
          purchaseId: 'original',
        });
        await fsp.writeFile(modelFile.path, watermarkedBuffer);
        finalFileSize = watermarkedBuffer.length;

        if (previewFile && rawPreviewBuffer) {
          const { buffer: watermarkedPreview } = await embedLicenseAndWatermark(rawPreviewBuffer, {
            modelId,
            ownerId,
            license: normalizedLicense,
            purchaseId: 'preview',
          });
          await fsp.writeFile(previewFile.path, watermarkedPreview);
        }
      } catch (wmErr: any) {
        if (wmErr instanceof AppError) throw wmErr;
        throw new AppError(400, 'INVALID_GLB', wmErr?.message || 'Failed to parse and watermark GLB structure');
      }

      storage = getStorage();

      // Store main model under <model_id>/model.<hash>.glb
      const fileHash = await computeFileSha256(modelFile.path);
      const mainKey = assetKey(modelId, 'model', fileHash);
      await storage.put(mainKey, modelFile.path);
      uploadedKeys.push(mainKey);

      // 3. Store the preview file (already checked above)
      let previewHash: string | null = null;
      if (previewFile) {
        previewHash = await computeFileSha256(previewFile.path);
        const previewKey = assetKey(modelId, 'preview', previewHash);
        await storage.put(previewKey, previewFile.path);
        uploadedKeys.push(previewKey);
      }

      // 4. Store the poster image (already validated & converted to WebP above)
      let posterHash: string | null = null;
      if (posterFile) {
        posterHash = await computeFileSha256(posterFile.path);
        const posterKey = assetKey(modelId, 'poster', posterHash);
        await storage.put(posterKey, posterFile.path);
        uploadedKeys.push(posterKey);
      }

      // 5. Sanitize Tags
      let parsedTags: string[] = [];
      if (Array.isArray(tags)) {
        parsedTags = tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
      } else if (typeof tags === 'string') {
        try {
          const parsed = JSON.parse(tags);
          parsedTags = Array.isArray(parsed)
            ? parsed.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
            : [tags.trim().toLowerCase()];
        } catch {
          parsedTags = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        }
      }
      parsedTags = Array.from(new Set(parsedTags));

      const parsedCurrency = String(currency || 'USD').trim().toUpperCase().slice(0, 3);

      // 6. Insert record into database (with Supabase REST fallback)
      let insertedModel: any;
      try {
        const result = await db.query(
          `INSERT INTO models (
            id, owner_id, title, description, tags, license,
            file_hash, file_size, preview_hash, poster_hash,
            price_cents, currency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *`,
          [
            modelId,
            ownerId,
            title.trim(),
            description.trim(),
            parsedTags,
            normalizedLicense,
            fileHash,
            finalFileSize,
            previewHash,
            posterHash,
            parsedPrice,
            parsedCurrency,
          ]
        );
        insertedModel = result.rows[0];
      } catch (dbErr) {
        if (!supabase) throw dbErr;
        const { data, error } = await supabase
          .from('models')
          .insert({
            id: modelId,
            owner_id: ownerId,
            title: title.trim(),
            description: description.trim(),
            tags: parsedTags,
            license: normalizedLicense,
            file_hash: fileHash,
            file_size: finalFileSize,
            preview_hash: previewHash,
            poster_hash: posterHash,
            price_cents: parsedPrice,
            currency: parsedCurrency,
          })
          .select()
          .single();
        if (error) throw dbErr;
        insertedModel = data;
      }

      res.status(201).json({
        message: 'Model uploaded successfully',
        model: insertedModel,
      });
    } catch (err) {
      await cleanupFiles(files);
      if (storage && uploadedKeys.length > 0) {
        await Promise.all(uploadedKeys.map((key) => storage!.delete(key).catch(() => undefined)));
      }
      next(err);
    }
  }
);

// PATCH /api/models/:id/assets (Replace main GLB, preview GLB, and/or poster image)
uploadRouter.patch(
  '/models/:id/assets',
  uploadLimiter,
  requireAuth,
  requireSeller,
  uploadFields,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const uploadedKeys: string[] = [];
    let storage: StorageAdapter | null = null;

    try {
      const modelId = String(req.params.id);
      if (!UUID_RE.test(modelId)) {
        throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
      }
      const userId = req.user!.id;

      let existing: {
        id: string;
        owner_id: string;
        license: string;
        file_hash: string;
        file_size: string | number;
        preview_hash: string | null;
        poster_hash: string | null;
        deleted_at: Date | string | null;
      } | undefined;
      try {
        const existingRes = await db.query(
          `SELECT id, owner_id, license, file_hash, file_size, preview_hash, poster_hash, deleted_at
           FROM models WHERE id = $1`,
          [modelId]
        );
        existing = existingRes.rows[0];
      } catch (dbErr) {
        if (!supabase) throw dbErr;
        const { data, error } = await supabase
          .from('models')
          .select('id, owner_id, license, file_hash, file_size, preview_hash, poster_hash, deleted_at')
          .eq('id', modelId)
          .maybeSingle();
        if (error) throw dbErr;
        existing = (data as typeof existing | null) ?? undefined;
      }
      if (!existing || existing.deleted_at !== null) {
        throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
      }
      if (existing.owner_id !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to edit this model');
      }

      const modelFile = files?.['file']?.[0];
      const previewFile = files?.['preview']?.[0];
      const posterFile = files?.['poster']?.[0];

      if (!modelFile && !previewFile && !posterFile) {
        throw new AppError(400, 'BAD_REQUEST', 'At least one asset file (file, preview, or poster) is required');
      }

      // Validate all replacement files & check foreign platform watermarks BEFORE storing anything
      const rawGlbBuffer = modelFile
        ? await readAndCheckForeignGlb(modelFile, {
            kind: 'model',
            maxBytes: env.maxModelSizeBytes,
            ownerId: existing.owner_id,
          })
        : null;

      const rawPreviewBuffer = previewFile
        ? await readAndCheckForeignGlb(previewFile, {
            kind: 'preview',
            maxBytes: env.maxPreviewSizeBytes,
            ownerId: existing.owner_id,
          })
        : null;

      if (posterFile) {
        await preparePosterToWebp(posterFile);
      }

      const existingFileHash = existing.file_hash?.trim() || null;
      const existingPreviewHash = existing.preview_hash?.trim() || null;
      const existingPosterHash = existing.poster_hash?.trim() || null;

      let nextFileHash: string = existingFileHash || existing.file_hash;
      let nextFileSize: number = Number(existing.file_size);
      let nextPreviewHash: string | null = existingPreviewHash;
      let nextPosterHash: string | null = existingPosterHash;

      try {
        if (modelFile && rawGlbBuffer) {
          const { buffer: watermarkedBuffer } = await embedLicenseAndWatermark(rawGlbBuffer, {
            modelId,
            ownerId: existing.owner_id,
            license: existing.license,
            purchaseId: 'original',
          });
          await fsp.writeFile(modelFile.path, watermarkedBuffer);
          nextFileSize = watermarkedBuffer.length;
        }

        if (previewFile && rawPreviewBuffer) {
          const { buffer: watermarkedPreview } = await embedLicenseAndWatermark(rawPreviewBuffer, {
            modelId,
            ownerId: existing.owner_id,
            license: existing.license,
            purchaseId: 'preview',
          });
          await fsp.writeFile(previewFile.path, watermarkedPreview);
        }
      } catch (wmErr: any) {
        if (wmErr instanceof AppError) throw wmErr;
        throw new AppError(400, 'INVALID_GLB', wmErr?.message || 'Failed to parse and watermark GLB structure');
      }

      storage = getStorage();

      if (modelFile) {
        nextFileHash = await computeFileSha256(modelFile.path);
        const mainKey = assetKey(modelId, 'model', nextFileHash);
        await storage.put(mainKey, modelFile.path);
        uploadedKeys.push(mainKey);
      }

      if (previewFile) {
        nextPreviewHash = await computeFileSha256(previewFile.path);
        const previewKey = assetKey(modelId, 'preview', nextPreviewHash);
        await storage.put(previewKey, previewFile.path);
        uploadedKeys.push(previewKey);
      }

      if (posterFile) {
        nextPosterHash = await computeFileSha256(posterFile.path);
        const posterKey = assetKey(modelId, 'poster', nextPosterHash);
        await storage.put(posterKey, posterFile.path);
        uploadedKeys.push(posterKey);
      }

      try {
        await db.query(
          `UPDATE models
           SET file_hash = $1, file_size = $2, preview_hash = $3, poster_hash = $4
           WHERE id = $5`,
          [nextFileHash, nextFileSize, nextPreviewHash, nextPosterHash, modelId]
        );
      } catch (dbErr) {
        if (!supabase) throw dbErr;
        const { error } = await supabase
          .from('models')
          .update({
            file_hash: nextFileHash,
            file_size: nextFileSize,
            preview_hash: nextPreviewHash,
            poster_hash: nextPosterHash,
          })
          .eq('id', modelId);
        if (error) throw dbErr;
      }

      const oldKeysToDelete: string[] = [];
      try {
        if (modelFile && existingFileHash && existingFileHash !== nextFileHash) {
          oldKeysToDelete.push(assetKey(modelId, 'model', existingFileHash));
        }
        if (previewFile && existingPreviewHash && existingPreviewHash !== nextPreviewHash) {
          oldKeysToDelete.push(assetKey(modelId, 'preview', existingPreviewHash));
        }
        if (posterFile && existingPosterHash && existingPosterHash !== nextPosterHash) {
          oldKeysToDelete.push(assetKey(modelId, 'poster', existingPosterHash));
        }
      } catch {
        // Ignore unexpected legacy/non-sha256 values when building old scoped key names.
      }
      if (oldKeysToDelete.length > 0 && storage) {
        await Promise.all(oldKeysToDelete.map((key) => storage!.delete(key).catch(() => undefined)));
      }

      await cleanupFiles(files);
      res.json({
        message: 'Model assets updated successfully',
        model: {
          id: modelId,
          fileHash: nextFileHash,
          fileSize: nextFileSize,
          previewHash: nextPreviewHash,
          posterHash: nextPosterHash,
        },
      });
    } catch (err) {
      await cleanupFiles(files);
      if (storage && uploadedKeys.length > 0) {
        await Promise.all(uploadedKeys.map((key) => storage!.delete(key).catch(() => undefined)));
      }
      next(err);
    }
  }
);
