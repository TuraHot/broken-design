'use client';

// /settings — the signed-in user's account details, display name, and profile logo/avatar management.
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2, LogOut, Trash2, Upload } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { deleteMyAvatar, updateProfile, uploadMyAvatar } from '@/lib/auth';
import { useT } from '@/lib/i18n/client';
import { authErrorText } from '@/lib/i18n/auth-error';
import type { MessageKey } from '@/lib/i18n/messages';
import {
  clearSession,
  readSession,
  SESSION_UPDATED_EVENT,
  updateSessionUser,
  type Session,
} from '@/lib/session';

const CARD = 'rounded-lg border border-line bg-ink/5 p-5 sm:p-6';
const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-accent';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);
const ALLOWED_IMAGE_EXTS = new Set(['webp', 'png', 'jpg', 'jpeg']);

const PRESET_AVATARS = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%238fd3ff"/><stop offset="100%25" stop-color="%231a243b"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g1)"/><circle cx="50" cy="40" r="20" fill="%238fd3ff"/><path d="M20 85 C20 65 35 60 50 60 C65 60 80 65 80 85 Z" fill="%238fd3ff" opacity="0.8"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%23b892ff"/><stop offset="100%25" stop-color="%232b1a4a"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g2)"/><circle cx="50" cy="40" r="20" fill="%23b892ff"/><path d="M20 85 C20 65 35 60 50 60 C65 60 80 65 80 85 Z" fill="%23b892ff" opacity="0.8"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%23ff9ec7"/><stop offset="100%25" stop-color="%234a1a2e"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g3)"/><circle cx="50" cy="40" r="20" fill="%23ff9ec7"/><path d="M20 85 C20 65 35 60 50 60 C65 60 80 65 80 85 Z" fill="%23ff9ec7" opacity="0.8"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%2334d399"/><stop offset="100%25" stop-color="%230f382a"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g4)"/><circle cx="50" cy="40" r="20" fill="%2334d399"/><path d="M20 85 C20 65 35 60 50 60 C65 60 80 65 80 85 Z" fill="%2334d399" opacity="0.8"/></svg>',
] as const;

type AvatarMode = 'saved' | 'file' | 'preset' | 'remove';

function svgDataUrlToPngBlob(svgDataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context is unavailable.'));
        return;
      }
      ctx.drawImage(img, 0, 0, 256, 256);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not encode preset avatar.'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Could not load preset avatar.'));
    img.src = svgDataUrl;
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const t = useT();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('saved');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<{ key: MessageKey } | { err: unknown } | null>(null);

  const initializedUserIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => {
      const next = readSession();
      setSession(next);
      const nextId = next?.user.id ?? null;
      if (nextId !== initializedUserIdRef.current) {
        initializedUserIdRef.current = nextId;
        setDraftName(next?.user.display_name ?? '');
        setDraftBio(next?.user.bio ?? '');
        setAvatarMode('saved');
        setPendingFile(null);
        setSelectedPresetIndex(null);
        setSaveSuccess(false);
        setSaveError(null);
      }
    };
    sync();
    setReady(true);
    window.addEventListener('storage', sync);
    window.addEventListener(SESSION_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SESSION_UPDATED_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!pendingFile) {
      setFilePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(pendingFile);
    setFilePreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pendingFile]);

  const savedAvatarUrl = session?.user.avatar_url ?? null;
  const effectiveAvatarUrl =
    avatarMode === 'file'
      ? filePreviewUrl
      : avatarMode === 'preset' && selectedPresetIndex !== null
        ? PRESET_AVATARS[selectedPresetIndex]
        : avatarMode === 'remove'
          ? null
          : savedAvatarUrl;

  const nameDirty = Boolean(session && draftName.trim() !== (session.user.display_name || ''));
  const bioDirty = Boolean(session && draftBio.trim() !== (session.user.bio || ''));
  const avatarDirty =
    avatarMode === 'file' ||
    avatarMode === 'preset' ||
    (avatarMode === 'remove' && Boolean(savedAvatarUrl));
  const hasChanges = nameDirty || bioDirty || avatarDirty;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const validType = file.type ? ALLOWED_IMAGE_TYPES.has(file.type) : ALLOWED_IMAGE_EXTS.has(ext);
    if (!validType) {
      setSaveError({ key: 'settings.invalidImage' });
      setSaveSuccess(false);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setSaveError({ key: 'settings.imageTooLarge' });
      setSaveSuccess(false);
      return;
    }

    setPendingFile(file);
    setSelectedPresetIndex(null);
    setAvatarMode('file');
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSelectPreset = (index: number) => {
    setAvatarMode('preset');
    setSelectedPresetIndex(index);
    setPendingFile(null);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleRemoveAvatar = () => {
    setAvatarMode(savedAvatarUrl ? 'remove' : 'saved');
    setPendingFile(null);
    setSelectedPresetIndex(null);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || savingRef.current || !hasChanges) return;

    const trimmedName = draftName.trim();
    if (!trimmedName) {
      setSaveError({ key: 'settings.nameRequired' });
      setSaveSuccess(false);
      return;
    }
    if (trimmedName.length > 100) {
      setSaveError({ key: 'settings.nameTooLong' });
      setSaveSuccess(false);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      if (nameDirty || bioDirty) {
        const updatedUser = await updateProfile(
          {
            displayName: trimmedName,
            bio: draftBio.trim(),
          },
          session.token,
        );
        updateSessionUser({
          display_name: updatedUser.display_name,
          bio: updatedUser.bio ?? draftBio.trim(),
        });
        setDraftName(updatedUser.display_name);
        setDraftBio(updatedUser.bio ?? draftBio.trim());
      }

      if (avatarDirty) {
        if (avatarMode === 'file' && pendingFile) {
          const nextAvatarUrl = await uploadMyAvatar(pendingFile, session.token, pendingFile.name);
          updateSessionUser({ avatar_url: nextAvatarUrl });
        } else if (avatarMode === 'preset' && selectedPresetIndex !== null) {
          const blob = await svgDataUrlToPngBlob(PRESET_AVATARS[selectedPresetIndex]);
          const nextAvatarUrl = await uploadMyAvatar(blob, session.token, 'preset-avatar.png');
          updateSessionUser({ avatar_url: nextAvatarUrl });
        } else if (avatarMode === 'remove') {
          await deleteMyAvatar(session.token);
          updateSessionUser({ avatar_url: null });
        }
      }

      setAvatarMode('saved');
      setPendingFile(null);
      setSelectedPresetIndex(null);
      setSession(readSession());
      setSaveSuccess(true);
    } catch (err) {
      setSaveError({ err });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const logOut = () => {
    clearSession();
    router.push('/');
  };

  return (
    <main className="mx-auto max-w-[720px] px-4 pb-16 pt-24 md:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">[ {t('settings.label')} ]</p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02]">{t('settings.title')}</h1>

      {!ready ? (
        <p role="status" className="mt-8 text-sm text-ink-soft">{t('settings.loading')}</p>
      ) : !session ? (
        <div className={`${CARD} mt-8 text-center`}>
          <p className="text-ink-soft">{t('settings.loginPrompt')}</p>
          <Link href="/login" className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-4 text-[15px] font-medium text-canvas hover:bg-ink/85">
            {t('settings.login')}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6">
          <section aria-labelledby="profile-title" className={CARD}>
            <h2 id="profile-title" className={LABEL}>{t('settings.profile')}</h2>

            <form onSubmit={handleSaveProfile} noValidate className="mt-4 space-y-6">
              <div>
                <p className="text-sm text-ink-soft">{t('settings.avatar')}</p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <UserAvatar
                    name={draftName.trim() || session.user.email}
                    avatarUrl={effectiveAvatarUrl}
                    size="lg"
                  />

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-ink/5 px-3 text-sm text-ink transition-colors hover:border-ink/40 hover:bg-ink/10 disabled:opacity-50"
                      >
                        <Upload aria-hidden className="h-4 w-4" />
                        <span>{t('settings.changeAvatar')}</span>
                      </button>

                      {effectiveAvatarUrl && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleRemoveAvatar}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-danger transition-colors hover:border-danger/30 hover:bg-danger/10 disabled:opacity-50"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                          <span>{t('settings.removeAvatar')}</span>
                        </button>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/webp,image/png,image/jpeg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    <p className="text-xs text-ink/50">{t('settings.avatarHint')}</p>

                    <div>
                      <p className="text-xs text-ink/50">{t('settings.presets')}</p>
                      <div className="mt-2 flex items-center gap-2.5">
                        {PRESET_AVATARS.map((preset, index) => {
                          const active = avatarMode === 'preset' && selectedPresetIndex === index;
                          return (
                            <button
                              key={index}
                              type="button"
                              disabled={saving}
                              aria-label={t('settings.preset', { n: index + 1 })}
                              aria-pressed={active}
                              onClick={() => handleSelectPreset(index)}
                              className={`h-9 w-9 overflow-hidden rounded-full border-2 transition-all hover:scale-105 disabled:opacity-50 ${
                                active ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-ink/50'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={preset} alt="" className="h-full w-full object-cover" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <dl className="divide-y divide-line border-t border-line">
                <div className="grid gap-1 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-4">
                  <dt className="text-sm text-ink-soft">
                    <label htmlFor="settings-display-name">{t('settings.displayName')}</label>
                  </dt>
                  <dd className="min-w-0">
                    <input
                      id="settings-display-name"
                      type="text"
                      maxLength={100}
                      disabled={saving}
                      value={draftName}
                      onChange={(e) => {
                        setDraftName(e.target.value);
                        setSaveError(null);
                        setSaveSuccess(false);
                      }}
                      className="h-10 w-full max-w-sm rounded-lg border border-line bg-canvas/40 px-3 text-sm text-ink placeholder:text-ink/40 focus:border-ink/50 focus:outline-none disabled:opacity-60"
                    />
                  </dd>
                </div>
                <div className="grid gap-1 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start sm:gap-4">
                  <dt className="pt-2 text-sm text-ink-soft">
                    <label htmlFor="settings-bio">{t('profile.aboutMe')}</label>
                  </dt>
                  <dd className="min-w-0">
                    <textarea
                      id="settings-bio"
                      rows={3}
                      maxLength={500}
                      disabled={saving}
                      value={draftBio}
                      onChange={(e) => {
                        setDraftBio(e.target.value);
                        setSaveError(null);
                        setSaveSuccess(false);
                      }}
                      placeholder={t('profile.bioPlaceholder')}
                      className="w-full max-w-sm resize-none rounded-lg border border-line bg-canvas/40 p-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-ink/50 focus:outline-none disabled:opacity-60"
                    />
                    <span className="mt-1 block font-mono text-[10px] text-ink/45">
                      {draftBio.length}/500
                    </span>
                  </dd>
                </div>
                <Row label={t('settings.email')}>{session.user.email}</Row>
                <Row label={t('settings.accountType')}>{session.user.is_seller ? t('settings.buyerSeller') : t('settings.buyer')}</Row>
              </dl>

              <p className="text-sm text-ink-soft">{t('settings.profileNote')}</p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !hasChanges || !draftName.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-canvas transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      <span>{t('settings.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Check aria-hidden className="h-4 w-4" />
                      <span>{t('settings.saveProfile')}</span>
                    </>
                  )}
                </button>

                {saveSuccess && (
                  <p role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-500">
                    <Check aria-hidden className="h-4 w-4 shrink-0" />
                    <span>{t('settings.profileSaved')}</span>
                  </p>
                )}

                {saveError && (
                  <p role="alert" className="inline-flex items-center gap-1.5 text-sm text-danger">
                    <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
                    <span>{'key' in saveError ? t(saveError.key) : authErrorText(saveError.err, t, 'settings.errSave')}</span>
                  </p>
                )}
              </div>
            </form>
          </section>

          <section aria-labelledby="security-title" className={CARD}>
            <h2 id="security-title" className={LABEL}>{t('settings.password')}</h2>
            <p className="mt-3 text-sm text-ink-soft">{t('settings.passwordNote')}</p>
          </section>

          <section aria-labelledby="session-title" className={CARD}>
            <h2 id="session-title" className={LABEL}>{t('settings.device')}</h2>
            <p className="mt-3 text-sm text-ink-soft">{t('settings.deviceNote')}</p>
            <button
              type="button"
              onClick={logOut}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm text-ink transition-colors hover:bg-ink/10"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              {t('settings.logout')}
            </button>
          </section>

          <section aria-labelledby="delete-title" className={CARD}>
            <h2 id="delete-title" className={LABEL}>{t('settings.delete')}</h2>
            <p className="mt-3 text-sm text-ink-soft">
              {t('settings.deleteBefore')}{' '}
              <Link href="/contact" className="text-ink underline underline-offset-4">{t('settings.deleteLink')}</Link>
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
