import { PAGE_SIZE, queryModels } from './pagination';
import { MOCK_MODELS } from './mock-models';
import type { ModelsPage, ModelsParams } from './types';

export const CORE_API_URL = process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:4000';
export const CDN_SERVICE_URL = process.env.NEXT_PUBLIC_CDN_SERVICE_URL || 'http://localhost:4001';

// Mock data is the default until core-api is ready; set NEXT_PUBLIC_USE_MOCK=false to call it.
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

/** List models for the gallery (paged, most popular first). Pages never need to know whether the data is mocked. */
export async function fetchModels(params: ModelsParams): Promise<ModelsPage> {
  if (USE_MOCK) return queryModels(MOCK_MODELS, params);

  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));

  const res = await fetch(`${CORE_API_URL}/api/models?${sp}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
  const data = (await res.json()) as Partial<ModelsPage>;
  return {
    items: data.items ?? [],
    page: data.page ?? 1,
    pageSize: data.pageSize ?? PAGE_SIZE,
    total: data.total ?? 0,
  };
}
