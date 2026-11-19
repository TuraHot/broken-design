// Prev / next links; page number lives in the URL
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { buildHref } from '@/lib/pagination';
import type { ModelsPage, ModelsParams } from '@/lib/types';

const BTN = 'inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm';

export default async function Pagination({ data, params = {} }: { data: ModelsPage; params?: ModelsParams }) {
  const { t } = await getT();
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (totalPages <= 1) return null;
  const { page } = data;

  return (
    <nav aria-label={t('pager.label')} className="mt-10 flex items-center justify-center gap-4">
      {page > 1 ? (
        <Link href={buildHref({ ...params, page: page - 1 })} rel="prev" className={`${BTN} text-white/65 transition-colors hover:border-white/30 hover:text-white`}>
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {t('pager.prev')}
        </Link>
      ) : (
        <span aria-disabled className={`${BTN} text-white/25`}>
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {t('pager.prev')}
        </span>
      )}
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/65">
        {t('pager.page', { page, total: totalPages })}
      </span>
      {page < totalPages ? (
        <Link href={buildHref({ ...params, page: page + 1 })} rel="next" className={`${BTN} text-white/65 transition-colors hover:border-white/30 hover:text-white`}>
          {t('pager.next')}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-disabled className={`${BTN} text-white/25`}>
          {t('pager.next')}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
