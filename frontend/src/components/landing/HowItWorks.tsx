// "/02.1 How it works": four steps in a row (lucide line icons, accent title, short mono text).
import { ClipboardPaste, Copy, Search, Zap, type LucideIcon } from 'lucide-react';
import NumberedHeading from '@/components/landing/NumberedHeading';
import type { MessageKey } from '@/lib/i18n/messages';
import { getT } from '@/lib/i18n/server';

const STEPS: { icon: LucideIcon; title: MessageKey; body: MessageKey }[] = [
  { icon: Search, title: 'home.how.s1.t', body: 'home.how.s1.d' },
  { icon: Copy, title: 'home.how.s2.t', body: 'home.how.s2.d' },
  { icon: ClipboardPaste, title: 'home.how.s3.t', body: 'home.how.s3.d' },
  { icon: Zap, title: 'home.how.s4.t', body: 'home.how.s4.d' },
];

export default async function HowItWorks() {
  const { t } = await getT();
  return (
    <section aria-label={t('home.how.title')}>
      <NumberedHeading index="02.1" title={t('home.how.title')} />
      <ol className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-4">
            <Icon aria-hidden strokeWidth={1.25} className="h-12 w-12 shrink-0 text-ink" />
            <div className="min-w-0">
              <p className="font-mono text-[12px] uppercase leading-snug tracking-[0.06em] text-accent">
                <span className="sr-only">{i + 1}. </span>
                {t(title)}
              </p>
              <p className="mt-2 font-mono text-[12px] leading-relaxed text-ink">{t(body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
