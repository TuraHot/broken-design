'use client';

// /admin/complaints — reports sent by users; open ones first. "Read & respond" opens the whole complaint.
import AdminList, { type Column } from '@/components/admin/AdminList';
import { CATEGORY_LABELS, ComplaintMessage, STATUS_LABELS } from '@/components/admin/ComplaintCells';
import { Badge } from '@/components/admin/ui';
import type { AdminComplaint } from '@/lib/admin-api';
import { formatDate } from '@/lib/format';

const COLUMNS: Column<AdminComplaint>[] = [
  {
    header: 'admin.col.from',
    cell: (c) => (
      <span className="block min-w-[150px]">
        <span className="block font-medium">{c.reporter.displayName}</span>
        <span className="block break-all text-ink-soft">{c.reporter.email}</span>
        <span className="mt-1 block font-mono text-[13px] text-ink-soft">{formatDate(c.createdAt)}</span>
      </span>
    ),
  },
  {
    header: 'admin.col.about',
    cell: (c, _api, t) => (
      <span className="block min-w-[130px]">
        <Badge tone={c.status === 'open' ? 'warn' : 'neutral'}>{t(STATUS_LABELS[c.status])}</Badge>{' '}
        <Badge>{t(CATEGORY_LABELS[c.category])}</Badge>
        {c.model && (
          <span className="mt-2 block">
            <span className="block text-ink">{c.model.title}</span>
            {c.owner && <span className="block text-ink-soft">{t('admin.by', { name: c.owner.displayName })}</span>}
            <span className="mt-1 flex flex-wrap gap-2">
              {c.model.isHidden && <Badge tone="warn">{t('admin.hidden')}</Badge>}
              {c.owner?.isSuspended && <Badge tone="danger">{t('admin.ownerSuspended')}</Badge>}
            </span>
          </span>
        )}
      </span>
    ),
  },
  { header: 'admin.col.message', cell: (c, api) => <ComplaintMessage row={c} api={api} /> },
];

export default function AdminComplaintsPage() {
  return (
    <AdminList<AdminComplaint>
      path="/complaints"
      heading="admin.nav.complaints"
      searchLabel="admin.search.complaints"
      columns={COLUMNS}
      filter={{
        param: 'status',
        label: 'admin.filter.status',
        initial: 'open',
        options: [
          { value: 'open', label: 'admin.status.open' },
          { value: 'in_review', label: 'admin.status.in_review' },
          { value: 'resolved', label: 'admin.status.resolved' },
          { value: 'dismissed', label: 'admin.status.dismissed' },
          { value: '', label: 'admin.status.all' },
        ],
      }}
    />
  );
}
