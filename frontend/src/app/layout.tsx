// Root Layout — Lixyte
import type { Metadata } from 'next';
import { Chakra_Petch, Michroma, Share_Tech_Mono } from 'next/font/google';
import AdminOnlyRedirect from '@/components/AdminOnlyRedirect';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ReportProvider from '@/components/report/ReportProvider';
import NavigationProgress from '@/components/ui/NavigationProgress';
import ThemeSync from '@/components/ThemeSync';
import RealtimeNotificationToast from '@/components/notifications/RealtimeNotificationToast';
import { LocaleProvider } from '@/lib/i18n/client';
import { getLocale } from '@/lib/i18n/server';
import { THEME_READY_ROUTES, themeBootstrapScript } from '@/lib/theme';
import './globals.css';

const chakra = Chakra_Petch({ subsets: ['latin', 'thai'], weight: ['400', '500', '600'], display: 'swap' });
const michroma = Michroma({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-display' });
const shareTechMono = Share_Tech_Mono({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Lixyte',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before the first paint (no flash); see lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript(THEME_READY_ROUTES) }} />
      </head>
      <body className={`${chakra.className} ${michroma.variable} ${shareTechMono.variable}`}>
        <LocaleProvider locale={locale}>
          <NavigationProgress />
          <ThemeSync />
          <RealtimeNotificationToast />
          <ReportProvider>
            <AdminOnlyRedirect />
            <Navbar />
            {/* The page grows to fill the screen, so a short page still has the footer at the very bottom. */}
            <div className="flex min-h-dvh flex-col">
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </ReportProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
