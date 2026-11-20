import { Router } from 'express';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/error.middleware';

export const creatorsRouter = Router();

/** Mirrors frontend `creatorHandle()` so URLs like `/creators/tomas-vega` resolve deterministically. */
export function toCreatorHandle(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildAvatarUrl(userId: string, avatarHash?: string | null): string | undefined {
  const clean = avatarHash?.trim();
  return clean ? `${env.cdnServiceUrl}/cdn/users/${userId}/avatar.webp?v=${clean.slice(0, 12)}` : undefined;
}

// GET /api/creators/:handle — public creator profile + all visible models (works even for creators with 0 models or >100 total catalog models)
creatorsRouter.get('/:handle', async (req, res) => {
  const targetHandle = String(req.params.handle || '').trim().toLowerCase();
  if (!targetHandle || targetHandle.length > 120) {
    throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator not found');
  }

  const candidatesRes = await db.query<{
    id: string;
    display_name: string | null;
    email: string;
    avatar_hash: string | null;
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
       )`,
  );

  const creator = candidatesRes.rows.find((u) => {
    const label = u.display_name?.trim() || u.email;
    return toCreatorHandle(label) === targetHandle;
  });

  if (!creator) {
    throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator not found');
  }

  const displayName = creator.display_name?.trim() || creator.email;
  const avatarUrl = buildAvatarUrl(creator.id, creator.avatar_hash);

  const modelsRes = await db.query<{
    id: string;
    owner_id: string;
    title: string;
    description: string | null;
    tags: string[];
    license: string;
    file_hash: string;
    file_size: string | number;
    preview_hash: string | null;
    poster_hash: string | null;
    price_cents: number;
    currency: string;
    view_count: string | number;
    download_count: string | number;
    like_count: string | number;
    created_at: Date | string;
  }>(
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

  const models = modelsRes.rows.map((row) => {
    const isPaid = row.price_cents > 0;
    const baseCdn = `${env.cdnServiceUrl}/cdn/models/${row.id}`;
    return {
      id: row.id,
      ownerId: row.owner_id,
      creator: displayName,
      creatorAvatarUrl: avatarUrl,
      title: row.title,
      description: row.description ?? '',
      tags: row.tags ?? [],
      license: row.license,
      priceCents: Number(row.price_cents),
      currency: row.currency,
      fileSize: Number(row.file_size),
      viewCount: Number(row.view_count),
      downloadCount: Number(row.download_count),
      likeCount: Number(row.like_count),
      posterUrl: row.poster_hash ? `${baseCdn}/poster.webp` : undefined,
      previewUrl: row.preview_hash ? `${baseCdn}/${row.preview_hash}.glb` : undefined,
      fileUrl: isPaid ? undefined : `${baseCdn}/${row.file_hash}.glb`,
      createdAt: row.created_at,
    };
  });

  const totalDownloads = models.reduce((sum, m) => sum + m.downloadCount, 0);
  const totalLikes = models.reduce((sum, m) => sum + m.likeCount, 0);

  res.json({
    handle: toCreatorHandle(displayName),
    name: displayName,
    avatarUrl,
    bio: '',
    models,
    totalDownloads,
    totalLikes,
  });
});
