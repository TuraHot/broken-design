'use client';

// Gallery card — lazy poster, title, creator, Free/price badge, likes
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MouseEvent, useEffect, useState } from 'react';
import { Heart, Image as ImageIcon, Loader2 } from 'lucide-react';
import { formatPrice as price } from '@/lib/format';
import type { Model } from '@/lib/types';

export default function ModelCard({ model }: { model: Model }) {
  const free = model.priceCents === 0;
  const pathname = usePathname();
  const [opening, setOpening] = useState(false);
  const targetHref = `/models/${model.id}`;

  useEffect(() => {
    setOpening(false);
  }, [pathname]);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (opening || pathname === targetHref) {
      e.preventDefault();
      return;
    }
    setOpening(true);
  };

  return (
    <Link
      href={targetHref}
      onClick={onClick}
      aria-busy={opening}
      className={`group block overflow-hidden rounded-lg border bg-white/5 transition-colors ${
        opening ? 'border-hud/50 cursor-wait' : 'border-white/10 hover:border-white/30'
      }`}
    >
      <div className="relative">
        {model.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={model.posterUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ) : (
          // Stand-in until real poster images exist.
          <div
            aria-hidden
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-white/[0.06] text-white/40"
          >
            <ImageIcon className="h-7 w-7" />
            <span className="text-sm">Image</span>
          </div>
        )}
        {opening && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgba(4,8,18,0.78)] backdrop-blur-[2px]">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-hud motion-reduce:animate-none" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-hud">[ Opening model… ]</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-white">{model.title}</h3>
        <p className="mt-0.5 truncate text-sm text-white/65">{model.creator}</p>
        <div className="mt-3 flex items-center justify-between">
          <span
            className={
              free
                ? 'rounded border border-hud/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-hud'
                : 'rounded border border-white/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white'
            }
          >
            {free ? 'Free' : price(model.priceCents)}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-white/65">
            <Heart aria-hidden className="h-4 w-4" />
            <span className="sr-only">Likes:</span>
            {model.likeCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
