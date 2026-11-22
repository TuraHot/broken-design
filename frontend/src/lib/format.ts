// Small display helpers shared by model cards and the model page

/** Thai baht, amounts in satang: `1500` -> `฿15`, `850` -> `฿8.50` (whole baht have no decimals). */
export const formatPrice = (satang: number) =>
  `฿${(satang / 100).toLocaleString('en-US', {
    minimumFractionDigits: satang % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

/** `3120` -> `3,120` */
export const formatCount = (n: number) => n.toLocaleString('en-US');

/** `2900, 'THB'` -> `฿29.00`; other currencies use the standard symbol; falls back to `29.00 XYZ` for an unknown code. */
export function formatMoney(cents: number, currency = 'THB') {
  if (currency.toUpperCase() === 'THB') {
    return `฿${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
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

/** ISO timestamp -> `2026-11-16 09:30:05 UTC`; `—` when empty or invalid. Use it where the order of events matters. */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}
