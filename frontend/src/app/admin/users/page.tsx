'use client';

// /admin/users — suspend or restore accounts
import { useEffect, useState } from 'react';
import AdminList, { type Column } from '@/components/admin/AdminList';
import { Badge, ConfirmAction } from '@/components/admin/ui';
import { setUserSuspended, type AdminUser } from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { readSession } from '@/lib/session';

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
      cell: (u, _api, t) => (u.suspendedAt ? <Badge tone="danger">{t('admin.suspended')}</Badge> : <Badge>{t('admin.active')}</Badge>),
    },
    { header: 'admin.col.joined', cell: (u) => <span className="font-mono text-[13px] text-white/65">{formatDate(u.createdAt)}</span> },
    {
      header: 'admin.col.action',
      cell: (u, api, t) => {
        if (u.id === myId) return <span className="text-sm text-white/65">{t('admin.you')}</span>;
        const suspended = u.suspendedAt !== null;
        const action = suspended ? t('admin.restore') : t('admin.suspend');
        return (
          <ConfirmAction
            label={action}
            ariaLabel={t('admin.actionOn', { action, name: u.displayName })}
            onConfirm={async () => {
              api.notify(null);
              try {
                const res = await setUserSuspended(u.id, !suspended);
                api.update(u.id, (row) => ({ ...row, suspendedAt: res.suspendedAt }));
              } catch (err) {
                api.notify(adminErrorText(err, t, 'admin.errAccount'));
              }
            }}
          />
        );
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
