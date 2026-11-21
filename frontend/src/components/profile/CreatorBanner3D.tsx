'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { CDN_SERVICE_URL } from '@/lib/api';
import { useT } from '@/lib/i18n/client';
import type { Model, SellerModelItem } from '@/lib/types';

interface Props {
  models: (Model | SellerModelItem)[];
  isOwnerCreator?: boolean;
  previewPublic?: boolean;
  onTogglePreview?: () => void;
}

const SLOTS_COUNT = 5;

export default function CreatorBanner3D({
  models,
  isOwnerCreator,
  previewPublic,
  onTogglePreview,
}: Props) {
  const t = useT();
  const [viewerReady, setViewerReady] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    import('@google/model-viewer')
      .then(() => setViewerReady(true))
      .catch(() => setViewerReady(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(models.length / SLOTS_COUNT));
  const currentPage = Math.min(page, totalPages - 1);
  const startIndex = currentPage * SLOTS_COUNT;
  const currentModels = models.slice(startIndex, startIndex + SLOTS_COUNT);

  // Generate 5 equal slots
  const slots = Array.from({ length: SLOTS_COUNT }, (_, i) => currentModels[i] || null);

  return (
    <div className="relative h-64 w-full overflow-hidden border-b border-line bg-card sm:h-72 md:h-80">
      {/* Background Ambience & Gradient Mesh */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card via-card/85 to-accent/10" />
      <svg aria-hidden viewBox="0 0 1240 240" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full opacity-50">
        <defs>
          <linearGradient id="vgen-cover-holo" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#8fd3ff" />
            <stop offset="0.35" stopColor="#b892ff" />
            <stop offset="0.7" stopColor="#ff9ec7" />
            <stop offset="1" stopColor="#ffb070" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#vgen-cover-holo)" vectorEffect="non-scaling-stroke">
          <path d="M0 155 C220 185 380 45 620 95 S1020 190 1240 80" strokeOpacity="0.55" strokeWidth="1.5" />
          <path d="M0 185 C260 205 420 95 650 135 S1040 215 1240 125" strokeOpacity="0.25" strokeWidth="1.2" />
          <path d="M0 110 C190 135 350 20 590 60 S990 140 1240 45" strokeOpacity="0.18" strokeWidth="1" />
        </g>
      </svg>

      {/* Decorative Glow Orb */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />

      {/* Owner Public Preview & Batch Pagination */}
      <div className="absolute top-3 right-4 z-30 flex items-center gap-2 sm:top-4 sm:right-6">
        {models.length > SLOTS_COUNT && (
          <div className="flex items-center gap-1 rounded-full border border-line/80 bg-canvas/80 px-2.5 py-1 font-mono text-[11px] text-ink/70 backdrop-blur-md shadow-sm">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-0.5 hover:text-ink disabled:opacity-30 disabled:hover:text-ink/70"
              title="Previous 5 models"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="px-1">{currentPage + 1}/{totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-0.5 hover:text-ink disabled:opacity-30 disabled:hover:text-ink/70"
              title="Next 5 models"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {isOwnerCreator && onTogglePreview && (
          <button
            type="button"
            onClick={onTogglePreview}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas/80 px-3.5 py-1.5 text-xs font-medium text-ink backdrop-blur-md transition-colors hover:bg-canvas shadow-sm"
          >
            <span>{previewPublic ? t('profile.exitPreview') : t('profile.preview')}</span>
            <span className={`h-2 w-2 rounded-full ${previewPublic ? 'bg-warn' : 'bg-emerald-500'}`} />
          </button>
        )}
      </div>

      {/* 5 Equal Slots Grid (Border-free on client) */}
      <div className="relative mx-auto h-full max-w-[1400px] px-3 pb-6 pt-10 sm:px-4 md:px-6">
        <div className="grid h-full grid-cols-5 items-center gap-2 sm:gap-3 md:gap-4">
          {slots.map((model, index) => {
            if (model) {
              const baseCdn = `${CDN_SERVICE_URL}/cdn/models/${encodeURIComponent(model.id)}`;
              const previewSrc = `${baseCdn}/preview.glb`;
              const poster = model.posterUrl || `${baseCdn}/poster.webp`;
              const rotSpeed = `${20 + (index % 3) * 6}deg`;

              return (
                <div
                  key={model.id}
                  className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden border-none p-1"
                >
                  <div className="relative flex w-full flex-1 items-center justify-center">
                    {viewerReady ? (
                      <model-viewer
                        src={previewSrc}
                        poster={poster}
                        alt={model.title}
                        loading="eager"
                        crossorigin="anonymous"
                        camera-controls=""
                        interaction-prompt="none"
                        auto-rotate=""
                        rotation-per-second={rotSpeed}
                        exposure="1.05"
                        shadow-intensity="1.1"
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: 'transparent',
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-accent/60" />
                      </div>
                    )}
                  </div>

                  {/* Model Badge */}
                  <Link
                    href={`/models/${model.id}`}
                    className="group z-10 -mt-2 flex max-w-[95%] items-center gap-1 truncate rounded-full border border-line/70 bg-canvas/80 px-2 py-0.5 font-mono text-[10px] sm:text-[11px] text-ink/80 backdrop-blur-md transition-all hover:border-accent hover:text-ink hover:bg-canvas shadow-sm"
                    title={model.title}
                  >
                    <Box className="h-2.5 w-2.5 shrink-0 text-accent group-hover:scale-110 transition-transform" />
                    <span className="truncate">{model.title}</span>
                  </Link>
                </div>
              );
            }

            // Empty Slot: Creator Owner sees subtle upload slot, visitors see borderless space
            if (isOwnerCreator && !previewPublic) {
              return (
                <div
                  key={`empty-${index}`}
                  className="flex h-full w-full items-center justify-center border-none p-2"
                >
                  <Link
                    href="/upload"
                    className="group flex h-[65%] w-[85%] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line/40 bg-ink/[0.02] p-2 text-ink/35 transition-all hover:border-accent/60 hover:bg-accent/5 hover:text-accent"
                    title={t('profile.uploadGlb')}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 transition-transform group-hover:scale-110 group-hover:bg-accent/10">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-center">{t('profile.uploadGlb')}</span>
                  </Link>
                </div>
              );
            }

            // Client/Visitor: Seamless empty slot without lines
            return (
              <div
                key={`empty-${index}`}
                aria-hidden="true"
                className="h-full w-full border-none"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
