// Text page body: a table of contents (a sticky column from `lg`, a plain list above the text on phones)
// next to the sections.
import { getT } from '@/lib/i18n/server';
import { LABEL } from './prose';

export interface TocItem {
  id: string;
  title: string;
}

export default async function DocLayout({ toc, children }: { toc: TocItem[]; children: React.ReactNode }) {
  const { t } = await getT();
  return (
    <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
      <nav aria-label={t('doc.onThisPage')} className="lg:sticky lg:top-24 lg:self-start">
        <p className={LABEL}>{t('doc.onThisPage')}</p>
        <ul className="mt-3 grid gap-1 border-l border-line text-sm">
          {toc.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-ink-soft transition-colors hover:border-ink/50 hover:text-ink">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12">{children}</div>
    </div>
  );
}
