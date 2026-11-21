'use client';

import { FormEvent, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { buildHref } from '@/lib/pagination';
import { useT } from '@/lib/i18n/client';
import type { ModelsParams } from '@/lib/types';

export default function GallerySearchBar({
  initialQuery = '',
  params = {},
}: {
  initialQuery?: string;
  params?: ModelsParams;
}) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const isFocusedRef = useRef(false);

  // Sync with initialQuery when the input is not actively focused
  useEffect(() => {
    if (!isFocusedRef.current) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const executeSearch = (targetQuery: string) => {
    const trimmed = targetQuery.trim();
    if (trimmed === (params.q ?? '').trim()) return;
    const nextParams: ModelsParams = {
      ...params,
      q: trimmed || undefined,
      page: 1,
    };
    startTransition(() => {
      router.replace(buildHref(nextParams), { scroll: false });
    });
  };

  // Live search: auto-trigger as user types without waiting for enter
  useEffect(() => {
    const trimmed = query.trim();
    const currentQ = (params.q ?? '').trim();
    if (trimmed === currentQ) return;

    const timer = setTimeout(() => {
      executeSearch(query);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, params.q]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    executeSearch('');
  };

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-busy={isPending}
      className="relative w-full max-w-sm"
    >
      <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center justify-center">
        {isPending ? (
          <Loader2
            aria-hidden
            className="h-4 w-4 animate-spin text-accent motion-reduce:animate-none"
          />
        ) : (
          <Search
            aria-hidden
            className="h-4 w-4 text-ink/50"
          />
        )}
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
        }}
        placeholder={t('nav.searchPlaceholder')}
        aria-label={t('nav.searchLabel')}
        className="h-9 w-full rounded-lg border border-line bg-ink/5 pl-9 pr-8 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-ink/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {query && !isPending && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t('modal.close')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink/40 transition-colors hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </form>
  );
}
