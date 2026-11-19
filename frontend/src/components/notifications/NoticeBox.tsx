'use client';

// The owner's notices (for example "an admin changed the license of your model, and why") on the seller dashboard.
import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { fetchNotices, markAllNoticesRead, markNoticeRead, type NoticeItem } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import NoticeContent from './NoticeContent';

export default function NoticeBox({ token }: { token: string }) {
  const t = useT();
  const [items, setItems] = useState<NoticeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotices(token);
      setItems(data.items);
      setError(null);
    } catch {
      setError(t('notice.errLoad'));
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch {
      setError(t('notice.errSave'));
    }
  };

  // Nothing to show: no box, so a seller without notices sees no extra space.
  if (!error && (!items || items.length === 0)) return null;

  const unread = (items ?? []).filter((n) => !n.readAt);

  return (
    <section aria-labelledby="notices-title" className="mb-6 rounded-lg border border-amber/40 bg-amber/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="notices-title" className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber">
          <BellRing aria-hidden className="h-4 w-4" />
          {t('notice.title')}
          {unread.length > 0 && <span>· {t('notice.unread', { n: unread.length })}</span>}
        </h2>
        {unread.length > 1 && (
          <button
            type="button"
            onClick={() => run(() => markAllNoticesRead(token))}
            className="text-sm text-white/65 underline underline-offset-4 hover:text-white"
          >
            {t('notice.markAll')}
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}

      <ul className="mt-3 grid gap-3">
        {(items ?? []).map((n) => {
          const isNew = !n.readAt;
          return (
            <li key={n.id} className={`rounded-lg border p-3 sm:p-4 ${isNew ? 'border-amber/50 bg-black/40' : 'border-white/10 bg-black/20 opacity-75'}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                {isNew && <span className="rounded border border-amber/50 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] text-amber">{t('notice.new')}</span>}
                <time dateTime={n.createdAt}>{formatDate(n.createdAt)}</time>
              </div>
              <NoticeContent n={n} />
              {isNew && (
                <button
                  type="button"
                  onClick={() => run(() => markNoticeRead(n.id, token))}
                  className="mt-3 h-8 rounded-lg border border-white/15 px-3 text-sm text-white/80 hover:border-white/40 hover:text-white"
                >
                  {t('notice.markRead')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
