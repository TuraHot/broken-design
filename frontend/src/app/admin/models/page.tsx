'use client';

// /admin/models — every model, including hidden and deleted ones
import AdminList, { type Column } from '@/components/admin/AdminList';
import { Badge, ConfirmAction } from '@/components/admin/ui';
import { AdminApiError, setModelHidden, type AdminModel } from '@/lib/admin-api';
import { formatDate, formatMoney } from '@/lib/format';

const COLUMNS: Column<AdminModel>[] = [
  {
    header: 'Model',
    cell: (m) => <span className="font-medium text-white">{m.title}</span>,
  },
  {
    header: 'Owner',
    cell: (m) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-white/80">{m.owner.displayName}</span>
        {m.owner.isSuspended && <Badge tone="danger">Suspended</Badge>}
      </span>
    ),
  },
  { header: 'License', cell: (m) => <span className="text-white/65">{m.license}</span> },
  { header: 'Price', cell: (m) => <span className="text-white/65">{m.priceCents === 0 ? 'Free' : formatMoney(m.priceCents, m.currency)}</span> },
  {
    header: 'Status',
    cell: (m) => (
      <span className="flex flex-wrap gap-2">
        {m.isDeleted && <Badge>Deleted</Badge>}
        {m.isHidden ? <Badge tone="warn">Hidden</Badge> : !m.isDeleted && <Badge>Visible</Badge>}
      </span>
    ),
  },
  { header: 'Created', cell: (m) => <span className="font-mono text-[13px] text-white/65">{formatDate(m.createdAt)}</span> },
  {
    header: 'Action',
    cell: (m, api) => (
      <ConfirmAction
        label={m.isHidden ? 'Restore' : 'Hide'}
        ariaLabel={`${m.isHidden ? 'Restore' : 'Hide'} ${m.title}`}
        onConfirm={async () => {
          api.notify(null);
          try {
            const res = await setModelHidden(m.id, !m.isHidden);
            api.update(m.id, (row) => ({ ...row, isHidden: res.isHidden }));
          } catch (err) {
            api.notify(err instanceof AdminApiError ? err.message : 'Could not change this model. Please try again.');
          }
        }}
      />
    ),
  },
];

export default function AdminModelsPage() {
  return (
    <AdminList<AdminModel>
      path="/models"
      label="Admin"
      heading="Models"
      searchLabel="Search title or owner"
      columns={COLUMNS}
    />
  );
}
