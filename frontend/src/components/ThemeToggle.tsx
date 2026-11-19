'use client';

// Navbar button: switches between the light and dark theme and remembers the choice in the `theme` cookie.
// Shown only on routes that are light-ready (lib/theme.ts); on every other page the site is always dark.
import { usePathname } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { isThemeReady, THEME_COOKIE, type Theme } from '@/lib/theme';

const YEAR = 60 * 60 * 24 * 365;

export default function ThemeToggle() {
  const pathname = usePathname();
  const t = useT();
  const [theme, setTheme] = useState<Theme | null>(null);

  // The theme is set before paint by a script in <head>; read it after mount so server and client markup match, and
  // follow later changes (navigation, or the system setting changing while no choice is saved) made by ThemeSync.
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (!isThemeReady(pathname) || !theme) return null;

  const next: Theme = theme === 'light' ? 'dark' : 'light';
  const switchTheme = () => {
    document.documentElement.dataset.theme = next;
    try {
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${YEAR}; samesite=lax`;
    } catch {
      // cookies blocked: the choice lasts until the next reload
    }
    setTheme(next);
  };
  const label = t(next === 'light' ? 'theme.toLight' : 'theme.toDark');

  return (
    <button
      type="button"
      onClick={switchTheme}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/15 text-ink/80 transition-colors hover:bg-ink/10 hover:text-ink"
    >
      {theme === 'light' ? <Moon aria-hidden className="h-4 w-4" /> : <Sun aria-hidden className="h-4 w-4" />}
    </button>
  );
}
