'use client';

// /admin/withdrawals — review, approve, mark paid, or reject creator withdrawal requests
import { useState } from 'react';
import AdminList, { type Column, type RowApi } from '@/components/admin/AdminList';
import { Badge, ConfirmAction } from '@/components/admin/ui';
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
      <span className="font-mono text-xs text-ink/45">
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
          className="h-8 whitespace-nowrap rounded-lg border border-accent/40 bg-accent/10 px-3 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
        >
          {t('admin.wd.approve')}
        </button>
      )}
      <ConfirmAction
        label={t('admin.wd.markPaid')}
        ariaLabel={t('admin.actionOn', { action: t('admin.wd.markPaid'), name: row.seller.displayName })}
        disabled={busy}
        onConfirm={() => run('paid')}
      />
      <ConfirmAction
        label={t('admin.wd.reject')}
        ariaLabel={t('admin.actionOn', { action: t('admin.wd.reject'), name: row.seller.displayName })}
        disabled={busy}
        onConfirm={() => run('rejected')}
      />
    </div>
  );
}

const COLUMNS: Column<AdminWithdrawal>[] = [
  {
    header: 'admin.col.date',
    cell: (w) => <span className="font-mono text-[13px] text-ink-soft">{formatDate(w.createdAt)}</span>,
  },
  {
    header: 'admin.col.seller',
    cell: (w) => (
      <span className="block">
        <span className="block font-medium">{w.seller.displayName}</span>
        <span className="block text-ink-soft">{w.seller.email}</span>
      </span>
    ),
  },
  {
    header: 'admin.wd.colBreakdown',
    cell: (w) => (
      <span className="block font-mono text-xs">
        <span className="text-ink/75">{formatMoney(w.grossAmountCents, w.currency)}</span>
        <span className="text-warn"> (-{formatMoney(w.platformFeeCents, w.currency)})</span>
        <span className="block font-semibold text-accent">{formatMoney(w.netAmountCents, w.currency)}</span>
      </span>
    ),
  },
  {
    header: 'admin.wd.colDestination',
    cell: (w) => (
      <span className="font-mono text-xs text-ink/75">
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
