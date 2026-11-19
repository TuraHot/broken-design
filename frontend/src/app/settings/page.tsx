'use client';

// /settings — the signed-in user's account details. Password change and account deletion need API endpoints
// that do not exist yet, so they are shown as unavailable instead of as forms that would fail.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import AvatarUploader from '@/components/profile/AvatarUploader';
import { useT } from '@/lib/i18n/client';
import { clearSession, readSession, SESSION_UPDATED_EVENT, type Session } from '@/lib/session';

const CARD = 'rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-white/65">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-white">{children}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const t = useT();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const sync = () => setSession(readSession());
    sync();
    setReady(true);
    window.addEventListener('storage', sync);
    window.addEventListener(SESSION_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SESSION_UPDATED_EVENT, sync);
    };
  }, []);

  const logOut = () => {
    clearSession();
    router.push('/');
  };

  return (
    <main className="mx-auto max-w-[720px] px-4 pb-16 pt-24 md:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud">[ {t('settings.label')} ]</p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02]">{t('settings.title')}</h1>

      {!ready ? (
        <p role="status" className="mt-8 text-sm text-white/65">{t('settings.loading')}</p>
      ) : !session ? (
        <div className={`${CARD} mt-8 text-center`}>
          <p className="text-white/65">{t('settings.loginPrompt')}</p>
          <Link href="/login" className="mt-6 inline-flex h-10 items-center rounded-lg bg-white px-4 text-[15px] font-medium text-black hover:bg-white/85">
            {t('settings.login')}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6">
          <section aria-labelledby="profile-title" className={CARD}>
            <h2 id="profile-title" className={LABEL}>{t('settings.profile')}</h2>
            <div className="mt-4">
              <AvatarUploader
                name={session.user.display_name?.trim() || session.user.email}
                avatarUrl={session.user.avatar_url}
                size="lg"
                onUpdated={(nextUrl) =>
                  setSession((prev) => (prev ? { ...prev, user: { ...prev.user, avatar_url: nextUrl } } : prev))
                }
              />
            </div>
            <dl className="mt-4 divide-y divide-white/10">
              <Row label={t('settings.displayName')}>{session.user.display_name || '—'}</Row>
              <Row label={t('settings.email')}>{session.user.email}</Row>
              <Row label={t('settings.accountType')}>{session.user.is_seller ? t('settings.buyerSeller') : t('settings.buyer')}</Row>
            </dl>
            <p className="mt-3 text-sm text-white/65">{t('settings.profileNote')}</p>
          </section>

          <section aria-labelledby="security-title" className={CARD}>
            <h2 id="security-title" className={LABEL}>{t('settings.password')}</h2>
            <p className="mt-3 text-sm text-white/65">{t('settings.passwordNote')}</p>
          </section>

          <section aria-labelledby="session-title" className={CARD}>
            <h2 id="session-title" className={LABEL}>{t('settings.device')}</h2>
            <p className="mt-3 text-sm text-white/65">{t('settings.deviceNote')}</p>
            <button
              type="button"
              onClick={logOut}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm text-white transition-colors hover:bg-white/10"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              {t('settings.logout')}
            </button>
          </section>

          <section aria-labelledby="delete-title" className={CARD}>
            <h2 id="delete-title" className={LABEL}>{t('settings.delete')}</h2>
            <p className="mt-3 text-sm text-white/65">
              {t('settings.deleteBefore')}{' '}
              <Link href="/contact" className="text-white underline underline-offset-4">{t('settings.deleteLink')}</Link>
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
