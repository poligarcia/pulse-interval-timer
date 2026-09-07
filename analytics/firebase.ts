import type { AnalyticsProvider } from './service.ts';
import type { SafeParameters } from './events.ts';

export type FirebaseClientConfig = {
  apiKey: string; projectId: string; appId: string; measurementId: string;
};

export function readFirebaseConfig(): FirebaseClientConfig | null {
  try {
    const value = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG ?? 'null');
    const environment = process.env.NEXT_PUBLIC_ANALYTICS_ENV;
    if (!value || !['development', 'production'].includes(environment ?? '')
      || value.projectId !== `laptiva-${environment}`
      || typeof value.apiKey !== 'string' || !value.apiKey
      || typeof value.appId !== 'string' || !value.appId
      || !/^G-[A-Z0-9]+$/.test(value.measurementId)) return null;
    // A development server must never contaminate the production property.
    if (process.env.NODE_ENV !== 'production' && environment === 'production') return null;
    return value;
  } catch { return null; }
}

export function disableGoogleCollection(config: FirebaseClientConfig | null, disabled: boolean) {
  if (config) (window as unknown as Record<string, unknown>)[`ga-disable-${config.measurementId}`] = disabled;
}

export function clearAnalyticsCookies() {
  // Dedicated host-only, root-path cookies; never touch app data or other sites' _ga cookies.
  try {
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0];
      if (/^laptiva_ga(?:_[A-Z0-9]+)?$/.test(name)) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      }
    }
  } catch { /* Restricted cookie storage. */ }
}

export async function createFirebaseProvider(
  config: FirebaseClientConfig,
  allowed: () => boolean,
  context: () => SafeParameters,
): Promise<AnalyticsProvider> {
  const [appSdk, sdk] = await Promise.all([import('firebase/app'), import('firebase/analytics')]);
  // Recheck after every async boundary: accepting then immediately revoking loads no tag.
  if (!allowed() || !(await sdk.isSupported()) || !allowed()) throw new Error('Analytics unavailable');
  const app = appSdk.getApps().find(({ name }) => name === 'laptiva-analytics')
    ?? appSdk.initializeApp(config, 'laptiva-analytics');
  sdk.setConsent({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  const analytics = sdk.initializeAnalytics(app, { config: {
    send_page_view: false,
    debug_mode: process.env.NEXT_PUBLIC_ANALYTICS_ENV === 'development',
    page_location: window.location.origin + window.location.pathname,
    page_referrer: '', page_title: 'Laptiva',
    allow_google_signals: false, allow_ad_personalization_signals: false,
    cookie_prefix: 'laptiva', cookie_domain: 'none', cookie_path: '/',
    cookie_expires: 180 * 24 * 60 * 60, cookie_update: false,
  } });
  // Do not hand a provider to the app while Firebase/gtag would queue its events.
  // No identifier is retained by Laptiva; this callback only establishes SDK readiness.
  await sdk.getGoogleAnalyticsClientId(analytics);
  return {
    setEnabled(enabled) {
      const collect = enabled && allowed();
      disableGoogleCollection(config, !collect);
      sdk.setAnalyticsCollectionEnabled(analytics, collect);
    },
    track(event, parameters) {
      if (!allowed()) return;
      const payload = { ...context(), ...parameters };
      if (event === 'screen_view') {
        sdk.logEvent(analytics, 'screen_view', { ...payload, firebase_screen: String(parameters.screen_name), firebase_screen_class: 'Laptiva' });
      } else {
        sdk.logEvent(analytics, event, payload);
      }
    },
  };
}
