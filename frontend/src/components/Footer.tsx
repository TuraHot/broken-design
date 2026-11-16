'use client';

// Site footer — brand line and links to pages that exist. Hidden on the auth pages.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useReport } from '@/components/report/ReportProvider';
import { hidesPublicChrome } from '@/lib/auth-paths';

// A link goes to a page; `report` opens the "Report a problem" popup instead.
type FooterLink = { label: string; href: string } | { label: string; report: true };

const GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/gallery', label: 'Gallery' },
      { href: '/docs', label: 'Docs' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/login', label: 'Log in or sign up' },
      { label: 'Report a problem', report: true },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();
  const { openReport } = useReport();
  if (hidesPublicChrome(pathname)) return null;

  return (
    <footer className="relative z-10 border-t border-white/10 bg-black">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 md:grid-cols-[1fr_auto] md:px-6">
        <div>
          <p className="font-semibold tracking-wide text-white">Lixyte</p>
          <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-white/65">
            A 3D asset repository and WebGL CDN. Pick a .glb, copy one line of code, ship it.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-16 gap-y-8">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">{g.title}</p>
              <ul className="mt-3 grid gap-2 text-sm">
                {g.links.map((l) => (
                  <li key={l.label}>
                    {'report' in l ? (
                      <button type="button" onClick={openReport} className="text-left text-white/65 transition-colors hover:text-white">
                        {l.label}
                      </button>
                    ) : (
                      <Link href={l.href} className="text-white/65 transition-colors hover:text-white">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1400px] px-4 py-5 font-mono text-[11px] tracking-[0.08em] text-white/40 md:px-6">
          © {new Date().getFullYear()} Lixyte
        </p>
      </div>
    </footer>
  );
}
