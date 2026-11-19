'use client';

// /admin/users — suspend or restore accounts
import { useEffect, useState } from 'react';
import AdminList, { type Column, type RowApi } from '@/components/admin/AdminList';
import SuspendDialog from '@/components/admin/SuspendDialog';
import { Badge } from '@/components/admin/ui';
import type { AdminUser } from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import { readSession } from '@/lib/session';

// One button per row. It opens the dialog where the admin picks how long and writes the reason.
function SuspendAction({ user, api }: { user: AdminUser; api: RowApi<AdminUser> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const action = user.suspendedAt !== null ? t('admin.restore') : t('admin.suspend');
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('admin.actionOn', { action, name: user.displayName })}
        className="h-8 whitespace-nowrap rounded-lg border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white"
      >
        {action}
      </button>
      {open && (
        <SuspendDialog
          user={user}
          onClose={() => setOpen(false)}
          onChanged={(change) => api.update(user.id, (row) => ({ ...row, ...change }))}
        />
      )}
    </>
  );
}

function buildColumns(myId: string | null): Column<AdminUser>[] {
  return [
    {
      header: 'admin.col.user',
      cell: (u) => (
        <span className="block">
          <span className="block font-medium">{u.displayName}</span>
          <span className="block text-white/65">{u.email}</span>
        </span>
      ),
    },
    { header: 'admin.col.role', cell: (u) => <Badge>{u.role}</Badge> },
    { header: 'admin.col.seller', cell: (u, _api, t) => <span className="text-white/65">{u.isSeller ? t('admin.yesWord') : t('admin.noWord')}</span> },
    {
      header: 'admin.col.status',
      cell: (u, _api, t) =>
        u.suspendedAt ? (
          <span className="flex flex-col items-start gap-1">
            <Badge tone="danger">{t('admin.suspended')}</Badge>
            <span className="text-xs text-white/65">
              {u.suspendedUntil ? t('admin.suspendedUntil', { date: formatDate(u.suspendedUntil) }) : t('admin.suspendedNoEnd')}
            </span>
            {u.suspensionReason && (
              <span title={u.suspensionReason} className="line-clamp-2 max-w-[28ch] break-words text-xs text-white/50">
                {u.suspensionReason}
              </span>
            )}
          </span>
        ) : (
          <Badge>{t('admin.active')}</Badge>
        ),
    },
    { header: 'admin.col.joined', cell: (u) => <span className="font-mono text-[13px] text-white/65">{formatDate(u.createdAt)}</span> },
    {
      header: 'admin.col.action',
      cell: (u, api, t) => {
        if (u.id === myId) return <span className="text-sm text-white/65">{t('admin.you')}</span>;
        // An admin account cannot be suspended (the server refuses too); one suspended earlier can still be restored.
        if (u.role === 'admin' && u.suspendedAt === null) return <span title={t('admin.noAdminSuspend')} className="text-sm text-white/40">—</span>;
        return <SuspendAction user={u} api={api} />;
      },
    },
  ];
}

export default function AdminUsersPage() {
  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => setMyId(readSession()?.user.id ?? null), []);

  return (
    <AdminList<AdminUser>
      path="/users"
      heading="admin.nav.users"
      searchLabel="admin.search.users"
      columns={buildColumns(myId)}
    />
  );
}
