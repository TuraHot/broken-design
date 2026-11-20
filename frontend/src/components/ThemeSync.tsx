'use client';

// Keeps <html data-theme> right after the first paint (the inline script in the layout sets it before): when the visitor
// moves between a light-ready page and a locked one without a reload, and when the system setting changes while no
// choice is saved. Renders nothing.
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { readCookie, resolveTheme, THEME_COOKIE } from '@/lib/theme';

export default function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: light)') : null;
    const apply = () => {
      let saved: string | null = null;
      try {
        saved = readCookie(document.cookie, THEME_COOKIE);
      } catch {
        // cookies blocked: act as if nothing is saved
      }
      document.documentElement.dataset.theme = resolveTheme(pathname, saved, Boolean(media?.matches));
    };
    apply();
    media?.addEventListener('change', apply);
    return () => media?.removeEventListener('change', apply);
  }, [pathname]);

  return null;
}
