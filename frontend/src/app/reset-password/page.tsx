// Choose a new password.
import { Suspense } from 'react';
import type { Metadata } from 'next';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.meta.reset') };
}

export default function ResetPasswordPage() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-4 py-16 md:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_25%,rgb(var(--c-accent)/0.12),transparent_60%),radial-gradient(ellipse_at_75%_75%,rgba(184,146,255,0.10),transparent_55%)]"
      />
      <Suspense><ResetPasswordForm /></Suspense>
    </main>
  );
}
