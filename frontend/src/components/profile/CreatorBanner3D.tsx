'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Box, Loader2, Plus, Search, X } from 'lucide-react';
import { CDN_SERVICE_URL } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import type { Model, SellerModelItem } from '@/lib/types';

interface Props {
  featuredModels: (Model | SellerModelItem)[];
  allModels?: (Model | SellerModelItem)[];
  isOwnerCreator?: boolean;
  previewPublic?: boolean;
  onTogglePreview?: () => void;
  onAddModel?: (modelId: string) => void;
  onRemoveModel?: (modelId: string) => void;
}

const SLOTS_COUNT = 5;

export default function CreatorBanner3D({
  featuredModels,
  allModels = [],
  isOwnerCreator,
  previewPublic,
  onTogglePreview,
  onAddModel,
  onRemoveModel,
}: Props) {
  const t = useT();
  const [viewerReady, setViewerReady] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    import('@google/model-viewer')
      .then(() => setViewerReady(true))
      .catch(() => setViewerReady(false));
  }, []);

  // Limit strictly to at most 5 models
  const displayedModels = featuredModels.slice(0, SLOTS_COUNT);
  const featuredIds = useMemo(() => new Set(displayedModels.map((m) => m.id)), [displayedModels]);

  // Generate 5 equal slots (Border-free on client)
  const slots = Array.from({ length: SLOTS_COUNT }, (_, i) => displayedModels[i] || null);

  // Filter models for selection modal
  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter((m) => m.title.toLowerCase().includes(q));
  }, [allModels, searchQuery]);

  return (
    <>
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

        {/* Top Controls: Model Selector & Preview Toggle */}
        <div className="absolute top-3 right-4 z-30 flex items-center gap-2 sm:top-4 sm:right-6">
          {isOwnerCreator && !previewPublic && (
            <button
              type="button"
              onClick={() => setIsSelectorOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas/80 px-3 py-1.5 font-mono text-xs text-ink/80 backdrop-blur-md shadow-sm transition-all hover:border-accent hover:text-ink hover:bg-canvas"
              title={t('profile.banner.modalTitle')}
            >
              <Plus className="h-3.5 w-3.5 text-accent" />
              <span>{t('profile.banner.selectBtn', { count: displayedModels.length, max: SLOTS_COUNT })}</span>
            </button>
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

        {/* 5 Equal Slots Grid (Strictly 5 slots, border-free on client) */}
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
                    className="group/slot relative flex h-full w-full flex-col items-center justify-center overflow-hidden border-none p-1"
                  >
                    {/* Remove from Showcase Button for Creator */}
                    {isOwnerCreator && !previewPublic && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveModel?.(model.id);
                        }}
                        className="absolute top-1 right-1 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-line/80 bg-canvas/90 text-ink/60 shadow-md backdrop-blur-sm transition-all hover:border-red-500/70 hover:bg-red-500 hover:text-white sm:opacity-75 sm:group-hover/slot:opacity-100"
                        title={t('profile.banner.removeSlotTooltip')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}

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

              // Empty Slot: Creator Owner sees button to select model to put up
              if (isOwnerCreator && !previewPublic) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="flex h-full w-full items-center justify-center border-none p-2"
                  >
                    <button
                      type="button"
                      onClick={() => setIsSelectorOpen(true)}
                      className="group flex h-[65%] w-[85%] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line/50 bg-ink/[0.02] p-2 text-ink/40 transition-all hover:border-accent hover:bg-accent/5 hover:text-accent shadow-sm"
                      title={t('profile.banner.emptySlot')}
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 transition-transform group-hover:scale-110 group-hover:bg-accent/10">
                        <Plus className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-center">
                        {t('profile.banner.emptySlot')}
                      </span>
                    </button>
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

      {/* Model Selection Modal for Creator */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-card shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 className="font-display text-lg uppercase tracking-tight text-ink">
                  {t('profile.banner.modalTitle')}
                </h3>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {t('profile.banner.modalSubtitle', { count: displayedModels.length, max: SLOTS_COUNT })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectorOpen(false)}
                className="rounded-lg p-1.5 text-ink-soft hover:bg-ink/5 hover:text-ink transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="border-b border-line px-5 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('profile.banner.searchPlaceholder')}
                  className="w-full rounded-xl border border-line bg-canvas pl-9 pr-3 py-2 text-xs text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Model List */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {filteredModels.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-soft">
                  {allModels.length === 0
                    ? t('profile.banner.emptyAccount')
                    : t('profile.banner.emptySearch')}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredModels.map((item) => {
                    const isFeatured = featuredIds.has(item.id);
                    const baseCdn = `${CDN_SERVICE_URL}/cdn/models/${encodeURIComponent(item.id)}`;
                    const posterSrc = item.posterUrl || `${baseCdn}/poster.webp`;
                    const priceFormatted =
                      item.priceCents > 0
                        ? formatPrice(item.priceCents)
                        : t('acct.free');

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 transition-all ${
                          isFeatured
                            ? 'border-accent/40 bg-accent/5'
                            : 'border-line/70 bg-canvas/60 hover:border-line'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {/* Thumbnail */}
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-ink/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={posterSrc}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 -z-10 flex items-center justify-center text-ink-soft">
                              <Box className="h-5 w-5" />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-ink">{item.title}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-ink-soft">{priceFormatted}</p>
                          </div>
                        </div>

                        {/* Action: Add / Remove */}
                        <div>
                          {isFeatured ? (
                            <button
                              type="button"
                              onClick={() => onRemoveModel?.(item.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 font-mono text-xs font-medium text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                            >
                              <X className="h-3 w-3" />
                              <span>{t('profile.banner.removeAction')}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={displayedModels.length >= SLOTS_COUNT}
                              onClick={() => onAddModel?.(item.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-accent bg-accent/10 px-2.5 py-1.5 font-mono text-xs font-medium text-accent hover:bg-accent hover:text-ink disabled:opacity-40 disabled:hover:bg-accent/10 disabled:hover:text-accent transition-all shadow-sm"
                            >
                              <Plus className="h-3 w-3" />
                              <span>{t('profile.banner.addAction')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <span className="font-mono text-xs text-ink-soft">
                {t('profile.banner.selectedCount', { count: displayedModels.length, max: SLOTS_COUNT })}
              </span>
              <button
                type="button"
                onClick={() => setIsSelectorOpen(false)}
                className="rounded-xl bg-accent px-4 py-2 font-mono text-xs font-medium text-ink hover:opacity-90 transition-opacity"
              >
                {t('profile.banner.done')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
