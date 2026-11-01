'use client';

// Horizontal row of model cards — scroll-snap, with arrow buttons on wide screens.
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ModelCard from '@/components/gallery/ModelCard';
import type { Model } from '@/lib/types';

const ARROW =
  'hidden h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors hover:border-white/50 hover:text-white md:grid';

export default function PopularCarousel({ models }: { models: Model[] }) {
  const listRef = useRef<HTMLUListElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="relative">
      <div className="absolute -top-12 right-0 flex gap-2">
        <button type="button" aria-label="Scroll left" onClick={() => scrollBy(-1)} className={ARROW}>
          <ChevronLeft aria-hidden className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Scroll right" onClick={() => scrollBy(1)} className={ARROW}>
          <ChevronRight aria-hidden className="h-5 w-5" />
        </button>
      </div>
      <ul
        ref={listRef}
        className="relative -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {models.map((m) => (
          <li key={m.id} className="w-[72%] shrink-0 snap-start sm:w-[42%] md:w-[31%] lg:w-[23.5%]">
            <ModelCard model={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}
