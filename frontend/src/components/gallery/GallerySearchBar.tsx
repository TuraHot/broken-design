'use client';

import { FormEvent, useEffect, useState, useTransition } from 'react';
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

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSearch = (newQuery: string) => {
    const trimmed = newQuery.trim();
    const nextParams: ModelsParams = {
      ...params,
      q: trimmed || undefined,
      page: 1,
    };
    startTransition(() => {
      router.push(buildHref(nextParams));
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    handleSearch('');
  };

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-busy={isPending}
      className="relative w-full max-w-sm"
    >
      {isPending ? (
        <Loader2
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-accent motion-reduce:animate-none"
        />
      ) : (
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50"
        />
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('nav.searchPlaceholder')}
        aria-label={t('nav.searchLabel')}
        className="h-9 w-full rounded-lg border border-line bg-ink/5 pl-9 pr-8 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-ink/50 focus:outline-none"
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
