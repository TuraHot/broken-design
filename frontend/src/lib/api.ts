import { buildProfile, creatorHandle, type CreatorProfile } from './creators';
import { PAGE_SIZE, queryModels } from './pagination';
import { MOCK_MODELS } from './mock-models';
import type { Model, ModelsPage, ModelsParams } from './types';

export const CORE_API_URL = process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:4000';
export const CDN_SERVICE_URL = process.env.NEXT_PUBLIC_CDN_SERVICE_URL || 'http://localhost:4001';

// Inside Docker, Next.js Server Components reach core-api via the internal service hostname,
// while browser clients continue using NEXT_PUBLIC_CORE_API_URL (localhost:4000).
function getServerCoreApiUrl(): string {
  if (typeof window === 'undefined' && process.env.INTERNAL_CORE_API_URL) {
    return process.env.INTERNAL_CORE_API_URL;
  }
  return CORE_API_URL;
}

// Mock data is merged with real database models (via Core API) unless NEXT_PUBLIC_USE_MOCK=false.
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildModelSearchParams(params: ModelsParams, pageSize?: number): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.tag) sp.set('tag', params.tag);
  if (params.license) sp.set('license', params.license);
  if (params.price) sp.set('price', params.price);
  if (params.page) sp.set('page', String(params.page));
  if (pageSize) sp.set('pageSize', String(pageSize));
  return sp;
}

async function fetchCoreApiModels(params: ModelsParams = {}, pageSize = 100): Promise<Model[]> {
  try {
    const query = buildModelSearchParams(params, pageSize).toString();
    const url = `${getServerCoreApiUrl()}/api/models${query ? `?${query}` : ''}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as Partial<ModelsPage>;
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function fetchCoreApiModelById(id: string): Promise<Model | null> {
  if (!UUID_RE.test(id)) return null;
  try {
    const res = await fetch(`${getServerCoreApiUrl()}/api/models/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Model>;
    if (data && data.id && data.title !== 'Sample 3D Asset') {
      return data as Model;
    }
    return null;
  } catch {
    return null;
  }
}

/** List models for the gallery (paged, real database models from Core API + optional mock catalogue). */
export async function fetchModels(params: ModelsParams): Promise<ModelsPage> {
  if (USE_MOCK) {
    const apiModels = await fetchCoreApiModels();
    const combined = [...apiModels, ...MOCK_MODELS];
    return queryModels(combined, params);
  }

  try {
    const sp = buildModelSearchParams(params);
    const res = await fetch(`${getServerCoreApiUrl()}/api/models?${sp}`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as Partial<ModelsPage>;
      if (Array.isArray(data.items)) {
        return {
          items: data.items,
          page: data.page ?? params.page ?? 1,
          pageSize: data.pageSize ?? PAGE_SIZE,
          total: data.total ?? data.items.length,
        };
      }
    }
  } catch {
    // Core API offline
  }

  return queryModels([], params);
}

/** One model for its detail page, or `null` when it does not exist. */
export async function fetchModel(id: string): Promise<Model | null> {
  if (UUID_RE.test(id)) {
    const fromApi = await fetchCoreApiModelById(id);
    if (fromApi) return fromApi;
  }

  if (USE_MOCK) return MOCK_MODELS.find((m) => m.id === id) ?? null;
  return null;
}

/** Other models by the same creator (most popular first), for the "More from" row. */
export async function fetchMoreFromCreator(model: Model, limit = 4): Promise<Model[]> {
  const apiModels = await fetchCoreApiModels();
  const pool = USE_MOCK ? [...apiModels, ...MOCK_MODELS] : apiModels;
  return queryModels(
    pool.filter((m) => m.creator === model.creator && m.id !== model.id),
    {},
    limit,
  ).items;
}

/** A creator profile by handle (see `creatorHandle`), or `null` when nobody has that handle. */
export async function fetchCreator(handle: string): Promise<CreatorProfile | null> {
  const apiModels = await fetchCoreApiModels();
  const pool = USE_MOCK ? [...apiModels, ...MOCK_MODELS] : apiModels;
  const mine = pool.filter((m) => creatorHandle(m.creator) === handle);
  if (mine.length > 0) return buildProfile(mine[0].creator, mine);

  if (!USE_MOCK) {
    try {
      const res = await fetch(`${getServerCoreApiUrl()}/api/creators/${encodeURIComponent(handle)}`, { cache: 'no-store' });
      if (res.ok) return (await res.json()) as CreatorProfile;
    } catch {
      return null;
    }
  }
  return null;
}
