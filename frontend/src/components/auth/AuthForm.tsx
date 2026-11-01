'use client';

// Log in / Sign up form — UI only: it validates input but is not connected to core-api auth yet.
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { EMAIL_RE, FIELD, Field } from './Field';

export type AuthMode = 'login' | 'signup';

interface Values {
  name: string;
  email: string;
  password: string;
}
type Errors = Partial<Record<keyof Values, string>>;

function validate(mode: AuthMode, v: Values): Errors {
  const errors: Errors = {};
  if (mode === 'signup' && !v.name.trim()) errors.name = 'Enter a display name.';
  if (!v.email.trim()) errors.email = 'Enter your email.';
  else if (!EMAIL_RE.test(v.email.trim())) errors.email = 'Enter a valid email address.';
  if (!v.password) errors.password = 'Enter your password.';
  else if (mode === 'signup' && v.password.length < 8) errors.password = 'Use at least 8 characters.';
  return errors;
}

const COPY = {
  login: {
    title: 'Welcome back',
    lead: 'Log in to browse, buy and embed 3D models.',
    submit: 'Log in',
    switchText: 'New here?',
    switchLink: 'Sign up',
    switchHref: '/login?mode=signup',
  },
  signup: {
    title: 'Create account',
    lead: 'Publish and embed 3D models in minutes.',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchHref: '/login',
  },
} as const;

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const copy = COPY[mode];
  const [values, setValues] = useState<Values>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [key]: e.target.value };
    setValues(next);
    if (submitted) setErrors(validate(mode, next));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(mode, values);
    setErrors(found);
    setSubmitted(true);
  };

  const fieldClass = (key: keyof Values) =>
    `${FIELD} ${errors[key] ? 'border-red-400/70 focus:border-red-300' : 'border-white/15 focus:border-white/50'}`;
  const described = (key: keyof Values) => (errors[key] ? `${key}-error` : undefined);
  const ready = submitted && Object.keys(errors).length === 0;

  return (
    <div className="w-full max-w-[420px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ Account ]</p>
      <h1 className="mt-4 font-display text-[clamp(26px,4vw,36px)] uppercase leading-[1.05] text-white">{copy.title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">{copy.lead}</p>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 p-1 text-sm">
          {(['login', 'signup'] as const).map((m) => (
            <Link
              key={m}
              href={m === 'login' ? '/login' : '/login?mode=signup'}
              aria-current={m === mode ? 'page' : undefined}
              className={`rounded-md py-1.5 text-center transition-colors ${
                m === mode ? 'bg-white font-medium text-black' : 'text-white/65 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Log in' : 'Sign up'}
            </Link>
          ))}
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-5 grid gap-4">
          {mode === 'signup' && (
            <Field id="name" label="Display name" error={errors.name}>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={values.name}
                onChange={update('name')}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={described('name')}
                placeholder="Ada Lovelace"
                className={fieldClass('name')}
              />
            </Field>
          )}

          <Field id="email" label="Email" error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={update('email')}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={described('email')}
              placeholder="you@example.com"
              className={fieldClass('email')}
            />
          </Field>

          <Field id="password" label="Password" error={errors.password}>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={values.password}
                onChange={update('password')}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={described('password')}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                className={`${fieldClass('password')} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-white/65 transition-colors hover:text-white"
              >
                {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {mode === 'login' && (
            <div className="-mt-2 text-right">
              <Link href="/forgot-password" className="text-sm text-white/65 underline-offset-4 transition-colors hover:text-white hover:underline">
                Forgot password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            className="mt-1 h-10 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-white/85"
          >
            {copy.submit}
          </button>

          <div role="status" aria-live="polite">
            {ready && (
              <p className="flex items-start gap-1.5 text-sm text-amber">
                <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                Sign-in isn&apos;t connected yet. Your details were not sent anywhere.
              </p>
            )}
          </div>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-white/65">
        {copy.switchText}{' '}
        <Link href={copy.switchHref} className="text-white underline-offset-4 hover:underline">
          {copy.switchLink}
        </Link>
      </p>
    </div>
  );
}
