'use client';

// /admin — the platform at a glance: what needs attention, key numbers, catalogue mix, people, recent activity
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/admin/ui';
import { adminFetch, type AdminOverview } from '@/lib/admin-api';
import { formatCount, formatDate, formatMoney } from '@/lib/format';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';

const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-white/65';

function Panel({ title, action, children }: { title: string; action?: { href: string; label: string }; children: React.ReactNode }) {
  const id = `panel-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="rounded-lg border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className={LABEL}>{title}</h2>
        {action && (
          <Link href={action.href} className="inline-flex items-center gap-1 text-sm text-white/65 transition-colors hover:text-white">
            {action.label}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <p className={LABEL}>{label}</p>
      <p className="mt-3 font-display text-2xl">{value}</p>
      <p className="mt-2 min-h-5 text-sm text-white/65">{note}</p>
    </>
  );
  const cls = 'block rounded-lg border border-white/10 bg-white/5 p-5';
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-white/30`}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** A labelled bar. The numbers are printed, so the bar is decoration. */
function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-white/80">{label}</span>
        <span className="font-mono text-[13px] text-white/65">{formatCount(value)} · {pct}%</span>
      </div>
      <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-hud/70" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-white/65">{children}</p>;
}

export default function AdminOverviewPage() {
  const t = useT();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    adminFetch<AdminOverview>('/overview', { signal: ctrl.signal })
      .then(setData)
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(adminErrorText(err, t));
      });
    return () => ctrl.abort();
    // The error text is made once, in the language of the moment the request fails.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attention = data
    ? [
        { id: 'apps', n: data.pendingApplications ?? 0, text: t((data.pendingApplications ?? 0) === 1 ? 'admin.ov.application.one' : 'admin.ov.application.many'), href: '/admin/creator-approvals' },
        { id: 'wd', n: data.pendingWithdrawals ?? 0, text: t((data.pendingWithdrawals ?? 0) === 1 ? 'admin.ov.withdrawal.one' : 'admin.ov.withdrawal.many'), href: '/admin/withdrawals' },
        { id: 'complaints', n: data.openComplaints, text: t(data.openComplaints === 1 ? 'admin.ov.complaint.one' : 'admin.ov.complaint.many'), href: '/admin/complaints' },
        { id: 'suspended', n: data.suspendedUsers, text: t(data.suspendedUsers === 1 ? 'admin.ov.suspended.one' : 'admin.ov.suspended.many'), href: '/admin/users' },
        { id: 'hidden', n: data.hiddenModels, text: t(data.hiddenModels === 1 ? 'admin.ov.hidden.one' : 'admin.ov.hidden.many'), href: '/admin/models' },
        { id: 'unpaid', n: data.pendingPurchases, text: t(data.pendingPurchases === 1 ? 'admin.ov.unpaid.one' : 'admin.ov.unpaid.many'), href: '/admin/purchases' },
      ].filter((a) => a.n > 0)
    : [];

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud">[ {t('admin.label')} ]</p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02]">{t('admin.nav.overview')}</h1>

      {error && (
        <p role="status" className="mt-8 flex items-center gap-2 text-red-300">
          <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {!data && !error && <p role="status" className="mt-8 text-sm text-white/65">{t('admin.loading')}</p>}

      {data && (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6">
          <Panel title={t('admin.ov.needs')}>
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-white/65">
                <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
                {t('admin.ov.nothing')}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {attention.map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className="inline-flex items-center gap-2 rounded-lg border border-amber/50 px-3 py-2 text-sm text-amber transition-colors hover:bg-white/5">
                      <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
                      <span><strong className="font-medium">{formatCount(a.n)}</strong> {a.text}</span>
                      <ArrowRight aria-hidden className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div>
            <h2 className={`${LABEL} mb-3`}>{t('admin.ov.totals')}</h2>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label={t('admin.ov.users')} value={formatCount(data.totalUsers)} note={t('admin.ov.nSuspended', { n: formatCount(data.suspendedUsers) })} href="/admin/users" />
              <Stat label={t('admin.ov.models')} value={formatCount(data.totalModels)} note={t('admin.ov.nHidden', { n: formatCount(data.hiddenModels) })} href="/admin/models" />
              <Stat label={t('admin.ov.paidPurchases')} value={formatCount(data.paidPurchases)} note={t('admin.ov.nUnpaid', { n: formatCount(data.pendingPurchases) })} href="/admin/purchases" />
              <Stat
                label={t('admin.ov.revenue')}
                value={formatMoney(data.totalRevenueCents)}
                note={
                  data.paidPurchases > 0
                    ? t('admin.ov.perOrder', { amount: formatMoney(Math.round(data.totalRevenueCents / data.paidPurchases)) })
                    : t('admin.ov.noSales')
                }
              />
            </div>
          </div>

          <div>
            <h2 className={`${LABEL} mb-3`}>{t('admin.ov.last7')}</h2>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
              <Stat label={t('admin.ov.newUsers')} value={formatCount(data.newUsers7d)} />
              <Stat label={t('admin.ov.newModels')} value={formatCount(data.newModels7d)} />
              <Stat label={t('admin.ov.revenue')} value={formatMoney(data.revenue7dCents)} />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <Panel title={t('admin.ov.catalogue')} action={{ href: '/admin/models', label: t('admin.ov.manageModels') }}>
              <ul className="grid gap-4">
                <Bar label={t('admin.ov.freeModels')} value={data.freeModels} total={data.totalModels} />
                <Bar label={t('admin.ov.paidModels')} value={data.totalModels - data.freeModels} total={data.totalModels} />
              </ul>
              <p className={`${LABEL} mb-3 mt-6`}>{t('admin.ov.byLicense')}</p>
              {data.licenseBreakdown.length === 0 ? (
                <Empty>{t('admin.ov.noModels')}</Empty>
              ) : (
                <ul className="grid gap-4">
                  {data.licenseBreakdown.map((l) => (
                    <Bar key={l.license} label={l.license} value={l.count} total={data.totalModels} />
                  ))}
                </ul>
              )}
              <p className="mt-6 text-sm text-white/65">
                {t('admin.ov.totalsLine', { downloads: formatCount(data.totalDownloads), views: formatCount(data.totalViews) })}
              </p>
            </Panel>

            <Panel title={t('admin.ov.people')} action={{ href: '/admin/users', label: t('admin.ov.manageUsers') }}>
              <ul className="grid gap-4">
                <Bar label={t('admin.ov.sellers')} value={data.sellerUsers} total={data.totalUsers} />
                <Bar label={t('admin.ov.admins')} value={data.adminUsers} total={data.totalUsers} />
                <Bar label={t('admin.ov.otherMembers')} value={Math.max(0, data.totalUsers - data.sellerUsers - data.adminUsers)} total={data.totalUsers} />
              </ul>
              <p className={`${LABEL} mb-3 mt-6`}>{t('admin.ov.newest')}</p>
              {data.recentUsers.length === 0 ? (
                <Empty>{t('admin.ov.noMembers')}</Empty>
              ) : (
                <ul className="divide-y divide-white/10">
                  {data.recentUsers.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-white">{u.displayName}</span>
                        <span className="block truncate text-white/65">{u.email}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <Badge>{u.role}</Badge>
                        <span className="hidden font-mono text-[13px] text-white/65 sm:inline">{formatDate(u.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={t('admin.ov.topModels')} action={{ href: '/admin/models', label: t('admin.ov.allModels') }}>
              {data.topModels.length === 0 ? (
                <Empty>{t('admin.ov.noModels')}</Empty>
              ) : (
                <ol className="divide-y divide-white/10">
                  {data.topModels.map((m, i) => (
                    <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="w-5 shrink-0 font-mono text-[13px] text-white/65">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-white">{m.title}</span>
                        <span className="block truncate text-white/65">{t('admin.by', { name: m.ownerName })}</span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-[13px] text-white/65">
                        {t('admin.ov.nDownloads', { n: formatCount(m.downloadCount) })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title={t('admin.ov.recent')} action={{ href: '/admin/purchases', label: t('admin.ov.allPurchases') }}>
              {data.recentPurchases.length === 0 ? (
                <Empty>{t('admin.ov.noPurchases')}</Empty>
              ) : (
                <ul className="divide-y divide-white/10">
                  {data.recentPurchases.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-white">{p.model.title}</span>
                        <span className="block truncate text-white/65">{p.buyerName} · {formatDate(p.paidAt)}</span>
                      </span>
                      <span className="shrink-0 text-white/80">{formatMoney(p.amountCents, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
