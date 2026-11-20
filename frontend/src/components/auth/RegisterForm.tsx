'use client';

// Register form: username, email, and password. Directly connected to Core API (/api/auth/register).
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { REGISTER_EMAIL_KEY, register } from '@/lib/auth';
import { authErrorText } from '@/lib/i18n/auth-error';
import { useT } from '@/lib/i18n/client';
import { EMAIL_RE, FIELD, Field } from './Field';

const PRIMARY =
  'mt-2 h-10 w-full rounded-lg bg-ink text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85 disabled:opacity-60';

export default function RegisterForm() {
  const router = useRouter();
  const t = useT();
  const [values, setValues] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values | 'api', string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The email the login page found no account for (read once, then removed), so the person does not type it again.
  const [fromLogin, setFromLogin] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(REGISTER_EMAIL_KEY);
      sessionStorage.removeItem(REGISTER_EMAIL_KEY);
      if (saved) {
        setValues((prev) => (prev.email ? prev : { ...prev, email: saved }));
        setFromLogin(true);
      }
    } catch {
      // storage blocked: start with an empty email
    }
  }, []);

  const update = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined, api: undefined }));
    }
  };

  const validate = () => {
    const errs: Partial<Record<keyof typeof values, string>> = {};
    if (!values.username.trim()) {
      errs.username = t('auth.errUsername');
    } else if (values.username.trim().length > 100) {
      errs.username = t('auth.errUsernameLong');
    }

    if (!values.email.trim()) {
      errs.email = t('auth.errEmail');
    } else if (!EMAIL_RE.test(values.email.trim())) {
      errs.email = t('auth.errEmailBad');
    }

    if (!values.password) {
      errs.password = t('auth.errPasswordNew');
    } else if (values.password.length < 8) {
      errs.password = t('auth.errPasswordShort');
    }

    return errs;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      await register(values.email, values.password, values.username.trim());

      // Do not sign in yet: send the new user to the log in page first.
      router.push('/login?registered=1');
    } catch (err) {
      setErrors({ api: authErrorText(err, t, 'auth.errRegister') });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (key: keyof typeof values) =>
    `${FIELD} ${errors[key] ? 'border-danger/70 focus:border-danger' : 'border-line focus:border-ink/50'}`;

  return (
    <div className="w-full max-w-[420px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{t('auth.label')}</p>
      <h1 className="mt-4 whitespace-nowrap font-display text-[clamp(18px,2.5vw,24px)] uppercase leading-[1.05] text-ink">
        {t('auth.register.title')}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{t('auth.register.lead')}</p>

      {fromLogin && (
        <p role="status" className="mt-6 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {t('auth.register.noAccountNotice')}
        </p>
      )}

      <div className="mt-8 rounded-lg border border-line bg-ink/5 p-5 sm:p-6">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {/* Username Field */}
          <Field id="username" label={t('auth.username')} error={errors.username}>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={values.username}
              onChange={update('username')}
              placeholder={t('auth.phUsername')}
              className={fieldClass('username')}
            />
          </Field>

          {/* Email Field */}
          <Field id="email" label={t('auth.email')} error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={update('email')}
              placeholder="you@example.com"
              className={fieldClass('email')}
            />
          </Field>

          {/* Password Field */}
          <Field id="password" label={t('auth.password')} error={errors.password}>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={values.password}
                onChange={update('password')}
                placeholder={t('auth.phNewPassword')}
                className={`${fieldClass('password')} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-ink-soft transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {/* API Error Message */}
          {errors.api && (
            <div role="status" className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              <p className="flex items-start gap-1.5">
                <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errors.api}</span>
              </p>
            </div>
          )}

          <button type="submit" disabled={submitting} className={PRIMARY}>
            {submitting ? t('auth.register.busy') : t('auth.register.submit')}
          </button>
        </form>

        <div className="mt-5 border-t border-line pt-4 text-center">
          <p className="text-sm text-ink-soft">
            {t('auth.haveAccount')}{' '}
            <Link
              href="/login"
              className="text-ink underline-offset-4 transition-colors hover:underline hover:text-accent"
            >
              {t('auth.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
