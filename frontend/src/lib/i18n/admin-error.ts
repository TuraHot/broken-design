// The text for an error shown on an admin page. Messages that the browser makes up (no network, not logged in)
// are translated; messages that come from the API are shown as the server wrote them.
import { AdminApiError } from '@/lib/admin-api';
import type { MessageKey } from './messages';

export function adminErrorText(
  err: unknown,
  t: (key: MessageKey) => string,
  fallback: MessageKey = 'admin.errGeneric',
): string {
  if (err instanceof AdminApiError) {
    if (err.code === 'NETWORK') return t('admin.errNetwork');
    if (err.code === 'UNAUTHORIZED') return t('admin.errLogin');
    return err.message;
  }
  return t(fallback);
}
