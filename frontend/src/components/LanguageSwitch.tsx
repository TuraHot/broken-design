'use client';

// Navbar button: switches the site between English and Thai. The button shows the language the site is in now; clicking it switches to the other one.
import { Languages } from 'lucide-react';
import { useLocale, useSetLocale, useT } from '@/lib/i18n/client';

export default function LanguageSwitch() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const target = locale === 'en' ? 'th' : 'en';
  return (
    <button
      type="button"
      onClick={() => setLocale(target)}
      aria-label={t('lang.switchTo')}
      title={t('lang.switchTo')}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 px-2 text-[12px] sm:text-[13px] text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:px-2.5"
    >
      <Languages aria-hidden className="hidden h-4 w-4 sm:block" />
      <span lang={locale}>
        {locale === 'th' ? 'ไทย' : 'EN'}
      </span>
    </button>
  );
}
