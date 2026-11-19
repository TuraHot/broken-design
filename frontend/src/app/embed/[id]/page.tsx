// Iframe viewer page (/embed/[id]?key=...) — CSP frame-ancestors * is set in next.config.ts
// It is shown inside other people's sites, where the `lang` cookie is not sent, so `?lang=th` or `?lang=en` chooses the
// language of its few messages (without it: the cookie if there is one, otherwise English).
import EmbedIframeViewer from '@/components/viewer/EmbedIframeViewer';
import { LocaleProvider } from '@/lib/i18n/client';
import { isLocale } from '@/lib/i18n/messages';
import { getLocale } from '@/lib/i18n/server';

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function flag(v: string | string[] | undefined, defaultValue: boolean): boolean {
  const s = first(v);
  if (s === undefined) return defaultValue;
  return s !== 'false' && s !== '0';
}

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const asked = first(sp.lang);
  const locale = isLocale(asked) ? asked : await getLocale();

  return (
    <LocaleProvider locale={locale}>
    <EmbedIframeViewer
      id={id}
      embedKey={first(sp.key)}
      autoRotate={flag(sp['auto-rotate'] ?? sp.autoRotate, true)}
      cameraControls={flag(sp['camera-controls'] ?? sp.cameraControls, true)}
      background={first(sp.background) || '#09090b'}
      exposure={first(sp.exposure) || '1'}
      shadowIntensity={first(sp['shadow-intensity'] ?? sp.shadowIntensity) || '1'}
    />
    </LocaleProvider>
  );
}
