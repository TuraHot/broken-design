'use client';

// Admin dialog: suspend an account (how long + a written reason) or restore it (optional reason).
// The reason is sent to the user as a notice; the dialog never decides who may do this, the server does.
import { useEffect, useState } from 'react';
import HistoryList, { type HistoryEntry } from '@/components/admin/HistoryList';
import ReasonField, { isReasonValid } from '@/components/admin/ReasonField';
import Modal from '@/components/ui/Modal';
import { fetchSuspensions, setUserSuspended, type AdminUser } from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 365;
const FIELD = 'mt-1.5 w-full rounded-lg border border-white/15 bg-black px-3 text-sm text-white focus:border-white/50 focus:outline-none';

const DURATIONS: { value: string; label: MessageKey }[] = [
  { value: '1', label: 'admin.suspend.d1' },
  { value: '3', label: 'admin.suspend.d3' },
  { value: '7', label: 'admin.suspend.d7' },
  { value: '30', label: 'admin.suspend.d30' },
  { value: 'custom', label: 'admin.suspend.dCustom' },
  { value: 'none', label: 'admin.suspend.dNone' },
];

/** The end time to send: an ISO string, `null` for "no end", or `undefined` when the custom date is not usable. */
function endTime(duration: string, customDate: string): string | null | undefined {
  if (duration === 'none') return null;
  if (duration === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate)) return undefined;
    const ms = new Date(`${customDate}T23:59:59Z`).getTime(); // the chosen day counts as a whole day (UTC)
    if (Number.isNaN(ms) || ms <= Date.now() || ms - Date.now() > MAX_DAYS * DAY_MS) return undefined;
    return new Date(ms).toISOString();
  }
  return new Date(Date.now() + Number(duration) * DAY_MS).toISOString();
}

export default function SuspendDialog({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUser;
  onClose: () => void;
  onChanged: (change: { suspendedAt: string | null; suspendedUntil: string | null; suspensionReason: string | null }) => void;
}) {
  const t = useT();
  const restoring = user.suspendedAt !== null;
  const [duration, setDuration] = useState('7');
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSuspensions(user.id)
      .then((d) => {
        if (cancelled) return;
        setHistory(
          d.items.map((h) => ({
            id: h.id,
            title:
              h.action === 'suspend'
                ? h.until
                  ? t('admin.history.suspendUntil', { date: formatDate(h.until) })
                  : t('admin.history.suspend')
                : h.action === 'restore'
                  ? t('admin.history.restore')
                  : t('admin.history.expire'),
            // Only an expiry is automatic. Any other action with no admin means that admin's account was deleted.
            by: h.admin ? { kind: 'admin', name: h.admin.displayName } : h.action === 'expire' ? { kind: 'auto' } : { kind: 'removed' },
            createdAt: h.createdAt,
            reason: h.reason,
          })),
        );
      })
      .catch(() => !cancelled && setHistoryError(t('admin.history.errLoad')));
    return () => {
      cancelled = true;
    };
    // The history is loaded once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const until = restoring ? null : endTime(duration, customDate);
  const requiresReason = !restoring; // suspending needs one, restoring does not
  const valid = isReasonValid(reason, requiresReason) && until !== undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await setUserSuspended(user.id, {
        suspended: !restoring,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(!restoring && until ? { until } : {}),
      });
      // The reason typed here is what the server stored: show it in the row at once (and clear it on a restore).
      onChanged({ suspendedAt: res.suspendedAt, suspendedUntil: res.suspendedUntil, suspensionReason: restoring ? null : reason.trim() });
      onClose();
    } catch (err) {
      setError(adminErrorText(err, t, 'admin.errAccount'));
      setBusy(false);
    }
  };

  const minDate = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + MAX_DAYS * DAY_MS).toISOString().slice(0, 10);

  return (
    <Modal title={t(restoring ? 'admin.restore.title' : 'admin.suspend.title', { name: user.displayName })} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {!restoring && (
          <div>
            <label htmlFor="suspend-duration" className="text-sm text-white/65">{t('admin.suspend.duration')}</label>
            <select id="suspend-duration" value={duration} onChange={(e) => setDuration(e.target.value)} className={`${FIELD} h-10`}>
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{t(d.label)}</option>
              ))}
            </select>
            {duration === 'custom' && (
              <div className="mt-3">
                <label htmlFor="suspend-until" className="text-sm text-white/65">{t('admin.suspend.until')}</label>
                <input
                  id="suspend-until"
                  type="date"
                  value={customDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className={`${FIELD} h-10`}
                />
                {customDate !== '' && until === undefined && (
                  <p className="mt-1.5 text-xs text-amber">{t('admin.suspend.errDate')}</p>
                )}
              </div>
            )}
          </div>
        )}

        <ReasonField
          id="suspend-reason"
          label={t(restoring ? 'admin.restore.reason' : 'admin.suspend.reason')}
          value={reason}
          onChange={setReason}
          required={requiresReason}
        />

        {!restoring && (
          <p className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">{t('admin.suspend.warning')}</p>
        )}

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-white/15 px-4 text-sm text-white/80 hover:border-white/40 hover:text-white"
          >
            {t('admin.license.cancel')}
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="h-10 rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t('admin.license.saving') : t(restoring ? 'admin.restore.submit' : 'admin.suspend.submit')}
          </button>
        </div>
      </form>
      <div className="mt-6">
        <HistoryList entries={history} error={historyError} headingId="suspend-history-title" />
      </div>
    </Modal>
  );
}
