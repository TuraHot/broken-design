'use client';

// Admin dialog: delete an account. The account is closed for good but everything it did stays as history, and its email
// can be used to sign up again as a new, separate account. A written reason is required and kept with the account.
// The dialog never decides who may do this, the server does (not admins, not yourself).
import { useState } from 'react';
import ReasonField, { isReasonValid } from '@/components/admin/ReasonField';
import Modal from '@/components/ui/Modal';
import { deleteUser, type AdminUser } from '@/lib/admin-api';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';

export default function DeleteUserDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  onClose: () => void;
  /** Called with the reason the server stored, so the row can show "Deleted" at once. */
  onDeleted: (reason: string) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isReasonValid(reason, true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteUser(user.id, reason.trim());
      onDeleted(reason.trim());
      onClose();
    } catch (err) {
      setError(adminErrorText(err, t, 'admin.errDelete'));
      setBusy(false);
    }
  };

  return (
    <Modal title={t('admin.delete.title', { name: user.displayName })} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-5">
        <p className="text-sm text-ink-soft">
          {user.displayName} <span className="text-ink/50">({user.email})</span>
        </p>

        <ReasonField
          id="delete-reason"
          label={t('admin.delete.reason')}
          hint={t('admin.delete.hint')}
          value={reason}
          onChange={setReason}
          required
        />

        <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">{t('admin.delete.warning')}</p>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-line px-4 text-sm text-ink/80 hover:border-ink/40 hover:text-ink"
          >
            {t('admin.license.cancel')}
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="h-10 rounded-lg border border-danger/70 px-4 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t('admin.license.saving') : t('admin.delete.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
