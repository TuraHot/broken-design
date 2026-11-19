'use client';

// /admin/models — every model, including hidden and deleted ones
import { useState } from 'react';
import AdminList, { type Column, type RowApi } from '@/components/admin/AdminList';
import EditModelDialog from '@/components/admin/EditModelDialog';
import { Badge } from '@/components/admin/ui';
import type { AdminModel } from '@/lib/admin-api';
import { formatDate, formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

// The single Edit button of a row; the dialog holds license change and hide / restore.
function EditAction({ model, api }: { model: AdminModel; api: RowApi<AdminModel> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('admin.actionOn', { action: t('admin.edit'), name: model.title })}
        className="h-8 whitespace-nowrap rounded-lg border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white"
      >
        {t('admin.edit')}
      </button>
      {open && (
        <EditModelDialog
          model={model}
          onClose={() => setOpen(false)}
          onLicenseChanged={(license) => api.update(model.id, (row) => ({ ...row, license }))}
          onHiddenChanged={(isHidden) => api.update(model.id, (row) => ({ ...row, isHidden }))}
        />
      )}
    </>
  );
}

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
    cell: (m, api) => (m.isDeleted ? <span className="text-white/40">—</span> : <EditAction model={m} api={api} />),
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
