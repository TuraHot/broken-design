'use client';

// Site footer — brand line and links to pages that exist. Hidden on the auth pages.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useReport } from '@/components/report/ReportProvider';
import { hidesPublicChrome } from '@/lib/auth-paths';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import { LEGAL_PAGES } from '@/lib/legal';

// A link goes to a page; `report` opens the "Report a problem" popup instead.
type FooterLink = { label: MessageKey; href: string } | { label: MessageKey; report: true };

const GROUPS: { title: MessageKey; links: FooterLink[] }[] = [
  {
    title: 'footer.product',
    links: [
      { href: '/gallery', label: 'footer.gallery' },
      { href: '/docs', label: 'footer.docs' },
      { href: '/licenses', label: 'footer.licenses' },
    ],
  },
  {
    title: 'footer.account',
    links: [
      { href: '/login', label: 'footer.login' },
      { label: 'footer.report', report: true },
      { href: '/contact', label: 'footer.contact' },
    ],
  },
  {
    title: 'footer.legal',
    links: LEGAL_PAGES.map((p) => ({ href: p.href, label: p.key })),
  },
];

export default function Footer() {
  const pathname = usePathname();
  const { openReport } = useReport();
  const t = useT();
  if (hidesPublicChrome(pathname)) return null;

  return (
    <footer className="relative z-10 border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 md:grid-cols-[1fr_auto] md:px-6">
        <div>
          <p className="font-semibold tracking-wide text-ink">Lixyte</p>
          <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-ink/65">{t('footer.tagline')}</p>
        </div>
        <nav aria-label={t('footer.nav')} className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3 sm:gap-x-16">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent/70">{t(g.title)}</p>
              <ul className="mt-3 grid gap-2 text-sm">
                {g.links.map((l) => (
                  <li key={l.label}>
                    {'report' in l ? (
                      <button type="button" onClick={openReport} className="text-left text-ink/65 transition-colors hover:text-ink">
                        {t(l.label)}
                      </button>
                    ) : (
                      <Link href={l.href} className="text-ink/65 transition-colors hover:text-ink">
                        {t(l.label)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1400px] px-4 py-5 font-mono text-[11px] tracking-[0.08em] text-ink/40 md:px-6">
          © {new Date().getFullYear()} Lixyte
        </p>
      </div>
    </footer>
  );
}
