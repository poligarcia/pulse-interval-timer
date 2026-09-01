export const SUPPORTED_LOCALES = ['en', 'es-AR', 'pt-BR'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'pulse-locale-v1';
export const LOCALE_QUERY_PARAM = 'lang';

export const LOCALE_OPTIONS = [
  { locale: 'en', code: 'en', name: 'English' },
  { locale: 'es-AR', code: 'es', name: 'Español (Argentina)' },
  { locale: 'pt-BR', code: 'pt', name: 'Português (Brasil)' },
] as const satisfies ReadonlyArray<{
  locale: Locale;
  code: string;
  name: string;
}>;

export type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale);
}

export function matchSupportedLocale(languageTag: string): Locale | null {
  const normalized = languageTag.trim().replaceAll('_', '-').toLowerCase();
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized === 'es' || normalized.startsWith('es-')) return 'es-AR';
  if (normalized === 'pt' || normalized.startsWith('pt-')) return 'pt-BR';
  return null;
}

export function localeUrlCode(locale: Locale) {
  return LOCALE_OPTIONS.find((option) => option.locale === locale)?.code ?? 'en';
}

export function readLocaleFromSearch(search: string): Locale | null {
  const value = new URLSearchParams(search).get(LOCALE_QUERY_PARAM);
  return value ? matchSupportedLocale(value) : null;
}

export function urlWithLocale(href: string, locale: Locale) {
  const url = new URL(href);
  url.searchParams.set(LOCALE_QUERY_PARAM, localeUrlCode(locale));
  return url.toString();
}

export function resolveLocale(
  storedLocale: unknown,
  preferredLanguages: readonly string[] = [],
): Locale {
  if (isLocale(storedLocale)) return storedLocale;

  for (const language of preferredLanguages) {
    const matched = matchSupportedLocale(language);
    if (matched) return matched;
  }

  return DEFAULT_LOCALE;
}

export function resolveInitialLocale(
  linkedLocale: Locale | null,
  storedLocale: unknown,
  preferredLanguages: readonly string[] = [],
) {
  return linkedLocale ?? resolveLocale(storedLocale, preferredLanguages);
}

export function readStoredLocale(storage: LocaleStorage): Locale | null {
  try {
    const stored = storage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(storage: LocaleStorage, locale: Locale): boolean {
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
