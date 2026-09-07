import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONSENT_KEY, CONSENT_MAX_AGE_MS, parseConsent, readConsent, writeConsent } from './consent.ts';
import { completionBucket, durationBucket, sanitizeEvent } from './events.ts';
import { AnalyticsService } from './service.ts';
import type { AnalyticsProvider } from './service.ts';
import { WorkoutAnalytics } from './workout.ts';

describe('consent', () => {
  it('persists accept and reject equally and expires at 180 days', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    for (const choice of ['accepted', 'rejected'] as const) {
      assert.equal(writeConsent(storage, choice, 100), true);
      assert.equal(readConsent(storage, 100 + CONSENT_MAX_AGE_MS - 1), choice);
      assert.equal(readConsent(storage, 100 + CONSENT_MAX_AGE_MS), 'unknown');
      assert.equal(readConsent(storage, 99), 'unknown');
    }
    assert.ok(values.has(CONSENT_KEY));
  });
  it('fails closed on malformed, versioned, unavailable or silently dropped storage', () => {
    for (const raw of [null, '{', 'null', 'true', '{"version":2,"choice":"accepted","decidedAt":1}', '{"version":1,"choice":"accepted"}']) {
      assert.equal(parseConsent(raw, 100), 'unknown');
    }
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
    assert.equal(readConsent(broken), 'unknown');
    assert.equal(writeConsent(broken, 'accepted'), false);
    assert.equal(writeConsent({ getItem: () => null, setItem: () => {} }, 'accepted'), false);
  });
});

describe('analytics boundary', () => {
  it('drops extra/private properties and rejects invalid enums or Labs', () => {
    assert.deepEqual(sanitizeEvent('screen_view', { screen_name: 'home', email: 'private', page_location: '?secret' }), { screen_name: 'home' });
    assert.equal(sanitizeEvent('screen_view', { screen_name: 'labs' }), null);
    assert.equal(sanitizeEvent('timer_saved', { operation: 'create', planned_duration_bucket: 'secret' }), null);
    assert.deepEqual(sanitizeEvent('audio_recovery_attempted', { message: 'private stack' }), {});
  });
  it('never loads on unknown/rejected; never replays events from before consent or loading', async () => {
    let loads = 0;
    let allowed = false;
    const events: string[] = [];
    const service = new AnalyticsService(async () => {
      loads++;
      return { setEnabled() {}, track: (event) => { events.push(event); } };
    }, () => allowed);
    service.track('screen_view', { screen_name: 'home' });
    service.setAllowed(false);
    assert.equal(loads, 0);
    allowed = true;
    service.setAllowed(true);
    service.track('screen_view', { screen_name: 'library' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(events, []);
    service.track('screen_view', { screen_name: 'settings' });
    assert.deepEqual(events, ['screen_view']);
    allowed = false;
    service.track('screen_view', { screen_name: 'home' });
    assert.equal(events.length, 1);
  });
  it('revocation while loading keeps a late provider disabled', async () => {
    let resolve!: (provider: AnalyticsProvider) => void;
    const enabled: boolean[] = [];
    const service = new AnalyticsService(() => new Promise((done) => { resolve = done; }), () => true);
    service.setAllowed(true);
    service.setAllowed(false);
    resolve({ setEnabled: (value) => { enabled.push(value); }, track() { assert.fail('must not send'); } });
    await new Promise((done) => setImmediate(done));
    assert.deepEqual(enabled, [false]);
    service.track('screen_view', { screen_name: 'home' });
  });
  it('provider failures are isolated', async () => {
    const service = new AnalyticsService(async () => { throw new Error('offline'); }, () => true);
    assert.doesNotThrow(() => service.setAllowed(true));
    await new Promise((done) => setImmediate(done));
    assert.doesNotThrow(() => service.track('audio_recovery_attempted', {}));
  });
});

describe('workout lifecycle', () => {
  it('emits only one end per start, no end for preview, allows next execution', () => {
    const events: string[] = [];
    const run = new WorkoutAnalytics((event) => { events.push(event); });
    const end = { outcome: 'completed', completion_bucket: '100', phase_kind: 'cooldown', planned_duration_bucket: 'under_5m', coach_enabled: false } as const;
    run.end(end);
    run.start({ timer_source: 'preset', planned_duration_bucket: 'under_5m', coach_enabled: false });
    run.end(end); run.end({ ...end, outcome: 'discarded' });
    run.start({ timer_source: 'custom', planned_duration_bucket: 'under_5m', coach_enabled: true });
    run.end({ ...end, outcome: 'reset' });
    assert.deepEqual(events, ['workout_started', 'workout_ended', 'workout_started', 'workout_ended']);
  });
  it('buckets times without exposing precise workout duration', () => {
    assert.deepEqual([0, 299, 300, 900, 1800, 3600].map(durationBucket), ['under_5m', 'under_5m', '5_15m', '15_30m', '30_60m', '60m_plus']);
    assert.deepEqual([0, .25, .5, .75, .99, 1].map(completionBucket), ['0_24', '25_49', '50_74', '75_99', '75_99', '100']);
  });
});
