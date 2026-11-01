'use client';

// Request a password reset — UI only: validates the email but sends nothing yet.
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { EMAIL_RE, FIELD, Field } from './Field';

function validate(email: string) {
  if (!email.trim()) return 'Enter your email.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (submitted) setError(validate(e.target.value));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(validate(email));
    setSubmitted(true);
  };

  const ready = submitted && !error;

  return (
    <div className="w-full max-w-[420px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ Account ]</p>
      <h1 className="mt-4 font-display text-[clamp(26px,4vw,36px)] uppercase leading-[1.05] text-white">Reset password</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">
        Enter your email and we&apos;ll send you a link to choose a new password.
      </p>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field id="email" label="Email" error={error}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={onChange}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'email-error' : undefined}
              placeholder="you@example.com"
              className={`${FIELD} ${error ? 'border-red-400/70 focus:border-red-300' : 'border-white/15 focus:border-white/50'}`}
            />
          </Field>

          <button
            type="submit"
            className="h-10 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-white/85"
          >
            Send reset link
          </button>

          <div role="status" aria-live="polite">
            {ready && (
              <p className="flex items-start gap-1.5 text-sm text-amber">
                <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                Password reset isn&apos;t connected yet. No email was sent.
              </p>
            )}
          </div>
        </form>
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
