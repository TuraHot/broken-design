// Landing section title row: mono label + Michroma heading on the left, optional "View all" link on the right
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export default async function SectionHeading({
  label,
  title,
  href,
}: {
  label: string;
  title: string;
  href?: string;
}) {
  const { t } = await getT();
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent/70">[ {label} ]</p>
        <h2 className="mt-3 font-display text-[clamp(20px,2.6vw,30px)] uppercase leading-[1.05] text-ink">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="hidden items-center gap-1.5 whitespace-nowrap text-sm text-ink-soft transition-colors hover:text-ink sm:inline-flex md:mr-24"
        >
          {t('home.viewAll')}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
