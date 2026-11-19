'use client';

// Client-side CTA buttons on /creator: links signed-in creators to /seller and /creators/[handle],
// signed-in buyers to /me, and signed-out visitors to /login.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Store, User } from 'lucide-react';
import { creatorHandle } from '@/lib/creators';
import { useT } from '@/lib/i18n/client';
import { readSession, type Session } from '@/lib/session';

const PRIMARY_BTN =
  'inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85';
const SECONDARY_BTN =
  'inline-flex items-center gap-2 rounded-lg border border-hud/40 bg-hud/10 px-3.5 py-1.5 text-[15px] font-medium text-hud transition-colors hover:bg-hud/20';
const OUTLINE_BTN =
  'border border-white px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-black';

export default function CreatorActions() {
  const t = useT();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(readSession());
    const onStorage = () => setSession(readSession());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const user = session?.user;
  const isCreator = Boolean(user?.is_seller || user?.role === 'creator');
  const displayName = user?.display_name?.trim() || user?.email || '';
  const handle = displayName ? creatorHandle(displayName) : '';

  return (
    <div className="mt-7 flex flex-wrap items-center gap-3">
      {isCreator && handle ? (
        <>
          <Link href="/seller" className={PRIMARY_BTN}>
            <Store aria-hidden className="h-4 w-4" />
            {t('creator.seller')}
          </Link>
          <Link href={`/creators/${handle}`} className={SECONDARY_BTN}>
            <User aria-hidden className="h-4 w-4" />
            {t('creator.profile')}
          </Link>
        </>
      ) : user ? (
        <Link href="/me" className={PRIMARY_BTN}>
          {t('creator.become')}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <Link href="/login" className={PRIMARY_BTN}>
          {t('creator.start')}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      )}
      <a href="#how-it-works" className={OUTLINE_BTN}>
        {t('creator.how')}
      </a>
    </div>
  );
}
