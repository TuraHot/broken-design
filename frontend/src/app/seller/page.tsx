'use client';

// Unified redirect: /seller -> /creators/[handle]?tab=dashboard (single source of truth for the Seller Dashboard).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSellerStatus } from '@/lib/api';
import { creatorHandle } from '@/lib/creators';
import { useT } from '@/lib/i18n/client';
import { readSession, updateSessionUser } from '@/lib/session';

export default function SellerRedirectPage() {
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    let active = true;
    (async () => {
      const session = readSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const u = session.user;
      if (u.role === 'admin') {
        router.replace('/admin');
        return;
      }

      const displayName = u.display_name?.trim() || u.email;
      const handle = creatorHandle(displayName);

      if (u.is_seller || u.role === 'creator') {
        router.replace(`/creators/${handle}?tab=dashboard`);
        return;
      }

      // Check live DB status in case an admin approved the creator application after login.
      const sellerActive = await fetchSellerStatus(session.token).catch(() => false);
      if (!active) return;

      if (sellerActive) {
        updateSessionUser({ is_seller: true, role: 'creator' });
        router.replace(`/creators/${handle}?tab=dashboard`);
      } else {
        router.replace('/creator');
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-24 md:px-6">
      <p className="font-mono text-sm text-white/50">{t('seller.loading')}</p>
    </main>
  );
}
