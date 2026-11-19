// The text for an error shown on an account form. Failures the browser makes up (no network, no message from the
// server) are translated; a message that came from the API is shown as the server wrote it.
import { AuthError } from '@/lib/auth';
import type { MessageKey } from './messages';

export function authErrorText(err: unknown, t: (key: MessageKey) => string, fallback: MessageKey = 'auth.errGeneric'): string {
  if (err instanceof AuthError) {
    if (err.code === 'API') return err.message;
    if (err.code === 'NETWORK') return t('auth.errNetwork');
  }
  return t(fallback);
}
