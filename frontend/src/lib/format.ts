// Small display helpers shared by model cards and the model page

/** `$15`, `$8.50` (whole dollars have no decimals). */
export const formatPrice = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/** `3120` -> `3,120` */
export const formatCount = (n: number) => n.toLocaleString('en-US');

/** `2900, 'USD'` -> `$29.00`; falls back to `29.00 XYZ` for an unknown currency code. */
export function formatMoney(cents: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** ISO timestamp -> `2026-11-16` (UTC date, same everywhere); `—` when empty or invalid. */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}
