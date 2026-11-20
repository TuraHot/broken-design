'use client';

// Top navigation — logo, Gallery / Docs / Creator, Log in or account menu
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MouseEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { hidesPublicChrome } from '@/lib/auth-paths';
import { creatorHandle } from '@/lib/creators';
import { readSession, SESSION_UPDATED_EVENT } from '@/lib/session';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import AccountMenu from './AccountMenu';
import LanguageSwitch from './LanguageSwitch';
import ThemeToggle from './ThemeToggle';

// `desktopOnly` links are hidden below `sm` so the bar fits at 375px; `hideBelow375` links also go on the narrowest phones
// (360px), where the theme toggle, bell and account button no longer fit next to them.
const LINKS: { href: string; label: MessageKey; desktopOnly?: boolean; hideBelow375?: boolean }[] = [
  { href: '/gallery', label: 'nav.gallery' },
  { href: '/docs', label: 'nav.docs', desktopOnly: true },
  { href: '/creator', label: 'nav.creator', hideBelow375: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const t = useT();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [creatorDashboardHref, setCreatorDashboardHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // A signed-in creator goes straight to their Creator Profile Seller Dashboard; everyone else sees the landing page.
  // Read again on every page change so logging in or out in this tab is picked up (the storage event only fires in other tabs).
  useEffect(() => {
    const update = () => {
      const user = readSession()?.user;
      const canSell = Boolean(user && user.role !== 'admin' && (user.is_seller || user.role === 'creator'));
      if (canSell && user) {
        const handle = creatorHandle(user.display_name?.trim() || user.email);
        setCreatorDashboardHref(handle ? `/creators/${encodeURIComponent(handle)}?tab=dashboard` : '/seller');
      } else {
        setCreatorDashboardHref(null);
      }
    };
    update();
    window.addEventListener('storage', update);
    window.addEventListener(SESSION_UPDATED_EVENT, update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener(SESSION_UPDATED_EVENT, update);
    };
  }, [pathname]);

  const handleNavClick = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (pendingHref !== null || pathname === href) {
      e.preventDefault();
      return;
    }
    setPendingHref(href);
  };

  if (hidesPublicChrome(pathname)) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas/90 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:gap-5 md:px-6">
        <Link
          href="/"
          onClick={handleNavClick('/')}
          aria-busy={pendingHref === '/'}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] font-semibold tracking-wide text-ink sm:text-base ${
            pendingHref !== null ? 'pointer-events-none' : ''
          }`}
        >
          <span>Lixyte</span>
          {pendingHref === '/' && (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-accent motion-reduce:animate-none" />
          )}
        </Link>

        <ul className={`flex items-center gap-3 text-sm sm:gap-5 sm:text-[15px] ${pendingHref !== null ? 'pointer-events-none' : ''}`}>
          {LINKS.map(({ href: baseHref, label, desktopOnly, hideBelow375 }) => {
            const href = baseHref === '/creator' && creatorDashboardHref ? creatorDashboardHref : baseHref;
            const hrefPath = href.split('?')[0];
            const active = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
            const loading = pendingHref === href;
            return (
              <li key={href} className={desktopOnly ? 'hidden sm:block' : hideBelow375 ? 'hidden min-[375px]:block' : undefined}>
                <Link
                  href={href}
                  onClick={handleNavClick(hrefPath)}
                  aria-current={active ? 'page' : undefined}
                  aria-busy={loading}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
                    loading ? 'text-accent' : active ? 'text-ink' : 'text-ink/65 transition-colors hover:text-ink'
                  }`}
                >
                  <span>{t(label)}</span>
                  {loading && (
                    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-accent motion-reduce:animate-none" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-1 text-[15px] sm:gap-3">
          <ThemeToggle />
          <LanguageSwitch />
          <AccountMenu />
        </div>
      </nav>
    </header>
  );
}
