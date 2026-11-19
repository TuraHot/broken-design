import { Router, type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { supabase } from '../../config/supabase';
import { requireAuth } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { getAvatarStorage, type StorageAdapter } from '../../storage';
import { avatarKey } from '../../storage/keys';
import { computeFileSha256 } from '../../utils/glbValidator';
import { limitedDiskStorage } from './limitedDiskStorage';

export const avatarRouter = Router();

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/webp', 'image/png', 'image/jpeg']);
const ALLOWED_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg']);

fs.mkdirSync(path.resolve(env.tmpUploadDir), { recursive: true });

const uploadAvatar = multer({
  storage: limitedDiskStorage(
    env.tmpUploadDir,
    { avatar: { bytes: MAX_AVATAR_BYTES, label: 'Avatar image' } },
    { bytes: MAX_AVATAR_BYTES, label: 'Avatar image' },
  ),
}).single('avatar');

interface UserAvatarRow {
  id: string;
  avatar_hash: string | null;
  suspended_at: Date | string | null;
}

async function findActiveUser(userId: string): Promise<UserAvatarRow> {
  let row: UserAvatarRow | undefined;
  try {
    const res = await db.query<UserAvatarRow>(
      `SELECT id, avatar_hash, suspended_at FROM users WHERE id = $1`,
      [userId],
    );
    row = res.rows[0];
  } catch (err) {
    if (!supabase) throw err;
    const { data, error } = await supabase
      .from('users')
      .select('id, avatar_hash, suspended_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw err;
    row = (data as UserAvatarRow | null) ?? undefined;
  }

  if (!row) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  if (row.suspended_at !== null) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator.');
  }
  return row;
}

async function saveUserAvatarHash(userId: string, avatarHash: string | null): Promise<void> {
  try {
    await db.query(`UPDATE users SET avatar_hash = $1 WHERE id = $2`, [avatarHash, userId]);
  } catch (err) {
    if (!supabase) throw err;
    const { error } = await supabase.from('users').update({ avatar_hash: avatarHash }).eq('id', userId);
    if (error) throw err;
  }
}

// POST /api/me/avatar — upload & center-crop user avatar/logo as 256x256 compressed WebP
avatarRouter.post(
  '/me/avatar',
  requireAuth,
  uploadAvatar,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const file = req.file;
    let uploadedKey: string | null = null;
    let storage: StorageAdapter | null = null;

    try {
      const userId = req.user!.id;
      const current = await findActiveUser(userId);
      const oldHash = current.avatar_hash?.trim() || null;

      if (!file) {
        throw new AppError(400, 'BAD_REQUEST', 'Avatar image file is required');
      }

      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_MIME.has(file.mimetype) && !ALLOWED_EXT.has(ext)) {
        throw new AppError(400, 'INVALID_AVATAR', 'Avatar must be a valid image (.webp, .png, or .jpg)');
      }

      try {
        const webpBuffer = await sharp(file.path)
          .rotate()
          .resize(256, 256, { fit: 'cover' })
          .webp({ quality: 82 })
          .toBuffer();
        await fsp.writeFile(file.path, webpBuffer);
      } catch {
        throw new AppError(400, 'INVALID_AVATAR', 'Avatar could not be processed as a valid image');
      }

      const avatarHash = await computeFileSha256(file.path);
      storage = getAvatarStorage();
      const nextKey = avatarKey(userId, avatarHash);
      await storage.put(nextKey, file.path);
      uploadedKey = nextKey;

      await saveUserAvatarHash(userId, avatarHash);

      if (oldHash && oldHash !== avatarHash) {
        await storage.delete(avatarKey(userId, oldHash)).catch(() => undefined);
      }

      res.json({
        message: 'Avatar updated',
        avatarHash,
        avatarPath: `/cdn/users/${userId}/avatar.webp?v=${avatarHash.slice(0, 12)}`,
      });
    } catch (err) {
      if (file?.path) {
        await fsp.unlink(file.path).catch(() => undefined);
      }
      if (storage && uploadedKey) {
        await storage.delete(uploadedKey).catch(() => undefined);
      }
      next(err);
    }
  },
);

// DELETE /api/me/avatar — remove current user's avatar/logo
avatarRouter.delete(
  '/me/avatar',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const current = await findActiveUser(userId);
      const oldHash = current.avatar_hash?.trim() || null;

      await saveUserAvatarHash(userId, null);

      if (oldHash) {
        await getAvatarStorage().delete(avatarKey(userId, oldHash)).catch(() => undefined);
      }

      res.json({
        message: 'Avatar removed',
        avatarHash: null,
        avatarPath: null,
      });
    } catch (err) {
      next(err);
    }
  },
);
