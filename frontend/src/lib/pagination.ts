// Pure gallery helpers: page param <-> URL, popularity sort and slicing (used by the mock data).
// Search and filtering are intentionally not implemented — the gallery filter UI is visual only.
import type { Model, ModelsPage, ModelsParams } from './types';

export const PAGE_SIZE = 48;

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Read Next.js `searchParams` into validated params; anything unknown is dropped. */
export function parseParams(raw: RawParams): ModelsParams {
  const page = Number.parseInt(first(raw.page) ?? '', 10);
  return { page: Number.isFinite(page) && page > 1 ? page : undefined };
}

/** `/gallery` or `/gallery?page=n` (page 1 has no query). */
export function buildHref(params: ModelsParams): string {
  return params.page && params.page > 1 ? `/gallery?page=${params.page}` : '/gallery';
}

/** Sort by popularity (likes, then downloads) and slice one page. The page number is clamped to the last page. */
export function queryModels(models: Model[], params: ModelsParams, pageSize = PAGE_SIZE): ModelsPage {
  const sorted = [...models].sort((a, b) => b.likeCount - a.likeCount || b.downloadCount - a.downloadCount);
  const lastPage = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, params.page ?? 1), lastPage);
  return { items: sorted.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: sorted.length };
}
