'use client';

// Landing page paging: with a mouse wheel or trackpad, one scroll gesture moves exactly one section (the same sections
// as the rail on the right edge); after the last section one more gesture goes to the bottom of the page. It only runs
// on wide screens with a fine pointer, so touch scrolling stays native, and it never blocks zoom (ctrl + wheel). A new
// gesture is ignored while the jump is playing and until the wheel has been quiet for a moment, so trackpad inertia
// cannot skip a section.
import { useEffect } from 'react';

const SECTION_TOP = 120; // keep in step with SectionDots: a section is "current" once its top is this close to the top
const JUMP_MS = 900; // the smooth scroll plus a margin
const QUIET_MS = 160; // wheel events this close together are one gesture
const MIN_DELTA = 4;

type Target = { id: string } | { top: number } | 'bottom';

export default function PageSnap({ ids }: { ids: string[] }) {
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    let lockedUntil = 0;
    let lastWheel = 0;

    const sections = () => ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

    const go = (target: Target) => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior = reduce ? 'auto' : 'smooth';
      if (target === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
      else if ('top' in target) window.scrollTo({ top: target.top, behavior });
      else document.getElementById(target.id)?.scrollIntoView({ behavior, block: 'start' });
    };

    const pick = (dir: 1 | -1): Target | null => {
      const list = sections();
      if (list.length === 0) return null;
      let cur = 0;
      list.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= SECTION_TOP) cur = i;
      });
      if (atBottom()) cur = list.length - 1;
      const top = list[cur].getBoundingClientRect().top;
      if (dir === 1) {
        // a page taller than the screen (short displays): show its lower part before leaving it
        const bottom = list[cur].getBoundingClientRect().bottom;
        if (bottom > window.innerHeight + 8) return { top: window.scrollY + bottom - window.innerHeight };
        if (cur < list.length - 1) return { id: list[cur + 1].id };
        return atBottom() ? null : 'bottom';
      }
      // up: finish the section we are inside of first (scrolled into it). At the very bottom the last section can sit
      // lower than the top of the screen and cannot be scrolled up to, so there we just go to the one before it.
      if (top < -8) return { id: list[cur].id };
      return cur > 0 ? { id: list[cur - 1].id } : null;
    };

    const onWheel = (e: WheelEvent) => {
      if (!wide.matches || e.ctrlKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // a sideways swipe is not paging
      if (Math.abs(e.deltaY) < MIN_DELTA) return;
      const now = performance.now();
      const gestureOver = now - lastWheel > QUIET_MS;
      lastWheel = now;
      const dir: 1 | -1 = e.deltaY > 0 ? 1 : -1;
      const target = pick(dir);
      if (!target) return; // top of the page going up, bottom going down: let the browser do its normal thing
      e.preventDefault();
      if (now < lockedUntil || !gestureOver) {
        // still inside the previous jump or its inertia: keep the lock alive, do nothing
        lockedUntil = Math.max(lockedUntil, now + QUIET_MS);
        return;
      }
      lockedUntil = now + JUMP_MS;
      go(target);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  return null;
}
