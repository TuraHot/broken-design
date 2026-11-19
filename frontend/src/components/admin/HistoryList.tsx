'use client';

// A short, read-only list of what happened before: who changed something, when, and why.
// The reason is the admin's own text and is shown as written.
import { formatDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

export interface HistoryEntry {
  id: string;
  /** What happened, already translated. */
  title: string;
  /** Who acted: an admin (named), nobody (it ended by itself), or an admin whose account no longer exists. */
  by: { kind: 'admin'; name: string } | { kind: 'auto' } | { kind: 'removed' };
  createdAt: string;
  reason: string | null;
}

export default function HistoryList({
  entries,
  error,
  headingId,
}: {
  /** `null` while loading. */
  entries: HistoryEntry[] | null;
  error: string | null;
  headingId: string;
}) {
  const t = useT();
  return (
    <section aria-labelledby={headingId} className="grid gap-3 border-t border-white/10 pt-5">
      <h3 id={headingId} className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">{t('admin.history.title')}</h3>
      {error ? (
        <p role="alert" className="text-sm text-red-300">{error}</p>
      ) : entries === null ? (
        <p role="status" className="text-sm text-white/65">{t('admin.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-white/65">{t('admin.history.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((h) => (
            <li key={h.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <p className="flex flex-wrap items-center gap-x-2 text-white">
                <span className="font-medium">{h.title}</span>
                <span className="text-xs text-white/50">
                  {formatDateTime(h.createdAt)} ·{' '}
                  {h.by.kind === 'admin'
                    ? t('admin.history.by', { name: h.by.name })
                    : h.by.kind === 'auto'
                      ? t('admin.history.auto')
                      : t('admin.history.removed')}
                </span>
              </p>
              {h.reason && <p className="mt-1 whitespace-pre-wrap break-words text-white/70">{h.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
