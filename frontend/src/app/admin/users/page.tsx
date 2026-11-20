'use client';

// /admin/users — suspend or restore accounts
import { useEffect, useState } from 'react';
import AdminList, { type Column, type RowApi } from '@/components/admin/AdminList';
import SuspendDialog from '@/components/admin/SuspendDialog';
import { Badge } from '@/components/admin/ui';
import {
  createInviteCode,
  fetchCreatorApplications,
  fetchInviteCodes,
  reviewCreatorApplication,
  type AdminCreatorApplication,
  type AdminInviteCode,
  type AdminUser,
} from '@/lib/admin-api';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import { readSession } from '@/lib/session';

function CreatorApplicationsPanel({ onApproved }: { onApproved: () => void }) {
  const t = useT();
  const [apps, setApps] = useState<AdminCreatorApplication[]>([]);
  const [codes, setCodes] = useState<AdminInviteCode[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (!readSession()) return;
    try {
      const [appsData, codesData] = await Promise.all([
        fetchCreatorApplications('pending'),
        fetchInviteCodes(),
      ]);
      setApps(Array.isArray(appsData.applications) ? appsData.applications : []);
      setCodes(Array.isArray(codesData.codes) ? codesData.codes : []);
    } catch {
      // AdminShell / AdminList handle auth errors
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleGenerateCode = async () => {
    if (creatingCode) return;
    try {
      setCreatingCode(true);
      setMsg(null);
      const data = await createInviteCode({ maxUses: 1 });
      if (data.code) setCodes((prev) => [data.code, ...prev]);
    } catch (err: any) {
      setMsg(err?.message || t('admin.apps.errGenerate'));
    } finally {
      setCreatingCode(false);
    }
  };

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    if (busyId) return;
    try {
      setBusyId(id);
      setMsg(null);
      await reviewCreatorApplication(id, status);
      setApps((prev) => prev.filter((a) => a.id !== id));
      setMsg(status === 'approved' ? t('admin.apps.approvedMsg') : t('admin.apps.rejectedMsg'));
      if (status === 'approved') onApproved();
    } catch (err: any) {
      setMsg(err?.message || t('admin.apps.errAction'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-8 space-y-4">
      <div className="rounded-xl border border-hud/30 bg-hud/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud">{t('admin.apps.eyebrow')}</p>
            <h2 className="mt-1 font-display text-lg uppercase text-white">
              {t('admin.apps.title', { n: apps.length })}
            </h2>
          </div>
          <button
            type="button"
            disabled={creatingCode}
            onClick={handleGenerateCode}
            className="h-9 rounded-lg border border-hud/40 bg-hud/10 px-3.5 font-mono text-xs uppercase tracking-wider text-hud transition-colors hover:bg-hud/20 disabled:opacity-50"
          >
            {creatingCode ? t('admin.apps.generating') : t('admin.apps.generateCode')}
          </button>
        </div>

        {msg && <p className="mt-2 text-xs text-hud">{msg}</p>}

        {codes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {codes.slice(0, 6).map((c) => (
              <span
                key={c.id}
                className="rounded-md border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-xs text-white/85 select-all"
              >
                {c.code}{' '}
                <span className="text-white/45">
                  ({c.usedCount}/{c.maxUses})
                </span>
              </span>
            ))}
          </div>
        )}

        {apps.length > 0 && (
          <ul className="mt-4 space-y-3">
            {apps.map((app) => (
              <li
                key={app.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-white/10 bg-black/50 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {app.displayName} <span className="font-mono text-xs text-white/55">({app.email})</span>
                  </p>
                  {app.note && <p className="mt-1 text-xs text-white/70">{app.note}</p>}
                  <p className="mt-1 font-mono text-[11px] text-white/45">
                    {t('admin.apps.applied', { date: formatDate(app.createdAt) })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === app.id}
                    onClick={() => handleReview(app.id, 'approved')}
                    className="h-8 rounded-lg bg-white px-3 text-xs font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-50"
                  >
                    {t('admin.apps.approve')}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === app.id}
                    onClick={() => handleReview(app.id, 'rejected')}
                    className="h-8 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-xs text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {t('admin.apps.reject')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// One button per row. It opens the dialog where the admin picks how long and writes the reason.
function SuspendAction({ user, api }: { user: AdminUser; api: RowApi<AdminUser> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const action = user.suspendedAt !== null ? t('admin.restore') : t('admin.suspend');
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('admin.actionOn', { action, name: user.displayName })}
        className="h-8 whitespace-nowrap rounded-lg border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white"
      >
        {action}
      </button>
      {open && (
        <SuspendDialog
          user={user}
          onClose={() => setOpen(false)}
          onChanged={(change) => api.update(user.id, (row) => ({ ...row, ...change }))}
        />
      )}
    </>
  );
}

function buildColumns(myId: string | null): Column<AdminUser>[] {
  return [
    {
      header: 'admin.col.user',
      cell: (u) => (
        <span className="block">
          <span className="block font-medium">{u.displayName}</span>
          <span className="block text-white/65">{u.email}</span>
        </span>
      ),
    },
    { header: 'admin.col.role', cell: (u) => <Badge>{u.role}</Badge> },
    { header: 'admin.col.seller', cell: (u, _api, t) => <span className="text-white/65">{u.isSeller ? t('admin.yesWord') : t('admin.noWord')}</span> },
    {
      header: 'admin.col.status',
      cell: (u, _api, t) =>
        u.suspendedAt ? (
          <span className="flex flex-col items-start gap-1">
            <Badge tone="danger">{t('admin.suspended')}</Badge>
            <span className="text-xs text-white/65">
              {u.suspendedUntil ? t('admin.suspendedUntil', { date: formatDate(u.suspendedUntil) }) : t('admin.suspendedNoEnd')}
            </span>
            {u.suspensionReason && (
              <span title={u.suspensionReason} className="line-clamp-2 max-w-[28ch] break-words text-xs text-white/50">
                {u.suspensionReason}
              </span>
            )}
          </span>
        ) : (
          <Badge>{t('admin.active')}</Badge>
        ),
    },
    { header: 'admin.col.joined', cell: (u) => <span className="font-mono text-[13px] text-white/65">{formatDate(u.createdAt)}</span> },
    {
      header: 'admin.col.action',
      cell: (u, api, t) => {
        if (u.id === myId) return <span className="text-sm text-white/65">{t('admin.you')}</span>;
        // An admin account cannot be suspended (the server refuses too); one suspended earlier can still be restored.
        if (u.role === 'admin' && u.suspendedAt === null) return <span title={t('admin.noAdminSuspend')} className="text-sm text-white/40">—</span>;
        return <SuspendAction user={u} api={api} />;
      },
    },
  ];
}

export default function AdminUsersPage() {
  const [myId, setMyId] = useState<string | null>(null);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);
  useEffect(() => setMyId(readSession()?.user.id ?? null), []);

  return (
    <>
      <CreatorApplicationsPanel onApproved={() => setUsersRefreshKey((k) => k + 1)} />
      <AdminList<AdminUser>
        key={usersRefreshKey}
        path="/users"
        heading="admin.nav.users"
        searchLabel="admin.search.users"
        columns={buildColumns(myId)}
      />
    </>
  );
}
