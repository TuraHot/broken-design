'use client';

// Shown when the gallery data cannot be loaded
export default function GalleryError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <div className="rounded-lg border border-white/10 bg-white/5 p-10 text-center">
        <p className="text-white">Couldn&apos;t load models. Please try again.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-white px-3.5 py-1.5 text-[15px] font-medium text-black transition-colors hover:bg-white/85"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
