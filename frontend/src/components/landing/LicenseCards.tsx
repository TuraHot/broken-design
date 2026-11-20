// "/06 Licenses": the four licenses as cards, with what each allows (+) and forbids (x). Text comes from lib/licenses.ts,
// the same summaries the model pages and /licenses use. A mark is never the only signal: each rule has hidden words.
import { Check, X } from 'lucide-react';
import NumberedHeading from '@/components/landing/NumberedHeading';
import { getT } from '@/lib/i18n/server';
import { LICENSE_INFO, LICENSE_INFO_TH } from '@/lib/licenses';
import type { License } from '@/lib/types';

const ORDER: { key: License; tag: string }[] = [
  { key: 'CC0', tag: 'CC0' },
  { key: 'CC-BY', tag: 'CC BY' },
  { key: 'CC-BY-NC', tag: 'CC BY-NC' },
  { key: 'COMMERCIAL', tag: 'Commercial' },
];

export default async function LicenseCards() {
  const { t, locale } = await getT();
  const info = locale === 'th' ? LICENSE_INFO_TH : LICENSE_INFO;
  return (
    <section aria-label={t('home.licenses.title')}>
      <NumberedHeading index="06" title={t('home.licenses.title')} />
      <p className="-mt-2 mb-8 max-w-[60ch] font-mono text-[12px] leading-relaxed text-ink-soft">
        {t('home.licenses.lead')}
      </p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER.map(({ key, tag }) => {
          const lic = info[key];
          // "CC0 — Public domain" -> "Public domain"
          const name = lic.name.includes('—') ? lic.name.split('—').slice(1).join('—').trim() : lic.name;
          return (
            <li key={key} className="flex flex-col gap-3.5 border border-line bg-card p-5">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-accent">{tag}</p>
              <p className="font-[family-name:var(--font-barlow)] text-[30px] font-bold uppercase leading-none text-ink">
                {name}
              </p>
              <p className="font-mono text-[12px] leading-relaxed text-ink-soft">{lic.summary}</p>
              <ul className="mt-auto grid gap-2 border-t border-line pt-3.5 font-mono text-[12px] leading-snug text-ink">
                {lic.rules.map((r) => (
                  <li key={r.text} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
                    {r.ok ? (
                      <Check aria-hidden className="mt-0.5 h-4 w-4 text-accent" />
                    ) : (
                      <X aria-hidden className="mt-0.5 h-4 w-4 text-ink-soft" />
                    )}
                    <span>
                      <span className="sr-only">{r.ok ? t('model.allowed') : t('model.notAllowed')} </span>
                      {r.text}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
