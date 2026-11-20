import { Router } from 'express';
import { db } from '../../config/db';
import { AppError } from '../../middlewares/error.middleware';
import { buildAvatarUrl, formatModelResponse, type ModelPresenterRow } from '../models/model.presenter';

export const creatorsRouter = Router();

/** Mirrors frontend `creatorHandle()` so URLs like `/creators/tomas-vega` and Thai handles resolve deterministically. */
export function toCreatorHandle(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /api/creators/:handle — public creator profile + all visible models (works even for creators with 0 models or >100 total catalog models)
creatorsRouter.get('/:handle', async (req, res) => {
  const targetHandle = String(req.params.handle || '').normalize('NFC').trim().toLowerCase();
  if (!targetHandle || targetHandle.length > 120) {
    throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator not found');
  }

  let candidatesRes;
  try {
    candidatesRes = await db.query<{
      id: string;
      display_name: string | null;
      email: string;
      avatar_hash: string | null;
      bio?: string | null;
    }>(
      `SELECT u.id, u.display_name, u.email, u.avatar_hash, u.bio
       FROM users u
       WHERE u.suspended_at IS NULL
         AND u.role <> 'admin'
         AND (
           u.is_seller = TRUE
           OR u.role = 'creator'
           OR EXISTS (
             SELECT 1 FROM models m
             WHERE m.owner_id = u.id AND m.hidden_at IS NULL AND m.deleted_at IS NULL
           )
         )
       ORDER BY u.created_at ASC, u.id ASC`,
    );
  } catch {
    candidatesRes = await db.query<{
      id: string;
      display_name: string | null;
      email: string;
      avatar_hash: string | null;
      bio?: string | null;
    }>(
      `SELECT u.id, u.display_name, u.email, u.avatar_hash
       FROM users u
       WHERE u.suspended_at IS NULL
         AND u.role <> 'admin'
         AND (
           u.is_seller = TRUE
           OR u.role = 'creator'
           OR EXISTS (
             SELECT 1 FROM models m
             WHERE m.owner_id = u.id AND m.hidden_at IS NULL AND m.deleted_at IS NULL
           )
         )
       ORDER BY u.created_at ASC, u.id ASC`,
    );
  }

  const creator = candidatesRes.rows.find((u) => {
    const label = u.display_name?.trim() || u.email;
    return toCreatorHandle(label) === targetHandle;
  });

  if (!creator) {
    throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator not found');
  }

  const displayName = creator.display_name?.trim() || creator.email;
  const avatarUrl = buildAvatarUrl(creator.id, creator.avatar_hash);

  const modelsRes = await db.query<Omit<ModelPresenterRow, 'creator' | 'creator_avatar_hash'>>(
    `SELECT
       m.id,
       m.owner_id,
       m.title,
       m.description,
       m.tags,
       m.license,
       m.file_hash,
       m.file_size,
       m.preview_hash,
       m.poster_hash,
       m.price_cents,
       m.currency,
       m.view_count,
       m.download_count,
       (SELECT COUNT(*) FROM likes l WHERE l.model_id = m.id) AS like_count,
       m.created_at
     FROM models m
     WHERE m.owner_id = $1
       AND m.hidden_at IS NULL
       AND m.deleted_at IS NULL
     ORDER BY like_count DESC, m.download_count DESC, m.created_at DESC`,
    [creator.id],
  );

  const models = modelsRes.rows.map((row) =>
    formatModelResponse(
      {
        ...row,
        creator: displayName,
      },
      avatarUrl,
    ),
  );

  const totalDownloads = models.reduce((sum, m) => sum + m.downloadCount, 0);
  const totalLikes = models.reduce((sum, m) => sum + m.likeCount, 0);

  res.json({
    handle: toCreatorHandle(displayName),
    name: displayName,
    avatarUrl,
    bio: creator.bio || '',
    models,
    totalDownloads,
    totalLikes,
  });
});
