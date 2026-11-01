// Login / Sign up — `/login` and `/login?mode=signup`. UI only until core-api auth exists.
import type { Metadata } from 'next';
import AuthForm from '@/components/auth/AuthForm';

export const metadata: Metadata = { title: 'Account — Broken Design' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mode } = await searchParams;
  const current = (Array.isArray(mode) ? mode[0] : mode) === 'signup' ? 'signup' : 'login';

  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-4 py-16 md:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_25%,rgba(143,211,255,0.12),transparent_60%),radial-gradient(ellipse_at_75%_75%,rgba(184,146,255,0.10),transparent_55%)]"
      />
      {/* key resets the form when switching between the two modes */}
      <AuthForm key={current} mode={current} />
    </main>
  );
}
