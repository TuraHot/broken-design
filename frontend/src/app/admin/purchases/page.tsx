'use client';

// /admin/purchases — every order; the watermark hash links a leaked file back to its buyer
import AdminList, { type Column } from '@/components/admin/AdminList';
import { Badge } from '@/components/admin/ui';
import type { AdminPurchase } from '@/lib/admin-api';
import { formatDate, formatMoney } from '@/lib/format';

const COLUMNS: Column<AdminPurchase>[] = [
  { header: 'Date', cell: (p) => <span className="font-mono text-[13px] text-white/65">{formatDate(p.paidAt ?? p.createdAt)}</span> },
  {
    header: 'Buyer',
    cell: (p) => (
      <span className="block">
        <span className="block font-medium">{p.buyer.displayName}</span>
        <span className="block text-white/65">{p.buyer.email}</span>
      </span>
    ),
  },
  {
    header: 'Model',
    cell: (p) => <span className="text-white">{p.model.title}</span>,
  },
  { header: 'Amount', cell: (p) => <span className="text-white/80">{formatMoney(p.amountCents, p.currency)}</span> },
  { header: 'License', cell: (p) => <span className="text-white/65">{p.licenseType}</span> },
  { header: 'Status', cell: (p) => (p.status === 'paid' ? <Badge>Paid</Badge> : <Badge tone="warn">Pending</Badge>) },
  {
    header: 'Watermark',
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
      label="Admin"
      heading="Purchases"
      searchLabel="Search buyer or model"
      columns={COLUMNS}
    />
  );
}
