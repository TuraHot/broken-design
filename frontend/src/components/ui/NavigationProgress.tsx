'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

const NAV_START_EVENT = 'lixyte:nav-start';
const HUD_CLIP =
  'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))';

/** Notify the global HUD navigation indicator when triggering programmatic navigation. */
export function startNavigationLoading(targetPath: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(NAV_START_EVENT, { detail: targetPath }));
}

function NavigationProgressInner() {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const navigatingRef = useRef(false);

  // Clear loading overlay as soon as the new route commits.
  useEffect(() => {
    navigatingRef.current = false;
    setNavigatingTo(null);
  }, [pathname, searchKey]);

  // Safety timeout so an aborted or cancelled navigation never locks the UI indefinitely.
  useEffect(() => {
    if (!navigatingTo) return;
    const timer = window.setTimeout(() => {
      navigatingRef.current = false;
      setNavigatingTo(null);
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [navigatingTo]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href') || '';
      if (!rawHref || rawHref.startsWith('#')) return;

      let targetUrl: URL;
      try {
        targetUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return;
      if (targetUrl.origin !== window.location.origin) return;
      if (targetUrl.pathname === '/embed' || targetUrl.pathname.startsWith('/embed/')) return;

      if (navigatingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const currentFull = `${window.location.pathname}${window.location.search}`;
      const nextFull = `${targetUrl.pathname}${targetUrl.search}`;
      if (nextFull === currentFull) {
        e.preventDefault();
        return;
      }

      navigatingRef.current = true;
      setNavigatingTo(targetUrl.pathname);
    };

    const onProgrammaticStart = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail || pathname;
      navigatingRef.current = true;
      setNavigatingTo(detail);
    };

    document.addEventListener('click', onDocClick, true);
    window.addEventListener(NAV_START_EVENT, onProgrammaticStart);
    return () => {
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener(NAV_START_EVENT, onProgrammaticStart);
    };
  }, [pathname]);

  if (!navigatingTo) return null;

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[80] h-0.5 animate-pulse bg-gradient-to-r from-hud via-violet to-amber shadow-[0_0_12px_rgba(143,211,255,0.85)] motion-reduce:animate-none"
      />
      <div
        role="status"
        aria-live="polite"
        aria-label={t('loader.page')}
        className="fixed inset-0 z-[65] flex cursor-wait items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      >
        <div
          className="w-full max-w-xs border border-hud/40 bg-[rgba(4,8,18,0.85)] p-5 shadow-2xl"
          style={{ clipPath: HUD_CLIP }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud">
              {t('loader.navigating')}
            </span>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin text-hud motion-reduce:animate-none" />
          </div>
          <p className="mt-3 text-sm text-white/80">{t('loader.view')}</p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-hud via-violet to-amber motion-reduce:animate-none" />
          </div>
        </div>
      </div>
    </>
  );
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
