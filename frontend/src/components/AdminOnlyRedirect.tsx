'use client';

// Admins work in /admin and never use the public site. Whenever a signed-in admin lands on any other page
// (after logging in, by typing an address, or by following a link) they are sent to /admin. There is no way to
// browse the public site as an admin: an admin account does not buy or sell, and it must not be able to try.
// This is a convenience for the UI: the API still checks the role in the database on every call (an admin is
// refused on checkout and payment with ADMIN_CANNOT_BUY).
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAdminPath } from '@/lib/auth-paths';
import { readSession, SESSION_UPDATED_EVENT } from '@/lib/session';

// `/embed` is shown inside other people's sites, so it must never redirect.
const EXEMPT = ['/embed'];

export default function AdminOnlyRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const check = () => {
      if (isAdminPath(pathname)) return;
      if (EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
      if (readSession()?.user.role === 'admin') router.replace('/admin');
    };
    check();
    window.addEventListener('storage', check);
    window.addEventListener(SESSION_UPDATED_EVENT, check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener(SESSION_UPDATED_EVENT, check);
    };
  }, [pathname, router]);

  return null;
}
