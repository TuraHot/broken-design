// "/07 FAQ": a big line and contact link on the left, six questions on the right that open and close (native <details>,
// so the keyboard and screen readers work with no script). Only answers the product can stand behind: nothing about fees
// or payouts until those are decided.
import Link from 'next/link';
import { ArrowUpRight, Minus, Plus } from 'lucide-react';
import NumberedHeading from '@/components/landing/NumberedHeading';
import type { MessageKey } from '@/lib/i18n/messages';
import { getT } from '@/lib/i18n/server';

const ITEMS: { q: MessageKey; a: MessageKey }[] = [
  { q: 'home.faq.q1', a: 'home.faq.a1' },
  { q: 'home.faq.q2', a: 'home.faq.a2' },
  { q: 'home.faq.q3', a: 'home.faq.a3' },
  { q: 'home.faq.q4', a: 'home.faq.a4' },
  { q: 'home.faq.q5', a: 'home.faq.a5' },
  { q: 'home.faq.q6', a: 'home.faq.a6' },
];

export default async function Faq() {
  const { t } = await getT();
  return (
    <section aria-label={t('home.faq.title')}>
      <NumberedHeading index="07" title={t('home.faq.title')} />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-14">
        <div>
          <p className="font-[family-name:var(--font-barlow)] text-[clamp(44px,5.4vw,80px)] font-extrabold uppercase leading-[0.92] text-ink">
            {t('home.faq.h1')}
            <br />
            {t('home.faq.h2')}
          </p>
          <p className="mt-5 max-w-[38ch] font-mono text-[12px] leading-relaxed text-ink-soft">{t('home.faq.lead')}</p>
          <Link
            href="/contact"
            className="mt-5 inline-flex items-center gap-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:text-accent"
          >
            {t('home.faq.contact')}
            <ArrowUpRight aria-hidden className="h-4 w-4 text-accent" />
          </Link>
        </div>

        <div className="border-t border-ink">
          {ITEMS.map(({ q, a }) => (
            <details key={q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                <span>{t(q)}</span>
                <span className="grid h-7 w-7 shrink-0 place-items-center border border-line text-accent group-open:border-accent">
                  <Plus aria-hidden className="h-4 w-4 group-open:hidden" />
                  <Minus aria-hidden className="hidden h-4 w-4 group-open:block" />
                </span>
              </summary>
              <p className="pb-5 pr-12 font-mono text-[12px] leading-[1.8] text-ink-soft">{t(a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
