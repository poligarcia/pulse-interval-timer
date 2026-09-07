export type AnalyticsScreen = 'home' | 'library' | 'editor' | 'runner' | 'progress' | 'settings';
export type PhaseKind = 'prepare' | 'work' | 'rest' | 'cycleRest' | 'cooldown';
export type DurationBucket = 'under_5m' | '5_15m' | '15_30m' | '30_60m' | '60m_plus';
export type Outcome = 'completed' | 'partial_saved' | 'discarded' | 'reset';
export type CompletionBucket = '0_24' | '25_49' | '50_74' | '75_99' | '100';
export type AnalyticsEvents = {
  screen_view: { screen_name: AnalyticsScreen };
  timer_selected: { entry_point: 'home' | 'library'; timer_source: 'preset' | 'custom' };
  timer_saved: { operation: 'create' | 'update'; planned_duration_bucket: DurationBucket };
  workout_adjusted: { changed_field: 'structure' | 'duration' | 'both' };
  workout_started: { timer_source: 'preset' | 'custom'; planned_duration_bucket: DurationBucket; coach_enabled: boolean };
  workout_paused: { phase_kind: PhaseKind };
  workout_resumed: { phase_kind: PhaseKind };
  workout_ended: { outcome: Outcome; completion_bucket: CompletionBucket; phase_kind: PhaseKind; planned_duration_bucket: DurationBucket; coach_enabled: boolean };
  calendar_exported: { result: 'initiated' | 'failed' };
  setting_changed: { setting_name: 'sound' | 'ticking' | 'coach' | 'coach_phrases' | 'rotation' | 'locale'; setting_value: 'enabled' | 'disabled' | 'en' | 'es-AR' | 'pt-BR' };
  audio_recovery_attempted: Record<string, never>;
  pwa_install_observed: Record<string, never>;
};
export type EventName = keyof AnalyticsEvents;
export type Track = <E extends EventName>(event: E, parameters: AnalyticsEvents[E]) => void;
export type SafeParameters = Record<string, string | number | boolean>;

// Runtime allowlists also reject extra fields passed through spreads, casts or future callers.
const duration = ['under_5m', '5_15m', '15_30m', '30_60m', '60m_plus'];
const phase = ['prepare', 'work', 'rest', 'cycleRest', 'cooldown'];
const schema: Record<EventName, Record<string, readonly (string | boolean)[]>> = {
  screen_view: { screen_name: ['home', 'library', 'editor', 'runner', 'progress', 'settings'] },
  timer_selected: { entry_point: ['home', 'library'], timer_source: ['preset', 'custom'] },
  timer_saved: { operation: ['create', 'update'], planned_duration_bucket: duration },
  workout_adjusted: { changed_field: ['structure', 'duration', 'both'] },
  workout_started: { timer_source: ['preset', 'custom'], planned_duration_bucket: duration, coach_enabled: [true, false] },
  workout_paused: { phase_kind: phase }, workout_resumed: { phase_kind: phase },
  workout_ended: { outcome: ['completed', 'partial_saved', 'discarded', 'reset'], completion_bucket: ['0_24', '25_49', '50_74', '75_99', '100'], phase_kind: phase, planned_duration_bucket: duration, coach_enabled: [true, false] },
  calendar_exported: { result: ['initiated', 'failed'] },
  setting_changed: { setting_name: ['sound', 'ticking', 'coach', 'coach_phrases', 'rotation', 'locale'], setting_value: ['enabled', 'disabled', 'en', 'es-AR', 'pt-BR'] },
  audio_recovery_attempted: {}, pwa_install_observed: {},
};
export function sanitizeEvent(event: EventName, parameters: unknown): SafeParameters | null {
  if (!Object.hasOwn(schema, event) || !parameters || typeof parameters !== 'object') return null;
  const clean: SafeParameters = {};
  for (const [key, values] of Object.entries(schema[event])) {
    const value = (parameters as SafeParameters)[key];
    if (!values.includes(value as string | boolean)) return null;
    clean[key] = value;
  }
  return clean;
}
export function durationBucket(seconds: number): DurationBucket {
  return seconds < 300 ? 'under_5m' : seconds < 900 ? '5_15m' : seconds < 1800 ? '15_30m' : seconds < 3600 ? '30_60m' : '60m_plus';
}
export function completionBucket(fraction: number): CompletionBucket {
  return fraction >= 1 ? '100' : fraction >= .75 ? '75_99' : fraction >= .5 ? '50_74' : fraction >= .25 ? '25_49' : '0_24';
}
