'use client';

// A searchable, paged table loaded from an admin list endpoint. The page supplies the columns.
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { AdminApiError, adminFetch, type Paged } from '@/lib/admin-api';

export interface RowApi<T> {
  /** Replace one row in place after an action succeeded. */
  update: (id: string, change: (row: T) => T) => void;
  /** Show (or clear with `null`) a message above the table. */
  notify: (message: string | null) => void;
}

export interface Column<T> {
  header: string;
  cell: (row: T, api: RowApi<T>) => React.ReactNode;
}

const PAGE_SIZE = 25;
const NAV_BTN = 'inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/65 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:border-white/15';

export default function AdminList<T extends { id: string }>({
  path,
  label,
  heading,
  searchLabel,
  columns,
  filter,
}: {
  path: string;
  label: string;
  heading: string;
  searchLabel: string;
  columns: Column<T>[];
  /** Optional dropdown sent to the API as `?<param>=<value>` (an empty value means "no filter"). */
  filter?: { param: string; label: string; initial: string; options: { value: string; label: string }[] };
}) {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filterValue, setFilterValue] = useState(filter?.initial ?? '');

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const sp = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) sp.set('q', q);
    if (filter && filterValue) sp.set(filter.param, filterValue);

    adminFetch<Paged<T>>(`${path}?${sp}`, { signal: ctrl.signal })
      .then((res) => {
        setData(res);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.');
        setLoading(false);
      });
    return () => ctrl.abort();
    // `filter` is a fresh object each render; only the chosen value matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, q, attempt, filterValue]);

  const api: RowApi<T> = {
    update: useCallback((id, change) => {
      setData((d) => (d ? { ...d, items: d.items.map((row) => (row.id === id ? change(row) : row)) } : d));
    }, []),
    notify: setNotice,
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud">[ {label} ]</p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02]">{heading}</h1>

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
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={searchLabel}
            placeholder={searchLabel}
            maxLength={100}
            className="h-9 w-full rounded-lg border border-white/15 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none"
          />
        </div>
        <button type="submit" className="h-9 rounded-lg border border-white/15 px-3 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white">
          Search
        </button>
        {filter && (
          <select
            aria-label={filter.label}
            value={filterValue}
            onChange={(e) => {
              setPage(1);
              setFilterValue(e.target.value);
            }}
            className="h-9 rounded-lg border border-white/15 bg-black px-3 text-sm text-white focus:border-white/50 focus:outline-none"
          >
            {filter.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </form>

      <div role="status" className="mt-4 min-h-5 text-sm">
        {notice && (
          <p className="flex items-center gap-2 text-amber">
            <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
            {notice}
          </p>
        )}
      </div>

      {error && !data ? (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-10 text-center">
          <p className="flex items-center justify-center gap-2 text-red-300">
            <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-6 h-9 rounded-lg bg-white px-3.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div
            role="region"
            aria-label={`${heading} table`}
            tabIndex={0}
            className={`overflow-x-auto rounded-lg border border-white/10 bg-white/5 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${loading ? 'opacity-60' : ''}`}
            aria-busy={loading}
          >
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.header} scope="col" className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.16em] text-white/65">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr key={row.id} className="border-t border-white/10 align-middle">
                    {columns.map((c) => (
                      <td key={c.header} className="px-4 py-3">
                        {c.cell(row, api)}
                      </td>
                    ))}
                  </tr>
                ))}
                {data && data.items.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-white/65">
                      {q ? `Nothing matches “${q}”.` : 'Nothing here yet.'}
                    </td>
                  </tr>
                )}
                {!data && loading && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-10 text-center text-white/65">Loading…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/65">{data.total} total</span>
              <div className="flex items-center gap-4">
                <button type="button" className={NAV_BTN} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  <ArrowLeft aria-hidden className="h-4 w-4" />
                  Prev
                </button>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/65">
                  Page {data.page} / {totalPages}
                </span>
                <button type="button" className={NAV_BTN} disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                  Next
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
