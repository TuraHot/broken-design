'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';

const HUD_CLIP =
  'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-4 py-24 md:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_25%,rgba(255,77,109,0.12),transparent_60%),radial-gradient(ellipse_at_75%_75%,rgba(143,211,255,0.10),transparent_55%)]"
      />

      <div
        className="w-full max-w-[520px] border border-brand/40 bg-[rgba(4,8,18,0.66)] p-7 backdrop-blur-sm md:p-10"
        style={{ clipPath: HUD_CLIP }}
      >
        <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
          [ 500 &middot; System error ]
        </p>

        <h1 className="mt-4 font-display text-[clamp(24px,4vw,38px)] uppercase leading-[1.05] text-white">
          Something went wrong
        </h1>

        <p className="mt-3 text-[15px] leading-relaxed text-white/65">
          An unexpected error occurred while loading this page. Please try again
          or return to the home page.
        </p>

        {error?.digest && (
          <p className="mt-3 font-mono text-xs text-white/40">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            Try again
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-white/40 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition-colors hover:border-white hover:bg-white hover:text-black"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
