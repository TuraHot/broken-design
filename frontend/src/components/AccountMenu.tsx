'use client';

// Right side of the Navbar: "Log in" when signed out, an account menu when signed in.
// The menu items are a convenience; every page and API checks the role again on the server.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useReport } from '@/components/report/ReportProvider';
import { creatorHandle } from '@/lib/creators';
import { clearSession, readSession, type Session } from '@/lib/session';

const itemClass =
  'flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

export default function AccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { openReport } = useReport();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Read the saved sign-in after mount (localStorage does not exist on the server), again on every
  // page change (the login form saves it just before it navigates), and when another tab changes it.
  useEffect(() => {
    setSession(readSession());
    setReady(true);
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onStorage = () => setSession(readSession());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  const logOut = () => {
    clearSession();
    setSession(null);
    setOpen(false);
    router.push('/');
  };

  // Same size as the Log in button, hidden until we know whether someone is signed in (no flicker or shift).
  const loginButton = (
    <Link
      href="/login"
      className={`whitespace-nowrap rounded-lg bg-white px-3 py-1.5 font-medium text-black transition-colors hover:bg-white/85 sm:px-3.5 ${
        ready ? '' : 'invisible'
      }`}
    >
      Log in
    </Link>
  );

  if (!session) return loginButton;

  const { user } = session;
  const name = user.display_name?.trim() || user.email;
  const isAdmin = user.role === 'admin';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account menu for ${name}`}
        className="grid h-9 w-9 place-items-center rounded-full border border-hud/50 bg-white/5 text-[13px] font-medium text-white transition-colors hover:border-hud hover:bg-white/10"
      >
        {initialsOf(name)}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-white/15 bg-black/95 p-1 backdrop-blur">
          <div className="border-b border-white/10 px-3 py-2">
            <p className="truncate text-sm text-white">{name}</p>
            {name !== user.email && <p className="truncate text-xs text-white/65">{user.email}</p>}
          </div>
          <ul className="pt-1">
            {isAdmin ? (
              // An admin only reaches the public pages through "View Website"; this is the way back.
              <li>
                <Link href="/admin" className={itemClass}>
                  Admin dashboard
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link href="/me" className={itemClass}>
                    Library
                  </Link>
                </li>
                {user.is_seller && (
                  <>
                    <li>
                      <Link href="/seller" className={itemClass}>
                        Seller dashboard
                      </Link>
                    </li>
                    <li>
                      <Link href={`/creators/${creatorHandle(name)}`} className={itemClass}>
                        Creator profile
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openReport();
                    }}
                    className={itemClass}
                  >
                    Report a problem
                  </button>
                </li>
              </>
            )}
            <li>
              <button type="button" onClick={logOut} className={itemClass}>
                Log out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
