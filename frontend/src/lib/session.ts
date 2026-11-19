// The sign-in of THIS browser tab. Saved by `components/auth/AuthForm.tsx` / `RegisterForm.tsx`.
// Stored in `sessionStorage` (one per tab), so two tabs can be signed in as two different accounts at the
// same time. Closing the tab signs that tab out. It is a convenience for the UI only:
// every page and API must still check the role on the server.
import { stopViewingSite } from './admin-view';
import type { AuthUser } from './auth';

export interface Session {
  token: string;
  user: AuthUser;
}

export const SESSION_UPDATED_EVENT = 'lixyte:session-updated';
const STORAGE_KEYS = ['token', 'accessToken', 'user'] as const;

/** `exp` (seconds) from a JWT payload, or `null` when it cannot be read. This does not verify the signature. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/** Older builds kept the sign-in in localStorage, which every tab shares. Remove it so it cannot leak into a new tab. */
function dropLegacyLocalSession(): void {
  try {
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage can be blocked (private mode).
  }
}

function notify(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT));
  }
}

/** This tab's sign-in, or `null` when signed out, the data is damaged, or the token has expired. */
export function readSession(): Session | null {
  try {
    dropLegacyLocalSession();
    const token = sessionStorage.getItem('token');
    const raw = sessionStorage.getItem('user');
    if (!token || !raw) return null;

    const exp = tokenExpiry(token);
    if (exp !== null && exp * 1000 <= Date.now()) {
      clearSession();
      return null;
    }

    const user = JSON.parse(raw) as Partial<AuthUser> | null;
    if (!user || typeof user.email !== 'string') return null;
    return { token, user: user as AuthUser };
  } catch {
    return null;
  }
}

/** The token of this tab's sign-in, or `null`. */
export function readToken(): string | null {
  return readSession()?.token ?? null;
}

/** Save a new sign-in for this tab only. */
export function saveSession(session: Session): void {
  try {
    dropLegacyLocalSession();
    sessionStorage.setItem('token', session.token);
    sessionStorage.setItem('user', JSON.stringify(session.user));
  } catch {
    // Storage can be blocked in private mode.
  }
  notify();
}

/** Update fields on this tab's signed-in user and notify listeners in this tab. */
export function updateSessionUser(patch: Partial<AuthUser>): Session | null {
  const current = readSession();
  if (!current) return null;
  const nextUser: AuthUser = { ...current.user, ...patch };
  try {
    sessionStorage.setItem('user', JSON.stringify(nextUser));
  } catch {
    // Storage can be blocked in private mode.
  }
  notify();
  return { token: current.token, user: nextUser };
}

/** Forget this tab's sign-in (log out in this tab). */
export function clearSession(): void {
  stopViewingSite();
  try {
    STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Storage can be blocked (private mode); nothing to clear then.
  }
  dropLegacyLocalSession();
  notify();
}
