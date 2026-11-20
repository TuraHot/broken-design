'use client';

// Gallery card — lazy poster, title, creator, Free/price badge, likes, and interactive 3D rotation on hover
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Heart, Image as ImageIcon, Loader2, Rotate3D } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { CDN_SERVICE_URL } from '@/lib/api';
import { formatCount, formatPrice as price } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import { useModelLike } from '@/lib/likes-store';
import type { Model } from '@/lib/types';

// Global dynamic loader for @google/model-viewer to load only once
let modelViewerPromise: Promise<any> | null = null;
function ensureModelViewer() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!modelViewerPromise) {
    modelViewerPromise = import('@google/model-viewer').catch((err) => {
      console.warn('Failed to load @google/model-viewer:', err);
    });
  }
  return modelViewerPromise;
}

export default function ModelCard({ model }: { model: Model }) {
  const router = useRouter();
  const t = useT();
  const free = model.priceCents === 0;
  const pathname = usePathname();
  const [opening, setOpening] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [show3D, setShow3D] = useState(false);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const downCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const { liked, count, busy, isRealModel, toggleLike } = useModelLike(model.id, model.likeCount);
  const targetHref = `/models/${model.id}`;
  const preview3dUrl = isRealModel
    ? `${CDN_SERVICE_URL}/cdn/models/${encodeURIComponent(model.id)}/preview.glb`
    : null;

  useEffect(() => {
    setOpening(false);
  }, [pathname]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!isRealModel) return;

    // 180ms debounce so cursor quickly sweeping past cards doesn't spin up WebGL
    hoverTimerRef.current = setTimeout(() => {
      ensureModelViewer().then(() => {
        setViewerReady(true);
        setShow3D(true);
      });
    }, 180);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShow3D(false);
    downCoordsRef.current = null;
  };

  // Click vs Drag on 3D viewport:
  // If user dragged to orbit (> 5px), don't navigate; if user clicked (< 5px), open model
  const onViewerPointerDown = (e: React.PointerEvent) => {
    downCoordsRef.current = { x: e.clientX, y: e.clientY };
  };

  const onViewerPointerUp = (e: React.PointerEvent) => {
    if (downCoordsRef.current) {
      const dist = Math.hypot(e.clientX - downCoordsRef.current.x, e.clientY - downCoordsRef.current.y);
      if (dist < 5) {
        if (!opening && pathname !== targetHref) {
          setOpening(true);
          router.push(targetHref);
        }
      }
    }
    downCoordsRef.current = null;
  };

  const onLinkClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (opening || pathname === targetHref) {
      e.preventDefault();
      return;
    }
    setOpening(true);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group block overflow-hidden rounded-lg border bg-card transition-colors ${
        opening ? 'border-accent/50 cursor-wait' : 'border-line hover:border-ink/40'
      }`}
    >
      {/* Media / 3D Canvas Viewport */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden bg-canvas/60 select-none"
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Interactive 3D Model Viewer on Hover */}
        {show3D && viewerReady && preview3dUrl ? (
          <div
            className="h-full w-full cursor-grab active:cursor-grabbing"
            onPointerDown={onViewerPointerDown}
            onPointerUp={onViewerPointerUp}
          >
            <model-viewer
              src={preview3dUrl}
              poster={model.posterUrl}
              alt={model.title}
              camera-controls
              auto-rotate
              shadow-intensity="1"
              style={{ width: '100%', height: '100%', backgroundColor: 'rgb(var(--c-canvas))' }}
              onError={() => setShow3D(false)}
            />
            {/* 3D Orbit Badge */}
            <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-canvas/75 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent border border-line backdrop-blur">
              <Rotate3D className="h-3 w-3 animate-pulse" />
              <span>{t('card.dragRotate')}</span>
            </div>
          </div>
        ) : (
          <Link
            href={targetHref}
            onClick={onLinkClick}
            className="block h-full w-full"
          >
            {model.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={model.posterUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ink/[0.06] text-ink/40"
              >
                <ImageIcon className="h-7 w-7" />
                <span className="text-sm">{t('card.image')}</span>
              </div>
            )}
          </Link>
        )}

        {/* 3D Available Badge (shown on hover before 3D loads) */}
        {!show3D && isRealModel && isHovered && (
          <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-canvas/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink/80 border border-line backdrop-blur">
            <Rotate3D className="h-3 w-3 text-accent" />
            <span>{t('card.badge3d')}</span>
          </div>
        )}

        {opening && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgba(4,8,18,0.78)] backdrop-blur-[2px]">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-accent motion-reduce:animate-none" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t('card.opening')}</span>
          </div>
        )}
      </div>

      {/* Model Metadata Section */}
      <div className="p-3">
        <Link href={targetHref} onClick={onLinkClick} className="block cursor-pointer">
          <h3 className="truncate text-sm font-medium text-ink group-hover:text-accent transition-colors">
            {model.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5">
            <UserAvatar name={model.creator} avatarUrl={model.creatorAvatarUrl} size="xs" />
            <p className="min-w-0 truncate text-sm text-ink-soft">{model.creator}</p>
          </div>
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <Link
            href={targetHref}
            onClick={onLinkClick}
            className={
              free
                ? 'rounded border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent'
                : 'rounded border border-ink/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink'
            }
          >
            {free ? t('gallery.free') : price(model.priceCents)}
          </Link>
          <button
            type="button"
            onClick={() => void toggleLike()}
            disabled={busy || !isRealModel}
            aria-pressed={liked}
            aria-label={liked ? t('model.unlike') : t('model.like')}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${
              liked ? 'text-red-500 hover:text-danger' : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Heart
              aria-hidden
              className={`h-4 w-4 transition-transform ${
                liked ? 'scale-110 fill-red-500 text-red-500' : 'fill-none'
              }`}
            />
            <span className="sr-only">{t('card.likes')}</span>
            <span>{formatCount(count)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
