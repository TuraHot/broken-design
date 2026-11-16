'use client';

// Admins work in /admin. Whenever a signed-in admin lands on any other page of the site (after logging
// in, or by typing an address) they are sent to /admin, unless they chose "View Website" in this tab
// (`lib/admin-view.ts`). This is a convenience for the UI: the API still checks the role on every call.
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isViewingSite, stopViewingSite } from '@/lib/admin-view';
import { isAdminPath } from '@/lib/auth-paths';
import { readSession } from '@/lib/session';

// `/embed` is shown inside other people's sites, so it must never redirect.
const EXEMPT = ['/embed'];

export default function AdminOnlyRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isAdminPath(pathname)) {
      stopViewingSite();
      return;
    }
    if (EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    if (isViewingSite()) return;
    if (readSession()?.user.role === 'admin') router.replace('/admin');
  }, [pathname, router]);

  return null;
}
