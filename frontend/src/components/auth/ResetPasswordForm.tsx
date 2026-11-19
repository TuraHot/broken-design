'use client';

// Choose a new password using the token from the emailed link (POST /api/auth/reset-password).
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { FIELD, Field } from './Field';
import { resetPassword } from '@/lib/auth';

export default function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setError(undefined);
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Cannot reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cls = `${FIELD} ${error ? 'border-red-400/70 focus:border-red-300' : 'border-white/15 focus:border-white/50'}`;

  return (
    <div className="w-full max-w-[420px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ Account ]</p>
      <h1 className="mt-4 font-display text-[clamp(26px,4vw,36px)] uppercase leading-[1.05] text-white">New password</h1>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
        {!token ? (
          <p className="text-sm text-red-300">This reset link is missing its token. Request a new one.</p>
        ) : done ? (
          <p className="text-sm text-hud">Password updated. You can now log in.</p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <Field id="password" label="New password" error={error}>
              <input id="password" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={cls} />
            </Field>
            <Field id="confirm" label="Confirm password">
              <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cls} />
            </Field>
            <button type="submit" disabled={busy} className="h-10 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-60">
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-white/65">
        <Link href={done ? '/login' : '/forgot-password'} className="text-white underline-offset-4 hover:underline">
          {done ? 'Go to log in' : 'Request a new link'}
        </Link>
      </p>
    </div>
  );
}
