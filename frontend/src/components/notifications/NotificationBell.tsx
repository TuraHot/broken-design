'use client';

// Bell next to the profile picture in the Navbar: a badge with the unread count and a dropdown with the latest notices.
// The count comes from AccountMenu (it already loads it on every page change); the list is loaded when the bell opens.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { fetchNotices, markAllNoticesRead, markNoticeRead, type NoticeItem } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import NoticeContent from './NoticeContent';

export default function NotificationBell({
  token,
  unread,
  onUnreadChange,
}: {
  token: string;
  unread: number;
  onUnreadChange: (n: number) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NoticeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotices(token);
      setItems(data.items);
      onUnreadChange(data.unread);
      setError(null);
    } catch {
      setError(t('notice.errLoad'));
    }
  }, [token, t, onUnreadChange]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch {
      setError(t('notice.errSave'));
    }
  };

  const label = unread > 0 ? t('bell.labelUnread', { n: unread }) : t('bell.label');
  const list = items ?? [];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
        className="relative grid h-9 w-9 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-hud"
      >
        <Bell aria-hidden className="h-5 w-5" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber px-1 font-mono text-[10px] font-semibold leading-none text-black"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-30 rounded-lg border border-white/15 bg-black/95 backdrop-blur sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/80">{t('notice.title')}</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => run(() => markAllNoticesRead(token))}
                className="text-xs text-white/65 underline underline-offset-4 hover:text-white"
              >
                {t('notice.markAll')}
              </button>
            )}
          </div>

          <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-3">
            {error && <p role="alert" className="mb-2 text-sm text-red-300">{error}</p>}
            {items && list.length === 0 && !error && (
              <p className="px-1 py-6 text-center text-sm text-white/50">{t('notice.empty')}</p>
            )}
            {!items && !error && <p className="px-1 py-6 text-center text-sm text-white/50">{t('bell.loading')}</p>}
            <ul className="grid gap-2.5">
              {list.map((n) => {
                const isNew = !n.readAt;
                return (
                  <li
                    key={n.id}
                    className={`rounded-lg border p-3 ${isNew ? 'border-amber/50 bg-white/[0.04]' : 'border-white/10 opacity-75'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                      {isNew && (
                        <span className="rounded border border-amber/50 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] text-amber">
                          {t('notice.new')}
                        </span>
                      )}
                      <time dateTime={n.createdAt}>{formatDate(n.createdAt)}</time>
                    </div>
                    <NoticeContent n={n} />
                    {isNew && (
                      <button
                        type="button"
                        onClick={() => run(() => markNoticeRead(n.id, token))}
                        className="mt-2.5 h-8 rounded-lg border border-white/15 px-3 text-sm text-white/80 hover:border-white/40 hover:text-white"
                      >
                        {t('notice.markRead')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-white/10 px-4 py-2.5 text-right">
            <Link href="/me" onClick={() => setOpen(false)} className="text-xs text-hud hover:underline">
              {t('bell.viewAll')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
