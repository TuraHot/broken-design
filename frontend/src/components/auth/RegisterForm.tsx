'use client';

// Register form: username, email, and password. Directly connected to Core API (/api/auth/register).
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { register } from '@/lib/auth';
import { EMAIL_RE, FIELD, Field } from './Field';

const PRIMARY =
  'mt-2 h-10 w-full rounded-lg bg-white text-[15px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-60';

export default function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values | 'api', string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined, api: undefined }));
    }
  };

  const validate = () => {
    const errs: Partial<Record<keyof typeof values, string>> = {};
    if (!values.username.trim()) {
      errs.username = 'Please enter a username.';
    } else if (values.username.trim().length > 100) {
      errs.username = 'Username must not exceed 100 characters.';
    }

    if (!values.email.trim()) {
      errs.email = 'Please enter an email address.';
    } else if (!EMAIL_RE.test(values.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!values.password) {
      errs.password = 'Please choose a password.';
    } else if (values.password.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
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
      const result = await register(values.email, values.password, values.username.trim());

      // Save user session
      localStorage.setItem('token', result.token);
      localStorage.setItem('accessToken', result.token);
      if (result.user) {
        localStorage.setItem('user', JSON.stringify(result.user));
      }

      router.push('/gallery');
    } catch (err: any) {
      setErrors({
        api: err instanceof Error ? err.message : 'Registration failed. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (key: keyof typeof values) =>
    `${FIELD} ${errors[key] ? 'border-red-400/70 focus:border-red-300' : 'border-white/15 focus:border-white/50'}`;

  return (
    <div className="w-full max-w-[420px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ Account ]</p>
      <h1 className="mt-4 whitespace-nowrap font-display text-[clamp(18px,2.5vw,24px)] uppercase leading-[1.05] text-white">
        Create an account
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">
        Set up your account to explore, purchase, and embed 3D models.
      </p>

      <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-5 sm:p-6">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {/* Username Field */}
          <Field id="username" label="Username" error={errors.username}>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={values.username}
              onChange={update('username')}
              placeholder="e.g. alex_developer"
              className={fieldClass('username')}
            />
          </Field>

          {/* Email Field */}
          <Field id="email" label="Email" error={errors.email}>
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
          <Field id="password" label="Password" error={errors.password}>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={values.password}
                onChange={update('password')}
                placeholder="At least 8 characters"
                className={`${fieldClass('password')} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-white/65 transition-colors hover:text-white"
              >
                {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {/* API Error Message */}
          {errors.api && (
            <div role="status" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              <p className="flex items-start gap-1.5">
                <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errors.api}</span>
              </p>
            </div>
          )}

          <button type="submit" disabled={submitting} className={PRIMARY}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="mt-5 border-t border-white/10 pt-4 text-center">
          <p className="text-sm text-white/65">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-white underline-offset-4 transition-colors hover:underline hover:text-hud"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
