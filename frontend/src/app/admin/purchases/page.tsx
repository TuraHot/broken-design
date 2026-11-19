'use client';

// /admin/purchases — every order; the watermark hash links a leaked file back to its buyer
import AdminList, { type Column } from '@/components/admin/AdminList';
import { Badge } from '@/components/admin/ui';
import type { AdminPurchase } from '@/lib/admin-api';
import { formatDate, formatMoney } from '@/lib/format';

const COLUMNS: Column<AdminPurchase>[] = [
  { header: 'admin.col.date', cell: (p) => <span className="font-mono text-[13px] text-white/65">{formatDate(p.paidAt ?? p.createdAt)}</span> },
  {
    header: 'admin.col.buyer',
    cell: (p) => (
      <span className="block">
        <span className="block font-medium">{p.buyer.displayName}</span>
        <span className="block text-white/65">{p.buyer.email}</span>
      </span>
    ),
  },
  {
    header: 'admin.col.model',
    cell: (p) => <span className="text-white">{p.model.title}</span>,
  },
  { header: 'admin.col.amount', cell: (p) => <span className="text-white/80">{formatMoney(p.amountCents, p.currency)}</span> },
  { header: 'admin.col.license', cell: (p) => <span className="text-white/65">{p.licenseType}</span> },
  {
    header: 'admin.col.status',
    cell: (p, _api, t) => (p.status === 'paid' ? <Badge>{t('admin.paid')}</Badge> : <Badge tone="warn">{t('admin.pending')}</Badge>),
  },
  {
    header: 'admin.col.watermark',
    cell: (p) =>
      p.watermarkHash ? (
        <span title={p.watermarkHash} className="font-mono text-[13px] text-white/65">
          {p.watermarkHash.slice(0, 12)}…
        </span>
      ) : (
        <span className="text-white/65">—</span>
      ),
  },
];

export default function AdminPurchasesPage() {
  return (
    <AdminList<AdminPurchase>
      path="/purchases"
      heading="admin.nav.purchases"
      searchLabel="admin.search.purchases"
      columns={COLUMNS}
    />
  );
}
