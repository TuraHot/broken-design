// What each license allows, shared by the English and Thai /licenses pages.
import type { License } from '@/lib/types';

export type Cell = 'yes' | 'no' | 'credit' | 'undefined';

// Plain-words summary per license. The first three rows follow the creative-commons licenses;
// COMMERCIAL's modify and redistribute rules are not defined by the platform yet (see the note under the table).
export const MATRIX: Record<License, { commercial: Cell; modify: Cell; credit: Cell; resell: Cell }> = {
  CC0: { commercial: 'yes', modify: 'yes', credit: 'no', resell: 'yes' },
  'CC-BY': { commercial: 'yes', modify: 'yes', credit: 'credit', resell: 'credit' },
  'CC-BY-NC': { commercial: 'no', modify: 'credit', credit: 'credit', resell: 'credit' },
  COMMERCIAL: { commercial: 'yes', modify: 'undefined', credit: 'no', resell: 'no' },
};
