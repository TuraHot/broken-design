// Gallery — paged grid of publicly visible 3D models. Search, filters, and page live in URL params.
import type { Metadata } from 'next';
import FilterBar from '@/components/gallery/FilterBar';
import GallerySearchBar from '@/components/gallery/GallerySearchBar';
import ModelCard from '@/components/gallery/ModelCard';
import Pagination from '@/components/gallery/Pagination';
import { fetchAvailableTags, fetchModels } from '@/lib/api';
import { getT } from '@/lib/i18n/server';
import { extractAvailableTags, isPublicModel, parseParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('gallery.meta') };
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ t }, rawSearchParams, apiTags] = await Promise.all([
    getT(),
    searchParams,
    fetchAvailableTags(false),
  ]);
  const params = parseParams(rawSearchParams, apiTags);
  const rawData = await fetchModels(params);
  const items = rawData.items.filter(isPublicModel);
  const tags = apiTags.length > 0 ? apiTags : extractAvailableTags(items);
  const data = {
    ...rawData,
    items,
    total: Math.max(items.length, rawData.total - (rawData.items.length - items.length)),
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-24 md:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{t('gallery.label')}</p>
      <h1 className="mt-4 font-display text-[clamp(28px,4vw,48px)] uppercase leading-[1.02] text-ink">{t('nav.gallery')}</h1>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <GallerySearchBar initialQuery={params.q ?? ''} params={params} />
        <FilterBar params={params} tags={tags} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          {t(data.total === 1 ? 'gallery.countOne' : 'gallery.countMany', { n: data.total })}
        </p>
      </div>

      {data.items.length > 0 ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((m) => (
            <li key={m.id}>
              <ModelCard model={m} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-lg border border-line bg-ink/5 p-10 text-center">
          <p className="text-ink">{t('gallery.empty')}</p>
        </div>
      )}

      <Pagination data={data} params={params} />
    </main>
  );
}
