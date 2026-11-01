// Gallery filters — UI only. The dropdowns look and open like real filters but do not filter anything yet.
import { GALLERY_TAGS, LICENSES } from '@/lib/types';
import FilterDropdown from './FilterDropdown';

export default function FilterBar() {
  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-3" role="group" aria-label="Filters">
      <FilterDropdown label="Tag" options={['All', ...GALLERY_TAGS]} />
      <FilterDropdown label="License" options={['All', ...LICENSES]} />
      <FilterDropdown label="Price" options={['All', 'Free', 'Paid']} />
    </div>
  );
}
