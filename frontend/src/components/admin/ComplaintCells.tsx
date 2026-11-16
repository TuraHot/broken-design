'use client';

// The "Message" cell of the /admin/complaints table: a short preview and a button that opens the whole
// complaint in a dialog, where the admin can read it and respond (status, note, hide the model).
import { useState } from 'react';
import type { RowApi } from './AdminList';
import { Badge, ConfirmAction } from './ui';
import Modal from '@/components/ui/Modal';
import {
  AdminApiError,
  setModelHidden,
  updateComplaint,
  type AdminComplaint,
  type ComplaintCategory,
  type ComplaintStatus,
} from '@/lib/admin-api';
import { formatDate } from '@/lib/format';

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  model: 'Model',
  account: 'Account / person',
  purchase: 'Purchase',
  other: 'Other',
};

const BTN = 'h-9 whitespace-nowrap rounded-lg border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-white/65';

export function ComplaintMessage({ row, api }: { row: AdminComplaint; api: RowApi<AdminComplaint> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-[220px] max-w-sm">
      <p className="line-clamp-2 break-words text-white/80">{row.message}</p>
      <button type="button" onClick={() => setOpen(true)} className={`${BTN} mt-2`}>
        Read &amp; respond
      </button>
      {open && (
        <Modal title="Complaint" size="lg" onClose={() => setOpen(false)}>
          <ComplaintDetails row={row} api={api} />
        </Modal>
      )}
    </div>
  );
}

function ComplaintDetails({ row, api }: { row: AdminComplaint; api: RowApi<AdminComplaint> }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(row.adminNote ?? '');
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>, fallback: string) => {
    setError(null);
    setBusy(true);
    try {
      await task();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: ComplaintStatus) =>
    run(async () => {
      const res = await updateComplaint(row.id, status);
      api.update(row.id, (r) => ({ ...r, status: res.status, handledAt: res.handledAt }));
    }, 'Could not change the status. Please try again.');

  const saveNote = () =>
    run(async () => {
      const res = await updateComplaint(row.id, row.status, note);
      api.update(row.id, (r) => ({ ...r, adminNote: res.adminNote }));
    }, 'Could not save the note. Please try again.');

  const noteChanged = note.trim() !== (row.adminNote ?? '');

  return (
    <div className="grid gap-6">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className={LABEL}>From</dt>
          <dd className="mt-1">
            <span className="block font-medium">{row.reporter.displayName}</span>
            <span className="block break-all text-white/65">{row.reporter.email}</span>
          </dd>
        </div>
        <div>
          <dt className={LABEL}>Sent</dt>
          <dd className="mt-1 font-mono text-[13px] text-white/80">{formatDate(row.createdAt)}</dd>
        </div>
        <div>
          <dt className={LABEL}>Type</dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            <Badge>{CATEGORY_LABELS[row.category]}</Badge>
            <Badge tone={row.status === 'open' ? 'warn' : 'neutral'}>{STATUS_LABELS[row.status]}</Badge>
          </dd>
        </div>
        {row.model && (
          <div>
            <dt className={LABEL}>Reported model</dt>
            <dd className="mt-1">
              <span className="block text-white">{row.model.title}</span>
              {row.owner && <span className="block text-white/65">by {row.owner.displayName}</span>}
              <span className="mt-1 flex flex-wrap gap-2">
                {row.model.isHidden && <Badge tone="warn">Hidden</Badge>}
                {row.owner?.isSuspended && <Badge tone="danger">Owner suspended</Badge>}
              </span>
            </dd>
          </div>
        )}
      </dl>

      <section aria-labelledby={`msg-${row.id}`}>
        <h3 id={`msg-${row.id}`} className={LABEL}>Message</h3>
        <p className="mt-2 max-h-[40dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-white/5 p-4 text-[15px] leading-relaxed text-white/90">
          {row.message}
        </p>
      </section>

      <section aria-labelledby={`resp-${row.id}`} className="grid gap-4 border-t border-white/10 pt-5">
        <h3 id={`resp-${row.id}`} className={LABEL}>Your response</h3>

        <div className="grid gap-1.5">
          <label htmlFor={`status-${row.id}`} className="text-sm text-white/65">Status</label>
          <select
            id={`status-${row.id}`}
            value={row.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value as ComplaintStatus)}
            className="h-10 rounded-lg border border-white/15 bg-black px-3 text-sm text-white focus:border-white/50 focus:outline-none disabled:opacity-40"
          >
            {(Object.keys(STATUS_LABELS) as ComplaintStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {row.handledAt && (
            <p className="text-sm text-white/65">
              Last handled {formatDate(row.handledAt)}
              {row.handledByName ? ` by ${row.handledByName}` : ''}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor={`note-${row.id}`} className="text-sm text-white/65">Admin note (only admins see it)</label>
          <textarea
            id={`note-${row.id}`}
            value={note}
            maxLength={1000}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you decide, and why?"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none"
          />
          <div>
            <button type="button" disabled={busy || !noteChanged} onClick={saveNote} className={BTN}>
              {busy ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>

        {row.model && (
          <div className="grid gap-1.5">
            <span className="text-sm text-white/65">Reported model</span>
            <div>
              <ConfirmAction
                label={row.model.isHidden ? 'Restore model' : 'Hide model'}
                ariaLabel={`${row.model.isHidden ? 'Restore' : 'Hide'} ${row.model.title}`}
                onConfirm={async () => {
                  setError(null);
                  try {
                    const res = await setModelHidden(row.model!.id, !row.model!.isHidden);
                    api.update(row.id, (r) => (r.model ? { ...r, model: { ...r.model, isHidden: res.isHidden } } : r));
                  } catch (err) {
                    setError(err instanceof AdminApiError ? err.message : 'Could not change this model. Please try again.');
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
