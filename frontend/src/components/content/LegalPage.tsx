// Shared shell of the legal pages: a draft notice, a table of contents, the sections, and links to the other documents.
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import DocLayout, { type TocItem } from './DocLayout';
import { LABEL, PageHeader, Section } from './prose';
import { getT } from '@/lib/i18n/server';
import { LEGAL_PAGES, LEGAL_UPDATED } from '@/lib/legal';

export interface LegalSection extends TocItem {
  body: React.ReactNode;
}

export default async function LegalPage({
  title,
  intro,
  sections,
  current,
}: {
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  current: (typeof LEGAL_PAGES)[number]['href'];
}) {
  const { t } = await getT();
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <PageHeader label={t('legal.label')} title={title} intro={intro} />

      <div role="note" className="mt-6 flex max-w-[72ch] gap-3 rounded-lg border border-amber/50 bg-white/5 p-4">
        <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
        <p className="text-sm leading-relaxed text-white/65">
          <strong className="font-medium text-amber">{t('legal.draft')}</strong> {t('legal.draftA')}{' '}
          <span className="font-mono text-[13px] text-white/80">[TO DECIDE]</span> {t('legal.draftB', { date: LEGAL_UPDATED })}
        </p>
      </div>

      <DocLayout toc={sections}>
        {sections.map((s) => (
          <Section key={s.id} id={s.id} title={s.title}>
            {s.body}
          </Section>
        ))}

        <nav aria-label={t('legal.otherNav')} className="border-t border-white/10 pt-8">
          <p className={LABEL}>{t('legal.other')}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {LEGAL_PAGES.filter((p) => p.href !== current).map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="text-white/65 underline-offset-4 transition-colors hover:text-white hover:underline">
                  {t(p.key)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/licenses" className="text-white/65 underline-offset-4 transition-colors hover:text-white hover:underline">
                {t('legal.modelLicenses')}
              </Link>
            </li>
          </ul>
        </nav>
      </DocLayout>
    </main>
  );
}
