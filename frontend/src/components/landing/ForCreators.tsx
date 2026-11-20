// "/05 For creators": a big line, the three steps down the left (log in, upload, share) and four capability cards on the
// right. The copy is the creator page's own (creator.* messages), so the two cannot drift apart.
import Link from 'next/link';
import { ArrowUpRight, CodeXml, Coins, LayoutDashboard, Upload, type LucideIcon } from 'lucide-react';
import NumberedHeading from '@/components/landing/NumberedHeading';
import type { MessageKey } from '@/lib/i18n/messages';
import { getT } from '@/lib/i18n/server';

const STEPS: { no: string; title: MessageKey; body: MessageKey }[] = [
  { no: '01', title: 'creator.s1.title', body: 'creator.s1.body' },
  { no: '02', title: 'creator.s2.title', body: 'creator.s2.body' },
  { no: '03', title: 'creator.s3.title', body: 'creator.s3.body' },
];

const FEATURES: { icon: LucideIcon; title: MessageKey; body: MessageKey }[] = [
  { icon: Upload, title: 'creator.f1.title', body: 'creator.f1.body' },
  { icon: Coins, title: 'creator.f2.title', body: 'creator.f2.body' },
  { icon: CodeXml, title: 'creator.f4.title', body: 'creator.f4.body' },
  { icon: LayoutDashboard, title: 'creator.f6.title', body: 'creator.f6.body' },
];

export default async function ForCreators() {
  const { t } = await getT();
  return (
    <section aria-label={t('home.creators.title')}>
      <NumberedHeading index="05" title={t('home.creators.title')} />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-14">
        <div>
          <p className="font-[family-name:var(--font-barlow)] text-[clamp(44px,5.4vw,80px)] font-extrabold uppercase leading-[0.92] text-ink">
            {t('home.creators.h1')}
            <br />
            {t('home.creators.h2')}
          </p>
          <ol className="mt-8 border-t border-line">
            {STEPS.map((s) => (
              <li key={s.no} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-b border-line py-4">
                <span className="font-[family-name:var(--font-barlow)] text-[34px] font-bold leading-none text-accent">
                  {s.no}
                </span>
                <div>
                  <p className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink">{t(s.title)}</p>
                  <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-ink-soft">{t(s.body)}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/seller"
            className="mt-7 inline-flex items-center gap-4 bg-ink px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-canvas transition-opacity hover:opacity-85"
          >
            {t('creator.seller')}
            <ArrowUpRight aria-hidden className="h-4 w-4 text-accent" />
          </Link>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex min-h-[160px] flex-col justify-between gap-4 border border-line bg-card p-5">
              <span className="grid h-10 w-10 place-items-center border border-accent text-accent">
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              <div>
                <p className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink">{t(title)}</p>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-ink-soft">{t(body)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
