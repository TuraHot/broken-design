'use client';

// The "Edit" dialog for a model, as a short guided flow instead of one long form:
//   1. choose what to do (change the license, or hide / restore the model),
//   2. fill in only what that action needs (pick the new license, then the written reason),
//   3. confirm. The reason is what the owner reads in a notice; every change is kept in the history shown at the bottom.
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Eye, EyeOff, Scale } from 'lucide-react';
import HistoryList, { type HistoryEntry } from '@/components/admin/HistoryList';
import ReasonField, { isReasonValid } from '@/components/admin/ReasonField';
import Modal from '@/components/ui/Modal';
import { fetchModelHistory, setModelHidden, setModelLicense, type AdminModel } from '@/lib/admin-api';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';

const LICENSES = ['CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL'] as const;
const SECTION = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';
const PRIMARY =
  'h-10 rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY = 'h-10 rounded-lg border border-white/15 px-4 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white';

type Step = 'menu' | 'license' | 'visibility';

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
  const [step, setStep] = useState<Step>('menu');
  const [license, setLicense] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

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

  const goTo = (next: Step) => {
    setStep(next);
    setReason('');
    setLicense(null);
    setError(null);
    if (next !== 'menu') setDone(null);
  };

  // Hiding needs a written reason; restoring may have one.
  const requiresReason = step === 'license' || !model.isHidden;
  const canSubmit = !busy && isReasonValid(reason, requiresReason) && (step !== 'license' || (license !== null && license !== model.license));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (step === 'license' && license) {
        const res = await setModelLicense(model.id, license, reason.trim());
        onLicenseChanged(res.license);
        setDone(t('admin.edit.doneLicense', { license: res.license }));
      } else {
        const res = await setModelHidden(model.id, { hidden: !model.isHidden, ...(reason.trim() ? { reason: reason.trim() } : {}) });
        onHiddenChanged(res.isHidden);
        setDone(t(res.isHidden ? 'admin.edit.doneHidden' : 'admin.edit.doneRestored'));
      }
      setHistoryRound((n) => n + 1);
      setStep('menu');
      setReason('');
      setLicense(null);
    } catch (err) {
      setError(adminErrorText(err, t, step === 'license' ? 'admin.license.errFail' : 'admin.errModel'));
    } finally {
      setBusy(false);
    }
  };

  const menuButton = (Icon: typeof Scale, title: string, desc: string, next: Step) => (
    <button
      type="button"
      onClick={() => goTo(next)}
      className="flex w-full items-center gap-4 rounded-lg border border-white/15 bg-white/5 p-4 text-left transition-colors hover:border-white/40 hover:bg-white/10"
    >
      <Icon aria-hidden className="h-5 w-5 shrink-0 text-white/80" />
      <span className="grid flex-1 gap-0.5">
        <span className="text-[15px] font-medium text-white">{title}</span>
        <span className="text-sm text-white/65">{desc}</span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/50" />
    </button>
  );

  return (
    <Modal title={t('admin.edit.title', { name: model.title })} onClose={onClose}>
      <div className="grid gap-6">
        {step === 'menu' && (
          <section aria-labelledby="edit-choose-title" className="grid gap-3">
            <h3 id="edit-choose-title" className={SECTION}>{t('admin.edit.choose')}</h3>
            {done && <p role="status" className="rounded-lg border border-hud/40 bg-hud/10 px-3 py-2 text-sm text-hud">{done}</p>}
            {menuButton(
              Scale,
              t('admin.edit.menuLicense'),
              t('admin.edit.menuLicenseDesc', { license: model.license }),
              'license',
            )}
            {model.isHidden
              ? menuButton(Eye, t('admin.edit.menuRestore'), t('admin.edit.menuRestoreDesc'), 'visibility')
              : menuButton(EyeOff, t('admin.edit.menuHide'), t('admin.edit.menuHideDesc'), 'visibility')}
          </section>
        )}

        {step !== 'menu' && (
          <form onSubmit={submit} noValidate className="grid gap-5" aria-labelledby="edit-step-title">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => goTo('menu')} disabled={busy} aria-label={t('admin.edit.back')} className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-white/80 hover:border-white/40 hover:text-white disabled:opacity-50">
                <ArrowLeft aria-hidden className="h-4 w-4" />
              </button>
              <h3 id="edit-step-title" className={SECTION}>
                {t(step === 'license' ? 'admin.edit.menuLicense' : model.isHidden ? 'admin.edit.menuRestore' : 'admin.edit.menuHide')}
              </h3>
            </div>

            {step === 'license' && (
              <fieldset className="grid gap-2">
                <legend className="text-sm text-white/65">
                  {t('admin.license.current')}: <span className="font-mono text-white">{model.license}</span>. {t('admin.edit.pickLicense')}
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {LICENSES.filter((l) => l !== model.license).map((l) => (
                    <label
                      key={l}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        license === l ? 'border-white bg-white/10 text-white' : 'border-white/15 text-white/80 hover:border-white/40'
                      }`}
                    >
                      <input type="radio" name="license-new" value={l} checked={license === l} onChange={() => setLicense(l)} className="accent-white" />
                      <span className="font-mono">{l}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {/* The reason comes after the choice: nothing to explain until a license is picked. */}
            {(step === 'visibility' || license !== null) && (
              <>
                <ReasonField
                  id="edit-reason"
                  label={t(step === 'visibility' && model.isHidden ? 'admin.edit.restoreReason' : 'admin.license.reason')}
                  value={reason}
                  onChange={setReason}
                  required={requiresReason}
                  rows={step === 'license' ? 4 : 3}
                />
                <p className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">
                  {t(step === 'license' ? 'admin.license.warning' : model.isHidden ? 'admin.edit.restoreWarning' : 'admin.edit.hideWarning')}
                </p>
              </>
            )}

            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => goTo('menu')} disabled={busy} className={SECONDARY}>{t('admin.edit.back')}</button>
              <button type="submit" disabled={!canSubmit} className={PRIMARY}>
                {busy
                  ? t('admin.license.saving')
                  : t(step === 'license' ? 'admin.license.submit' : model.isHidden ? 'admin.edit.restoreSubmit' : 'admin.edit.hideSubmit')}
              </button>
            </div>
          </form>
        )}

        {step === 'menu' && (
          <>
            <HistoryList entries={history} error={historyError} headingId="model-history-title" />
            <div className="flex justify-end border-t border-white/10 pt-4">
              <button type="button" onClick={onClose} className={SECONDARY}>{t('admin.edit.close')}</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
