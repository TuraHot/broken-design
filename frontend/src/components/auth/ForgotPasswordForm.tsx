'use client';

// Reset password, step 1 + 2: enter email -> demo mailbox shows the 6-digit OTP -> enter it -> /reset-password.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { EMAIL_RE, FIELD, Field } from './Field';
import { requestPasswordReset, verifyResetOtp } from '@/lib/auth';

const PRIMARY =
  'h-10 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-60';

const friendly = (err: unknown) =>
  err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Cannot reach the server. Please try again.';

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) return setError('Enter your email.');
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    setError(undefined);
    setBusy(true);
    try {
      setMockOtp(await requestPasswordReset(email));
      setCode('');
      setStep('otp');
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.');
    setError(undefined);
    setBusy(true);
    try {
      const token = await verifyResetOtp(email, code);
      router.push(`/reset-password?token=${encodeURIComponent(token)}`);
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  };

  const cls = (bad: boolean) => `${FIELD} ${bad ? 'border-red-400/70 focus:border-red-300' : 'border-white/15 focus:border-white/50'}`;

  return (
    <div className="w-full max-w-[420px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ Account ]</p>
      <h1 className="mt-4 font-display text-[clamp(26px,4vw,36px)] uppercase leading-[1.05] text-white">Reset password</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">
        {step === 'email'
          ? 'Enter your email and we’ll send you a 6-digit verification code.'
          : 'Enter the 6-digit code to continue.'}
      </p>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
        {step === 'email' ? (
          <form onSubmit={sendCode} noValidate className="grid gap-4">
            <Field id="email" label="Email" error={error}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={cls(Boolean(error))}
              />
            </Field>
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
              <span className="truncate text-white">{email.trim()}</span>
              <button type="button" onClick={() => { setStep('email'); setError(undefined); }} className="shrink-0 text-white/65 underline-offset-4 hover:text-white hover:underline">
                Change
              </button>
            </div>

            {mockOtp && (
              <div className="rounded-lg border border-amber/40 bg-amber/5 p-3 text-sm text-white/80">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber">OTP CODE</p>
                <p className="mt-2 select-all text-center font-mono text-base tracking-[0.4em] text-white">{mockOtp}</p>
                <p className="mt-2 text-xs text-white/50">Copy it into the box below. Valid for 10 minutes.</p>
              </div>
            )}

            <form onSubmit={verify} noValidate className="grid gap-4">
              <Field id="code" label="Verification code" error={error}>
                <input
                  id="code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className={`${cls(Boolean(error))} text-center font-mono text-lg tracking-[0.5em]`}
                />
              </Field>
              <button type="submit" disabled={busy} className={PRIMARY}>
                {busy ? 'Verifying…' : 'Verify and continue'}
              </button>
            </form>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-white/65">
        Remembered it?{' '}
        <Link href="/login" className="text-white underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
