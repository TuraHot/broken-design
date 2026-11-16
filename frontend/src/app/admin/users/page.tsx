'use client';

// /admin/users — suspend or restore accounts
import { useEffect, useState } from 'react';
import AdminList, { type Column } from '@/components/admin/AdminList';
import { Badge, ConfirmAction } from '@/components/admin/ui';
import { AdminApiError, setUserSuspended, type AdminUser } from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { readSession } from '@/lib/session';

function buildColumns(myId: string | null): Column<AdminUser>[] {
  return [
    {
      header: 'User',
      cell: (u) => (
        <span className="block">
          <span className="block font-medium">{u.displayName}</span>
          <span className="block text-white/65">{u.email}</span>
        </span>
      ),
    },
    { header: 'Role', cell: (u) => <Badge>{u.role}</Badge> },
    { header: 'Seller', cell: (u) => <span className="text-white/65">{u.isSeller ? 'Yes' : 'No'}</span> },
    {
      header: 'Status',
      cell: (u) => (u.suspendedAt ? <Badge tone="danger">Suspended</Badge> : <Badge>Active</Badge>),
    },
    { header: 'Joined', cell: (u) => <span className="font-mono text-[13px] text-white/65">{formatDate(u.createdAt)}</span> },
    {
      header: 'Action',
      cell: (u, api) => {
        if (u.id === myId) return <span className="text-sm text-white/65">This is you</span>;
        const suspended = u.suspendedAt !== null;
        return (
          <ConfirmAction
            label={suspended ? 'Restore' : 'Suspend'}
            ariaLabel={`${suspended ? 'Restore' : 'Suspend'} ${u.displayName}`}
            onConfirm={async () => {
              api.notify(null);
              try {
                const res = await setUserSuspended(u.id, !suspended);
                api.update(u.id, (row) => ({ ...row, suspendedAt: res.suspendedAt }));
              } catch (err) {
                api.notify(err instanceof AdminApiError ? err.message : 'Could not change this account. Please try again.');
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
      label="Admin"
      heading="Users"
      searchLabel="Search name or email"
      columns={buildColumns(myId)}
    />
  );
}
