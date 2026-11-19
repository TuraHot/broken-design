// A status or error line that is either a translated key (it follows the language switch) or text the server wrote.
import { ApiError } from '@/lib/api';
import type { MessageKey } from './messages';

export type Msg = { key: MessageKey; vars?: Record<string, string | number> } | { text: string };

/**
 * What to show for a failed call: the API's own message when it sent one, a translated "cannot reach the server" when
 * the browser could not connect (fetch throws a TypeError), otherwise the translated fallback `key`.
 */
export const fromErr = (err: unknown, key: MessageKey): Msg => {
  if (err instanceof ApiError) return err.fromServer ? { text: err.message } : { key };
  if (err instanceof TypeError) return { key: 'common.errNetwork' };
  if (err instanceof Error && (err as Error & { serverText?: boolean }).serverText) return { text: err.message };
  return { key };
};

/** An Error whose message is text the server wrote (for code that calls fetch itself, such as the .glb download). */
export const serverError = (message: string) => Object.assign(new Error(message), { serverText: true });

export const msgText = (m: Msg, t: (key: MessageKey, vars?: Record<string, string | number>) => string) =>
  'key' in m ? t(m.key, m.vars) : m.text;
