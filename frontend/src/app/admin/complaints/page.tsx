'use client';

// /admin/complaints — reports sent by users; open ones first. "Read & respond" opens the whole complaint.
import AdminList, { type Column } from '@/components/admin/AdminList';
import { CATEGORY_LABELS, ComplaintMessage, STATUS_LABELS } from '@/components/admin/ComplaintCells';
import { Badge } from '@/components/admin/ui';
import type { AdminComplaint } from '@/lib/admin-api';
import { formatDate } from '@/lib/format';

const COLUMNS: Column<AdminComplaint>[] = [
  {
    header: 'From',
    cell: (c) => (
      <span className="block min-w-[150px]">
        <span className="block font-medium">{c.reporter.displayName}</span>
        <span className="block break-all text-white/65">{c.reporter.email}</span>
        <span className="mt-1 block font-mono text-[13px] text-white/65">{formatDate(c.createdAt)}</span>
      </span>
    ),
  },
  {
    header: 'About',
    cell: (c) => (
      <span className="block min-w-[130px]">
        <Badge tone={c.status === 'open' ? 'warn' : 'neutral'}>{STATUS_LABELS[c.status]}</Badge>{' '}
        <Badge>{CATEGORY_LABELS[c.category]}</Badge>
        {c.model && (
          <span className="mt-2 block">
            <span className="block text-white">{c.model.title}</span>
            {c.owner && <span className="block text-white/65">by {c.owner.displayName}</span>}
            <span className="mt-1 flex flex-wrap gap-2">
              {c.model.isHidden && <Badge tone="warn">Hidden</Badge>}
              {c.owner?.isSuspended && <Badge tone="danger">Owner suspended</Badge>}
            </span>
          </span>
        )}
      </span>
    ),
  },
  { header: 'Message', cell: (c, api) => <ComplaintMessage row={c} api={api} /> },
];

export default function AdminComplaintsPage() {
  return (
    <AdminList<AdminComplaint>
      path="/complaints"
      label="Admin"
      heading="Complaints"
      searchLabel="Search message, person or model"
      columns={COLUMNS}
      filter={{
        param: 'status',
        label: 'Filter by status',
        initial: 'open',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'in_review', label: 'In review' },
          { value: 'resolved', label: 'Resolved' },
          { value: 'dismissed', label: 'Dismissed' },
          { value: '', label: 'All' },
        ],
      }}
    />
  );
}
