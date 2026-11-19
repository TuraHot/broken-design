'use client';

// Quick jumps between the landing page sections: dots on the right edge (wide screens) and a scroll-down arrow in the
// hero. Scrolling stays free; a click only scrolls smoothly to the section (instantly under reduced motion).
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';

export const LANDING_SECTIONS: { id: string; label: MessageKey }[] = [
  { id: 'hero', label: 'home.nav.hero' },
  { id: 'popular', label: 'home.popular' },
  { id: 'categories', label: 'home.categories' },
  { id: 'arrivals', label: 'home.arrivals' },
  { id: 'join', label: 'home.getStarted' },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/**
 * The current section: the last one whose top has passed 40% of the screen height, or the last section once the page is
 * scrolled to the bottom (short sections at the end could never be reached otherwise). Updated while scrolling.
 */
function useCurrentSection(ids: string[]): string {
  const [current, setCurrent] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    if (els.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let id = els[0].id;
      if (atBottom) id = els[els.length - 1].id;
      else for (const el of els) if (el.getBoundingClientRect().top <= window.innerHeight * 0.4) id = el.id;
      setCurrent(id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);
  return current;
}

export function ScrollCue({ target = 'popular' }: { target?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => scrollToSection(target)}
      aria-label={t('home.scrollDown')}
      className="absolute bottom-4 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-accent text-accent transition-colors hover:bg-accent hover:text-canvas"
    >
      <ChevronDown aria-hidden className="h-5 w-5" />
    </button>
  );
}

/** `ids` are the sections that exist on this render (popular and arrivals only appear when there are models). */
export default function SectionDots({ ids }: { ids: string[] }) {
  const t = useT();
  const current = useCurrentSection(ids);
  return (
    <nav
      aria-label={t('home.sections')}
      className="fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 md:flex"
    >
      {LANDING_SECTIONS.filter((s) => ids.includes(s.id)).map(({ id, label }) => {
        const active = current === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => scrollToSection(id)}
            aria-label={t(label)}
            aria-current={active ? 'true' : undefined}
            title={t(label)}
            className="grid h-5 w-5 place-items-center"
          >
            <span
              className={`block rounded-full border border-accent transition-all ${
                active ? 'h-3 w-3 bg-accent' : 'h-2 w-2 bg-transparent'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
