'use client';

// /admin/notifications — everything that is waiting for an admin right now (creator applications to approve, open
// complaints), newest first. Each item links to the page that handles it, and leaves the list once it is handled.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, Flag, RefreshCw, UserCheck } from 'lucide-react';
import { CATEGORY_LABELS } from '@/components/admin/ComplaintCells';
import { Badge } from '@/components/admin/ui';
import { fetchNotifications, type AdminNotificationItem, type AdminWaitingCounts } from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';

const LINK =
  'inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white';

export default function AdminNotificationsPage() {
  const t = useT();
  const [data, setData] = useState<{ counts: AdminWaitingCounts; items: AdminNotificationItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchNotifications()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((err) => !cancelled && setError(adminErrorText(err, t)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Reloaded on mount and when the admin presses Refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud">[ {t('admin.label')} ]</p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02]">{t('admin.nav.notifications')}</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-white/65">{t('admin.notif.lead')}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {data && (
          <>
            <Badge tone={data.counts.creatorApplications > 0 ? 'warn' : 'neutral'}>
              {t('admin.notif.applications', { n: data.counts.creatorApplications })}
            </Badge>
            <Badge tone={data.counts.complaints > 0 ? 'warn' : 'neutral'}>
              {t('admin.notif.complaints', { n: data.counts.complaints })}
            </Badge>
          </>
        )}
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          disabled={loading}
          className="ml-auto inline-flex h-8 items-center gap-2 rounded-lg border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white disabled:opacity-50"
        >
          <RefreshCw aria-hidden className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {t('admin.notif.refresh')}
        </button>
      </div>

      {error && !data ? (
        <div role="alert" className="mt-6 rounded-lg border border-white/10 bg-white/5 p-10 text-center">
          <p className="flex items-center justify-center gap-2 text-red-300">
            <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-6 h-9 rounded-lg bg-white px-3.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
          >
            {t('admin.tryAgain')}
          </button>
        </div>
      ) : !data ? (
        <p role="status" className="mt-6 text-sm text-white/65">{t('admin.loading')}</p>
      ) : data.items.length === 0 ? (
        <p className="mt-6 rounded-lg border border-white/10 bg-white/5 p-10 text-center text-white/65">{t('admin.notif.empty')}</p>
      ) : (
        <ul aria-busy={loading} className={`mt-6 grid gap-3 ${loading ? 'opacity-60' : ''}`}>
          {data.items.map((item) => {
            const application = item.kind === 'creator_application';
            const Icon = application ? UserCheck : Flag;
            const category = item.category && item.category in CATEGORY_LABELS ? item.category : null;
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 text-hud">
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-white">
                      {t(application ? 'admin.notif.newApplication' : 'admin.notif.newComplaint')}
                      {category && <Badge>{t(CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS])}</Badge>}
                    </p>
                    <p className="mt-0.5 break-words text-sm text-white/65">
                      {item.person.displayName} <span className="font-mono text-xs text-white/50">({item.person.email})</span>
                    </p>
                    {item.modelTitle && (
                      <p className="mt-0.5 break-words text-sm text-white/65">{t('admin.notif.aboutModel', { title: item.modelTitle })}</p>
                    )}
                    {item.text && <p className="mt-1.5 line-clamp-3 break-words text-sm text-white/80">{item.text}</p>}
                    <p className="mt-1.5 font-mono text-[12px] text-white/50">{formatDate(item.createdAt)}</p>
                  </div>
                </div>
                <Link href={application ? '/admin/creator-approvals' : '/admin/complaints'} className={LINK}>
                  {t('admin.notif.review')}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
