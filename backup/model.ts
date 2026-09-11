import type { CoachPersonalityPreference, VoicePreference } from '../coach/types.ts';
import type { ReminderDay } from '../reminders/types.ts';
import { DEFAULT_REMINDER_DAYS, DEFAULT_REMINDER_TIME, normalizeReminderDays, normalizeReminderTime } from '../reminders/reminders.ts';

export type TimerConfig = {
  id: string;
  name: string;
  nameIsCustom?: boolean;
  prepare: number;
  work: number;
  rest: number;
  rounds: number;
  cycles: number;
  cycleRest: number;
  cooldown: number;
};

export function normalizeTimerMetric(value: number, min: number, max: number) {
  const finiteValue = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, Math.round(finiteValue)));
}

export function normalizeTimerValues(timer: TimerConfig): TimerConfig {
  return {
    ...timer,
    prepare: normalizeTimerMetric(timer.prepare, 0, 600),
    work: normalizeTimerMetric(timer.work, 1, 3600),
    rest: normalizeTimerMetric(timer.rest, 0, 3600),
    rounds: normalizeTimerMetric(timer.rounds, 1, 99),
    cycles: normalizeTimerMetric(timer.cycles, 1, 20),
    cycleRest: normalizeTimerMetric(timer.cycleRest, 0, 3600),
    cooldown: normalizeTimerMetric(timer.cooldown, 0, 3600),
  };
}

export function normalizeStoredTimer(value: unknown): TimerConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const timer = value as Record<string, unknown>;
  const metricKeys = ['prepare', 'work', 'rest', 'rounds', 'cycles', 'cycleRest', 'cooldown'] as const;
  if (typeof timer.id !== 'string' || !timer.id
    || typeof timer.name !== 'string'
    || metricKeys.some((key) => typeof timer[key] !== 'number' || !Number.isFinite(timer[key]))) return null;

  return normalizeTimerValues({
    id: timer.id,
    name: timer.name,
    nameIsCustom: typeof timer.nameIsCustom === 'boolean' ? timer.nameIsCustom : undefined,
    prepare: timer.prepare as number,
    work: timer.work as number,
    rest: timer.rest as number,
    rounds: timer.rounds as number,
    cycles: timer.cycles as number,
    cycleRest: timer.cycleRest as number,
    cooldown: timer.cooldown as number,
  });
}

export type Settings = {
  soundEnabled: boolean;
  volume: number;
  ticking: boolean;
  voiceEnabled: boolean;
  coachPhrasesEnabled: boolean;
  voiceURI: string;
  coachPersonality: CoachPersonalityPreference;
  voicePreference: VoicePreference;
  lastAutomaticVoiceURI: string;
  ducking: boolean;
  rotation: boolean;
  weeklyActiveDayGoal: number;
  reminderDays: ReminderDay[];
  reminderTime: string;
};

export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  volume: 0.65,
  ticking: false,
  voiceEnabled: false,
  coachPhrasesEnabled: true,
  voiceURI: '',
  coachPersonality: 'focused',
  voicePreference: 'either',
  lastAutomaticVoiceURI: '',
  ducking: false,
  rotation: true,
  weeklyActiveDayGoal: 3,
  reminderDays: DEFAULT_REMINDER_DAYS,
  reminderTime: DEFAULT_REMINDER_TIME,
};

export function normalizeSettings(value: unknown): Settings {
  const stored = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Settings> & { weeklyWorkoutGoal?: unknown }
    : {};
  const { weeklyWorkoutGoal: legacyWeeklyWorkoutGoal, ...currentSettings } = stored;
  const requestedGoal = Number(currentSettings.weeklyActiveDayGoal ?? legacyWeeklyWorkoutGoal);
  return {
    ...DEFAULT_SETTINGS,
    ...currentSettings,
    weeklyActiveDayGoal: Number.isFinite(requestedGoal)
      ? Math.min(7, Math.max(1, Math.round(requestedGoal)))
      : DEFAULT_SETTINGS.weeklyActiveDayGoal,
    reminderDays: normalizeReminderDays(stored.reminderDays),
    reminderTime: normalizeReminderTime(stored.reminderTime),
  };
}
