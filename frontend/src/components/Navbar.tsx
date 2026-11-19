'use client';

// Top navigation — logo, Gallery / Docs / Creator, search box (goes to /gallery?q=), Log in or account menu
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, MouseEvent, useEffect, useState, useTransition } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { startNavigationLoading } from '@/components/ui/NavigationProgress';
import { hidesPublicChrome } from '@/lib/auth-paths';
import { creatorHandle } from '@/lib/creators';
import { readSession } from '@/lib/session';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import AccountMenu from './AccountMenu';
import LanguageSwitch from './LanguageSwitch';
import ThemeToggle from './ThemeToggle';

// `desktopOnly` links are hidden below `sm` so the bar fits at 375px.
const LINKS: { href: string; label: MessageKey; desktopOnly?: boolean }[] = [
  { href: '/gallery', label: 'nav.gallery' },
  { href: '/docs', label: 'nav.docs', desktopOnly: true },
  { href: '/creator', label: 'nav.creator' },
];

export default function Navbar() {
  const pathname = usePathname();
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mobileSearch, setMobileSearch] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
        setCreatorDashboardHref(handle ? `/creators/${handle}?tab=dashboard` : '/seller');
      } else {
        setCreatorDashboardHref(null);
      }
    };
    update();
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [pathname]);

  const handleNavClick = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (pendingHref !== null || pathname === href) {
      e.preventDefault();
      return;
    }
    setPendingHref(href);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isPending || pendingHref !== null) return;
    const q = query.trim();
    const target = q ? `/gallery?q=${encodeURIComponent(q)}` : '/gallery';
    startNavigationLoading('/gallery');
    startTransition(() => {
      router.push(target);
    });
  };

  if (hidesPublicChrome(pathname)) return null;

  const searchField = (
    <form onSubmit={submit} role="search" aria-busy={isPending} className="relative w-full">
      {isPending ? (
        <Loader2
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-hud motion-reduce:animate-none"
        />
      ) : (
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('nav.searchPlaceholder')}
        aria-label={t('nav.searchLabel')}
        className="h-9 w-full rounded-lg border border-white/15 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none"
      />
    </form>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:gap-5 md:px-6">
        <Link
          href="/"
          onClick={handleNavClick('/')}
          aria-busy={pendingHref === '/'}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] font-semibold tracking-wide text-white sm:text-base ${
            pendingHref !== null ? 'pointer-events-none' : ''
          }`}
        >
          <span>Lixyte</span>
          {pendingHref === '/' && (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-hud motion-reduce:animate-none" />
          )}
        </Link>

        <ul className={`flex items-center gap-3 text-sm sm:gap-5 sm:text-[15px] ${pendingHref !== null ? 'pointer-events-none' : ''}`}>
          {LINKS.map(({ href: baseHref, label, desktopOnly }) => {
            const href = baseHref === '/creator' && creatorDashboardHref ? creatorDashboardHref : baseHref;
            const hrefPath = href.split('?')[0];
            const active = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
            const loading = pendingHref === href;
            return (
              <li key={href} className={desktopOnly ? 'hidden sm:block' : undefined}>
                <Link
                  href={href}
                  onClick={handleNavClick(hrefPath)}
                  aria-current={active ? 'page' : undefined}
                  aria-busy={loading}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
                    loading ? 'text-hud' : active ? 'text-white' : 'text-white/65 transition-colors hover:text-white'
                  }`}
                >
                  <span>{t(label)}</span>
                  {loading && (
                    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-hud motion-reduce:animate-none" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden w-full max-w-xs md:block">{searchField}</div>

        <div className="ml-auto flex items-center gap-2 text-[15px] sm:gap-3">
          <button
            type="button"
            onClick={() => setMobileSearch((v) => !v)}
            aria-label={mobileSearch ? t('nav.closeSearch') : t('nav.openSearch')}
            aria-expanded={mobileSearch}
            className="grid h-9 w-8 place-items-center rounded-lg text-white/80 hover:text-white md:hidden"
          >
            {mobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
          <ThemeToggle />
          <LanguageSwitch />
          <AccountMenu />
        </div>
      </nav>

      {mobileSearch && <div className="border-t border-white/10 px-4 py-3 md:hidden">{searchField}</div>}
    </header>
  );
}
