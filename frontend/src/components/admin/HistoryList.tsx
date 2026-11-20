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
    <section aria-labelledby={headingId} className="grid gap-3 border-t border-line pt-5">
      <h3 id={headingId} className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{t('admin.history.title')}</h3>
      {error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : entries === null ? (
        <p role="status" className="text-sm text-ink-soft">{t('admin.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink-soft">{t('admin.history.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((h) => (
            <li key={h.id} className="rounded-lg border border-line bg-ink/5 px-3 py-2 text-sm">
              <p className="flex flex-wrap items-center gap-x-2 text-ink">
                <span className="font-medium">{h.title}</span>
                <span className="text-xs text-ink/50">
                  {formatDateTime(h.createdAt)} ·{' '}
                  {h.by.kind === 'admin'
                    ? t('admin.history.by', { name: h.by.name })
                    : h.by.kind === 'auto'
                      ? t('admin.history.auto')
                      : t('admin.history.removed')}
                </span>
              </p>
              {h.reason && <p className="mt-1 whitespace-pre-wrap break-words text-ink/70">{h.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
