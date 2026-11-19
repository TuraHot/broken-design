'use client';

// Email-first sign-in: enter an email, we check if it exists in the database,
// then ask for its password (known email) or register with display name (new email).
// Connected to Core API (/api/auth/check-email, /api/auth/login, /api/auth/register).
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { checkEmail, login, register } from '@/lib/auth';
import { EMAIL_RE, FIELD, Field } from './Field';

type Step = 'email' | 'login' | 'signup';

interface Values {
  email: string;
  name: string;
  password: string;
}
type Errors = Partial<Record<keyof Values, string>>;

function validate(step: Step, v: Values): Errors {
  const errors: Errors = {};
  if (step === 'email') {
    if (!v.email.trim()) errors.email = 'Enter your email.';
    else if (!EMAIL_RE.test(v.email.trim())) errors.email = 'Enter a valid email address.';
    return errors;
  }
  if (step === 'signup' && !v.name.trim()) errors.name = 'Enter a display name.';
  if (!v.password) errors.password = step === 'login' ? 'Enter your password.' : 'Choose a password.';
  else if (step === 'signup' && v.password.length < 8) errors.password = 'Use at least 8 characters.';
  return errors;
}

const COPY = {
  email: {
    title: 'Welcome to Lixyte',
    lead: 'Enter your email. We’ll check whether you already have an account.',
    submit: 'Continue',
  },
  login: {
    title: 'Welcome back',
    lead: 'Enter your password to log in.',
    submit: 'Log in',
  },
  signup: {
    title: 'Create account',
    lead: 'No account for this email yet. Set one up to publish and embed 3D models.',
    submit: 'Create account',
  },
} as const;

const PRIMARY =
  'mt-1 h-10 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-60';

export default function AuthForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [values, setValues] = useState<Values>({ email: '', name: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);

  const copy = COPY[step];

  const update = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [key]: e.target.value };
    setValues(next);
    if (submitted) setErrors(validate(step, next));
  };

  const goTo = (next: Step) => {
    setStep(next);
    setErrors({});
    setSubmitted(false);
    setShowPassword(false);
    if (next === 'email') setValues((v) => ({ ...v, password: '' }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (checking) return;
    const found = validate(step, values);
    setErrors(found);
    setSubmitted(true);
    if (Object.keys(found).length > 0) return;

    if (step === 'email') {
      try {
        setChecking(true);
        const exists = await checkEmail(values.email);
        goTo(exists ? 'login' : 'signup');
      } catch (err: any) {
        setErrors({ email: err?.message || 'Unable to verify email address.' });
      } finally {
        setChecking(false);
      }
      return;
    }

    if (step === 'login' || step === 'signup') {
      try {
        setChecking(true);
        const result =
          step === 'login'
            ? await login(values.email, values.password)
            : await register(values.email, values.password, values.name);

        // Store tokens for authentication across the app
        localStorage.setItem('token', result.token);
        localStorage.setItem('accessToken', result.token);
        if (result.user) {
          localStorage.setItem('user', JSON.stringify(result.user));
        }

        router.push('/gallery');
      } catch (error: any) {
        setErrors({
          password:
            error instanceof Error
              ? error.message
              : 'Authentication failed. Please try again.',
        });
      } finally {
        setChecking(false);
      }
    }
  };

  const fieldClass = (key: keyof Values) =>
    `${FIELD} ${errors[key] ? 'border-red-400/70 focus:border-red-300' : 'border-white/15 focus:border-white/50'}`;
  const described = (key: keyof Values) => (errors[key] ? `${key}-error` : undefined);

  const passwordField = (
    <Field id="password" label="Password" error={errors.password}>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete={step === 'login' ? 'current-password' : 'new-password'}
          autoFocus={step !== 'signup'}
          value={values.password}
          onChange={update('password')}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={described('password')}
          placeholder={step === 'signup' ? 'At least 8 characters' : 'Your password'}
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
  );

  return (
    <div className="w-full max-w-[420px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ Account ]</p>
      <h1 className="mt-4 whitespace-nowrap font-display text-[clamp(12px,calc((100vw_-_32px)/23),18px)] uppercase leading-[1.05] text-white">
        {copy.title}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">{copy.lead}</p>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
        {step !== 'email' && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
            <span className="truncate text-white">{values.email.trim()}</span>
            <button
              type="button"
              onClick={() => goTo('email')}
              className="shrink-0 text-white/65 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Change
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {step === 'email' && (
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
          )}

          {step === 'signup' && (
            <Field id="name" label="Display name" error={errors.name}>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                autoFocus
                value={values.name}
                onChange={update('name')}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={described('name')}
                placeholder="Ada Lovelace"
                className={fieldClass('name')}
              />
            </Field>
          )}

          {(step === 'login' || step === 'signup') && passwordField}

          {step === 'login' && (
            <div className="-mt-2 text-right">
              <Link href="/forgot-password" className="text-sm text-white/65 underline-offset-4 transition-colors hover:text-white hover:underline">
                Forgot password?
              </Link>
            </div>
          )}

          <button type="submit" disabled={checking} className={PRIMARY}>
            {checking
              ? step === 'email'
                ? 'Checking…'
                : 'Please wait…'
              : copy.submit}
          </button>
        </form>

        <div className="mt-5 border-t border-white/10 pt-4 text-center">
          <p className="text-sm text-white/65">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-white underline-offset-4 transition-colors hover:underline hover:text-hud"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
