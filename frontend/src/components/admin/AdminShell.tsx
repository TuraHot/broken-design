'use client';

// Layout for every /admin page. It replaces the public navbar and footer (see `lib/auth-paths.ts`):
// a sidebar on desktop, a top bar with tabs on phones, and Log out. Admins never use the public site: they stay in
// this area and `components/AdminOnlyRedirect.tsx` sends them back from every other page (there is no way out).
// The gate only decides what to show; the API re-checks the admin role in the database on every call.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Box, Flag, LayoutDashboard, LogOut, Receipt, UserCheck, Users, Wallet, type LucideIcon } from 'lucide-react';
import LanguageSwitch from '@/components/LanguageSwitch';
import { fetchWaitingSummary, WAITING_CHANGED_EVENT, type AdminWaitingCounts } from '@/lib/admin-api';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import { clearSession, readSession, SESSION_UPDATED_EVENT, type Session } from '@/lib/session';

type Count = keyof AdminWaitingCounts;

// `count` = which waiting number to show next to the tab (applications and complaints still waiting for an admin).
const TABS: { href: string; label: MessageKey; icon: LucideIcon; count?: Count }[] = [
  { href: '/admin', label: 'admin.nav.overview', icon: LayoutDashboard },
  { href: '/admin/notifications', label: 'admin.nav.notifications', icon: Bell, count: 'total' },
  { href: '/admin/models', label: 'admin.nav.models', icon: Box },
  { href: '/admin/users', label: 'admin.nav.users', icon: Users },
  { href: '/admin/creator-approvals', label: 'admin.nav.creatorApprovals', icon: UserCheck, count: 'creatorApplications' },
  { href: '/admin/purchases', label: 'admin.nav.purchases', icon: Receipt },
  { href: '/admin/withdrawals', label: 'admin.nav.withdrawals', icon: Wallet },
  { href: '/admin/complaints', label: 'admin.nav.complaints', icon: Flag, count: 'complaints' },
];

const REFRESH_MS = 60_000;

const PRIMARY = 'inline-flex h-9 items-center rounded-lg bg-white px-3.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85';
const SIDE_LINK = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] transition-colors';

function Notice({ code, text, action }: { code: string; text: string; action: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 p-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/65">[ {code} ]</p>
        <p className="mt-3 text-white/65">{text}</p>
        <div className="mt-6 flex justify-center">{action}</div>
      </div>
    </main>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const sync = () => {
      setSession(readSession());
      setReady(true);
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(SESSION_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SESSION_UPDATED_EVENT, sync);
    };
  }, []);

  // How many things wait for an admin (shown next to the tabs). Read again on every page change and once a minute while
  // the tab is visible; a failed read keeps the last numbers (the pages themselves show their own errors).
  const [waiting, setWaiting] = useState<AdminWaitingCounts | null>(null);
  const isAdmin = session?.user.role === 'admin';
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const read = () => {
      if (document.visibilityState === 'hidden') return;
      fetchWaitingSummary()
        .then((c) => !cancelled && setWaiting(c))
        .catch(() => undefined);
    };
    read();
    const timer = window.setInterval(read, REFRESH_MS);
    window.addEventListener(WAITING_CHANGED_EVENT, read);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(WAITING_CHANGED_EVENT, read);
    };
  }, [isAdmin, pathname]);

  if (!ready) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <p role="status" className="text-sm text-white/65">{t('admin.loading')}</p>
      </main>
    );
  }
  if (!session) {
    return <Notice code="401" text={t('admin.e401')} action={<Link href="/login" className={PRIMARY}>{t('admin.login')}</Link>} />;
  }
  if (session.user.role !== 'admin') {
    return <Notice code="403" text={t('admin.e403')} action={<Link href="/" className={PRIMARY}>{t('admin.backHome')}</Link>} />;
  }

  const name = session.user.display_name?.trim() || session.user.email;
  const logOut = () => {
    clearSession();
    setSession(null);
    router.push('/');
  };

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));
  const tabLinks = (cls: (active: boolean) => string, withIcon: boolean) =>
    TABS.map(({ href, label, icon: Icon, count }) => {
      const n = count && waiting ? waiting[count] : 0;
      return (
        <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined} className={cls(isActive(href))}>
          {withIcon && <Icon aria-hidden className="h-4 w-4 shrink-0" />}
          {t(label)}
          {n > 0 && (
            <span className="ml-2 grid h-5 min-w-5 place-items-center rounded-full border border-amber/50 px-1.5 font-mono text-[11px] text-amber md:ml-auto">
              <span aria-hidden>{n > 99 ? '99+' : n}</span>
              <span className="sr-only">{t('admin.waitingCount', { n })}</span>
            </span>
          )}
        </Link>
      );
    });

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/10 bg-black p-4 md:flex">
        <div className="px-3 pb-6 pt-2">
          <p className="text-base font-semibold tracking-wide text-white">Lixyte</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-hud">[ {t('admin.label')} ]</p>
        </div>

        <nav aria-label={t('admin.navLabel')} className="grid gap-1">
          {tabLinks(
            (active) => `${SIDE_LINK} ${active ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`,
            true,
          )}
        </nav>

        <div className="mt-auto grid gap-1 border-t border-white/10 pt-4">
          <div className="px-3 pb-2">
            <p className="truncate text-sm text-white">{name}</p>
            {name !== session.user.email && <p className="truncate text-xs text-white/65">{session.user.email}</p>}
          </div>
          <div className="px-3 pb-2">
            <LanguageSwitch />
          </div>
          <button type="button" onClick={logOut} className={`${SIDE_LINK} text-white/65 hover:bg-white/5 hover:text-white`}>
            <LogOut aria-hidden className="h-4 w-4 shrink-0" />
            {t('admin.logout')}
          </button>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur md:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <p className="text-[15px] font-semibold tracking-wide text-white">Lixyte</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud">[ {t('admin.label')} ]</p>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitch />
            <button type="button" onClick={logOut} aria-label={t('admin.logout')} className="grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:text-white">
              <LogOut aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav aria-label={t('admin.navLabel')} className="flex gap-1 overflow-x-auto border-t border-white/10 px-2">
          {tabLinks(
            (active) =>
              `-mb-px inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2 text-[15px] transition-colors ${
                active ? 'border-white text-white' : 'border-transparent text-white/65 hover:text-white'
              }`,
            false,
          )}
        </nav>
      </header>

      <main className="px-4 pb-16 pt-32 md:ml-60 md:px-8 md:pt-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
