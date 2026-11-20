import { env } from '../../config/env';

export interface ModelPresenterRow {
  id: string;
  owner_id: string;
  creator: string;
  creator_avatar_hash?: string | null;
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
}

export function buildAvatarUrl(userId: string, avatarHash?: string | null): string | undefined {
  const clean = avatarHash?.trim();
  return clean ? `${env.cdnServiceUrl}/cdn/users/${userId}/avatar.webp?v=${clean.slice(0, 12)}` : undefined;
}

export function formatModelResponse(row: ModelPresenterRow, creatorAvatarUrlOverride?: string) {
  const isPaid = Number(row.price_cents) > 0;
  const baseCdn = `${env.cdnServiceUrl}/cdn/models/${row.id}`;
  const fileHash = row.file_hash?.trim() || '';
  const previewHash = row.preview_hash?.trim() || '';
  const posterHash = row.poster_hash?.trim() || '';

  return {
    id: row.id,
    ownerId: row.owner_id,
    creator: row.creator,
    creatorAvatarUrl: creatorAvatarUrlOverride ?? buildAvatarUrl(row.owner_id, row.creator_avatar_hash),
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
    posterUrl: posterHash ? `${baseCdn}/poster.webp` : undefined,
    previewUrl: previewHash ? `${baseCdn}/${previewHash}.glb` : undefined,
    // ห้ามส่งลิงก์ไฟล์เต็มของโมเดลเสียเงิน
    fileUrl: isPaid || !fileHash ? undefined : `${baseCdn}/${fileHash}.glb`,
    createdAt: row.created_at,
  };
}
