'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  localeUrlCode,
  readLocaleFromSearch,
  readStoredLocale,
  resolveInitialLocale,
  urlWithLocale,
  writeStoredLocale,
} from './locales.ts';
import type { Locale } from './locales.ts';
import { getMessages } from './messages.ts';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setCurrentLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const linkedLocale = readLocaleFromSearch(window.location.search);
    const storedLocale = readStoredLocale(window.localStorage);
    const preferredLanguages = [...navigator.languages, navigator.language];
    const resolvedLocale = resolveInitialLocale(linkedLocale, storedLocale, preferredLanguages);
    if (linkedLocale) writeStoredLocale(window.localStorage, linkedLocale);
    window.history.replaceState(window.history.state, '', urlWithLocale(window.location.href, resolvedLocale));
    window.queueMicrotask(() => setCurrentLocale(resolvedLocale));
  }, []);

  useEffect(() => {
    const copy = getMessages(locale);
    document.documentElement.lang = locale;
    document.title = copy.shell.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.shell.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', copy.shell.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', copy.shell.description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', copy.shell.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', copy.shell.description);
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) {
      const code = localeUrlCode(locale);
      manifest.href = code === 'en' ? './manifest.webmanifest' : `./manifest.${code}.webmanifest`;
    }
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setCurrentLocale(nextLocale);
    writeStoredLocale(window.localStorage, nextLocale);
    window.history.replaceState(window.history.state, '', urlWithLocale(window.location.href, nextLocale));
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider.');
  return context;
}
