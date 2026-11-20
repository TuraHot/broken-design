'use client';

// Popular models in the "selected work" style: square cards (picture, mono title, category, ↗), rows of "+" marks down
// both sides, and one row of cards that drifts sideways forever. The drift pauses on hover or keyboard focus. With
// reduced motion (or too few models to loop) the row is a plain strip you scroll yourself.
import Link from 'next/link';
import { ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import type { Model } from '@/lib/types';

const PLUS_MARKS = 5;
// 2 columns visible on phones, 4 from md; 100cqw is the width of the clipping box (a size container, see below)
const COLS = 'auto-cols-[calc((100cqw-1rem)/2)] md:auto-cols-[calc((100cqw-3rem)/4)]';
const LOOP_FROM = 5; // more than 4 models = more than 4 columns, so there is something to scroll

function PopularCard({ model }: { model: Model }) {
  const t = useT();
  const free = model.priceCents === 0;
  const category = model.tags[0] ?? model.license;
  return (
    <Link
      href={`/models/${model.id}`}
      className="group block border border-line bg-card transition-colors hover:border-ink"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink/[0.06]">
        {model.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.posterUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div aria-hidden className="grid h-full w-full place-items-center text-ink/40">
            <ImageIcon className="h-7 w-7" />
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-[13px] font-semibold uppercase text-ink">{model.title}</h3>
          <p className="mt-1 truncate font-mono text-[11px] uppercase text-ink-soft">
            {category} · {free ? t('gallery.free') : formatPrice(model.priceCents)}
          </p>
        </div>
        <ArrowUpRight aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      </div>
    </Link>
  );
}

function Row({ models, inert }: { models: Model[]; inert?: boolean }) {
  return (
    <ul inert={inert} aria-hidden={inert || undefined} className={`grid shrink-0 grid-flow-col gap-4 ${COLS}`}>
      {models.map((m) => (
        <li key={m.id}>
          <PopularCard model={m} />
        </li>
      ))}
    </ul>
  );
}

export default function PopularGrid({ models }: { models: Model[] }) {
  const loop = models.length >= LOOP_FROM;
  return (
    <div className="relative px-4 md:px-16">
      {/* "+" marks down both sides, like the reference. They hug the cards, leaving the screen edge to the page dots. */}
      {(['left-0 items-end pr-2', 'right-0 items-start pl-2'] as const).map((side) => (
        <div
          key={side}
          aria-hidden
          className={`absolute inset-y-0 ${side} hidden w-16 flex-col justify-between py-2 font-mono text-[14px] leading-none text-ink-soft md:flex`}
        >
          {Array.from({ length: PLUS_MARKS }, (_, i) => (
            <span key={i}>+</span>
          ))}
        </div>
      ))}

      <div className="overflow-hidden [container-type:inline-size] motion-reduce:overflow-x-auto [scrollbar-width:thin]">
        <div
          className={`flex w-max gap-4 ${
            loop ? 'animate-[popular-drift_60s_linear_infinite] hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none' : ''
          }`}
        >
          <Row models={models} />
          {loop && (
            <div className="contents motion-reduce:hidden">
              <Row models={models} inert />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
