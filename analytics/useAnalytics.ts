'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '../i18n/locales.ts';
import { CONSENT_KEY, consentRemainingMs, readConsent, writeConsent } from './consent.ts';
import type { Consent, ConsentChoice } from './consent.ts';
import type { AnalyticsScreen } from './events.ts';
import { AnalyticsService } from './service.ts';
import { clearAnalyticsCookies, createFirebaseProvider, disableGoogleCollection, readFirebaseConfig } from './firebase.ts';

export function useAnalytics(locale: Locale, appVersion: string) {
  const [consent, setConsent] = useState<Consent>('unknown');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const serviceRef = useRef<AnalyticsService | null>(null);
  const screenRef = useRef<AnalyticsScreen | 'labs'>('home');
  const localeRef = useRef(locale);
  const storageBlockedRef = useRef(false);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { localeRef.current = locale; }, [locale]);

  const refresh = useCallback(function refreshConsent() {
    let choice: Consent = 'unknown';
    try { if (!storageBlockedRef.current) choice = readConsent(window.localStorage); } catch { /* Fail closed. */ }
    const enabled = choice === 'accepted' && screenRef.current !== 'labs';
    disableGoogleCollection(readFirebaseConfig(), !enabled);
    serviceRef.current?.setAllowed(enabled);
    if (choice !== 'accepted') clearAnalyticsCookies();
    setConsent(choice);
    setReady(true);
    if (expiryRef.current !== null) clearTimeout(expiryRef.current);
    try {
      const remaining = consentRemainingMs(window.localStorage);
      if (remaining !== null && !storageBlockedRef.current) {
        expiryRef.current = setTimeout(refreshConsent, Math.min(remaining + 1, 2_000_000_000));
      }
    } catch { /* Storage unavailable. */ }
  }, []);

  useEffect(() => {
    const config = readFirebaseConfig();
    let active = true;
    disableGoogleCollection(config, true);
    const allowed = () => {
      try { return active && !storageBlockedRef.current && screenRef.current !== 'labs' && readConsent(window.localStorage) === 'accepted'; }
      catch { return false; }
    };
    const service = new AnalyticsService(
      () => config ? createFirebaseProvider(config, allowed, () => ({
        event_schema_version: 1, app_version: appVersion, locale: localeRef.current,
        surface: window.matchMedia('(display-mode: standalone)').matches ? 'web_standalone' : 'web_browser',
        storage_mode: 'local', account_state: 'none', connectivity: navigator.onLine ? 'online' : 'offline',
      })) : Promise.reject(new Error('Analytics not configured')),
      allowed,
      () => { if (screenRef.current !== 'labs') service.track('screen_view', { screen_name: screenRef.current }); },
    );
    serviceRef.current = service;
    const sync = () => refresh();
    const storage = (event: StorageEvent) => { if (!event.key || event.key === CONSENT_KEY) sync(); };
    const installed = () => service.track('pwa_install_observed', {});
    queueMicrotask(sync);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('appinstalled', installed);
    const expiry = window.setInterval(sync, 60_000);
    return () => {
      active = false;
      service.setAllowed(false);
      disableGoogleCollection(config, true);
      serviceRef.current = null;
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('appinstalled', installed);
      window.clearInterval(expiry);
      if (expiryRef.current !== null) clearTimeout(expiryRef.current);
    };
  }, [appVersion, refresh]);

  const choose = useCallback((choice: ConsentChoice) => {
    // Stop collection synchronously, even if persisting the new preference fails.
    disableGoogleCollection(readFirebaseConfig(), true);
    serviceRef.current?.setAllowed(false);
    let saved = false;
    try { saved = writeConsent(window.localStorage, choice); } catch { /* Fail closed. */ }
    setStorageError(!saved);
    storageBlockedRef.current = !saved;
    if (!saved) {
      // If replacing an accepted record fails (e.g. quota), try removing that
      // record so a later reload cannot mistake the stale choice for consent.
      try { window.localStorage.removeItem(CONSENT_KEY); } catch { /* This tab remains blocked. */ }
      setConsent('unknown');
      clearAnalyticsCookies();
      return;
    }
    refresh();
    if (choice === 'accepted' && screenRef.current !== 'labs') {
      serviceRef.current?.track('screen_view', { screen_name: screenRef.current });
    }
  }, [refresh]);

  const navigate = useCallback((screen: AnalyticsScreen | 'labs') => {
    if (screen === screenRef.current) return;
    screenRef.current = screen;
    refresh();
    if (screen !== 'labs') serviceRef.current?.track('screen_view', { screen_name: screen });
  }, [refresh]);
  const track = useCallback<AnalyticsService['track']>((event, parameters) => {
    serviceRef.current?.track(event, parameters);
  }, []);
  return { consent, ready, storageError, choose, navigate, track };
}
