// Landing section title in the "/02  TITLE" style: accent index, then the title in mono capitals. Optional "View all".
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export default async function NumberedHeading({
  index,
  title,
  href,
}: {
  index: string;
  title: string;
  href?: string;
}) {
  const { t } = await getT();
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="flex items-baseline gap-4 font-mono text-[13px] uppercase tracking-[0.12em] text-ink">
        <span className="text-accent">/{index}</span>
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:text-accent"
        >
          {t('home.viewAll')}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
