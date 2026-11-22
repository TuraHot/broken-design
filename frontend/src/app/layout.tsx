// Root Layout — Lixyte
import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Lixyte',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Chakra+Petch:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Michroma&family=Share+Tech+Mono&display=swap"
        />
        {/* Sets data-theme before the first paint (no flash); see lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript(THEME_READY_ROUTES) }} />
      </head>
      <body>
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
