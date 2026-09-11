import { DEFAULT_SETTINGS, normalizeSettings, normalizeStoredTimer } from './model.ts';
import type { Settings, TimerConfig } from './model.ts';
import { parseWorkoutSessions } from '../progress/progress.ts';
import type { WorkoutSession } from '../progress/types.ts';
import { isLocale, LOCALE_STORAGE_KEY } from '../i18n/locales.ts';
import type { Locale } from '../i18n/locales.ts';
import { DEFAULT_LABS_SETTINGS, LABS_SETTINGS_STORAGE_KEY, LABS_PHRASES_STORAGE_KEY, parseLabsSettings, parseCandidatePack } from '../labs/storage.ts';
import { DRILL_STORAGE_KEY, parseDrillMemory } from '../coach/drill.ts';
import { createDisplayMessageMemory } from '../coach/display-messages.ts';

export const APP_VERSION = '1.4.0';
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export type AppState = { settings: Settings; timers: TimerConfig[]; recentTimerIds: string[]; workoutSessions: WorkoutSession[]; locale: Locale };
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const auxiliary = {
  [LABS_SETTINGS_STORAGE_KEY]: parseLabsSettings,
  [LABS_PHRASES_STORAGE_KEY]: parseCandidatePack,
  [DRILL_STORAGE_KEY]: parseDrillMemory,
  'pulse-display-message-memory-v1': createDisplayMessageMemory,
};
export type Backup = { format: 'laptiva-backup'; schemaVersion: 1; appVersion: string; exportedAt: string; defaults: { settings: Settings; locale: Locale; labs: typeof DEFAULT_LABS_SETTINGS }; state: AppState; auxiliary: Record<string, unknown> };
export type Issue = { kind: 'version' | 'defaults' | 'changed' | 'skipped' | 'voice'; path: string; before?: unknown; after?: unknown };
export type ImportPlan = { backup: Backup; issues: Issue[] };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function equal(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (record(a) && record(b)) {
    const keys = Object.keys(a).filter(k => a[k] !== undefined);
    return keys.length === Object.keys(b).filter(k => b[k] !== undefined).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
  }
  return a === b;
}
export function createBackup(state: AppState, storage: StorageLike, now = new Date()): Backup {
  const extras: Record<string, unknown> = {};
  for (const [key, parse] of Object.entries(auxiliary)) {
    const raw = storage.getItem(key);
    extras[key] = parse(raw ? JSON.parse(raw) : null);
  }
  return { format: 'laptiva-backup', schemaVersion: 1, appVersion: APP_VERSION, exportedAt: now.toISOString(), defaults: { settings: structuredClone(DEFAULT_SETTINGS), locale: 'en', labs: { ...DEFAULT_LABS_SETTINGS } }, state: structuredClone(state), auxiliary: extras };
}

/** Pure preview: never mutates storage. Unknown envelope versions cannot be safely interpreted. */
export function prepareImport(text: string, voiceURIs?: string[]): ImportPlan {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('size');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('invalid'); }
  if (!record(raw) || raw.format !== 'laptiva-backup' || raw.schemaVersion !== 1) throw new Error('format');
  if (typeof raw.appVersion !== 'string' || typeof raw.exportedAt !== 'string' || !Number.isFinite(Date.parse(raw.exportedAt))
    || !record(raw.defaults) || !record(raw.state) || !record(raw.state.settings)
    || !Array.isArray(raw.state.timers) || !Array.isArray(raw.state.recentTimerIds) || !Array.isArray(raw.state.workoutSessions)) throw new Error('invalid');
  const issues: Issue[] = [];
  for (const key of Object.keys(raw)) if (!['format', 'schemaVersion', 'appVersion', 'exportedAt', 'defaults', 'state', 'auxiliary'].includes(key)) issues.push({ kind: 'skipped', path: key });
  const changed = (path: string, a: unknown, b: unknown) => { if (!equal(a, b)) issues.push({ kind: 'changed', path, before: a, after: b }); };
  if (raw.appVersion !== APP_VERSION) issues.push({ kind: 'version', path: `${raw.appVersion} → ${APP_VERSION}` });
  const defaults = { settings: DEFAULT_SETTINGS, locale: 'en' as const, labs: DEFAULT_LABS_SETTINGS };
  for (const key of new Set([...Object.keys(raw.defaults), ...Object.keys(defaults)])) {
    const current = defaults[key as keyof typeof defaults];
    const previous = raw.defaults[key];
    if (key === 'settings' && record(previous)) {
      for (const field of new Set([...Object.keys(previous), ...Object.keys(DEFAULT_SETTINGS)])) {
        if (!equal(previous[field], DEFAULT_SETTINGS[field as keyof Settings])) issues.push({ kind: 'defaults', path: `settings.${field}`, before: previous[field], after: DEFAULT_SETTINGS[field as keyof Settings] });
      }
    } else if (!equal(previous, current)) issues.push({ kind: 'defaults', path: key, before: previous, after: current });
  }
  const candidate: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const value = raw.state.settings[key];
    candidate[key] = typeof value === typeof fallback && (typeof value !== 'number' || Number.isFinite(value)) ? value : fallback;
  }
  if (!['focused', 'energetic', 'tough', 'calm', 'drill', 'surprise'].includes(String(candidate.coachPersonality))) candidate.coachPersonality = DEFAULT_SETTINGS.coachPersonality;
  if (!['female', 'male', 'either'].includes(String(candidate.voicePreference))) candidate.voicePreference = DEFAULT_SETTINGS.voicePreference;
  candidate.volume = Math.max(0, Math.min(1, Number(candidate.volume)));
  const settings = normalizeSettings(candidate);
  for (const key of new Set([...Object.keys(raw.state.settings), ...Object.keys(settings)])) changed(`settings.${key}`, raw.state.settings[key], settings[key as keyof Settings]);
  for (const key of ['voiceURI', 'lastAutomaticVoiceURI'] as const) {
    if (settings[key] && voiceURIs && !voiceURIs.includes(settings[key])) {
      issues.push({ kind: 'voice', path: `settings.${key}` }); settings[key] = '';
    }
  }
  const timers: TimerConfig[] = [];
  const seen = new Set<string>();
  raw.state.timers.forEach((value, i) => {
    const timer = normalizeStoredTimer(value);
    if (!timer || seen.has(timer.id)) { issues.push({ kind: 'skipped', path: `timers[${i}]` }); return; }
    changed(`timers[${i}]`, value, timer); seen.add(timer.id); timers.push(timer);
  });
  const recentTimerIds = [...new Set(raw.state.recentTimerIds.filter((id): id is string => typeof id === 'string' && seen.has(id)))];
  changed('recentTimerIds', raw.state.recentTimerIds, recentTimerIds);
  const workoutSessions: WorkoutSession[] = [];
  const sessionIds = new Set<string>();
  raw.state.workoutSessions.forEach((value, i) => {
    const session = parseWorkoutSessions([value])[0];
    if (!session || sessionIds.has(session.id)) { issues.push({ kind: 'skipped', path: `workoutSessions[${i}]` }); return; }
    session.timerSnapshot = normalizeStoredTimer(session.timerSnapshot)!;
    changed(`workoutSessions[${i}]`, value, session); sessionIds.add(session.id); workoutSessions.push(session);
  });
  const locale = isLocale(raw.state.locale) ? raw.state.locale : 'en';
  changed('locale', raw.state.locale, locale);
  for (const key of Object.keys(raw.state)) if (!['settings', 'timers', 'recentTimerIds', 'workoutSessions', 'locale'].includes(key)) issues.push({ kind: 'skipped', path: `state.${key}` });
  const extras: Record<string, unknown> = {};
  const source = record(raw.auxiliary) ? raw.auxiliary : {};
  for (const [key, parse] of Object.entries(auxiliary)) { extras[key] = parse(source[key]); changed(key, source[key], extras[key]); }
  for (const key of Object.keys(source)) if (!Object.hasOwn(auxiliary, key)) issues.push({ kind: 'skipped', path: key });
  const drill = extras[DRILL_STORAGE_KEY] as ReturnType<typeof parseDrillMemory>;
  if (settings.coachPersonality === 'drill' && !drill.unlocked) { settings.coachPersonality = 'tough'; issues.push({ kind: 'changed', path: 'settings.coachPersonality', before: 'drill', after: 'tough' }); }
  return { backup: { format: 'laptiva-backup', schemaVersion: 1, appVersion: APP_VERSION, exportedAt: raw.exportedAt, defaults, state: { settings, timers, recentTimerIds, workoutSessions, locale }, auxiliary: extras }, issues };
}

/** Roll back all touched keys on quota/storage failure; caller reloads only after success. */
export function restoreBackup(storage: StorageLike, backup: Backup): void {
  const { state } = backup;
  const values: Record<string, unknown> = { 'pulse-settings-v1': state.settings, 'pulse-timers-v2': state.timers, 'pulse-recent-timers-v1': state.recentTimerIds, 'pulse-workout-sessions-v2': state.workoutSessions, ...backup.auxiliary };
  const entries = Object.entries(values).filter(([key]) => Object.hasOwn(auxiliary, key) || ['pulse-settings-v1', 'pulse-timers-v2', 'pulse-recent-timers-v1', 'pulse-workout-sessions-v2'].includes(key)).map(([key, value]) => [key, JSON.stringify(value)] as const);
  entries.push([LOCALE_STORAGE_KEY, state.locale]);
  const previous = entries.map(([key]) => [key, storage.getItem(key)] as const);
  try { for (const [key, value] of entries) storage.setItem(key, value); }
  catch {
    let rollbackFailed = false;
    for (const [key, value] of previous) { try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { rollbackFailed = true; } }
    throw new Error(rollbackFailed ? 'rollback' : 'storage');
  }
}
