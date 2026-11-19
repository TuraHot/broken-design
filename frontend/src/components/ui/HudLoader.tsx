import { Loader2 } from 'lucide-react';

const HUD_CLIP =
  'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))';

/** Centred HUD loading panel following the dark/hud visual system. */
export function HudLoader({
  label = '[ Loading · Lixyte ]',
  message = 'Syncing 3D asset stream…',
}: {
  label?: string;
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[55dvh] max-w-md items-center justify-center"
    >
      <div
        className="w-full border border-hud/35 bg-[rgba(4,8,18,0.66)] p-6 backdrop-blur-sm"
        style={{ clipPath: HUD_CLIP }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/80">{label}</p>
          <Loader2 aria-hidden className="h-4 w-4 animate-spin text-hud motion-reduce:animate-none" />
        </div>

        <p className="mt-4 text-sm text-white/80">{message}</p>

        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-hud via-violet to-amber motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton matching the `/gallery` page shell and card grid. */
export function GallerySkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading gallery" className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <div className="flex items-center gap-2">
        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-hud motion-reduce:animate-none" />
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ Syncing 3D library… ]</p>
      </div>
      <h1 className="mt-4 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02] text-white">Gallery</h1>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg border border-white/10 bg-white/5 motion-reduce:animate-none" />
          <div className="h-9 w-28 animate-pulse rounded-lg border border-white/10 bg-white/5 motion-reduce:animate-none" />
          <div className="h-9 w-24 animate-pulse rounded-lg border border-white/10 bg-white/5 motion-reduce:animate-none" />
        </div>
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
            <div className="aspect-[4/3] animate-pulse bg-white/[0.06] motion-reduce:animate-none" />
            <div className="space-y-2.5 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
              <div className="flex items-center justify-between pt-1">
                <div className="h-5 w-14 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
                <div className="h-4 w-10 animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** Skeleton matching `/models/[id]` layout (preview viewport + sticky action card). */
export function ModelDetailSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading model details" className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <div className="flex items-center gap-2 text-sm text-white/65">
        <span>Gallery</span>
        <span aria-hidden className="text-white/40">/</span>
        <span className="inline-block h-4 w-36 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-hud/25 bg-[rgba(4,8,18,0.66)]">
          <Loader2 aria-hidden className="h-6 w-6 animate-spin text-hud motion-reduce:animate-none" />
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/80">
            [ Connecting 3D stream… ]
          </p>
        </div>

        <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <div className="space-y-5 rounded-lg border border-white/10 bg-white/5 p-5">
            <div className="space-y-3">
              <div className="h-7 w-4/5 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
              <div className="flex gap-2">
                <div className="h-5 w-14 animate-pulse rounded border border-white/10 bg-white/5 motion-reduce:animate-none" />
                <div className="h-5 w-20 animate-pulse rounded border border-white/10 bg-white/5 motion-reduce:animate-none" />
              </div>
            </div>
            <div className="h-10 w-full animate-pulse rounded-lg bg-white/15 motion-reduce:animate-none" />
            <div className="flex items-center gap-3 border-t border-white/10 pt-5">
              <div className="h-10 w-10 animate-pulse rounded-full border border-hud/30 bg-white/5 motion-reduce:animate-none" />
              <div className="space-y-1.5">
                <div className="h-4 w-28 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
                <div className="h-3 w-12 animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-lg border border-white/10 bg-white/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ Description ]</p>
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-hud/70">[ How to use ]</p>
          <div className="mt-4 h-28 w-full animate-pulse rounded-lg border border-white/10 bg-black/70 motion-reduce:animate-none" />
        </section>
      </div>
    </main>
  );
}
