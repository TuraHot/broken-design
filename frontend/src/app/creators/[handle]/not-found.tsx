import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

export default async function CreatorNotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <div className="rounded-lg border border-line bg-ink/5 p-10 text-center">
        <p className="text-ink">{t('sys.creatorNotFound')}</p>
        <Link
          href="/gallery"
          className="mt-4 inline-flex rounded-lg bg-ink px-3.5 py-1.5 text-[15px] font-medium text-canvas transition-colors hover:bg-ink/85"
        >
          {t('sys.backToGallery')}
        </Link>
      </div>
    </main>
  );
}
