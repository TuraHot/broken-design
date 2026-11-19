// The legal pages and the date their draft text was last changed. Shown in the footer and on each page.
// `title` is the English name; `key` is its text key for the translated name (lib/i18n/messages.ts).
export const LEGAL_UPDATED = '2026-11-17';

export const LEGAL_PAGES = [
  { href: '/terms', title: 'Terms of Service', key: 'legal.terms' },
  { href: '/privacy', title: 'Privacy Policy', key: 'legal.privacy' },
  { href: '/seller-terms', title: 'Seller Terms', key: 'legal.sellerTerms' },
  { href: '/refunds', title: 'Refund Policy', key: 'legal.refunds' },
  { href: '/dmca', title: 'Copyright & DMCA', key: 'legal.dmca' },
] as const;
