'use client';

// /settings — the signed-in user's account details & profile avatar management.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Camera, Check, Loader2, LogOut, Trash2, Upload } from 'lucide-react';
import { getAvatarUrl, updateProfile } from '@/lib/auth';
import { useT } from '@/lib/i18n/client';
import { clearSession, readSession, type Session } from '@/lib/session';

const CARD = 'rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70';

const PRESET_AVATARS = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%238fd3ff"/><stop offset="100%" stop-color="%231a243b"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g1)"/><circle cx="50" cy="40" r="20" fill="%238fd3ff"/><path d="M20 85 C20 65 35 60 50 60 C65 60 80 65 80 85 Z" fill="%238fd3ff" opacity="0.8"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23b892ff"/><stop offset="100%" stop-color="%232b1a4a"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g2)"/><circle cx="50" cy="40" r="20" fill="%23b892ff"/><path d="M20 85 C20 65 35 60 50 60 C65 60 80 65 80 85 Z" fill="%23b892ff" opacity="0.8"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23ff9ec7"/><stop offset="100%" stop-color="%234a1a2e"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g3)"/><circle cx="50" cy="40" r="20" fill="%23ff9ec7"/><path d="M20 85 C20 65 35 60 50 60 C65 60 80 65 80 85 Z" fill="%23ff9ec7" opacity="0.8"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2334d399"/><stop offset="100%" stop-color="%230f382a"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g4)"/><circle cx="50" cy="40" r="20" fill="%2334d399"/><path d="M20 85 C20 65 35 60 50 60 C65 60 80 65 80 85 Z" fill="%2334d399" opacity="0.8"/></svg>',
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

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

  // Avatar state
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = readSession();
    setSession(s);
    if (s?.user?.avatar_url) {
      setAvatar(s.user.avatar_url);
    }
    setReady(true);
  }, []);

  const logOut = () => {
    clearSession();
    router.push('/');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    setAvatarError(null);
    setAvatarSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(256, Math.max(img.width, img.height));
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async () => {
    if (!session) return;
    setSavingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(false);

    try {
      const updatedUser = await updateProfile({ avatarUrl: avatar }, session.token);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSession({ ...session, user: updatedUser });
      window.dispatchEvent(new Event('storage'));
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 4000);
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to update profile picture');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    setAvatarError(null);
    setAvatarSuccess(false);
  };

  const name = session?.user?.display_name?.trim() || session?.user?.email || 'User';

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
          {/* Profile Picture Section */}
          <section aria-labelledby="avatar-title" className={CARD}>
            <h2 id="avatar-title" className={LABEL}>{t('settings.avatar')}</h2>
            
            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
              {/* Avatar Preview */}
              <div className="relative group shrink-0 flex flex-col items-center">
                <div className="grid h-24 w-24 overflow-hidden place-items-center rounded-full border-2 border-hud/60 bg-white/5 text-2xl font-semibold text-white shadow-lg">
                  {avatar ? (
                    <img src={getAvatarUrl(avatar) || ''} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <span>{initialsOf(name)}</span>
                  )}
                </div>
                {session?.user?.avatar_hash && (
                  <p className="mt-2 max-w-[110px] truncate font-mono text-[10px] text-hud/80" title={`SHA-256: ${session.user.avatar_hash}`}>
                    SHA-256: {session.user.avatar_hash.substring(0, 8)}…
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload avatar"
                  className="absolute bottom-6 right-0 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/90 text-white/80 transition-colors hover:border-hud hover:text-white"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              {/* Upload & Actions */}
              <div className="flex-1 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-white/30"
                  >
                    <Upload className="h-4 w-4" />
                    {t('settings.changeAvatar')}
                  </button>

                  {avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm text-red-300 transition-colors hover:bg-red-500/10 hover:border-red-500/30"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('settings.removeAvatar')}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={savingAvatar || avatar === (session.user.avatar_url || null)}
                    onClick={handleSaveAvatar}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-50"
                  >
                    {savingAvatar ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        {t('settings.saveAvatar')}
                      </>
                    )}
                  </button>
                </div>

                {/* Presets */}
                <div className="pt-2">
                  <p className="text-xs text-white/50">{t('settings.presets')}</p>
                  <div className="mt-2 flex items-center gap-2.5">
                    {PRESET_AVATARS.map((preset, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setAvatar(preset);
                          setAvatarSuccess(false);
                          setAvatarError(null);
                        }}
                        className={`h-9 w-9 overflow-hidden rounded-full border-2 transition-all hover:scale-105 ${
                          avatar === preset ? 'border-hud ring-2 ring-hud/30' : 'border-white/20 hover:border-white/50'
                        }`}
                      >
                        <img src={preset} alt={`Preset ${index + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback status */}
                {avatarSuccess && (
                  <p role="status" className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    {t('settings.avatarSaved')}
                  </p>
                )}
                {avatarError && (
                  <p role="status" className="flex items-center gap-1.5 text-xs text-red-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {avatarError}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Account Profile details */}
          <section aria-labelledby="profile-title" className={CARD}>
            <h2 id="profile-title" className={LABEL}>{t('settings.profile')}</h2>
            <dl className="mt-2 divide-y divide-white/10">
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
