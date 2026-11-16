// Client for core-api `/api/admin/*`. Admin pages run in the browser because the token lives in
// localStorage. This only attaches the token; the server decides who is an admin (AGENT.md §3.2).
import { CORE_API_URL } from './api';
import { readSession } from './session';

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminOverview {
  totalUsers: number;
  suspendedUsers: number;
  adminUsers: number;
  sellerUsers: number;
  newUsers7d: number;
  totalModels: number;
  hiddenModels: number;
  freeModels: number;
  newModels7d: number;
  totalDownloads: number;
  totalViews: number;
  paidPurchases: number;
  pendingPurchases: number;
  openComplaints: number;
  totalRevenueCents: number;
  revenue7dCents: number;
  licenseBreakdown: { license: string; count: number }[];
  topModels: { id: string; title: string; ownerName: string; downloadCount: number; viewCount: number }[];
  recentPurchases: {
    id: string;
    buyerName: string;
    model: { id: string; title: string };
    amountCents: number;
    currency: string;
    paidAt: string | null;
  }[];
  recentUsers: { id: string; displayName: string; email: string; role: string; createdAt: string }[];
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'creator' | 'admin';
  isSeller: boolean;
  suspendedAt: string | null;
  createdAt: string;
}

export interface AdminModel {
  id: string;
  title: string;
  license: string;
  priceCents: number;
  currency: string;
  viewCount: number;
  downloadCount: number;
  isHidden: boolean;
  isDeleted: boolean;
  owner: { id: string; displayName: string; isSuspended: boolean };
  createdAt: string;
}

export interface AdminPurchase {
  id: string;
  status: 'pending' | 'paid';
  amountCents: number;
  currency: string;
  licenseType: string;
  watermarkHash: string | null;
  paidAt: string | null;
  createdAt: string;
  buyer: { id: string; email: string; displayName: string };
  model: { id: string; title: string };
}

export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';
export type ComplaintCategory = 'model' | 'account' | 'purchase' | 'other';

export interface AdminComplaint {
  id: string;
  category: ComplaintCategory;
  message: string;
  status: ComplaintStatus;
  adminNote: string | null;
  handledAt: string | null;
  handledByName: string | null;
  createdAt: string;
  reporter: { id: string; displayName: string; email: string };
  model: { id: string; title: string; isHidden: boolean } | null;
  owner: { id: string; displayName: string; isSuspended: boolean } | null;
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = readSession();
  if (!session) throw new AdminApiError(401, 'UNAUTHORIZED', 'Please log in first.');

  let res: Response;
  try {
    res = await fetch(`${CORE_API_URL}/api/admin${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        ...init.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new AdminApiError(0, 'NETWORK', 'Cannot reach the server. Is core-api running?');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AdminApiError(
      res.status,
      data?.error?.code ?? 'ERROR',
      data?.error?.message ?? 'Request failed. Please try again.',
    );
  }
  return data as T;
}

export const setUserSuspended = (id: string, suspended: boolean) =>
  adminFetch<{ id: string; isSuspended: boolean; suspendedAt: string | null }>(
    `/users/${encodeURIComponent(id)}/suspend`,
    { method: 'PATCH', body: JSON.stringify({ suspended }) },
  );

export const setModelHidden = (id: string, hidden: boolean) =>
  adminFetch<{ id: string; isHidden: boolean; hiddenAt: string | null }>(
    `/models/${encodeURIComponent(id)}/hide`,
    { method: 'PATCH', body: JSON.stringify({ hidden }) },
  );

export const updateComplaint = (id: string, status: ComplaintStatus, adminNote?: string) =>
  adminFetch<{ id: string; status: ComplaintStatus; adminNote: string | null; handledAt: string | null }>(
    `/complaints/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(adminNote === undefined ? { status } : { status, adminNote }) },
  );
