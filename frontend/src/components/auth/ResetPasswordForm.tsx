'use client';

// Choose a new password using the token from the emailed link (POST /api/auth/reset-password).
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { FIELD, Field } from './Field';
import { resetPassword } from '@/lib/auth';
import { authErrorText } from '@/lib/i18n/auth-error';
import { useT } from '@/lib/i18n/client';

export default function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const t = useT();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setError(t('auth.errPasswordShort'));
    if (password !== confirm) return setError(t('auth.errMismatch'));
    setError(undefined);
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(authErrorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  const cls = `${FIELD} ${error ? 'border-red-400/70 focus:border-red-300' : 'border-white/15 focus:border-white/50'}`;

  return (
    <div className="w-full max-w-[420px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">{t('auth.label')}</p>
      <h1 className="mt-4 font-display text-[clamp(26px,4vw,36px)] uppercase leading-[1.05] text-white">{t('auth.reset.title')}</h1>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
        {!token ? (
          <p className="text-sm text-red-300">{t('auth.reset.noToken')}</p>
        ) : done ? (
          <p className="text-sm text-hud">{t('auth.reset.done')}</p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <Field id="password" label={t('auth.newPassword')} error={error}>
              <input id="password" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.phNewPassword')} className={cls} />
            </Field>
            <Field id="confirm" label={t('auth.confirmPassword')}>
              <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cls} />
            </Field>
            <button type="submit" disabled={busy} className="h-10 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-60">
              {busy ? t('auth.reset.saving') : t('auth.reset.submit')}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-white/65">
        <Link href={done ? '/login' : '/forgot-password'} className="text-white underline-offset-4 hover:underline">
          {done ? t('auth.reset.toLogin') : t('auth.reset.newLink')}
        </Link>
      </p>
    </div>
  );
}
