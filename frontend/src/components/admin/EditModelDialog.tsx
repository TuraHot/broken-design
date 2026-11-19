'use client';

// The one "Edit" dialog for a model: change its license, and hide or restore it. Each action takes a written
// reason that the owner receives as a notice, and each is kept in the history shown at the bottom.
import { useEffect, useState } from 'react';
import HistoryList, { type HistoryEntry } from '@/components/admin/HistoryList';
import ReasonField, { isReasonValid } from '@/components/admin/ReasonField';
import Modal from '@/components/ui/Modal';
import { fetchModelHistory, setModelHidden, setModelLicense, type AdminModel } from '@/lib/admin-api';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';

const LICENSES = ['CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL'] as const;
const FIELD = 'mt-1.5 w-full rounded-lg border border-white/15 bg-black px-3 text-sm text-white focus:border-white/50 focus:outline-none';
const SECTION = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';

export default function EditModelDialog({
  model,
  onClose,
  onLicenseChanged,
  onHiddenChanged,
}: {
  model: AdminModel;
  onClose: () => void;
  onLicenseChanged: (license: string) => void;
  onHiddenChanged: (isHidden: boolean) => void;
}) {
  const t = useT();
  const [license, setLicense] = useState<string>(LICENSES.find((l) => l !== model.license) ?? 'CC0');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRound, setHistoryRound] = useState(0);

  // Loaded when the dialog opens and again after each change, so the new entry shows at once.
  useEffect(() => {
    let cancelled = false;
    setHistoryError(null);
    fetchModelHistory(model.id)
      .then((d) => {
        if (cancelled) return;
        setHistoryError(null);
        setHistory(
          d.items.map((c) => ({
            id: c.id,
            title:
              c.kind === 'license'
                ? t('admin.history.license', { from: c.oldLicense, to: c.newLicense })
                : c.action === 'hide'
                  ? t('admin.history.hide')
                  : t('admin.history.restore'),
            // Changes to a model are always made by an admin; no admin here means that account was deleted.
            by: c.admin ? { kind: 'admin', name: c.admin.displayName } : { kind: 'removed' },
            createdAt: c.createdAt,
            reason: c.reason,
          })),
        );
      })
      .catch(() => !cancelled && setHistoryError(t('admin.history.errLoad')));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id, historyRound]);

  const valid = license !== model.license && isReasonValid(reason, true);

  const submitLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await setModelLicense(model.id, license, reason.trim());
      onLicenseChanged(res.license);
      setHistoryRound((n) => n + 1);
      setReason('');
      setLicense(LICENSES.find((l) => l !== res.license) ?? 'CC0');
    } catch (err) {
      setError(adminErrorText(err, t, 'admin.license.errFail'));
    } finally {
      setBusy(false);
    }
  };

  const [hideReason, setHideReason] = useState('');
  const [hideBusy, setHideBusy] = useState(false);
  // Hiding needs a written reason; restoring may have one.
  const requiresHideReason = !model.isHidden;
  const hideValid = isReasonValid(hideReason, requiresHideReason);

  const submitHidden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hideValid || hideBusy) return;
    setHideBusy(true);
    setError(null);
    try {
      const res = await setModelHidden(model.id, { hidden: !model.isHidden, ...(hideReason.trim() ? { reason: hideReason.trim() } : {}) });
      onHiddenChanged(res.isHidden);
      setHideReason('');
      setHistoryRound((n) => n + 1);
    } catch (err) {
      setError(adminErrorText(err, t, 'admin.errModel'));
    } finally {
      setHideBusy(false);
    }
  };

  return (
    <Modal title={t('admin.edit.title', { name: model.title })} onClose={onClose}>
      <div className="grid gap-6">
        <form onSubmit={submitLicense} noValidate className="grid gap-5" aria-labelledby="edit-license-title">
          <h3 id="edit-license-title" className={SECTION}>{t('admin.edit.licenseSection')}</h3>
          <p className="text-sm text-white/65">
            {t('admin.license.current')}: <span className="font-mono text-white">{model.license}</span>
          </p>

          <div>
            <label htmlFor="license-new" className="text-sm text-white/65">{t('admin.license.new')}</label>
            <select id="license-new" value={license} onChange={(e) => setLicense(e.target.value)} className={`${FIELD} h-10`}>
              {LICENSES.map((l) => (
                <option key={l} value={l} disabled={l === model.license}>{l}</option>
              ))}
            </select>
          </div>

          <ReasonField id="license-reason" label={t('admin.license.reason')} value={reason} onChange={setReason} required />

          <p className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">{t('admin.license.warning')}</p>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!valid || busy}
              className="h-10 rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t('admin.license.saving') : t('admin.license.submit')}
            </button>
          </div>
        </form>

        <form onSubmit={submitHidden} noValidate aria-labelledby="edit-visibility-title" className="grid gap-4 border-t border-white/10 pt-5">
          <h3 id="edit-visibility-title" className={SECTION}>{t('admin.edit.visibilitySection')}</h3>
          <p className="text-sm text-white/65">{model.isHidden ? t('admin.edit.hiddenNow') : t('admin.edit.visibleNow')}</p>

          <ReasonField
            id="hide-reason"
            label={t(model.isHidden ? 'admin.edit.restoreReason' : 'admin.license.reason')}
            value={hideReason}
            onChange={setHideReason}
            required={requiresHideReason}
            rows={3}
          />

          {!model.isHidden && (
            <p className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">{t('admin.edit.hideWarning')}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!hideValid || hideBusy}
              className="h-10 rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {hideBusy ? t('admin.license.saving') : t(model.isHidden ? 'admin.edit.restoreSubmit' : 'admin.edit.hideSubmit')}
            </button>
          </div>
        </form>

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

        <HistoryList entries={history} error={historyError} headingId="model-history-title" />

        <div className="flex justify-end border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-white/15 px-4 text-sm text-white/80 hover:border-white/40 hover:text-white"
          >
            {t('admin.edit.close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
