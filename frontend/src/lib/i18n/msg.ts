// A status or error line that is either a translated key (it follows the language switch) or text the server wrote.
import type { MessageKey } from './messages';

export type Msg = { key: MessageKey; vars?: Record<string, string | number> } | { text: string };

/** The server's message when there is one, otherwise our own translated fallback. */
export const fromErr = (err: any, key: MessageKey): Msg => (err?.message ? { text: err.message } : { key });

export const msgText = (m: Msg, t: (key: MessageKey, vars?: Record<string, string | number>) => string) =>
  'key' in m ? t(m.key, m.vars) : m.text;
