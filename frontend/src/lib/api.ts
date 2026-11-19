import { cache } from 'react';
import { buildProfile, creatorHandle, type CreatorProfile } from './creators';
import { isPublicModel, PAGE_SIZE, queryModels } from './pagination';
import type {
  Model,
  ModelsPage,
  ModelsParams,
  PurchaseDetail,
  PurchaseItem,
  QrPaymentResponse,
  SellerModelItem,
  SellerSalesSummary,
  SellerWalletResponse,
  SellerWithdrawal,
} from './types';

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

const fetchCoreApiModelsCached = cache(async (query: string): Promise<Model[]> => {
  try {
    const url = `${getServerCoreApiUrl()}/api/models${query ? `?${query}` : ''}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as Partial<ModelsPage>;
    return Array.isArray(data.items) ? data.items.filter(isPublicModel) : [];
  } catch {
    return [];
  }
});

export async function fetchCoreApiModels(params: ModelsParams = {}, pageSize = 100): Promise<Model[]> {
  const query = buildModelSearchParams(params, pageSize).toString();
  return fetchCoreApiModelsCached(query);
}

const fetchCoreApiModelById = cache(async (id: string): Promise<Model | null> => {
  if (!UUID_RE.test(id)) return null;
  try {
    const res = await fetch(`${getServerCoreApiUrl()}/api/models/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Model>;
    if (data && data.id && data.title !== 'Sample 3D Asset' && isPublicModel(data as Model)) {
      return data as Model;
    }
    return null;
  } catch {
    return null;
  }
});

/** List models for the gallery (paged, real database models from Core API, public visible only). */
export async function fetchModels(params: ModelsParams): Promise<ModelsPage> {
  try {
    const sp = buildModelSearchParams(params);
    const res = await fetch(`${getServerCoreApiUrl()}/api/models?${sp}`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as Partial<ModelsPage>;
      if (Array.isArray(data.items)) {
        const visibleItems = data.items.filter(isPublicModel);
        const hiddenCount = data.items.length - visibleItems.length;
        const rawTotal = data.total ?? data.items.length;
        return {
          items: visibleItems,
          page: data.page ?? params.page ?? 1,
          pageSize: data.pageSize ?? PAGE_SIZE,
          total: Math.max(visibleItems.length, rawTotal - hiddenCount),
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

  return null;
}

/** Other models by the same creator (most popular first), for the "More from" row. */
export async function fetchMoreFromCreator(model: Model, limit = 4): Promise<Model[]> {
  const apiModels = await fetchCoreApiModels();
  return queryModels(
    apiModels.filter((m) => m.creator === model.creator && m.id !== model.id),
    {},
    limit,
  ).items;
}

/** A creator profile by handle (see `creatorHandle`), or `null` when nobody has that handle. */
export async function fetchCreator(handle: string): Promise<CreatorProfile | null> {
  const apiModels = await fetchCoreApiModels();
  const mine = apiModels.filter((m) => creatorHandle(m.creator) === handle);
  if (mine.length > 0) return buildProfile(mine[0].creator, mine);

  try {
    const res = await fetch(`${getServerCoreApiUrl()}/api/creators/${encodeURIComponent(handle)}`, { cache: 'no-store' });
    if (res.ok) return (await res.json()) as CreatorProfile;
  } catch {
    // Core API offline
  }
  return null;
}

/** Shared authenticated JSON fetch helper for buyer and seller actions. */
async function coreApiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${CORE_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Fetch purchases for the currently logged-in user (`GET /api/me/purchases`). */
export async function fetchMyPurchases(token: string): Promise<PurchaseItem[]> {
  const data = await coreApiFetch<{ purchases?: PurchaseItem[] }>('/api/me/purchases', token, {
    cache: 'no-store',
  });
  return data.purchases || [];
}

/** Regenerate embed_key for a purchase (`POST /api/purchases/:id/regenerate-key`). */
export async function regenerateEmbedKey(
  purchaseId: string,
  token: string,
): Promise<{ id: string; embedKey: string }> {
  return coreApiFetch(`/api/purchases/${encodeURIComponent(purchaseId)}/regenerate-key`, token, {
    method: 'POST',
  });
}

/** Fetch a single purchase by ID (`GET /api/purchases/:id`). */
export async function fetchPurchaseById(purchaseId: string, token: string): Promise<PurchaseDetail> {
  return coreApiFetch<PurchaseDetail>(`/api/purchases/${encodeURIComponent(purchaseId)}`, token, {
    cache: 'no-store',
  });
}

/** Confirm mock payment for a pending purchase (`POST /api/purchases/:id/confirm-mock`). */
export async function confirmMockPayment(
  purchaseId: string,
  token: string,
): Promise<{
  purchaseId: string;
  modelId: string;
  embedKey: string;
  amountCents: number;
  currency: string;
  licenseType: string;
  paidAt: string;
}> {
  return coreApiFetch(`/api/purchases/${encodeURIComponent(purchaseId)}/confirm-mock`, token, {
    method: 'POST',
  });
}

/** Create or retrieve QR payment (PromptPay via Stripe or mock) (`POST /api/purchases/:id/qr`). */
export async function createQrPayment(purchaseId: string, token: string): Promise<QrPaymentResponse> {
  return coreApiFetch<QrPaymentResponse>(`/api/purchases/${encodeURIComponent(purchaseId)}/qr`, token, {
    method: 'POST',
  });
}

/** Enable seller mode for user (`POST /api/seller/enable`). */
export async function enableSellerMode(token: string): Promise<void> {
  await coreApiFetch('/api/seller/enable', token, { method: 'POST' });
}

/** Fetch seller status (`GET /api/seller/status`). */
export async function fetchSellerStatus(token: string): Promise<boolean> {
  const res = await fetch(`${CORE_API_URL}/api/seller/status`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.isSeller);
}

/** Fetch seller's own uploaded models (`GET /api/seller/models`). */
export async function fetchSellerModels(token: string): Promise<SellerModelItem[]> {
  const data = await coreApiFetch<{ models?: SellerModelItem[] }>('/api/seller/models', token, {
    cache: 'no-store',
  });
  return data.models || [];
}

/** Fetch seller sales summary (`GET /api/seller/sales`). */
export async function fetchSellerSales(token: string): Promise<SellerSalesSummary> {
  return coreApiFetch<SellerSalesSummary>('/api/seller/sales', token, { cache: 'no-store' });
}

/** Fetch seller platform escrow wallet & withdrawal history (`GET /api/seller/wallet`). */
export async function fetchSellerWallet(token: string): Promise<SellerWalletResponse> {
  return coreApiFetch<SellerWalletResponse>('/api/seller/wallet', token, { cache: 'no-store' });
}

/** Request a withdrawal with platform fee/difference calculation (`POST /api/seller/withdraw`). */
export async function requestSellerWithdrawal(
  token: string,
  payload: { amountCents?: number; payoutMethod: 'promptpay' | 'bank'; payoutAccount: string },
): Promise<{ withdrawal: SellerWithdrawal }> {
  return coreApiFetch<{ withdrawal: SellerWithdrawal }>('/api/seller/withdraw', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Soft delete a model (`DELETE /api/models/:id`). */
export async function deleteModel(modelId: string, token: string): Promise<void> {
  await coreApiFetch(`/api/models/${encodeURIComponent(modelId)}`, token, {
    method: 'DELETE',
  });
}

/** Update model metadata (`PATCH /api/models/:id`). */
export async function updateSellerModel(
  modelId: string,
  token: string,
  payload: { title: string; description: string; priceCents: number; license: string },
): Promise<{ model: { id: string; title: string; description: string; priceCents: number; license: string } }> {
  return coreApiFetch(`/api/models/${encodeURIComponent(modelId)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Replace model .glb, preview .glb, and/or poster image (`PATCH /api/models/:id/assets` on CDN Service). */
export async function replaceModelAssets(
  modelId: string,
  token: string,
  files: { file?: File | null; preview?: File | null; poster?: File | null },
): Promise<{ model: { id: string; posterHash?: string | null } }> {
  const formData = new FormData();
  if (files.file) formData.append('file', files.file);
  if (files.preview) formData.append('preview', files.preview);
  if (files.poster) formData.append('poster', files.poster);

  const res = await fetch(`${CDN_SERVICE_URL}/api/models/${encodeURIComponent(modelId)}/assets`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `Asset update failed (${res.status})`);
  }
  return res.json();
}

export interface NoticeItem {
  id: string;
  kind: string;
  modelId: string | null;
  data: { modelTitle?: string; oldLicense?: string; newLicense?: string; reason?: string | null; until?: string | null; auto?: boolean };
  readAt: string | null;
  createdAt: string;
}

/** The signed-in user's notices (`GET /api/me/notifications`). */
export async function fetchNotices(token: string): Promise<{ unread: number; items: NoticeItem[] }> {
  return coreApiFetch('/api/me/notifications', token, { cache: 'no-store' });
}

/** Mark one notice as read (`PATCH /api/me/notifications/:id/read`). */
export async function markNoticeRead(id: string, token: string): Promise<void> {
  await coreApiFetch(`/api/me/notifications/${encodeURIComponent(id)}/read`, token, { method: 'PATCH' });
}

/** Mark every notice as read (`PATCH /api/me/notifications/read-all`). */
export async function markAllNoticesRead(token: string): Promise<void> {
  await coreApiFetch('/api/me/notifications/read-all', token, { method: 'PATCH' });
}
