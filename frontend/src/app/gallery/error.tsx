'use client';

// Shown when the gallery data cannot be loaded
import { useT } from '@/lib/i18n/client';

export default function GalleryError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <div className="rounded-lg border border-line bg-ink/5 p-10 text-center">
        <p className="text-ink">{t('sys.galleryError')}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-ink px-3.5 py-1.5 text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85"
        >
          {t('sys.tryAgain')}
        </button>
      </div>
    </main>
  );
}
