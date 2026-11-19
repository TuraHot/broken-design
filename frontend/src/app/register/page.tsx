// Register page — standalone account creation at `/register`
import type { Metadata } from 'next';
import RegisterForm from '@/components/auth/RegisterForm';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.meta.register') };
}

export default function RegisterPage() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-4 py-16 md:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_25%,rgba(143,211,255,0.12),transparent_60%),radial-gradient(ellipse_at_75%_75%,rgba(184,146,255,0.10),transparent_55%)]"
      />
      <RegisterForm />
    </main>
  );
}
