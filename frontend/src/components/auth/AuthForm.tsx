'use client';

// Email-first sign-in: enter an email, we check if it exists in the database, then ask for its password. An email with no
// account is sent to /register (its own page) with the email already filled in; nothing is created on this page.
// Connected to Core API (/api/auth/check-email, /api/auth/login).
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { checkEmail, login, REGISTER_EMAIL_KEY } from '@/lib/auth';
import { authErrorText } from '@/lib/i18n/auth-error';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import { saveSession } from '@/lib/session';
import { EMAIL_RE, FIELD, Field } from './Field';

type Step = 'email' | 'login';
type Translate = (key: MessageKey) => string;

interface Values {
  email: string;
  password: string;
}
type Errors = Partial<Record<keyof Values, string>>;

function validate(step: Step, v: Values, t: Translate): Errors {
  const errors: Errors = {};
  if (step === 'email') {
    if (!v.email.trim()) errors.email = t('auth.errEmail');
    else if (!EMAIL_RE.test(v.email.trim())) errors.email = t('auth.errEmailBad');
    return errors;
  }
  if (!v.password) errors.password = t('auth.errPasswordLogin');
  return errors;
}

const COPY: Record<Step, { title: MessageKey; lead: MessageKey; submit: MessageKey }> = {
  email: { title: 'auth.email.title', lead: 'auth.email.lead', submit: 'auth.email.submit' },
  login: { title: 'auth.login.title', lead: 'auth.login.lead', submit: 'auth.login.submit' },
};

const PRIMARY =
  'mt-1 h-10 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-60';

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const [step, setStep] = useState<Step>('email');
  const [values, setValues] = useState<Values>({ email: '', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  const registeredNotice = Boolean(searchParams.get('registered')); // set by the register page after it creates an account

  const copy = COPY[step];

  const update = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [key]: e.target.value };
    setValues(next);
    if (submitted) setErrors(validate(step, next, t));
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
    const found = validate(step, values, t);
    setErrors(found);
    setSubmitted(true);
    if (Object.keys(found).length > 0) return;

    if (step === 'email') {
      try {
        setChecking(true);
        const exists = await checkEmail(values.email);
        if (exists) {
          goTo('login');
        } else {
          // No account for this email: hand it to the register page (in this tab's storage, not in the URL).
          try {
            sessionStorage.setItem(REGISTER_EMAIL_KEY, values.email.trim());
          } catch {
            // storage blocked: the register page just opens with an empty email
          }
          router.push('/register');
        }
      } catch (err) {
        setErrors({ email: authErrorText(err, t, 'auth.errVerifyEmail') });
      } finally {
        setChecking(false);
      }
      return;
    }

    if (step === 'login') {
      try {
        setChecking(true);
        const result = await login(values.email, values.password);

        // Store tokens for authentication across the app (per-tab session isolation)
        saveSession({ token: result.token, user: result.user });

        router.push('/gallery');
      } catch (error) {
        setErrors({ password: authErrorText(error, t) });
      } finally {
        setChecking(false);
      }
    }
  };

  const fieldClass = (key: keyof Values) =>
    `${FIELD} ${errors[key] ? 'border-red-400/70 focus:border-red-300' : 'border-white/15 focus:border-white/50'}`;
  const described = (key: keyof Values) => (errors[key] ? `${key}-error` : undefined);

  const passwordField = (
    <Field id="password" label={t('auth.password')} error={errors.password}>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          autoFocus
          value={values.password}
          onChange={update('password')}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={described('password')}
          placeholder={t('auth.phPassword')}
          className={`${fieldClass('password')} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
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
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">{t('auth.label')}</p>
      <h1 className="mt-4 whitespace-nowrap font-display text-[clamp(12px,calc((100vw_-_32px)/23),18px)] uppercase leading-[1.05] text-white">
        {t(copy.title)}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">{t(copy.lead)}</p>

      {registeredNotice && (
        <p role="status" className="mt-6 rounded-lg border border-hud/40 bg-hud/10 px-3 py-2 text-sm text-hud">
          {t('auth.createdNotice')}
        </p>
      )}

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
        {step !== 'email' && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
            <span className="truncate text-white">{values.email.trim()}</span>
            <button
              type="button"
              onClick={() => goTo('email')}
              className="shrink-0 text-white/65 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              {t('auth.change')}
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {step === 'email' && (
            <Field id="email" label={t('auth.email')} error={errors.email}>
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

          {step === 'login' && passwordField}

          {step === 'login' && (
            <div className="-mt-2 text-right">
              <Link href="/forgot-password" className="text-sm text-white/65 underline-offset-4 transition-colors hover:text-white hover:underline">
                {t('auth.forgotLink')}
              </Link>
            </div>
          )}

          <button type="submit" disabled={checking} className={PRIMARY}>
            {checking ? (step === 'email' ? t('auth.checking') : t('auth.wait')) : t(copy.submit)}
          </button>
        </form>

        <div className="mt-5 border-t border-white/10 pt-4 text-center">
          <p className="text-sm text-white/65">
            {t('auth.noAccount')}{' '}
            <Link
              href="/register"
              className="text-white underline-offset-4 transition-colors hover:underline hover:text-hud"
            >
              {t('auth.createLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
