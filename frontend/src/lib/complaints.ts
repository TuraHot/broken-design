// Sending a complaint to core-api (`POST /api/complaints`). Needs a signed-in user.
import { CORE_API_URL } from './api';
import { readSession } from './session';

export const COMPLAINT_CATEGORIES = [
  { value: 'model', label: 'A model (copied, offensive, broken…)' },
  { value: 'account', label: 'A person or an account' },
  { value: 'purchase', label: 'A purchase or payment' },
  { value: 'other', label: 'Something else' },
] as const;

export type ComplaintCategoryValue = (typeof COMPLAINT_CATEGORIES)[number]['value'];

export const COMPLAINT_MIN = 10;
export const COMPLAINT_MAX = 2000;

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Pulls a model id out of a pasted model link or a bare id. `null` when there is none. */
export function extractModelId(text: string): string | null {
  return text.match(UUID_IN_TEXT)?.[0].toLowerCase() ?? null;
}

/**
 * A failed send. `code` says what kind of failure it was so the form can show it in the visitor's language;
 * `message` is the server's own text and only exists for `API` errors (shown as the server wrote it).
 */
export class ComplaintError extends Error {
  constructor(
    public code: 'LOGIN' | 'NETWORK' | 'API',
    message = '',
  ) {
    super(message);
  }
}

export async function submitComplaint(input: { category: ComplaintCategoryValue; modelId?: string; message: string }) {
  const session = readSession();
  if (!session) throw new ComplaintError('LOGIN');

  let res: Response;
  try {
    res = await fetch(`${CORE_API_URL}/api/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ComplaintError('NETWORK');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ComplaintError('API', data?.error?.message ?? '');
  return data as { id: string; status: string; createdAt: string };
}
