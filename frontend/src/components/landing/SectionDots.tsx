'use client';

// Quick jumps between the landing sections: a rail on the right edge (wide screens) with up and down arrows around the
// number of the current section, and a scroll-down arrow in the hero. A click scrolls smoothly to the section (instantly
// under reduced motion). The numbers are the same as the /01../07 headings on the page.
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';

export const LANDING_SECTIONS: { id: string; no: string; label: MessageKey }[] = [
  { id: 'hero', no: '01', label: 'home.nav.hero' },
  { id: 'how', no: '02', label: 'home.how.title' },
  { id: 'categories', no: '03', label: 'home.categories' },
  { id: 'popular', no: '04', label: 'home.popular' },
  { id: 'creators', no: '05', label: 'home.nav.creators' },
  { id: 'licenses', no: '06', label: 'home.nav.licenses' },
  { id: 'faq', no: '07', label: 'home.nav.faq' },
];

// A section counts as the current one once its top is within this many pixels of the top of the screen (a little more
// than the navbar plus the 80px scroll margin), so jumping to a section with the arrows lands exactly on it.
const SECTION_TOP = 120;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/**
 * The current section: the last one whose top has reached the top of the screen (SECTION_TOP), or the last section once
 * the page is scrolled to the bottom (short sections at the end could never be reached otherwise). Updated while scrolling.
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
      else for (const el of els) if (el.getBoundingClientRect().top <= SECTION_TOP) id = el.id;
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

// Tailwind only sees whole class names written out in the source, so the light-theme variants are spelled in full.
const RAIL_BTN =
  "grid h-9 w-9 place-items-center rounded-md text-ink transition-colors hover:text-highlight disabled:pointer-events-none disabled:opacity-30 outline-offset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-highlight [html[data-theme='light']_&]:text-canvas";

/** `ids` are the sections that exist on this render (kept as a list so a page can be dropped). */
export default function SectionDots({ ids }: { ids: string[] }) {
  const t = useT();
  const current = useCurrentSection(ids);
  const list = LANDING_SECTIONS.filter((s) => ids.includes(s.id));
  const index = Math.max(0, list.findIndex((s) => s.id === current));
  const here = list[index];
  const prev = list[index - 1];
  const next = list[index + 1];
  return (
    <nav aria-label={t('home.sections')} className="fixed right-3 top-1/2 z-20 hidden -translate-y-1/2 md:block">
      <div
        className="flex w-12 flex-col items-center rounded-lg border border-line bg-card py-1.5 [html[data-theme='light']_&]:border-ink [html[data-theme='light']_&]:bg-ink"
      >
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && scrollToSection(prev.id)}
          aria-label={t('home.prevSection')}
          className={RAIL_BTN}
        >
          <ChevronUp aria-hidden className="h-5 w-5" />
        </button>
        <p
          aria-live="polite"
          title={t(here.label)}
          className="py-1 text-center font-mono text-[16px] font-bold leading-none text-highlight"
        >
          <span className="sr-only">{t(here.label)} </span>
          {here.no}
        </p>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && scrollToSection(next.id)}
          aria-label={t('home.nextSection')}
          className={RAIL_BTN}
        >
          <ChevronDown aria-hidden className="h-5 w-5" />
        </button>
        {/* the number of the section the down arrow goes to */}
        <p aria-hidden className="h-4 font-mono text-[11px] leading-4 text-ink/50 [html[data-theme='light']_&]:text-canvas/50">
          {next?.no ?? ''}
        </p>
      </div>
    </nav>
  );
}
