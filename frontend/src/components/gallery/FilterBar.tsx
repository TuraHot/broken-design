// Gallery filters — connected to URL searchParams (?tag=&license=&price=).
import { getT } from '@/lib/i18n/server';
import { tagLabel } from '@/lib/i18n/tag';
import { GALLERY_TAGS, LICENSES, type ModelsParams } from '@/lib/types';
import FilterDropdown from './FilterDropdown';

// `value` is what goes into the URL (never translated); `label` is what the visitor reads.
export default async function FilterBar({ params = {} }: { params?: ModelsParams }) {
  const { t } = await getT();
  const all = { value: 'all', label: t('gallery.all') };
  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-3" role="group" aria-label={t('gallery.filters')}>
      <FilterDropdown
        label={t('gallery.fTag')}
        paramKey="tag"
        options={[all, ...GALLERY_TAGS.map((tag) => ({ value: tag, label: tagLabel(t, tag) }))]}
        params={params}
      />
      <FilterDropdown
        label={t('gallery.fLicense')}
        paramKey="license"
        options={[all, ...LICENSES.map((l) => ({ value: l, label: l }))]}
        params={params}
      />
      <FilterDropdown
        label={t('gallery.fPrice')}
        paramKey="price"
        options={[all, { value: 'free', label: t('gallery.free') }, { value: 'paid', label: t('gallery.paid') }]}
        params={params}
      />
    </div>
  );
}
