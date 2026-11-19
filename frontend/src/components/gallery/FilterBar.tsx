// Gallery filters — connected to URL searchParams (?tag=&license=&price=).
import { LICENSES, type ModelsParams } from '@/lib/types';
import FilterDropdown from './FilterDropdown';

export default function FilterBar({
  params = {},
  tags = [],
}: {
  params?: ModelsParams;
  tags?: readonly string[];
}) {
  const tagOptions = params.tag && !tags.includes(params.tag) ? ['All', params.tag, ...tags] : ['All', ...tags];

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-3" role="group" aria-label="Filters">
      <FilterDropdown label="Tag" paramKey="tag" options={tagOptions} params={params} />
      <FilterDropdown label="License" paramKey="license" options={['All', ...LICENSES]} params={params} />
      <FilterDropdown label="Price" paramKey="price" options={['All', 'Free', 'Paid']} params={params} />
    </div>
  );
}
