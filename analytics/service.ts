import { sanitizeEvent } from './events.ts';
import type { EventName, SafeParameters, Track } from './events.ts';

export interface AnalyticsProvider {
  setEnabled(enabled: boolean): void;
  track(event: EventName, parameters: SafeParameters): void;
}
export class NoOpAnalytics implements AnalyticsProvider {
  setEnabled() {}
  track() {}
}

// No queue: events generated without consent, or while the SDK loads, are dropped.
export class AnalyticsService {
  private provider: AnalyticsProvider = new NoOpAnalytics();
  private allowed = false;
  private loading: Promise<void> | null = null;
  private loaded = false;
  private loadProvider: () => Promise<AnalyticsProvider>;
  private isAllowed: () => boolean;
  private onReady: () => void;
  constructor(loadProvider: () => Promise<AnalyticsProvider>, isAllowed: () => boolean, onReady = () => {}) {
    this.loadProvider = loadProvider;
    this.isAllowed = isAllowed;
    this.onReady = onReady;
  }

  setAllowed(allowed: boolean): void {
    this.allowed = allowed;
    try { this.provider.setEnabled(allowed && this.isAllowed()); } catch { /* Optional telemetry. */ }
    if (allowed && !this.loaded && !this.loading) {
      this.loading = this.loadProvider().then((provider) => {
        this.provider = provider;
        this.loaded = true;
        provider.setEnabled(this.allowed && this.isAllowed());
        if (this.enabled) this.onReady();
      }).catch(() => { /* Offline/ad blockers never break the app. */ }).finally(() => { this.loading = null; });
    }
  }

  get enabled() { return this.allowed && this.isAllowed(); }

  track: Track = (event, parameters) => {
    try {
      if (!this.enabled) return;
      const clean = sanitizeEvent(event, parameters);
      if (clean) this.provider.track(event, clean);
    } catch { /* Telemetry cannot interrupt workouts. */ }
  };
}
