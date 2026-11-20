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
  suspendedUntil: string | null;
  suspensionReason: string | null;
  createdAt: string;
  /** Set when an admin deleted the account (the row stays as history; `email` is then the address it had). */
  deletedAt: string | null;
  deletedReason: string | null;
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

export interface AdminPurchaseDetail {
  id: string;
  status: 'pending' | 'paid';
  amountCents: number;
  currency: string;
  licenseType: string;
  watermarkHash: string | null;
  providerSessionId: string | null;
  paidAt: string | null;
  createdAt: string;
  buyer: { id: string; email: string; displayName: string; isSuspended: boolean };
  model: { id: string; title: string; currentLicense: string; isHidden: boolean; isDeleted: boolean };
  owner: { id: string; email: string; displayName: string };
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

/** Suspend (reason required, `until` optional: no end time = until an admin restores) or restore (reason optional). */
export const setUserSuspended = (id: string, body: { suspended: boolean; reason?: string; until?: string }) =>
  adminFetch<{ id: string; isSuspended: boolean; suspendedAt: string | null; suspendedUntil: string | null }>(
    `/users/${encodeURIComponent(id)}/suspend`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );

/**
 * Delete an account but keep its history (reason required, 10-1000 characters). The email is freed: signing up with it
 * again makes a brand-new account. Admins and your own account are refused by the server.
 */
export const deleteUser = (id: string, reason: string) =>
  adminFetch<{ id: string; isDeleted: boolean }>(`/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });

/** Hide (reason required, the owner is notified) or restore (reason optional). */
export const setModelHidden = (id: string, body: { hidden: boolean; reason?: string }) =>
  adminFetch<{ id: string; isHidden: boolean; hiddenAt: string | null }>(
    `/models/${encodeURIComponent(id)}/hide`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );

export const fetchPurchaseDetail = (id: string) =>
  adminFetch<AdminPurchaseDetail>(`/purchases/${encodeURIComponent(id)}`);

export interface SuspensionEntry {
  id: string;
  action: 'suspend' | 'restore' | 'expire';
  reason: string | null;
  until: string | null;
  createdAt: string;
  admin: { id: string; displayName: string } | null;
}

/** One line of a model's history: a license change or a hide / restore. */
export type ModelHistoryEntry =
  | { kind: 'license'; id: string; oldLicense: string; newLicense: string; reason: string; createdAt: string; admin: { id: string; displayName: string } | null }
  | { kind: 'visibility'; id: string; action: 'hide' | 'restore'; reason: string | null; createdAt: string; admin: { id: string; displayName: string } | null };

export const fetchSuspensions = (userId: string) =>
  adminFetch<{ items: SuspensionEntry[] }>(`/users/${encodeURIComponent(userId)}/suspensions`);

export const fetchModelHistory = (modelId: string) =>
  adminFetch<{ items: ModelHistoryEntry[] }>(`/models/${encodeURIComponent(modelId)}/history`);

/** The written reason of an admin action (license change, hide, suspend): the API accepts 10 to 1000 characters. */
// ─── What waits for an admin (creator applications and open complaints) ───────
export interface AdminWaitingCounts {
  creatorApplications: number;
  complaints: number;
  total: number;
}

export interface AdminNotificationItem {
  kind: 'creator_application' | 'complaint';
  id: string;
  createdAt: string;
  person: { id: string; displayName: string; email: string };
  /** The applicant's note or the complaint message (cut to 300 characters by the server). */
  text: string;
  /** Complaints only: model | account | purchase | other. */
  category: string | null;
  modelTitle: string | null;
}

export const fetchWaitingSummary = () => adminFetch<AdminWaitingCounts>('/notifications/summary');

/** Sent on `window` when an application or a complaint was handled, so the sidebar numbers update at once. */
export const WAITING_CHANGED_EVENT = 'lixyte:admin-waiting-changed';

function announceWaitingChanged<T>(result: T): T {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WAITING_CHANGED_EVENT));
  return result;
}

export const fetchNotifications = () =>
  adminFetch<{ counts: AdminWaitingCounts; items: AdminNotificationItem[] }>('/notifications');

// ─── Creator approvals ───────────────────────────────────────────────────────
export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface AdminCreatorApplication {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  note: string;
  status: CreatorApplicationStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AdminInviteCode {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export const fetchCreatorApplications = (status: CreatorApplicationStatus | 'all') =>
  adminFetch<{ applications: AdminCreatorApplication[] }>(`/creator-applications?status=${status}`);

export const reviewCreatorApplication = (id: string, status: 'approved' | 'rejected', adminNote?: string) =>
  adminFetch<{ application: { id: string; status: CreatorApplicationStatus } }>(
    `/creator-applications/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify({ status, ...(adminNote ? { adminNote } : {}) }) },
  ).then(announceWaitingChanged);

export const fetchInviteCodes = () => adminFetch<{ codes: AdminInviteCode[] }>('/invite-codes');

export const createInviteCode = (maxUses = 1) =>
  adminFetch<{ code: AdminInviteCode }>('/invite-codes', { method: 'POST', body: JSON.stringify({ maxUses }) });

export const REASON_MIN = 10;
export const REASON_MAX = 1000;

export const setModelLicense = (id: string, license: string, reason: string) =>
  adminFetch<{ id: string; license: string }>(`/models/${encodeURIComponent(id)}/license`, {
    method: 'PATCH',
    body: JSON.stringify({ license, reason }),
  });

export const updateComplaint = (id: string, status: ComplaintStatus, adminNote?: string) =>
  adminFetch<{ id: string; status: ComplaintStatus; adminNote: string | null; handledAt: string | null; reporterNotified: boolean }>(
    `/complaints/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(adminNote === undefined ? { status } : { status, adminNote }) },
  ).then(announceWaitingChanged);
