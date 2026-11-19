'use client';

// The "Message" cell of the /admin/complaints table: a short preview and a button that opens the whole
// complaint in a dialog, where the admin can read it and respond (status, note, hide the model).
import { useState } from 'react';
import type { RowApi } from './AdminList';
import { Badge, ConfirmAction } from './ui';
import Modal from '@/components/ui/Modal';
import {
  setModelHidden,
  updateComplaint,
  type AdminComplaint,
  type ComplaintCategory,
  type ComplaintStatus,
} from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';

/** Text keys of the status and category names; translate them with `t(...)`. */
export const STATUS_LABELS: Record<ComplaintStatus, MessageKey> = {
  open: 'admin.status.open',
  in_review: 'admin.status.in_review',
  resolved: 'admin.status.resolved',
  dismissed: 'admin.status.dismissed',
};

export const CATEGORY_LABELS: Record<ComplaintCategory, MessageKey> = {
  model: 'admin.cat.model',
  account: 'admin.cat.account',
  purchase: 'admin.cat.purchase',
  other: 'admin.cat.other',
};

const BTN = 'h-9 whitespace-nowrap rounded-lg border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-white/65';

export function ComplaintMessage({ row, api }: { row: AdminComplaint; api: RowApi<AdminComplaint> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-[220px] max-w-sm">
      <p className="line-clamp-2 break-words text-white/80">{row.message}</p>
      <button type="button" onClick={() => setOpen(true)} className={`${BTN} mt-2`}>
        {t('admin.readRespond')}
      </button>
      {open && (
        <Modal title={t('admin.complaint')} size="lg" onClose={() => setOpen(false)}>
          <ComplaintDetails row={row} api={api} />
        </Modal>
      )}
    </div>
  );
}

function ComplaintDetails({ row, api }: { row: AdminComplaint; api: RowApi<AdminComplaint> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(row.adminNote ?? '');
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>, fallback: MessageKey) => {
    setError(null);
    setBusy(true);
    try {
      await task();
    } catch (err) {
      setError(adminErrorText(err, t, fallback));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: ComplaintStatus) =>
    run(async () => {
      const res = await updateComplaint(row.id, status);
      api.update(row.id, (r) => ({ ...r, status: res.status, handledAt: res.handledAt }));
    }, 'admin.errStatus');

  const saveNote = () =>
    run(async () => {
      const res = await updateComplaint(row.id, row.status, note);
      api.update(row.id, (r) => ({ ...r, adminNote: res.adminNote }));
    }, 'admin.errNote');

  const noteChanged = note.trim() !== (row.adminNote ?? '');

  return (
    <div className="grid gap-6">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className={LABEL}>{t('admin.col.from')}</dt>
          <dd className="mt-1">
            <span className="block font-medium">{row.reporter.displayName}</span>
            <span className="block break-all text-white/65">{row.reporter.email}</span>
          </dd>
        </div>
        <div>
          <dt className={LABEL}>{t('admin.sent')}</dt>
          <dd className="mt-1 font-mono text-[13px] text-white/80">{formatDate(row.createdAt)}</dd>
        </div>
        <div>
          <dt className={LABEL}>{t('admin.type')}</dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            <Badge>{t(CATEGORY_LABELS[row.category])}</Badge>
            <Badge tone={row.status === 'open' ? 'warn' : 'neutral'}>{t(STATUS_LABELS[row.status])}</Badge>
          </dd>
        </div>
        {row.model && (
          <div>
            <dt className={LABEL}>{t('admin.reportedModel')}</dt>
            <dd className="mt-1">
              <span className="block text-white">{row.model.title}</span>
              {row.owner && <span className="block text-white/65">{t('admin.by', { name: row.owner.displayName })}</span>}
              <span className="mt-1 flex flex-wrap gap-2">
                {row.model.isHidden && <Badge tone="warn">{t('admin.hidden')}</Badge>}
                {row.owner?.isSuspended && <Badge tone="danger">{t('admin.ownerSuspended')}</Badge>}
              </span>
            </dd>
          </div>
        )}
      </dl>

      <section aria-labelledby={`msg-${row.id}`}>
        <h3 id={`msg-${row.id}`} className={LABEL}>{t('admin.col.message')}</h3>
        <p className="mt-2 max-h-[40dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-white/5 p-4 text-[15px] leading-relaxed text-white/90">
          {row.message}
        </p>
      </section>

      <section aria-labelledby={`resp-${row.id}`} className="grid gap-4 border-t border-white/10 pt-5">
        <h3 id={`resp-${row.id}`} className={LABEL}>{t('admin.yourResponse')}</h3>

        <div className="grid gap-1.5">
          <label htmlFor={`status-${row.id}`} className="text-sm text-white/65">{t('admin.statusLabel')}</label>
          <select
            id={`status-${row.id}`}
            value={row.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value as ComplaintStatus)}
            className="h-10 rounded-lg border border-white/15 bg-black px-3 text-sm text-white focus:border-white/50 focus:outline-none disabled:opacity-40"
          >
            {(Object.keys(STATUS_LABELS) as ComplaintStatus[]).map((s) => (
              <option key={s} value={s}>{t(STATUS_LABELS[s])}</option>
            ))}
          </select>
          {row.handledAt && (
            <p className="text-sm text-white/65">
              {row.handledByName
                ? t('admin.lastHandledBy', { date: formatDate(row.handledAt), name: row.handledByName })
                : t('admin.lastHandled', { date: formatDate(row.handledAt) })}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor={`note-${row.id}`} className="text-sm text-white/65">{t('admin.noteLabel')}</label>
          <textarea
            id={`note-${row.id}`}
            value={note}
            maxLength={1000}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('admin.notePlaceholder')}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none"
          />
          <div>
            <button type="button" disabled={busy || !noteChanged} onClick={saveNote} className={BTN}>
              {busy ? t('admin.saving') : t('admin.saveNote')}
            </button>
          </div>
        </div>

        {row.model && (
          <div className="grid gap-1.5">
            <span className="text-sm text-white/65">{t('admin.reportedModel')}</span>
            <div>
              <ConfirmAction
                label={row.model.isHidden ? t('admin.restoreModel') : t('admin.hideModel')}
                ariaLabel={t('admin.actionOn', { action: row.model.isHidden ? t('admin.restore') : t('admin.hide'), name: row.model.title })}
                onConfirm={async () => {
                  setError(null);
                  try {
                    const res = await setModelHidden(row.model!.id, !row.model!.isHidden);
                    api.update(row.id, (r) => (r.model ? { ...r, model: { ...r.model, isHidden: res.isHidden } } : r));
                  } catch (err) {
                    setError(adminErrorText(err, t, 'admin.errModel'));
                  }
                }}
              />
            </div>
          </div>
        )}

        <p role="status" className="min-h-5 text-sm text-amber">{error}</p>
      </section>
    </div>
  );
}
