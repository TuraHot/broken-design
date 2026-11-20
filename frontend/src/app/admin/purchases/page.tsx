'use client';

// /admin/purchases — every order; the watermark hash links a leaked file back to its buyer
import { useState } from 'react';
import AdminList, { type Column } from '@/components/admin/AdminList';
import PurchaseDialog from '@/components/admin/PurchaseDialog';
import { Badge } from '@/components/admin/ui';
import type { AdminPurchase } from '@/lib/admin-api';
import { formatDate, formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

// Opens the read-only details of one purchase.
function DetailsAction({ purchase }: { purchase: AdminPurchase }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('admin.actionOn', { action: t('admin.purchase.details'), name: purchase.model.title })}
        className="h-8 whitespace-nowrap rounded-lg border border-line px-3 text-sm text-ink/80 transition-colors hover:border-ink/40 hover:text-ink"
      >
        {t('admin.purchase.details')}
      </button>
      {open && <PurchaseDialog purchaseId={purchase.id} onClose={() => setOpen(false)} />}
    </>
  );
}

const COLUMNS: Column<AdminPurchase>[] = [
  { header: 'admin.col.date', cell: (p) => <span className="font-mono text-[13px] text-ink-soft">{formatDate(p.paidAt ?? p.createdAt)}</span> },
  {
    header: 'admin.col.buyer',
    cell: (p) => (
      <span className="block">
        <span className="block font-medium">{p.buyer.displayName}</span>
        <span className="block text-ink-soft">{p.buyer.email}</span>
      </span>
    ),
  },
  {
    header: 'admin.col.model',
    cell: (p) => <span className="text-ink">{p.model.title}</span>,
  },
  { header: 'admin.col.amount', cell: (p) => <span className="text-ink/80">{formatMoney(p.amountCents, p.currency)}</span> },
  { header: 'admin.col.license', cell: (p) => <span className="text-ink-soft">{p.licenseType}</span> },
  {
    header: 'admin.col.status',
    cell: (p, _api, t) => (p.status === 'paid' ? <Badge>{t('admin.paid')}</Badge> : <Badge tone="warn">{t('admin.pending')}</Badge>),
  },
  {
    header: 'admin.col.watermark',
    cell: (p) =>
      p.watermarkHash ? (
        <span title={p.watermarkHash} className="font-mono text-[13px] text-ink-soft">
          {p.watermarkHash.slice(0, 12)}…
        </span>
      ) : (
        <span className="text-ink-soft">—</span>
      ),
  },
  { header: 'admin.col.action', cell: (p) => <DetailsAction purchase={p} /> },
];

export default function AdminPurchasesPage() {
  return (
    <AdminList<AdminPurchase>
      path="/purchases"
      heading="admin.nav.purchases"
      searchLabel="admin.search.purchases"
      columns={COLUMNS}
      dateRange
      filter={{
        param: 'status',
        label: 'admin.filter.status',
        initial: '',
        options: [
          { value: '', label: 'admin.status.all' },
          { value: 'paid', label: 'admin.paid' },
          { value: 'pending', label: 'admin.pending' },
        ],
      }}
    />
  );
}
