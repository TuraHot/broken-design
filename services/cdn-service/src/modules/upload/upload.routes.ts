import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import multer from 'multer';
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
import { embedLicenseAndWatermark } from '../../utils/glbWatermark';
import { requireAuth, requireSeller } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { limitedDiskStorage } from './limitedDiskStorage';

export const uploadRouter = Router();

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

// POST /api/models (Upload 3D Asset: file, preview?, poster?, metadata)
uploadRouter.post(
  '/models',
  requireAuth,
  requireSeller,
  uploadFields,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const uploadedKeys: string[] = [];
    let storage: StorageAdapter | null = null;

    try {
      // 0. Verify seller account status in database (ensure account is active and not suspended)
      try {
        const userCheck = await db.query(
          `SELECT id, role, is_seller, suspended_at FROM users WHERE id = $1`,
          [req.user!.id]
        );

        if (userCheck.rows.length > 0) {
          const dbUser = userCheck.rows[0];
          if (dbUser.suspended_at !== null) {
            throw new AppError(
              403,
              'ACCOUNT_SUSPENDED',
              'Your account has been suspended by an administrator. Upload access is blocked.'
            );
          }
          if (!dbUser.is_seller && dbUser.role !== 'creator' && dbUser.role !== 'admin') {
            throw new AppError(
              403,
              'FORBIDDEN',
              'Seller access is disabled for this account.'
            );
          }
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
      }

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

      // 2. Validate and inspect main GLB file
      const modelFile = files?.['file']?.[0];
      if (!modelFile) {
        throw new AppError(400, 'BAD_REQUEST', 'Main GLB file is required');
      }

      if (modelFile.size > env.maxModelSizeBytes) {
        throw new AppError(413, 'FILE_TOO_LARGE', `Model file exceeds maximum limit of ${env.maxModelSizeBytes} bytes`);
      }

      const validation = await validateGlbFile(modelFile.path);
      if (!validation.valid) {
        throw new AppError(400, 'INVALID_GLB', validation.reason || 'File is not a valid Binary glTF (GLB v2)');
      }

      // 2b. Check the preview and poster BEFORE anything is stored, so a bad one cannot leave the main file
      // behind in permanent storage (storage is content-addressed and shared, so it is never deleted on error).
      if (previewFile) {
        if (previewFile.size > env.maxPreviewSizeBytes) {
          throw new AppError(413, 'FILE_TOO_LARGE', `Preview file exceeds limit of ${env.maxPreviewSizeBytes} bytes`);
        }
        const previewValidation = await validateGlbFile(previewFile.path);
        if (!previewValidation.valid) {
          throw new AppError(400, 'INVALID_GLB', 'Preview file is not a valid GLB (glTF v2)');
        }
      }

      const posterFile = files?.['poster']?.[0];
      if (posterFile) {
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

      const modelId = crypto.randomUUID();
      const ownerId = req.user!.id;

      // Embed platform origin license & vertex steganography watermark (purchaseId: 'original')
      const rawGlbBuffer = await fsp.readFile(modelFile.path);
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
  requireAuth,
  requireSeller,
  uploadFields,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const uploadedKeys: string[] = [];
    let storage: ReturnType<typeof getStorage> | null = null;

    try {
      const modelId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const userCheck = await db.query(
        `SELECT id, role, is_seller, suspended_at FROM users WHERE id = $1`,
        [userId]
      );
      if (userCheck.rows.length > 0) {
        const dbUser = userCheck.rows[0];
        if (dbUser.suspended_at !== null) {
          throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator.');
        }
      }

      const existingRes = await db.query(
        `SELECT id, owner_id, license, file_hash, file_size, preview_hash, poster_hash, deleted_at
         FROM models WHERE id = $1`,
        [modelId]
      );
      if (existingRes.rowCount === 0 || existingRes.rows[0].deleted_at !== null) {
        throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
      }
      const existing = existingRes.rows[0];
      if (existing.owner_id !== userId && userRole !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to edit this model');
      }

      const modelFile = files?.['file']?.[0];
      const previewFile = files?.['preview']?.[0];
      const posterFile = files?.['poster']?.[0];

      if (!modelFile && !previewFile && !posterFile) {
        throw new AppError(400, 'BAD_REQUEST', 'At least one asset file (file, preview, or poster) is required');
      }

      storage = getStorage();
      let nextFileHash: string = existing.file_hash;
      let nextFileSize: number = Number(existing.file_size);
      let nextPreviewHash: string | null = existing.preview_hash;
      let nextPosterHash: string | null = existing.poster_hash;

      if (modelFile) {
        if (modelFile.size > env.maxModelSizeBytes) {
          throw new AppError(413, 'FILE_TOO_LARGE', `Model file exceeds limit of ${env.maxModelSizeBytes} bytes`);
        }
        const validation = await validateGlbFile(modelFile.path);
        if (!validation.valid) {
          throw new AppError(400, 'INVALID_GLB', validation.reason || 'File is not a valid Binary glTF (GLB v2)');
        }
        const rawGlbBuffer = await fsp.readFile(modelFile.path);
        const { buffer: watermarkedBuffer } = await embedLicenseAndWatermark(rawGlbBuffer, {
          modelId,
          ownerId: existing.owner_id,
          license: existing.license,
          purchaseId: 'original',
        });
        await fsp.writeFile(modelFile.path, watermarkedBuffer);
        nextFileSize = watermarkedBuffer.length;
        nextFileHash = await computeFileSha256(modelFile.path);
        const mainKey = assetKey(modelId, 'main', nextFileHash);
        await storage.put(mainKey, modelFile.path);
        uploadedKeys.push(mainKey);
      }

      if (previewFile) {
        if (previewFile.size > env.maxPreviewSizeBytes) {
          throw new AppError(413, 'FILE_TOO_LARGE', `Preview file exceeds limit of ${env.maxPreviewSizeBytes} bytes`);
        }
        const previewValidation = await validateGlbFile(previewFile.path);
        if (!previewValidation.valid) {
          throw new AppError(400, 'INVALID_GLB', 'Preview file is not a valid GLB (glTF v2)');
        }
        nextPreviewHash = await computeFileSha256(previewFile.path);
        const previewKey = assetKey(modelId, 'preview', nextPreviewHash);
        await storage.put(previewKey, previewFile.path);
        uploadedKeys.push(previewKey);
      }

      if (posterFile) {
        if (posterFile.size > env.maxPosterSizeBytes) {
          throw new AppError(413, 'FILE_TOO_LARGE', `Poster file exceeds limit of ${env.maxPosterSizeBytes} bytes`);
        }
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
