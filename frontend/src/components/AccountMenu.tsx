'use client';

// Right side of the Navbar: "Log in" when signed out, an account menu when signed in.
// The menu items are a convenience; every page and API checks the role again on the server.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReport } from '@/components/report/ReportProvider';
import NotificationBell from '@/components/notifications/NotificationBell';
import UserAvatar from '@/components/ui/UserAvatar';
import { CORE_API_URL, fetchNotices } from '@/lib/api';
import { creatorHandle } from '@/lib/creators';
import { useT } from '@/lib/i18n/client';
import { clearSession, readSession, SESSION_UPDATED_EVENT, updateSessionUser, type Session } from '@/lib/session';

const itemClass =
  'flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-ink/65 transition-colors hover:bg-ink/10 hover:text-ink';

export default function AccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { openReport } = useReport();
  const t = useT();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const syncedTokenRef = useRef<string | null>(null);

  // Read the saved sign-in after mount (sessionStorage does not exist on the server), again on every
  // page change (the login form saves it just before it navigates), and when updated in this tab.
  useEffect(() => {
    setSession(readSession());
    setReady(true);
    setOpen(false);
  }, [pathname]);

  // Everyone except admins sees how many notices they have not read yet (a suspension or its end, a license change).
  const noticeToken = session && session.user.role !== 'admin' ? session.token : null;
  useEffect(() => {
    if (!noticeToken) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    fetchNotices(noticeToken)
      .then((d) => !cancelled && setUnread(d.unread))
      .catch(() => !cancelled && setUnread(0));
    return () => {
      cancelled = true;
    };
  }, [noticeToken, pathname]);

  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener('storage', sync);
    window.addEventListener(SESSION_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SESSION_UPDATED_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    const token = session?.token;
    if (!token) {
      syncedTokenRef.current = null;
      return;
    }
    if (syncedTokenRef.current === token) return;
    syncedTokenRef.current = token;

    let cancelled = false;
    fetch(`${CORE_API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.user) {
          updateSessionUser(data.user);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onUnreadChange = useCallback((n: number) => setUnread(n), []);

  const logOut = () => {
    clearSession();
    setSession(null);
    setOpen(false);
    router.push('/');
  };

  // Shown when signed out, hidden until we know whether someone is signed in (no flicker or shift).
  const authButtons = (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${ready ? '' : 'invisible'}`}>
      <Link
        href="/login"
        className="hidden h-9 items-center min-[375px]:inline-flex whitespace-nowrap rounded-lg px-2.5 text-[14px] font-medium text-ink/75 transition-colors hover:bg-ink/10 hover:text-ink sm:px-3 sm:text-[15px]"
      >
        {t('nav.login')}
      </Link>
      <Link
        href="/register"
        className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-ink px-3 text-[14px] font-medium text-canvas transition-colors hover:bg-ink/85 sm:px-3.5 sm:text-[15px]"
      >
        {t('nav.register')}
      </Link>
    </div>
  );

  if (!session) return authButtons;

  const { user } = session;
  const name = user.display_name?.trim() || user.email;
  const isAdmin = user.role === 'admin';

  return (
    <div className="flex items-center gap-1 sm:gap-2">
    {/* The bell is for notices, which admins do not get (the API gives them none) */}
    {!isAdmin && <NotificationBell token={session.token} unread={unread} onUnreadChange={onUnreadChange} />}
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('menu.account', { name })}
        className="rounded-full transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <UserAvatar name={name} avatarUrl={user.avatar_url} size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-ink/15 bg-canvas/95 p-1 backdrop-blur">
          <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
            <UserAvatar name={name} avatarUrl={user.avatar_url} size="sm" className="!h-8 !w-8 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              {name !== user.email && <p className="truncate text-xs text-ink/65">{user.email}</p>}
            </div>
          </div>
          <ul className="pt-1">
            {isAdmin ? (
              // An admin never uses the public pages (AdminOnlyRedirect sends them back); the only entry is the admin area.
              <li>
                <Link href="/admin" className={itemClass}>
                  {t('menu.admin')}
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link href="/me" className={itemClass}>
                    {t('menu.library')}
                    {unread > 0 && (
                      <span className="ml-2 rounded border border-warn/50 px-1.5 py-0.5 font-mono text-[10px] uppercase text-warn">
                        {t('menu.newNotices', { n: unread })}
                      </span>
                    )}
                  </Link>
                </li>
                {user.is_seller && (() => {
                  const handle = creatorHandle(name);
                  const profileHref = handle ? `/creators/${encodeURIComponent(handle)}` : '/seller';
                  return (
                    <li>
                      <Link href={profileHref} className={itemClass}>
                        {t('menu.creatorProfile')}
                      </Link>
                    </li>
                  );
                })()}
                <li>
                  <Link href="/settings" className={itemClass}>
                    {t('menu.settings')}
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openReport();
                    }}
                    className={itemClass}
                  >
                    {t('menu.report')}
                  </button>
                </li>
              </>
            )}
            <li>
              <button type="button" onClick={logOut} className={itemClass}>
                {t('menu.logout')}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
    </div>
  );
}
