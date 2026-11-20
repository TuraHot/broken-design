// Creator profile types and URL handle helpers (shared between frontend and core-api).
import type { Model } from './types';

export interface CreatorProfile {
  handle: string;
  name: string;
  avatarUrl?: string;
  bio: string;
  models: Model[];
  totalDownloads: number;
  totalLikes: number;
}

/** "Tomás Vega" -> "tomas-vega", "สมชาย ใจดี" -> "สมชาย-ใจดี" (preserves Unicode letters/marks, drops Latin diacritics). */
export function creatorHandle(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
