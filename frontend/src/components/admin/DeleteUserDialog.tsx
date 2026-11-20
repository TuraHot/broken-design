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
        <p className="text-sm text-white/65">
          {user.displayName} <span className="text-white/50">({user.email})</span>
        </p>

        <ReasonField
          id="delete-reason"
          label={t('admin.delete.reason')}
          hint={t('admin.delete.hint')}
          value={reason}
          onChange={setReason}
          required
        />

        <p className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">{t('admin.delete.warning')}</p>

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
            className="h-10 rounded-lg border border-red-400/70 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t('admin.license.saving') : t('admin.delete.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
