'use client';

// /admin/creator-approvals — people who asked to become creators (pending first, with the ones already handled), and the
// invite codes that make someone a creator at once. The API re-checks the admin role on every call.
import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Badge, ConfirmAction } from '@/components/admin/ui';
import {
  createInviteCode,
  fetchCreatorApplications,
  fetchInviteCodes,
  reviewCreatorApplication,
  type AdminCreatorApplication,
  type AdminInviteCode,
  type CreatorApplicationStatus,
} from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';

type Filter = CreatorApplicationStatus | 'all';

const FILTERS: { value: Filter; label: MessageKey }[] = [
  { value: 'pending', label: 'admin.ca.status.pending' },
  { value: 'approved', label: 'admin.ca.status.approved' },
  { value: 'rejected', label: 'admin.ca.status.rejected' },
  { value: 'all', label: 'admin.status.all' },
];

const STATUS_LABEL: Record<CreatorApplicationStatus, MessageKey> = {
  pending: 'admin.ca.status.pending',
  approved: 'admin.ca.status.approved',
  rejected: 'admin.ca.status.rejected',
};

const BTN =
  'h-8 whitespace-nowrap rounded-lg border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export default function AdminCreatorApprovalsPage() {
  const t = useT();
  const [filter, setFilter] = useState<Filter>('pending');
  const [apps, setApps] = useState<AdminCreatorApplication[] | null>(null);
  const [codes, setCodes] = useState<AdminInviteCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setApps(null);
    fetchCreatorApplications(filter)
      .then((d) => {
        if (cancelled) return;
        setApps(d.applications);
        setError(null);
      })
      .catch((err) => !cancelled && setError(adminErrorText(err, t)));
    return () => {
      cancelled = true;
    };
    // Reloaded when the filter changes or the admin presses Try again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, attempt]);

  useEffect(() => {
    let cancelled = false;
    fetchInviteCodes()
      .then((d) => !cancelled && setCodes(d.codes))
      .catch(() => !cancelled && setCodes([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const review = async (app: AdminCreatorApplication, status: 'approved' | 'rejected') => {
    if (busyId) return;
    setBusyId(app.id);
    setNotice(null);
    try {
      await reviewCreatorApplication(app.id, status);
      // A handled application leaves the "pending" list at once; in the other lists its status changes in place.
      setApps((prev) =>
        prev
          ? filter === 'pending'
            ? prev.filter((a) => a.id !== app.id)
            : prev.map((a) => (a.id === app.id ? { ...a, status, reviewedAt: new Date().toISOString() } : a))
          : prev,
      );
      setNotice(t(status === 'approved' ? 'admin.ca.doneApproved' : 'admin.ca.doneRejected', { name: app.displayName }));
    } catch (err) {
      setNotice(adminErrorText(err, t, 'admin.ca.errReview'));
    } finally {
      setBusyId(null);
    }
  };

  const generate = async () => {
    if (creatingCode) return;
    setCreatingCode(true);
    setNotice(null);
    try {
      const d = await createInviteCode(1);
      setCodes((prev) => [d.code, ...(prev ?? [])]);
    } catch (err) {
      setNotice(adminErrorText(err, t, 'admin.ca.errCode'));
    } finally {
      setCreatingCode(false);
    }
  };

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">[ {t('admin.label')} ]</p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02]">{t('admin.nav.creatorApprovals')}</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-ink-soft">{t('admin.ca.lead')}</p>

      <div role="status" className="mt-4 min-h-5 text-sm text-accent">{notice}</div>

      <div role="group" aria-label={t('admin.statusLabel')} className="mt-2 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`${BTN} ${
              filter === f.value ? 'border-ink bg-ink text-canvas' : 'border-line text-ink/80 hover:border-ink/40 hover:text-ink'
            }`}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {error && !apps ? (
        <div role="alert" className="mt-6 rounded-lg border border-line bg-ink/5 p-10 text-center">
          <p className="flex items-center justify-center gap-2 text-danger">
            <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-6 h-9 rounded-lg bg-ink px-3.5 text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85"
          >
            {t('admin.tryAgain')}
          </button>
        </div>
      ) : !apps ? (
        <p role="status" className="mt-6 text-sm text-ink-soft">{t('admin.loading')}</p>
      ) : apps.length === 0 ? (
        <p className="mt-6 rounded-lg border border-line bg-ink/5 p-10 text-center text-ink-soft">{t('admin.ca.empty')}</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {apps.map((app) => (
            <li
              key={app.id}
              className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-ink/5 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {app.displayName}
                  <Badge tone={app.status === 'pending' ? 'warn' : 'neutral'}>{t(STATUS_LABEL[app.status])}</Badge>
                </p>
                <p className="break-all font-mono text-xs text-ink/55">{app.email}</p>
                <p className="mt-1.5 break-words text-sm text-ink/80">{app.note || <span className="text-ink/45">{t('admin.ca.noNote')}</span>}</p>
                <p className="mt-1.5 font-mono text-[12px] text-ink/50">
                  {t('admin.ca.applied', { date: formatDate(app.createdAt) })}
                  {app.reviewedAt && ` · ${t('admin.ca.reviewed', { date: formatDate(app.reviewedAt) })}`}
                </p>
                {app.adminNote && <p className="mt-1 break-words text-xs text-ink/50">{app.adminNote}</p>}
              </div>
              {app.status === 'pending' && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === app.id}
                    onClick={() => review(app, 'approved')}
                    aria-label={t('admin.actionOn', { action: t('admin.ca.approve'), name: app.displayName })}
                    className={`${BTN} border-ink bg-ink font-medium text-canvas hover:bg-ink/85`}
                  >
                    {t('admin.ca.approve')}
                  </button>
                  <ConfirmAction
                    label={t('admin.ca.reject')}
                    ariaLabel={t('admin.actionOn', { action: t('admin.ca.reject'), name: app.displayName })}
                    disabled={busyId === app.id}
                    onConfirm={() => review(app, 'rejected')}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 rounded-lg border border-line bg-ink/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{t('admin.ca.codes.title')}</h2>
            <p className="mt-1.5 max-w-[60ch] text-sm text-ink-soft">{t('admin.ca.codes.lead')}</p>
          </div>
          <button
            type="button"
            disabled={creatingCode}
            onClick={generate}
            className={`${BTN} border-accent/40 bg-accent/10 font-mono text-xs uppercase tracking-wider text-accent hover:bg-accent/20`}
          >
            {creatingCode ? t('admin.working') : t('admin.ca.codes.generate')}
          </button>
        </div>
        {codes && codes.length === 0 ? (
          <p className="mt-4 text-sm text-ink/50">{t('admin.ca.codes.empty')}</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {(codes ?? []).slice(0, 12).map((c) => (
              <li key={c.id} className="rounded-md border border-line bg-canvas/60 px-2.5 py-1 font-mono text-xs text-ink/85">
                <span className="select-all">{c.code}</span>{' '}
                <span className="text-ink/50">{t('admin.ca.codes.uses', { used: c.usedCount, max: c.maxUses })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
