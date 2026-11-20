'use client';

// /admin/withdrawals — review, approve, mark paid, or reject creator withdrawal requests
import { useState } from 'react';
import AdminList, { type Column, type RowApi } from '@/components/admin/AdminList';
import { Badge } from '@/components/admin/ui';
import {
  AdminApiError,
  updateWithdrawal,
  type AdminWithdrawal,
  type WithdrawalStatus,
} from '@/lib/admin-api';
import { formatDate, formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

function statusBadge(status: WithdrawalStatus, t: ReturnType<typeof useT>) {
  if (status === 'paid') return <Badge>{t('admin.paid')}</Badge>;
  if (status === 'approved') return <Badge>{t('admin.wd.approved')}</Badge>;
  if (status === 'rejected') return <Badge tone="danger">{t('admin.wd.rejected')}</Badge>;
  return <Badge tone="warn">{t('admin.pending')}</Badge>;
}

function WithdrawalActions({ row, api }: { row: AdminWithdrawal; api: RowApi<AdminWithdrawal> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  if (row.status === 'paid' || row.status === 'rejected') {
    return (
      <span className="font-mono text-xs text-white/45">
        {row.processedAt ? formatDate(row.processedAt) : t('admin.wd.done')}
      </span>
    );
  }

  const run = async (nextStatus: 'approved' | 'paid' | 'rejected') => {
    if (busy) return;
    setBusy(true);
    api.notify(null);
    try {
      const res = await updateWithdrawal(row.id, nextStatus);
      api.update(row.id, (w) => ({ ...w, status: res.status, processedAt: res.processedAt }));
    } catch (err) {
      api.notify(err instanceof AdminApiError ? err.message : t('admin.wd.errUpdate'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {row.status === 'pending' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('approved')}
          className="h-7 whitespace-nowrap rounded-lg border border-hud/40 bg-hud/10 px-2.5 text-xs font-medium text-hud transition-colors hover:bg-hud/20 disabled:opacity-50"
        >
          {t('admin.wd.approve')}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void run('paid')}
        className="h-7 whitespace-nowrap rounded-lg bg-white px-2.5 text-xs font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-50"
      >
        {t('admin.wd.markPaid')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run('rejected')}
        className="h-7 whitespace-nowrap rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 text-xs text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
      >
        {t('admin.wd.reject')}
      </button>
    </div>
  );
}

const COLUMNS: Column<AdminWithdrawal>[] = [
  {
    header: 'admin.col.date',
    cell: (w) => <span className="font-mono text-[13px] text-white/65">{formatDate(w.createdAt)}</span>,
  },
  {
    header: 'admin.col.seller',
    cell: (w) => (
      <span className="block">
        <span className="block font-medium">{w.seller.displayName}</span>
        <span className="block text-white/65">{w.seller.email}</span>
      </span>
    ),
  },
  {
    header: 'admin.wd.colBreakdown',
    cell: (w) => (
      <span className="block font-mono text-xs">
        <span className="text-white/75">{formatMoney(w.grossAmountCents, w.currency)}</span>
        <span className="text-amber"> (-{formatMoney(w.platformFeeCents, w.currency)})</span>
        <span className="block font-semibold text-hud">{formatMoney(w.netAmountCents, w.currency)}</span>
      </span>
    ),
  },
  {
    header: 'admin.wd.colDestination',
    cell: (w) => (
      <span className="font-mono text-xs text-white/75">
        {w.payoutMethod.toUpperCase()} · {w.payoutAccount}
      </span>
    ),
  },
  {
    header: 'admin.col.status',
    cell: (w, _api, t) => statusBadge(w.status, t),
  },
  {
    header: 'admin.col.action',
    cell: (w, api) => <WithdrawalActions row={w} api={api} />,
  },
];

export default function AdminWithdrawalsPage() {
  return (
    <AdminList<AdminWithdrawal>
      path="/withdrawals"
      heading="admin.nav.withdrawals"
      searchLabel="admin.search.withdrawals"
      columns={COLUMNS}
      filter={{
        param: 'status',
        label: 'admin.filter.status',
        initial: '',
        options: [
          { value: '', label: 'admin.status.all' },
          { value: 'pending', label: 'admin.pending' },
          { value: 'approved', label: 'admin.wd.approved' },
          { value: 'paid', label: 'admin.paid' },
          { value: 'rejected', label: 'admin.wd.rejected' },
        ],
      }}
    />
  );
}
