'use client';

// Bell next to the profile picture in the Navbar: a badge with the unread count and a dropdown with the latest notices.
// Clicking any notice closes the dropdown and opens its full detail in a centered popup/modal dialog via createPortal.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NoticeItem[] | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleSelectNotice = (n: NoticeItem) => {
    setOpen(false); // Close dropdown immediately so it doesn't stay on the right
    setSelectedNotice(n);
    if (!n.readAt) {
      void run(() => markNoticeRead(n.id, token));
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
        className="relative grid h-9 w-8 place-items-center sm:w-9 rounded-full text-ink/75 transition-colors hover:bg-ink/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
        <div className="fixed inset-x-3 top-16 z-30 rounded-lg border border-ink/15 bg-canvas/95 backdrop-blur sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/80">{t('notice.title')}</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => run(() => markAllNoticesRead(token))}
                className="text-xs text-ink/65 underline underline-offset-4 hover:text-ink"
              >
                {t('notice.markAll')}
              </button>
            )}
          </div>

          <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-3">
            {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
            {items && list.length === 0 && !error && (
              <p className="px-1 py-6 text-center text-sm text-ink/50">{t('notice.empty')}</p>
            )}
            {!items && !error && <p className="px-1 py-6 text-center text-sm text-ink/50">{t('bell.loading')}</p>}
            <ul className="grid gap-2.5">
              {list.map((n) => {
                const isNew = !n.readAt;
                return (
                  <li
                    key={n.id}
                    onClick={() => handleSelectNotice(n)}
                    className={`group cursor-pointer rounded-lg border p-3 transition-colors ${
                      isNew
                        ? 'border-warn/50 bg-ink/[0.04] hover:bg-ink/[0.08]'
                        : 'border-line opacity-75 hover:opacity-100 hover:bg-ink/[0.03]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/50">
                      <div className="flex items-center gap-2">
                        {isNew && (
                          <span className="rounded border border-warn/50 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] text-warn">
                            {t('notice.new')}
                          </span>
                        )}
                        <time dateTime={n.createdAt}>{formatDate(n.createdAt)}</time>
                      </div>
                      <span className="text-[11px] font-mono opacity-0 group-hover:opacity-80 text-accent transition-opacity">
                        View &rarr;
                      </span>
                    </div>
                    <NoticeContent n={n} />
                    {isNew && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          run(() => markNoticeRead(n.id, token));
                        }}
                        className="mt-2.5 h-8 rounded-lg border border-ink/15 px-3 text-sm text-ink/80 hover:border-ink/40 hover:text-ink"
                      >
                        {t('notice.markRead')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Centered Modal / Pop-up mounted directly to document.body via Portal */}
      {mounted && selectedNotice && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('notice.title')}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedNotice(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-line bg-canvas p-6 shadow-2xl text-ink animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-accent">
                  {t('notice.title')}
                </span>
                {!selectedNotice.readAt && (
                  <span className="rounded border border-warn/50 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warn">
                    {t('notice.new')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                aria-label={t('modal.close')}
                className="rounded p-1 text-ink/50 hover:bg-ink/10 hover:text-ink transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <time className="block text-xs font-mono text-ink/50" dateTime={selectedNotice.createdAt}>
                {formatDate(selectedNotice.createdAt)}
              </time>
              <div className="rounded-xl border border-line bg-ink/[0.03] p-4 text-ink leading-relaxed">
                <NoticeContent n={selectedNotice} />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="h-9 rounded-lg bg-ink px-4 text-xs font-medium text-canvas hover:bg-ink/85 transition-colors"
              >
                {t('modal.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
