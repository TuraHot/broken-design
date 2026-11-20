'use client';

// A searchable, paged table loaded from an admin list endpoint. The page supplies the columns.
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { adminFetch, type Paged } from '@/lib/admin-api';
import { adminErrorText } from '@/lib/i18n/admin-error';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export interface RowApi<T> {
  /** Replace one row in place after an action succeeded. */
  update: (id: string, change: (row: T) => T) => void;
  /** Show (or clear with `null`) a message above the table. */
  notify: (message: string | null) => void;
}

export interface Column<T> {
  /** Text key of the column heading. */
  header: MessageKey;
  cell: (row: T, api: RowApi<T>, t: Translate) => React.ReactNode;
}

interface FilterDef {
  param: string;
  label: MessageKey;
  initial: string;
  options: { value: string; label: MessageKey }[];
}

const PAGE_SIZE = 25;
const NAV_BTN = 'inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:text-ink/25 disabled:hover:border-line';

export default function AdminList<T extends { id: string }>({
  path,
  heading,
  searchLabel,
  columns,
  filter,
  dateRange,
}: {
  path: string;
  heading: MessageKey;
  searchLabel: MessageKey;
  columns: Column<T>[];
  /** Optional dropdown(s) sent to the API as `?<param>=<value>` (an empty value means "no filter"). */
  filter?: FilterDef | FilterDef[];
  /** Adds two date fields sent to the API as `?from=YYYY-MM-DD&to=YYYY-MM-DD` (both days included). */
  dateRange?: boolean;
}) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const filters = filter ? (Array.isArray(filter) ? filter : [filter]) : [];
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((f) => [f.param, f.initial])),
  );
  const filterKey = JSON.stringify(filterValues);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) sp.set('q', q);
    for (const [param, value] of Object.entries(filterValues)) if (value) sp.set(param, value);
    if (dateRange && from) sp.set('from', from);
    if (dateRange && to) sp.set('to', to);

    adminFetch<Paged<T>>(`${path}?${sp}`, { signal: ctrl.signal })
      .then((res) => {
        setData(res);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(adminErrorText(err, t));
        setLoading(false);
      });
    return () => ctrl.abort();
    // `filterValues` is read through `filterKey`: only the chosen values matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, q, attempt, filterKey, from, to]);

  const api: RowApi<T> = {
    update: useCallback((id, change) => {
      setData((d) => (d ? { ...d, items: d.items.map((row) => (row.id === id ? change(row) : row)) } : d));
    }, []),
    notify: setNotice,
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">[ {t('admin.label')} ]</p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02]">{t(heading)}</h1>

      <form
        role="search"
        className="mt-8 flex max-w-2xl flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(draft.trim());
        }}
      >
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={t(searchLabel)}
            placeholder={t(searchLabel)}
            maxLength={100}
            className="h-9 w-full rounded-lg border border-line bg-ink/5 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 focus:border-ink/50 focus:outline-none"
          />
        </div>
        <button type="submit" className="h-9 rounded-lg border border-line px-3 text-sm text-ink/80 transition-colors hover:border-ink/40 hover:text-ink">
          {t('admin.search')}
        </button>
        {filters.map((f) => (
          <select
            key={f.param}
            aria-label={t(f.label)}
            value={filterValues[f.param] ?? ''}
            onChange={(e) => {
              setPage(1);
              setFilterValues((v) => ({ ...v, [f.param]: e.target.value }));
            }}
            className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm text-ink focus:border-ink/50 focus:outline-none"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{t(o.label)}</option>
            ))}
          </select>
        ))}
        {dateRange && (
          // One date range: two dates that belong together, kept side by side with visible labels.
          <div role="group" aria-label={t('admin.dateRange')} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              {t('admin.dateFromShort')}
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setPage(1);
                  setFrom(e.target.value);
                }}
                className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm text-ink focus:border-ink/50 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              {t('admin.dateToShort')}
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setPage(1);
                  setTo(e.target.value);
                }}
                className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm text-ink focus:border-ink/50 focus:outline-none"
              />
            </label>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setFrom('');
                  setTo('');
                }}
                className="h-9 rounded-lg px-2 text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                {t('admin.dateClear')}
              </button>
            )}
          </div>
        )}
      </form>

      <div role="status" className="mt-4 min-h-5 text-sm">
        {notice && (
          <p className="flex items-center gap-2 text-warn">
            <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
            {notice}
          </p>
        )}
      </div>

      {error && !data ? (
        <div className="mt-2 rounded-lg border border-line bg-ink/5 p-10 text-center">
          <p className="flex items-center justify-center gap-2 text-danger">
            <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-6 h-9 rounded-lg bg-ink px-3.5 text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85"
          >
            {t('admin.tryAgain')}
          </button>
        </div>
      ) : (
        <>
          <div
            role="region"
            aria-label={t('admin.tableLabel', { heading: t(heading) })}
            tabIndex={0}
            className={`overflow-x-auto rounded-lg border border-line bg-ink/5 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink/50 ${loading ? 'opacity-60' : ''}`}
            aria-busy={loading}
          >
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.header} scope="col" className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.16em] text-ink-soft">
                      {t(c.header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr key={row.id} className="border-t border-line align-middle">
                    {columns.map((c) => (
                      <td key={c.header} className="px-4 py-3">
                        {c.cell(row, api, t)}
                      </td>
                    ))}
                  </tr>
                ))}
                {data && data.items.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-soft">
                      {q ? t('admin.nothingMatches', { q }) : t('admin.nothingYet')}
                    </td>
                  </tr>
                )}
                {!data && loading && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-soft">{t('admin.loading')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && (
            <nav aria-label={t('admin.pagination')} className="mt-6 flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">{t('admin.total', { n: data.total })}</span>
              <div className="flex items-center gap-4">
                <button type="button" className={NAV_BTN} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  <ArrowLeft aria-hidden className="h-4 w-4" />
                  {t('admin.prev')}
                </button>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
                  {t('admin.page', { page: data.page, total: totalPages })}
                </span>
                <button type="button" className={NAV_BTN} disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                  {t('admin.next')}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
