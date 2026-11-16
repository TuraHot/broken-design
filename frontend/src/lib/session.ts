// Read-only view of the sign-in that `components/auth/AuthForm.tsx` saves in localStorage.
// Used by the Navbar to show who is signed in. It is a convenience for the UI only:
// every page and API must still check the role on the server.
import { stopViewingSite } from './admin-view';
import type { AuthUser } from './auth';

export interface Session {
  token: string;
  user: AuthUser;
}

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

/** The saved sign-in, or `null` when signed out, the data is damaged, or the token has expired. */
export function readSession(): Session | null {
  try {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
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

/** Forget the saved sign-in (log out on this device). */
export function clearSession(): void {
  stopViewingSite();
  try {
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage can be blocked (private mode); nothing to clear then.
  }
}
