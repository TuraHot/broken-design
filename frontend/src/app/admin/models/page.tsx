'use client';

// /admin/models — every model, including hidden and deleted ones
import AdminList, { type Column } from '@/components/admin/AdminList';
import { Badge, ConfirmAction } from '@/components/admin/ui';
import { setModelHidden, type AdminModel } from '@/lib/admin-api';
import { formatDate, formatMoney } from '@/lib/format';
import { adminErrorText } from '@/lib/i18n/admin-error';

const COLUMNS: Column<AdminModel>[] = [
  {
    header: 'admin.col.model',
    cell: (m) => <span className="font-medium text-white">{m.title}</span>,
  },
  {
    header: 'admin.col.owner',
    cell: (m, _api, t) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-white/80">{m.owner.displayName}</span>
        {m.owner.isSuspended && <Badge tone="danger">{t('admin.suspended')}</Badge>}
      </span>
    ),
  },
  { header: 'admin.col.license', cell: (m) => <span className="text-white/65">{m.license}</span> },
  {
    header: 'admin.col.price',
    cell: (m, _api, t) => <span className="text-white/65">{m.priceCents === 0 ? t('admin.free') : formatMoney(m.priceCents, m.currency)}</span>,
  },
  {
    header: 'admin.col.status',
    cell: (m, _api, t) => (
      <span className="flex flex-wrap gap-2">
        {m.isDeleted && <Badge>{t('admin.deleted')}</Badge>}
        {m.isHidden ? <Badge tone="warn">{t('admin.hidden')}</Badge> : !m.isDeleted && <Badge>{t('admin.visible')}</Badge>}
      </span>
    ),
  },
  { header: 'admin.col.created', cell: (m) => <span className="font-mono text-[13px] text-white/65">{formatDate(m.createdAt)}</span> },
  {
    header: 'admin.col.action',
    cell: (m, api, t) => (
      <ConfirmAction
        label={m.isHidden ? t('admin.restore') : t('admin.hide')}
        ariaLabel={t('admin.actionOn', { action: m.isHidden ? t('admin.restore') : t('admin.hide'), name: m.title })}
        onConfirm={async () => {
          api.notify(null);
          try {
            const res = await setModelHidden(m.id, !m.isHidden);
            api.update(m.id, (row) => ({ ...row, isHidden: res.isHidden }));
          } catch (err) {
            api.notify(adminErrorText(err, t, 'admin.errModel'));
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
      heading="admin.nav.models"
      searchLabel="admin.search.models"
      columns={COLUMNS}
    />
  );
}
