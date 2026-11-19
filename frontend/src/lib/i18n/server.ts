// Language for server components: read from the `lang` cookie. Using it makes the page render per request.
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, translate, type Locale, type MessageKey } from './messages';

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars) };
}
