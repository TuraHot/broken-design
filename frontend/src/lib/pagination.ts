// Gallery helpers: search/filter/page params <-> URL, visibility guard, popularity sort and slicing.
import type { License, Model, ModelsPage, ModelsParams } from './types';

export const PAGE_SIZE = 48;

type ModelVisibilityFields = {
  isHidden?: boolean;
  hidden?: boolean;
  hiddenAt?: string | null;
  hidden_at?: string | null;
  isBanned?: boolean;
  banned?: boolean;
  bannedAt?: string | null;
  banned_at?: string | null;
  isDeleted?: boolean;
  deleted?: boolean;
  deletedAt?: string | null;
  deleted_at?: string | null;
  ownerSuspendedAt?: string | null;
  owner_suspended_at?: string | null;
  status?: string;
  owner?: { isSuspended?: boolean; suspendedAt?: string | null; suspended_at?: string | null };
};

/** True only for models that are not hidden/banned, not soft-deleted, and not owned by a suspended user. */
export function isPublicModel(model: Model & ModelVisibilityFields): boolean {
  if (
    model.isHidden ||
    model.hidden ||
    model.hiddenAt != null ||
    model.hidden_at != null ||
    model.isBanned ||
    model.banned ||
    model.bannedAt != null ||
    model.banned_at != null
  ) {
    return false;
  }
  if (model.isDeleted || model.deleted || model.deletedAt != null || model.deleted_at != null) {
    return false;
  }
  if (
    model.owner?.isSuspended ||
    model.owner?.suspendedAt != null ||
    model.owner?.suspended_at != null ||
    model.ownerSuspendedAt != null ||
    model.owner_suspended_at != null
  ) {
    return false;
  }
  if (typeof model.status === 'string' && ['hidden', 'banned', 'deleted', 'suspended'].includes(model.status.toLowerCase())) {
    return false;
  }
  return true;
}

const VALID_TAGS: readonly string[] = ['character', 'vehicle', 'architecture', 'nature', 'sci-fi', 'props', 'abstract', 'animal'];
const VALID_LICENSES: readonly string[] = ['CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL'];

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Extract unique lowercase tags from publicly visible models only. */
export function extractAvailableTags(models: Model[]): string[] {
  const seen = new Set<string>();
  for (const model of models) {
    if (!isPublicModel(model)) continue;
    for (const rawTag of model.tags ?? []) {
      const tag = rawTag.trim().toLowerCase();
      if (tag) seen.add(tag);
    }
  }
  const known = VALID_TAGS.filter((t) => seen.has(t));
  const custom = [...seen].filter((t) => !VALID_TAGS.includes(t)).sort((a, b) => a.localeCompare(b));
  return [...known, ...custom];
}

/** Read Next.js `searchParams` into validated params; anything unknown is dropped. */
export function parseParams(raw: RawParams, extraAllowedTags: readonly string[] = []): ModelsParams {
  const params: ModelsParams = {};

  const q = first(raw.q)?.trim();
  if (q) params.q = q;

  const tag = first(raw.tag)?.trim().toLowerCase();
  if (tag && (VALID_TAGS.includes(tag) || extraAllowedTags.includes(tag))) {
    params.tag = tag;
  }

  const license = first(raw.license)?.trim().toUpperCase();
  if (license && VALID_LICENSES.includes(license)) {
    params.license = license as License;
  }

  const price = first(raw.price)?.trim().toLowerCase();
  if (price === 'free' || price === 'paid') {
    params.price = price;
  }

  const page = Number.parseInt(first(raw.page) ?? '', 10);
  if (Number.isFinite(page) && page > 1) {
    params.page = page;
  }

  return params;
}

/** `/gallery` or `/gallery?...` (page 1 has no `page` query). */
export function buildHref(params: ModelsParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.tag) sp.set('tag', params.tag);
  if (params.license) sp.set('license', params.license);
  if (params.price) sp.set('price', params.price);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return qs ? `/gallery?${qs}` : '/gallery';
}

/** Filter, sort by popularity (likes, then downloads) and slice one page. The page number is clamped to the last page. */
export function queryModels(models: Model[], params: ModelsParams, pageSize = PAGE_SIZE): ModelsPage {
  const q = params.q?.trim().toLowerCase();
  const filtered = models.filter((m) => {
    if (!isPublicModel(m)) return false;
    if (q) {
      const inTitle = m.title.toLowerCase().includes(q);
      const inDesc = (m.description ?? '').toLowerCase().includes(q);
      const inCreator = m.creator.toLowerCase().includes(q);
      const inTags = m.tags.some((t) => t.toLowerCase().includes(q));
      if (!inTitle && !inDesc && !inCreator && !inTags) return false;
    }
    if (params.tag && !m.tags.includes(params.tag)) return false;
    if (params.license && m.license !== params.license) return false;
    if (params.price === 'free' && m.priceCents !== 0) return false;
    if (params.price === 'paid' && m.priceCents <= 0) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.likeCount - a.likeCount || b.downloadCount - a.downloadCount);
  const lastPage = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, params.page ?? 1), lastPage);
  return { items: sorted.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: sorted.length };
}
