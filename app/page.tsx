'use client';

import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, UIEvent } from 'react';
import {
  COACH_PERSONALITIES,
  createCoachMemory,
  createDisplayMessageMemory,
  curateVoices,
  deriveCoachContext,
  getCoachPersonalityPresentation,
  makeCountdownSpeech,
  makeDisplayMessageSpeech,
  makePreviewSpeech,
  planCoachIntervention,
  resolveActiveCoach,
  resolveCoachPersonality,
  selectDisplayMessage,
  selectPhaseSpeech,
  speechLanguageForLocale,
} from '@/coach';
import type {
  ActiveCoach,
  CoachMemory,
  CoachPersonalityPreference,
  CoachSpeech,
  DisplayMessage,
  DisplayMessageKind,
  DisplayMessageMemory,
  PhaseKind,
  VoicePreference,
} from '@/coach';
import { createSpeechController } from '@/coach/speech-controller';
import type { SpeechController } from '@/coach/speech-controller';
import {
  calculateProgressMilestones,
  calculateProgressStreaks,
  calculateWorkoutSessionMetrics,
  createStoppedWorkoutSession,
  createWorkoutSession,
  parseWorkoutSessions,
  summarizeProgress,
} from '@/progress';
import type { ProgressMilestone, WorkoutSession } from '@/progress';
import { ProgressScreen } from '@/progress/ProgressScreen';
import { AppIcon } from '@/components/AppIcon';
import {
  DEFAULT_REMINDER_DAYS,
  DEFAULT_REMINDER_TIME,
  REMINDER_DAY_OPTIONS,
  createWorkoutReminderCalendarDataUrl,
  normalizeReminderDays,
  normalizeReminderTime,
} from '@/reminders';
import type { ReminderDay } from '@/reminders';
import {
  createLabsUnlockSequence,
  activateLabsUnlock,
  LABS_UNLOCK_WINDOW_MS,
} from '@/labs/unlock';
import type { LabsUnlockSequence } from '@/labs/unlock';
import {
  hideLabs,
  readLabsSettings,
  writeLabsSettings,
} from '@/labs/storage';
import { getMessages, localizeTimerName, LOCALE_OPTIONS, useLocale } from '@/i18n';
import type { AppMessages } from '@/i18n';
import { WorkoutAudioScheduler } from '@/workout/audio-scheduler';
import type { ScheduledAudioHandle } from '@/workout/audio-scheduler';
import { createBrowserAudioEngine } from '@/workout/audio-engine';
import type { AudioEngine } from '@/workout/audio-engine';
import { WorkoutTimeline } from '@/workout/timeline';
import type { WorkoutTimelineEvent, WorkoutTimelineSnapshot } from '@/workout/timeline';

const PulseLabsScreen = lazy(() => import('@/labs/components/PulseLabsScreen'));

type TimerConfig = {
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

function normalizeTimerMetric(value: number, min: number, max: number) {
  const finiteValue = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, Math.round(finiteValue)));
}

function normalizeTimerValues(timer: TimerConfig): TimerConfig {
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

function normalizeStoredTimer(value: unknown): TimerConfig | null {
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

type Settings = {
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

type WorkoutPhase = {
  kind: PhaseKind;
  duration: number;
  round: number;
  cycle: number;
};

type ScreenName = 'home' | 'library' | 'progress' | 'editor' | 'runner' | 'settings' | 'labs';
type ReturnScreen = 'home' | 'library' | 'progress';

const APP_VERSION = '1.4.0';
const TIMERS_STORAGE = 'pulse-timers-v2';
const LEGACY_TIMERS_STORAGE = 'pulse-timers-v1';
const SETTINGS_STORAGE = 'pulse-settings-v1';
const DISPLAY_MESSAGE_MEMORY_STORAGE = 'pulse-display-message-memory-v1';
const RECENT_TIMERS_STORAGE = 'pulse-recent-timers-v1';
const WORKOUT_SESSIONS_STORAGE = 'pulse-workout-sessions-v2';
const LEGACY_WORKOUT_SESSIONS_STORAGE = 'pulse-workout-sessions-v1';
const HOME_TIMER_LIMIT = 4;
const RECOVERY_SPEECH_PAUSE_MS = 400;
const AUDIO_START_LEAD_SECONDS = 0.075;

type ScreenWakeLock = {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void, options?: AddEventListenerOptions) => void;
};

type BrowserSpeechController = SpeechController<
  SpeechSynthesisVoice,
  SpeechSynthesisUtterance,
  number
>;

function generatedTimerName(timer: Pick<TimerConfig, 'work' | 'rest' | 'rounds' | 'cycles'>) {
  const cycles = timer.cycles > 1 ? ` X ${timer.cycles}` : '';
  return `${timer.work}s work - ${timer.rest}s rest X ${timer.rounds}${cycles}`;
}

function displayWorkoutSessionTimerName(session: WorkoutSession, copy: AppMessages) {
  return session.timerSnapshot.nameIsCustom === false
    ? localizeTimerName(session.timerSnapshot, copy)
    : session.timerName;
}

function makeDefaultTimer(work: number, rest: number, index: number): TimerConfig {
  const timer: TimerConfig = {
    id: `preset-${work}-${rest}-4-${index}`,
    name: '',
    nameIsCustom: false,
    prepare: 5,
    work,
    rest,
    rounds: 4,
    cycles: 1,
    cycleRest: 60,
    cooldown: 10,
  };
  timer.name = generatedTimerName(timer);
  return timer;
}

const DEFAULT_COMBINATIONS: Array<[number, number]> = [
  [10, 60], [10, 90], [15, 60], [15, 90], [20, 60], [20, 90], [20, 120],
  [30, 60], [30, 90], [30, 120], [40, 60], [40, 90], [50, 60], [50, 90],
];

const DEFAULT_TIMERS = DEFAULT_COMBINATIONS.map(([work, rest], index) => makeDefaultTimer(work, rest, index));

const LEGACY_DEFAULTS: TimerConfig[] = [
  { id: 'classic-30-60', name: 'Classic 30 / 60', prepare: 5, work: 30, rest: 60, rounds: 4, cycles: 1, cycleRest: 60, cooldown: 10 },
  { id: 'power-20-10', name: 'Power 20 / 10', prepare: 10, work: 20, rest: 10, rounds: 8, cycles: 2, cycleRest: 90, cooldown: 30 },
  { id: 'steady-45-15', name: 'Steady 45 / 15', prepare: 10, work: 45, rest: 15, rounds: 6, cycles: 1, cycleRest: 60, cooldown: 45 },
];

const DEFAULT_SETTINGS: Settings = {
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

function normalizeSettings(value: unknown): Settings {
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

function makeEmptyTimer(): TimerConfig {
  const timer: TimerConfig = {
    id: '',
    name: '',
    nameIsCustom: false,
    prepare: 10,
    work: 30,
    rest: 15,
    rounds: 6,
    cycles: 1,
    cycleRest: 60,
    cooldown: 30,
  };
  timer.name = generatedTimerName(timer);
  return timer;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function formatCompact(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return formatTime(seconds);
}

function formatProgressMinutes(seconds: number) {
  if (seconds <= 0) return '0';
  if (seconds < 60) return '<1';
  return String(Math.round(seconds / 60));
}

function workoutDuration(timer: TimerConfig) {
  const normalized = normalizeTimerValues(timer);
  const work = normalized.work * normalized.rounds * normalized.cycles;
  const roundRests = normalized.rest * Math.max(0, normalized.rounds - 1) * normalized.cycles;
  const cycleRests = normalized.cycleRest * Math.max(0, normalized.cycles - 1);
  return normalized.prepare + work + roundRests + cycleRests + normalized.cooldown;
}

function selectHomeTimers(timers: TimerConfig[], recentTimerIds: string[]) {
  const timersById = new Map(timers.map((timer) => [timer.id, timer]));
  const selectedIds = new Set<string>();
  const selectedTimers: TimerConfig[] = [];

  for (const id of recentTimerIds) {
    const timer = timersById.get(id);
    if (!timer || selectedIds.has(id)) continue;
    selectedIds.add(id);
    selectedTimers.push(timer);
  }

  for (const timer of timers) {
    if (selectedTimers.length >= HOME_TIMER_LIMIT) break;
    if (selectedIds.has(timer.id)) continue;
    selectedIds.add(timer.id);
    selectedTimers.push(timer);
  }

  return selectedTimers.slice(0, HOME_TIMER_LIMIT);
}

function buildSequence(timer: TimerConfig): WorkoutPhase[] {
  const normalized = normalizeTimerValues(timer);
  const sequence: WorkoutPhase[] = [];
  if (normalized.prepare > 0) {
    sequence.push({ kind: 'prepare', duration: normalized.prepare, round: 1, cycle: 1 });
  }

  for (let cycle = 1; cycle <= normalized.cycles; cycle += 1) {
    for (let round = 1; round <= normalized.rounds; round += 1) {
      sequence.push({ kind: 'work', duration: normalized.work, round, cycle });
      if (round < normalized.rounds && normalized.rest > 0) {
        sequence.push({ kind: 'rest', duration: normalized.rest, round, cycle });
      }
    }

    if (cycle < normalized.cycles && normalized.cycleRest > 0) {
      sequence.push({ kind: 'cycleRest', duration: normalized.cycleRest, round: normalized.rounds, cycle });
    }
  }

  if (normalized.cooldown > 0) {
    sequence.push({ kind: 'cooldown', duration: normalized.cooldown, round: normalized.rounds, cycle: normalized.cycles });
  }

  return sequence;
}

function isUnchangedLegacyDefault(timer: TimerConfig) {
  const original = LEGACY_DEFAULTS.find((candidate) => candidate.id === timer.id);
  if (!original) return false;
  return (['name', 'prepare', 'work', 'rest', 'rounds', 'cycles', 'cycleRest', 'cooldown'] as const)
    .every((key) => timer[key] === original[key]);
}

function migrateLegacyTimers(timers: TimerConfig[]) {
  const preserved = timers
    .filter((timer) => !isUnchangedLegacyDefault(timer))
    .map((timer) => ({
      ...timer,
      id: LEGACY_DEFAULTS.some((preset) => preset.id === timer.id) ? `migrated-${timer.id}` : timer.id,
      nameIsCustom: true,
    }));
  return [...DEFAULT_TIMERS, ...preserved];
}

function PlayGlyph() {
  return <span className="play-glyph" aria-hidden="true" />;
}

function PauseGlyph() {
  return <span className="pause-glyph" aria-hidden="true"><i /><i /></span>;
}

function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`switch ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
      <span className="switch-track"><span className="switch-thumb" /></span>
    </label>
  );
}

function MetricInput({
  label,
  helper,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string;
  helper: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="metric-input">
      <span className="metric-copy"><strong>{label}</strong><small>{helper}</small></span>
      <span className="metric-control">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? normalizeTimerMetric(next, min, max) : min);
          }}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}

const DURATION_WHEEL_ITEM_HEIGHT = 78;
const DURATION_WHEEL_MOUSE_DRAG_MULTIPLIER = 1.45;
const DURATION_WHEEL_MOUSE_MOMENTUM_MS = 180;
const MAX_WHEEL_DURATION_SECONDS = (59 * 60) + 59;

type DurationWheelDrag = {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  lastY: number;
  lastTimestamp: number;
  velocity: number;
  moved: boolean;
};

function DurationWheelColumn({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const optionIdPrefix = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const dragRef = useRef<DurationWheelDrag | null>(null);
  const valueFromScrollRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const values = Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index);

  useEffect(() => {
    if (!listRef.current) return;
    if (valueFromScrollRef.current === value) {
      valueFromScrollRef.current = null;
      return;
    }
    listRef.current.scrollTo({ top: (value - min) * DURATION_WHEEL_ITEM_HEIGHT, behavior: 'auto' });
  }, [min, value]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const nextValue = Math.min(max, Math.max(min, min + Math.round(scrollTop / DURATION_WHEEL_ITEM_HEIGHT)));
      if (nextValue !== value) {
        valueFromScrollRef.current = nextValue;
        onChange(nextValue);
      }
    });
  };

  const selectValue = (nextValue: number) => {
    valueFromScrollRef.current = nextValue;
    onChange(nextValue);
    listRef.current?.scrollTo({
      top: (nextValue - min) * DURATION_WHEEL_ITEM_HEIGHT,
      behavior: 'smooth',
    });
  };

  const finishMouseDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const drag = dragRef.current;
    const list = listRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !list) return;

    if (list.hasPointerCapture(event.pointerId)) list.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);

    if (!drag.moved) return;
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);

    const releaseVelocity = event.timeStamp - drag.lastTimestamp > 80 ? 0 : drag.velocity;
    const projectedScrollTop = cancelled
      ? list.scrollTop
      : list.scrollTop + (releaseVelocity * DURATION_WHEEL_MOUSE_MOMENTUM_MS);
    const nextValue = Math.min(max, Math.max(min, min + Math.round(projectedScrollTop / DURATION_WHEEL_ITEM_HEIGHT)));
    selectValue(nextValue);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !listRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: listRef.current.scrollTop,
      lastY: event.clientY,
      lastTimestamp: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const list = listRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !list) return;
    event.preventDefault();

    const elapsed = Math.max(1, event.timeStamp - drag.lastTimestamp);
    const distance = (drag.lastY - event.clientY) * DURATION_WHEEL_MOUSE_DRAG_MULTIPLIER;
    drag.velocity = distance / elapsed;
    drag.lastY = event.clientY;
    drag.lastTimestamp = event.timeStamp;
    drag.moved ||= Math.abs(event.clientY - drag.startY) > 3;
    list.scrollTop = drag.startScrollTop
      + ((drag.startY - event.clientY) * DURATION_WHEEL_MOUSE_DRAG_MULTIPLIER);
  };

  return (
    <div className="duration-wheel-column">
      <div className="duration-wheel-selection" aria-hidden="true" />
      <div
        className={`duration-wheel-list${isDragging ? ' dragging' : ''}`}
        ref={listRef}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${optionIdPrefix}-${value}`}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishMouseDrag}
        onPointerCancel={(event) => finishMouseDrag(event, true)}
      >
        {values.map((option) => (
          <button
            type="button"
            className={option === value ? 'selected' : ''}
            id={`${optionIdPrefix}-${option}`}
            role="option"
            aria-selected={option === value}
            tabIndex={option === value ? 0 : -1}
            key={option}
            onClick={() => {
              if (!suppressClickRef.current) selectValue(option);
            }}
          >
            {String(option).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  );
}

function DurationInput({
  label,
  helper,
  value,
  min,
  max,
  minutesUnit,
  secondsUnit,
  onChange,
}: {
  label: string;
  helper: string;
  value: number;
  min: number;
  max: number;
  minutesUnit: string;
  secondsUnit: string;
  onChange: (value: number) => void;
}) {
  const { locale } = useLocale();
  const commonCopy = getMessages(locale).common;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const helperId = useId();
  const normalizedValue = normalizeTimerMetric(value, min, max);
  const [pickerValue, setPickerValue] = useState(normalizedValue);
  const [pickerOpen, setPickerOpen] = useState(false);
  const minutes = Math.floor(pickerValue / 60);
  const seconds = pickerValue % 60;
  const maximumMinutes = Math.floor(max / 60);
  const maximumSeconds = minutes === maximumMinutes ? max % 60 : 59;
  const minimumSeconds = minutes === 0 ? min : 0;

  const updatePickerValue = (nextMinutes: number, nextSeconds: number) => {
    setPickerValue(normalizeTimerMetric((nextMinutes * 60) + nextSeconds, min, max));
  };

  const openPicker = () => {
    setPickerValue(normalizedValue);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    setPickerOpen(true);
  };

  const cancelPicker = () => {
    setPickerValue(normalizedValue);
    dialogRef.current?.close();
    setPickerOpen(false);
  };

  const applyPicker = () => {
    onChange(pickerValue);
    dialogRef.current?.close();
    setPickerOpen(false);
  };

  return (
    <>
      <button type="button" className="duration-input" onClick={openPicker} aria-label={`${commonCopy.edit} ${label}`}>
        <span className="metric-copy"><strong>{label}</strong><small>{helper}</small></span>
        <span className="duration-value">
          <output aria-live="polite">{formatTime(normalizedValue)}</output>
          <small>{commonCopy.edit}</small>
        </span>
      </button>
      <dialog
        className="duration-picker-dialog"
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={helperId}
        onCancel={(event) => {
          event.preventDefault();
          cancelPicker();
        }}
      >
        <div className="duration-picker-content">
          <header>
            <button type="button" onClick={cancelPicker}>{commonCopy.cancel}</button>
            <strong id={titleId}>{label}</strong>
            <button type="button" className="accent" onClick={applyPicker}>{commonCopy.done}</button>
          </header>
          <p id={helperId}>{helper}</p>
          <output className="duration-picker-total" aria-live="polite">{formatTime(pickerValue)}</output>
          {pickerOpen && (
            <div className="duration-wheel-pickers">
              <DurationWheelColumn
                label={`${label} · ${minutesUnit}`}
                value={minutes}
                min={0}
                max={maximumMinutes}
                onChange={(nextMinutes) => updatePickerValue(nextMinutes, seconds)}
              />
              <span className="duration-wheel-unit">{minutesUnit}</span>
              <DurationWheelColumn
                label={`${label} · ${secondsUnit}`}
                value={seconds}
                min={minimumSeconds}
                max={maximumSeconds}
                onChange={(nextSeconds) => updatePickerValue(minutes, nextSeconds)}
              />
              <span className="duration-wheel-unit">{secondsUnit}</span>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

function TimerDetails({ timer, index, copy }: { timer: TimerConfig; index: number; copy: AppMessages }) {
  const timerName = localizeTimerName(timer, copy);
  return (
    <>
      <span className={`timer-number color-${index % 3}`}>{String(index + 1).padStart(2, '0')}</span>
      <span className="timer-info">
        <strong>{timerName}</strong>
        <small>{formatTime(workoutDuration(timer))} · {copy.timerDetails.structure(timer.rounds, timer.cycles)}</small>
        <span className="interval-row">
          <span><i className="dot work-dot" /> {copy.timerDetails.work} {formatCompact(timer.work)}</span>
          <span><i className="dot rest-dot" /> {copy.timerDetails.rest} {formatCompact(timer.rest)}</span>
        </span>
      </span>
    </>
  );
}

export default function Home() {
  const { locale, setLocale } = useLocale();
  const copy = getMessages(locale);
  const localeName = LOCALE_OPTIONS.find((option) => option.locale === locale)?.name ?? locale;
  const [screen, setScreen] = useState<ScreenName>('home');
  const [returnScreen, setReturnScreen] = useState<ReturnScreen>('home');
  const [timers, setTimers] = useState<TimerConfig[]>(DEFAULT_TIMERS);
  const [recentTimerIds, setRecentTimerIds] = useState<string[]>([]);
  const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<TimerConfig>(makeEmptyTimer());
  const [activeTimer, setActiveTimer] = useState<TimerConfig>(DEFAULT_TIMERS[0]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(DEFAULT_TIMERS[0].prepare);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hasWorkoutStarted, setHasWorkoutStarted] = useState(false);
  const [progressAnnouncement, setProgressAnnouncement] = useState('');
  const [sessionAdjustment, setSessionAdjustment] = useState({
    prepare: DEFAULT_TIMERS[0].prepare,
    work: DEFAULT_TIMERS[0].work,
    rest: DEFAULT_TIMERS[0].rest,
    rounds: DEFAULT_TIMERS[0].rounds,
    cycles: DEFAULT_TIMERS[0].cycles,
    cycleRest: DEFAULT_TIMERS[0].cycleRest,
    cooldown: DEFAULT_TIMERS[0].cooldown,
  });
  const [newMilestones, setNewMilestones] = useState<ProgressMilestone[]>([]);
  const [calendarStatus, setCalendarStatus] = useState('');
  const [labsUnlocked, setLabsUnlocked] = useState(false);
  const [labsUnlockSequence, setLabsUnlockSequence] = useState<LabsUnlockSequence>(() => createLabsUnlockSequence());
  const [labsUnlockMessage, setLabsUnlockMessage] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioNeedsGesture, setAudioNeedsGesture] = useState(false);
  const [audioRestorePending, setAudioRestorePending] = useState(false);
  const [workoutStartPending, setWorkoutStartPending] = useState(false);
  const [runnerMessageSelection, setRunnerMessageSelection] = useState<{
    phaseIndex: number;
    kind: DisplayMessageKind;
    message: DisplayMessage;
  } | null>(null);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const speechControllerRef = useRef<BrowserSpeechController | null>(null);
  const workoutAudioSchedulerRef = useRef<WorkoutAudioScheduler | null>(null);
  const workoutTimelineRef = useRef<WorkoutTimeline | null>(null);
  const activeCoachRef = useRef<ActiveCoach | null>(null);
  const coachMemoryRef = useRef<CoachMemory>(createCoachMemory());
  const displayMessageMemoryRef = useRef<DisplayMessageMemory>(createDisplayMessageMemory());
  const transitionLockRef = useRef(false);
  const workoutRunGenerationRef = useRef(0);
  const workoutStartPendingRef = useRef(false);
  const workoutStartTokenRef = useRef(0);
  const audioEnsurePromiseRef = useRef<Promise<AudioContext | null> | null>(null);
  const audioRecoveryPromiseRef = useRef<Promise<void> | null>(null);
  const audioRestorePromiseRef = useRef<Promise<void> | null>(null);
  const mediaWasHiddenRef = useRef(false);
  const suppressWorkoutCuesRef = useRef(false);
  const finishIntentRef = useRef(false);
  const resumeAfterFinishDialogRef = useRef(false);
  const lastTickSecondRef = useRef<number | null>(null);
  const phaseIndexRef = useRef(0);
  const runningRef = useRef(false);
  const sequenceRef = useRef<WorkoutPhase[]>([]);
  const settingsRef = useRef(settings);
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);
  const wakeLockWantedRef = useRef(false);
  const coachSpeechGenerationRef = useRef(0);
  const pendingCoachSpeechTimeoutRef = useRef<number | null>(null);
  const workoutStartedAtRef = useRef<string | null>(null);
  const recordedWorkoutSessionIdRef = useRef<string | null>(null);
  const adjustSessionDialogRef = useRef<HTMLDialogElement | null>(null);
  const finishSessionDialogRef = useRef<HTMLDialogElement | null>(null);
  const labsOpeningControlRef = useRef<HTMLButtonElement | null>(null);
  const restoreLabsFocusRef = useRef(false);
  const labsUnlockSequenceRef = useRef<LabsUnlockSequence>(createLabsUnlockSequence());

  const sequence = useMemo(() => buildSequence(activeTimer), [activeTimer]);
  sequenceRef.current = sequence;
  phaseIndexRef.current = phaseIndex;
  runningRef.current = running;
  settingsRef.current = settings;
  const currentPhase = sequence[phaseIndex];
  const nextPhase = sequence[phaseIndex + 1];
  const curatedVoices = useMemo(() => curateVoices(availableVoices, locale), [availableVoices, locale]);
  const recommendedVoices = curatedVoices.filter(({ profile }) => profile.recommended && !profile.novelty);
  const otherVoices = curatedVoices.filter(({ profile }) => !profile.recommended || profile.novelty);

  useEffect(() => {
    let storedTimers: TimerConfig[] | null = null;
    let storedRecentTimerIds: string[] | null = null;
    let storedWorkoutSessions: WorkoutSession[] | null = null;
    let storedSettings: Settings | null = null;
    let storedLabsUnlocked: boolean | null = null;
    try {
      const savedTimers = window.localStorage.getItem(TIMERS_STORAGE);
      const legacyTimers = window.localStorage.getItem(LEGACY_TIMERS_STORAGE);
      const savedRecentTimerIds = window.localStorage.getItem(RECENT_TIMERS_STORAGE);
      const savedWorkoutSessions = window.localStorage.getItem(WORKOUT_SESSIONS_STORAGE)
        ?? window.localStorage.getItem(LEGACY_WORKOUT_SESSIONS_STORAGE);
      const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE);
      const savedDisplayMessageMemory = window.localStorage.getItem(DISPLAY_MESSAGE_MEMORY_STORAGE);
      const labsSettings = readLabsSettings(window.localStorage);
      storedLabsUnlocked = labsSettings.unlocked;
      if (savedTimers) {
        const parsed = JSON.parse(savedTimers) as unknown;
        if (Array.isArray(parsed)) {
          const normalized = parsed.map(normalizeStoredTimer).filter((timer): timer is TimerConfig => timer !== null);
          if (normalized.length > 0) storedTimers = normalized;
        }
      } else if (legacyTimers) {
        const parsed = JSON.parse(legacyTimers) as unknown;
        if (Array.isArray(parsed)) {
          const normalized = parsed.map(normalizeStoredTimer).filter((timer): timer is TimerConfig => timer !== null);
          storedTimers = migrateLegacyTimers(normalized);
        }
      }
      if (savedRecentTimerIds) {
        const parsed = JSON.parse(savedRecentTimerIds) as unknown;
        if (Array.isArray(parsed)) {
          storedRecentTimerIds = parsed.filter((id): id is string => typeof id === 'string');
        }
      }
      if (savedWorkoutSessions) {
        storedWorkoutSessions = parseWorkoutSessions(JSON.parse(savedWorkoutSessions));
      }
      if (savedSettings) storedSettings = normalizeSettings(JSON.parse(savedSettings));
      if (savedDisplayMessageMemory) {
        displayMessageMemoryRef.current = createDisplayMessageMemory(JSON.parse(savedDisplayMessageMemory));
      }
    } catch {
      // Keep safe defaults when device storage contains invalid data.
    }

    window.queueMicrotask(() => {
      if (storedTimers) setTimers(storedTimers);
      if (storedRecentTimerIds) setRecentTimerIds(storedRecentTimerIds);
      if (storedWorkoutSessions) setWorkoutSessions(storedWorkoutSessions);
      if (storedSettings) setSettings(storedSettings);
      if (storedLabsUnlocked !== null) {
        setLabsUnlocked(storedLabsUnlocked);
        const sequenceState = createLabsUnlockSequence(storedLabsUnlocked);
        labsUnlockSequenceRef.current = sequenceState;
        setLabsUnlockSequence(sequenceState);
      }
      setHydrated(true);
    });

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (labsUnlockSequence.unlocked || labsUnlockSequence.startedAt === null) return;
    const delay = Math.max(0, labsUnlockSequence.startedAt + LABS_UNLOCK_WINDOW_MS - Date.now() + 1);
    const timeout = window.setTimeout(() => {
      const sequenceState = createLabsUnlockSequence(false);
      labsUnlockSequenceRef.current = sequenceState;
      setLabsUnlockSequence(sequenceState);
      setLabsUnlockMessage('');
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [labsUnlockSequence]);

  useEffect(() => {
    if (screen !== 'settings' || !restoreLabsFocusRef.current) return;
    restoreLabsFocusRef.current = false;
    window.requestAnimationFrame(() => labsOpeningControlRef.current?.focus());
  }, [screen]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TIMERS_STORAGE, JSON.stringify(timers));
  }, [timers, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(RECENT_TIMERS_STORAGE, JSON.stringify(recentTimerIds));
  }, [recentTimerIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(WORKOUT_SESSIONS_STORAGE, JSON.stringify(workoutSessions));
    } catch {
      // The current session still completes if local storage is unavailable or full.
    }
  }, [hydrated, workoutSessions]);

  const getSpeechController = useCallback(() => {
    if (speechControllerRef.current) return speechControllerRef.current;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const controller: BrowserSpeechController = createSpeechController({
      synthesis: window.speechSynthesis,
      createUtterance: (text) => new SpeechSynthesisUtterance(text),
      setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimer: (handle) => window.clearTimeout(handle),
    });
    speechControllerRef.current = controller;
    return controller;
  }, []);

  useEffect(() => {
    const controller = getSpeechController();
    if (!controller) return;
    const unsubscribeVoices = controller.subscribeVoices((voices) => {
      setAvailableVoices([...voices]);
    });
    return () => {
      unsubscribeVoices();
      controller.dispose();
      if (speechControllerRef.current === controller) speechControllerRef.current = null;
    };
  }, [getSpeechController]);

  const getAudioEngine = useCallback(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = createBrowserAudioEngine({
        probeDelayMs: 50,
        resumeTimeoutMs: 450,
      });
    }
    return audioEngineRef.current;
  }, []);

  const ensureAudio = useCallback((forceRecreate = false) => {
    if (document.visibilityState !== 'visible') return Promise.resolve(null);
    if (audioEnsurePromiseRef.current && !forceRecreate) return audioEnsurePromiseRef.current;

    const recovery = getAudioEngine().recover({ forceRecreate }).then(
      (result) => {
        if (result.status === 'ready') {
          setAudioNeedsGesture(false);
          return result.context;
        }
        if (result.status === 'needs-gesture'
          && settingsRef.current.soundEnabled
          && settingsRef.current.volume > 0
          && document.visibilityState === 'visible') {
          setAudioNeedsGesture(true);
        }
        return null;
      },
      () => {
        if (settingsRef.current.soundEnabled
          && settingsRef.current.volume > 0
          && document.visibilityState === 'visible') {
          setAudioNeedsGesture(true);
        }
        return null;
      },
    );
    audioEnsurePromiseRef.current = recovery;
    void recovery.finally(() => {
      if (audioEnsurePromiseRef.current === recovery) audioEnsurePromiseRef.current = null;
    });
    return recovery;
  }, [getAudioEngine]);

  const scheduleTone = useCallback((
    context: AudioContext,
    frequency: number,
    duration: number,
    volumeScale: number,
    requestedStart: number,
    volume: number,
  ): ScheduledAudioHandle => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = Math.max(requestedStart, context.currentTime + 0.005);
    const endsAt = start + duration + 0.02;
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.18 * volumeScale), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(endsAt);

    const disconnect = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.addEventListener('ended', disconnect, { once: true });

    return {
      endsAt,
      cancel: () => {
        try { oscillator.stop(); } catch { /* The tone may have already ended. */ }
      },
    };
  }, []);

  const playTone = useCallback(async (frequency: number, duration = 0.11, volumeScale = 1) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.soundEnabled
      || currentSettings.volume <= 0
      || document.visibilityState !== 'visible') return false;
    const context = await ensureAudio();
    if (!context) return false;
    scheduleTone(
      context,
      frequency,
      duration,
      volumeScale,
      context.currentTime + 0.005,
      currentSettings.volume,
    );
    return true;
  }, [ensureAudio, scheduleTone]);

  const scheduleWorkoutAudioEvent = useCallback((
    context: AudioContext,
    event: WorkoutTimelineEvent,
    audioTime: number,
  ) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.soundEnabled || currentSettings.volume <= 0) return undefined;
    if (event.kind === 'tick' && !currentSettings.ticking) return undefined;

    if (event.kind === 'tick') {
      return scheduleTone(context, 1180, 0.035, 0.34, audioTime, currentSettings.volume);
    }

    if (event.kind === 'complete') {
      return [
        scheduleTone(context, 1040, 0.3, 1.2, audioTime, currentSettings.volume),
        scheduleTone(context, 1240, 0.34, 1.2, audioTime + 0.18, currentSettings.volume),
      ];
    }

    const phase = sequenceRef.current[event.phaseIndex];
    if (!phase) return undefined;
    const frequencies: Record<PhaseKind, number> = {
      prepare: 560,
      work: 920,
      rest: 330,
      cycleRest: 460,
      cooldown: 520,
    };
    return scheduleTone(
      context,
      frequencies[phase.kind],
      0.16,
      1.2,
      audioTime,
      currentSettings.volume,
    );
  }, [scheduleTone]);

  const stopWorkoutAudio = useCallback((cancelPending = true) => {
    workoutAudioSchedulerRef.current?.stop({ cancelPending });
    workoutAudioSchedulerRef.current = null;
  }, []);

  const invalidatePendingWorkoutStart = useCallback(() => {
    workoutStartTokenRef.current += 1;
    workoutStartPendingRef.current = false;
    setWorkoutStartPending(false);
  }, []);

  const invalidateAudioRecovery = useCallback(() => {
    audioEngineRef.current?.invalidate();
    audioEnsurePromiseRef.current = null;
    audioRecoveryPromiseRef.current = null;
    audioRestorePromiseRef.current = null;
    setAudioNeedsGesture(false);
    setAudioRestorePending(false);
  }, []);

  const startWorkoutAudio = useCallback((
    timeline: WorkoutTimeline,
    context: AudioContext,
    anchorElapsedMs: number,
    anchorAudioTime: number,
    includeCurrentPhaseCue = true,
  ) => {
    stopWorkoutAudio();
    const scheduler = new WorkoutAudioScheduler(timeline, {
      audioNow: () => context.currentTime,
      clearTimer: (handle) => window.clearInterval(handle as number),
      schedule: (event, audioTime) => scheduleWorkoutAudioEvent(context, event, audioTime),
      setTimer: (callback, intervalMs) => window.setInterval(callback, intervalMs),
    });
    workoutAudioSchedulerRef.current = scheduler;
    try {
      scheduler.start({ anchorAudioTime, anchorElapsedMs, includeCurrentPhaseCue });
      return scheduler;
    } catch {
      scheduler.stop();
      workoutAudioSchedulerRef.current = null;
      return null;
    }
  }, [scheduleWorkoutAudioEvent, stopWorkoutAudio]);

  const playCue = useCallback(async (kind: PhaseKind | 'complete') => {
    const frequencies: Record<PhaseKind | 'complete', number> = {
      prepare: 560,
      work: 920,
      rest: 330,
      cycleRest: 460,
      cooldown: 520,
      complete: 1040,
    };
    const played = await playTone(frequencies[kind], kind === 'complete' ? 0.3 : 0.16, 1.2);
    if (kind === 'complete' && played) {
      window.setTimeout(() => { void playTone(1240, 0.34, 1.2); }, 180);
    }
    return played;
  }, [playTone]);

  const resolveWorkoutCoach = useCallback(() => {
    const liveVoices = getSpeechController()?.getVoices()
      ?? (availableVoices.length > 0
        ? availableVoices
        : ('speechSynthesis' in window ? window.speechSynthesis.getVoices() : []));
    const currentCoach = activeCoachRef.current;
    if (currentCoach
      && (liveVoices.length === 0
        || (currentCoach.voiceURI
          && liveVoices.some((voice) => voice.voiceURI === currentCoach.voiceURI)))) {
      return currentCoach;
    }

    const personality = currentCoach?.personality
      ?? resolveCoachPersonality(settings.coachPersonality);
    const coach = resolveActiveCoach({
      voices: liveVoices,
      personality,
      preference: settings.voicePreference,
      selectedVoiceURI: settings.voiceURI,
      previousAutomaticVoiceURI: settings.lastAutomaticVoiceURI,
      locale,
    });
    activeCoachRef.current = coach;
    if (!settings.voiceURI && coach.voiceURI && coach.voiceURI !== settings.lastAutomaticVoiceURI) {
      setSettings((current) => ({ ...current, lastAutomaticVoiceURI: coach.voiceURI }));
    }
    return coach;
  }, [availableVoices, getSpeechController, locale, settings.coachPersonality, settings.lastAutomaticVoiceURI, settings.voicePreference, settings.voiceURI]);

  const cancelCoachSpeech = useCallback(() => {
    coachSpeechGenerationRef.current += 1;
    if (pendingCoachSpeechTimeoutRef.current !== null) {
      window.clearTimeout(pendingCoachSpeechTimeoutRef.current);
      pendingCoachSpeechTimeoutRef.current = null;
    }
    speechControllerRef.current?.cancel();
  }, []);

  const speakCoach = useCallback((
    speech: CoachSpeech,
    options?: { interrupt?: boolean; voiceURI?: string; onEnd?: () => void },
  ) => {
    const controller = getSpeechController();
    if (!settings.voiceEnabled || !controller || document.visibilityState !== 'visible') return null;
    if (options?.interrupt) {
      coachSpeechGenerationRef.current += 1;
      if (pendingCoachSpeechTimeoutRef.current !== null) {
        window.clearTimeout(pendingCoachSpeechTimeoutRef.current);
        pendingCoachSpeechTimeoutRef.current = null;
      }
    }
    const voiceURI = options?.voiceURI ?? resolveWorkoutCoach().voiceURI;
    return controller.speak({
      text: speech.text,
      locale: speechLanguageForLocale(locale),
      preferredVoiceURI: voiceURI,
      rate: speech.rate,
      pitch: speech.pitch,
      volume: settings.volume,
      interrupt: options?.interrupt,
      retry: true,
      onStart: (_event, context) => {
        if (options?.voiceURI !== undefined || !context.voice) return;
        const selectedVoiceURI = context.voice.voiceURI;
        const currentCoach = activeCoachRef.current;
        if (!currentCoach || currentCoach.voiceURI) return;
        activeCoachRef.current = { ...currentCoach, voiceURI: selectedVoiceURI };
        if (!settings.voiceURI && selectedVoiceURI !== settings.lastAutomaticVoiceURI) {
          setSettings((current) => ({ ...current, lastAutomaticVoiceURI: selectedVoiceURI }));
        }
      },
      onEnd: options?.onEnd,
    });
  }, [getSpeechController, locale, resolveWorkoutCoach, settings.lastAutomaticVoiceURI, settings.voiceEnabled, settings.voiceURI, settings.volume]);

  useEffect(() => {
    activeCoachRef.current = null;
    cancelCoachSpeech();
  }, [cancelCoachSpeech, locale]);

  const scheduleCoachSpeechAfterPause = useCallback((speech: CoachSpeech) => {
    const generation = coachSpeechGenerationRef.current;
    if (coachSpeechGenerationRef.current !== generation) return;
    pendingCoachSpeechTimeoutRef.current = window.setTimeout(() => {
      pendingCoachSpeechTimeoutRef.current = null;
      if (coachSpeechGenerationRef.current === generation) speakCoach(speech);
    }, RECOVERY_SPEECH_PAUSE_MS);
  }, [speakCoach]);

  const contextForPhase = useCallback((phase: WorkoutPhase, index: number, phaseRemaining = phase.duration) => (
    deriveCoachContext({
      phase,
      phaseIndex: index,
      sequence,
      remainingInPhase: phaseRemaining,
      totalRounds: activeTimer.rounds,
      totalCycles: activeTimer.cycles,
    })
  ), [activeTimer.cycles, activeTimer.rounds, sequence]);

  const announcePhase = useCallback((phase: WorkoutPhase, index: number, followUp?: CoachSpeech) => {
    const personality = activeCoachRef.current?.personality
      ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
    return speakCoach(
      selectPhaseSpeech(personality, phase.kind, contextForPhase(phase, index), locale),
      {
        interrupt: true,
        onEnd: followUp ? () => scheduleCoachSpeechAfterPause(followUp) : undefined,
      },
    );
  }, [contextForPhase, locale, scheduleCoachSpeechAfterPause, settings.coachPersonality, speakCoach]);

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<ScreenWakeLock> };
    };
    if (!wakeLockWantedRef.current || document.visibilityState !== 'visible' || wakeLockRef.current) return;
    try {
      const wakeLock = await nav.wakeLock?.request('screen') ?? null;
      if (!wakeLock) return;
      if (!wakeLockWantedRef.current || document.visibilityState !== 'visible') {
        void wakeLock.release().catch(() => undefined);
        return;
      }
      wakeLockRef.current = wakeLock;
      wakeLock.addEventListener?.('release', () => {
        if (wakeLockRef.current === wakeLock) wakeLockRef.current = null;
      }, { once: true });
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const keepScreenAwake = useCallback(() => {
    wakeLockWantedRef.current = true;
    void requestWakeLock();
  }, [requestWakeLock]);

  const releaseWakeLock = useCallback(() => {
    wakeLockWantedRef.current = false;
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    const restoreWakeLock = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', restoreWakeLock);
    return () => document.removeEventListener('visibilitychange', restoreWakeLock);
  }, [requestWakeLock]);

  const recoverWorkoutAudio = useCallback((forceRecreate = false) => {
    if (audioRecoveryPromiseRef.current && !forceRecreate) return audioRecoveryPromiseRef.current;
    if (!runningRef.current || document.visibilityState !== 'visible') return Promise.resolve();
    const soundRequested = settingsRef.current.soundEnabled && settingsRef.current.volume > 0;
    if (!soundRequested) {
      setAudioNeedsGesture(false);
    }

    const timeline = workoutTimelineRef.current;
    const runGeneration = workoutRunGenerationRef.current;
    if (!timeline) return Promise.resolve();
    stopWorkoutAudio();

    const recovery = (async () => {
      const context = soundRequested ? await ensureAudio(forceRecreate) : null;
      if (document.visibilityState !== 'visible'
        || !runningRef.current
        || workoutRunGenerationRef.current !== runGeneration
        || workoutTimelineRef.current !== timeline) return;
      if (suppressWorkoutCuesRef.current) {
        const snapshot = timeline.snapshot(performance.now());
        phaseIndexRef.current = snapshot.phaseIndex;
        lastTickSecondRef.current = snapshot.remainingSeconds;
        setPhaseIndex(snapshot.phaseIndex);
        setRemaining(snapshot.remainingSeconds);
        if (snapshot.finished) return;
      }
      if (!context) {
        suppressWorkoutCuesRef.current = false;
        return;
      }
      const leadSeconds = AUDIO_START_LEAD_SECONDS;
      const futureMonotonicTime = performance.now() + leadSeconds * 1000;
      const anchorElapsedMs = timeline.elapsedAt(futureMonotonicTime);
      if (anchorElapsedMs >= timeline.totalMs) return;
      startWorkoutAudio(
        timeline,
        context,
        anchorElapsedMs,
        context.currentTime + leadSeconds,
        false,
      );
      suppressWorkoutCuesRef.current = false;
    })();
    audioRecoveryPromiseRef.current = recovery;
    void recovery.finally(() => {
      if (audioRecoveryPromiseRef.current === recovery) audioRecoveryPromiseRef.current = null;
    });
    return recovery;
  }, [ensureAudio, startWorkoutAudio, stopWorkoutAudio]);

  useEffect(() => {
    const suspendMediaLifecycle = () => {
      mediaWasHiddenRef.current = true;
      suppressWorkoutCuesRef.current = true;
      invalidatePendingWorkoutStart();
      stopWorkoutAudio();
      cancelCoachSpeech();
      speechControllerRef.current?.setVisible(false);
      invalidateAudioRecovery();
    };
    const synchronizeMediaLifecycle = () => {
      if (document.visibilityState !== 'visible') {
        suspendMediaLifecycle();
        return;
      }
      getSpeechController()?.setVisible(true);
      if (runningRef.current) {
        const forceRecreate = mediaWasHiddenRef.current;
        mediaWasHiddenRef.current = false;
        void recoverWorkoutAudio(forceRecreate);
      }
    };

    document.addEventListener('visibilitychange', synchronizeMediaLifecycle);
    window.addEventListener('pagehide', suspendMediaLifecycle);
    window.addEventListener('pageshow', synchronizeMediaLifecycle);
    window.addEventListener('focus', synchronizeMediaLifecycle);
    return () => {
      document.removeEventListener('visibilitychange', synchronizeMediaLifecycle);
      window.removeEventListener('pagehide', suspendMediaLifecycle);
      window.removeEventListener('pageshow', synchronizeMediaLifecycle);
      window.removeEventListener('focus', synchronizeMediaLifecycle);
    };
  }, [cancelCoachSpeech, getSpeechController, invalidateAudioRecovery, invalidatePendingWorkoutStart, recoverWorkoutAudio, stopWorkoutAudio]);

  const applyOrientation = useCallback(async (allowRotation: boolean) => {
    try {
      if (allowRotation) {
        screenOrientation().unlock?.();
      } else {
        await screenOrientation().lock?.('portrait');
      }
    } catch {
      // iOS only allows orientation locks in supported standalone/fullscreen contexts.
    }
  }, []);

  function screenOrientation() {
    return window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };
  }

  const selectRunnerMessage = useCallback((phase: WorkoutPhase, index: number) => {
    const kind: DisplayMessageKind | null = phase.kind === 'rest' || phase.kind === 'cycleRest'
      ? 'motivation'
      : phase.kind === 'cooldown'
        ? 'aspiration'
        : null;
    if (!kind) {
      setRunnerMessageSelection(null);
      return null;
    }

    const selection = selectDisplayMessage(kind, displayMessageMemoryRef.current, locale);
    displayMessageMemoryRef.current = selection.memory;
    try {
      window.localStorage.setItem(DISPLAY_MESSAGE_MEMORY_STORAGE, JSON.stringify(selection.memory));
    } catch {
      // Message rotation still works when device storage is unavailable.
    }
    const runnerSelection = { phaseIndex: index, kind, message: selection.message };
    setRunnerMessageSelection(runnerSelection);
    return runnerSelection;
  }, [locale]);

  const recordCompletedWorkout = useCallback(() => {
    if (recordedWorkoutSessionIdRef.current) return;
    const completedAt = new Date();
    const fallbackStart = new Date(completedAt.getTime() - workoutDuration(activeTimer) * 1000);
    const storedStart = workoutStartedAtRef.current
      ? new Date(workoutStartedAtRef.current)
      : fallbackStart;
    const startedAt = Number.isFinite(storedStart.getTime()) ? storedStart : fallbackStart;
    const session = createWorkoutSession(activeTimer, startedAt, completedAt);
    recordedWorkoutSessionIdRef.current = session.id;
    const previouslyUnlocked = new Set(
      calculateProgressMilestones(workoutSessions, completedAt, settings.weeklyActiveDayGoal)
        .filter(({ unlocked }) => unlocked)
        .map(({ id }) => id),
    );
    const nextSessions = [session, ...workoutSessions];
    const newlyUnlocked = calculateProgressMilestones(nextSessions, completedAt, settings.weeklyActiveDayGoal)
      .filter(({ id, unlocked }) => unlocked && !previouslyUnlocked.has(id));
    setWorkoutSessions(nextSessions);
    setNewMilestones(newlyUnlocked);
  }, [activeTimer, settings.weeklyActiveDayGoal, workoutSessions]);

  const finishWorkout = useCallback(() => {
    if (transitionLockRef.current || finishIntentRef.current) return;
    transitionLockRef.current = true;
    workoutTimelineRef.current?.pause(performance.now());
    const completionWasScheduled = workoutAudioSchedulerRef.current?.hasScheduled('complete') ?? false;
    stopWorkoutAudio(false);
    recordCompletedWorkout();
    runningRef.current = false;
    phaseIndexRef.current = Math.max(0, sequence.length - 1);
    lastTickSecondRef.current = 0;
    setPhaseIndex(phaseIndexRef.current);
    setRunning(false);
    setFinished(true);
    setRemaining(0);
    if (document.visibilityState === 'visible' && !suppressWorkoutCuesRef.current) {
      if (!completionWasScheduled) void playCue('complete');
      const personality = activeCoachRef.current?.personality
        ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
      const finishingFromCooldown = settings.coachPhrasesEnabled && sequence[sequence.length - 1]?.kind === 'cooldown';
      speakCoach(selectPhaseSpeech(personality, 'complete', undefined, locale), { interrupt: !finishingFromCooldown });
    }
    releaseWakeLock();
    suppressWorkoutCuesRef.current = false;
    transitionLockRef.current = false;
  }, [locale, playCue, recordCompletedWorkout, releaseWakeLock, sequence, settings.coachPersonality, settings.coachPhrasesEnabled, speakCoach, stopWorkoutAudio]);

  const enterWorkoutPhase = useCallback((nextIndex: number, nextRemaining: number) => {
    if (transitionLockRef.current || finishIntentRef.current) return;
    const upcoming = sequence[nextIndex];
    if (!upcoming) return;
    transitionLockRef.current = true;
    phaseIndexRef.current = nextIndex;
    setPhaseIndex(nextIndex);
    setRemaining(nextRemaining);
    lastTickSecondRef.current = nextRemaining;
    const messageSelection = selectRunnerMessage(upcoming, nextIndex);
    if (document.visibilityState !== 'visible' || suppressWorkoutCuesRef.current) {
      transitionLockRef.current = false;
      return;
    }
    if (!workoutAudioSchedulerRef.current?.hasScheduled(`phase-${nextIndex}`)) {
      void playCue(upcoming.kind);
    }
    let followUp: CoachSpeech | undefined;
    if (settings.coachPhrasesEnabled && messageSelection) {
      const personality = activeCoachRef.current?.personality
        ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
      followUp = makeDisplayMessageSpeech(personality, messageSelection.kind, messageSelection.message);
    }
    announcePhase(upcoming, nextIndex, followUp);
    transitionLockRef.current = false;
  }, [announcePhase, playCue, selectRunnerMessage, sequence, settings.coachPersonality, settings.coachPhrasesEnabled]);

  useEffect(() => {
    if (!running) return;
    const synchronize = () => {
      const timeline = workoutTimelineRef.current;
      if (!timeline) return;
      const snapshot = timeline.snapshot(performance.now());

      if (snapshot.finished) {
        finishWorkout();
        return;
      }

      if (snapshot.phaseIndex !== phaseIndexRef.current) {
        enterWorkoutPhase(snapshot.phaseIndex, snapshot.remainingSeconds);
        return;
      }

      const nextRemaining = snapshot.remainingSeconds;
      if (nextRemaining !== lastTickSecondRef.current) {
        lastTickSecondRef.current = nextRemaining;
        setRemaining(nextRemaining);
        if (document.visibilityState !== 'visible' || suppressWorkoutCuesRef.current) return;
        const timelinePhase = sequence[snapshot.phaseIndex];
        if ((timelinePhase.kind === 'prepare' || timelinePhase.kind === 'work' || timelinePhase.kind === 'rest') && nextRemaining > 0 && nextRemaining <= 3) {
          const personality = activeCoachRef.current?.personality
            ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
          speakCoach(makeCountdownSpeech(personality, nextRemaining));
        }
        if (settings.voiceEnabled && settings.coachPhrasesEnabled && timelinePhase.kind === 'work') {
          const personality = activeCoachRef.current?.personality
            ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
          const context = contextForPhase(timelinePhase, snapshot.phaseIndex, nextRemaining);
          const plan = planCoachIntervention(personality, context, coachMemoryRef.current, { locale });
          coachMemoryRef.current = plan.memory;
          if (plan.speech) speakCoach(plan.speech);
        }
      }
    };

    synchronize();
    const interval = window.setInterval(synchronize, 100);

    return () => window.clearInterval(interval);
  }, [contextForPhase, enterWorkoutPhase, finishWorkout, locale, running, sequence, settings.coachPersonality, settings.coachPhrasesEnabled, settings.voiceEnabled, speakCoach]);

  useEffect(() => () => {
    stopWorkoutAudio();
    audioEngineRef.current?.dispose();
    audioEngineRef.current = null;
    audioEnsurePromiseRef.current = null;
    audioRecoveryPromiseRef.current = null;
    audioRestorePromiseRef.current = null;
    releaseWakeLock();
    cancelCoachSpeech();
  }, [cancelCoachSpeech, releaseWakeLock, stopWorkoutAudio]);

  const pauseWorkoutTiming = useCallback((): WorkoutTimelineSnapshot | null => {
    const timeline = workoutTimelineRef.current;
    if (!timeline) return null;
    const snapshot = timeline.pause(performance.now());
    stopWorkoutAudio();
    runningRef.current = false;
    phaseIndexRef.current = snapshot.phaseIndex;
    lastTickSecondRef.current = snapshot.remainingSeconds;
    setPhaseIndex(snapshot.phaseIndex);
    setRemaining(snapshot.remainingSeconds);
    return snapshot;
  }, [stopWorkoutAudio]);

  const openAdjustSessionDialog = () => {
    if (workoutStartPendingRef.current || hasWorkoutStarted || finished) return;
    setSessionAdjustment({
      prepare: activeTimer.prepare,
      work: activeTimer.work,
      rest: activeTimer.rest,
      rounds: activeTimer.rounds,
      cycles: activeTimer.cycles,
      cycleRest: activeTimer.cycleRest,
      cooldown: activeTimer.cooldown,
    });
    window.requestAnimationFrame(() => {
      if (!adjustSessionDialogRef.current?.open) adjustSessionDialogRef.current?.showModal();
    });
  };

  const applySessionAdjustment = () => {
    if (workoutStartPendingRef.current || hasWorkoutStarted || finished) return;
    const adjustedTimer: TimerConfig = {
      ...activeTimer,
      prepare: normalizeTimerMetric(sessionAdjustment.prepare, 0, 600),
      work: normalizeTimerMetric(sessionAdjustment.work, 1, 3600),
      rest: normalizeTimerMetric(sessionAdjustment.rest, 0, 3600),
      rounds: Math.min(99, Math.max(1, Math.round(sessionAdjustment.rounds))),
      cycles: Math.min(20, Math.max(1, Math.round(sessionAdjustment.cycles))),
      cycleRest: normalizeTimerMetric(sessionAdjustment.cycleRest, 0, 3600),
      cooldown: normalizeTimerMetric(sessionAdjustment.cooldown, 0, 3600),
    };
    if (adjustedTimer.nameIsCustom === false) adjustedTimer.name = generatedTimerName(adjustedTimer);
    const adjustedSequence = buildSequence(adjustedTimer);
    suppressWorkoutCuesRef.current = false;
    stopWorkoutAudio();
    workoutTimelineRef.current = new WorkoutTimeline(adjustedSequence);
    sequenceRef.current = adjustedSequence;
    phaseIndexRef.current = 0;
    setActiveTimer(adjustedTimer);
    setPhaseIndex(0);
    setRemaining(adjustedSequence[0]?.duration ?? 0);
    lastTickSecondRef.current = adjustedSequence[0]?.duration ?? 0;
    setRunnerMessageSelection(null);
    adjustSessionDialogRef.current?.close();
  };

  const openEditor = (timer?: TimerConfig, origin?: ReturnScreen) => {
    const destination = origin ?? (screen === 'library' ? 'library' : 'home');
    setReturnScreen(destination);
    setDraft(timer ? { ...timer, nameIsCustom: timer.nameIsCustom ?? true } : makeEmptyTimer());
    setScreen('editor');
  };

  const updateDraftMetric = (key: keyof Pick<TimerConfig, 'prepare' | 'work' | 'rest' | 'rounds' | 'cycles' | 'cycleRest' | 'cooldown'>, value: number) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (!current.nameIsCustom) next.name = generatedTimerName(next);
      return next;
    });
  };

  const updateDraftName = (name: string) => {
    setDraft((current) => {
      const automaticName = localizeTimerName({ ...current, nameIsCustom: false }, copy);
      const nameIsCustom = name.trim() !== automaticName;
      return {
        ...current,
        name: nameIsCustom ? name : generatedTimerName(current),
        nameIsCustom,
      };
    });
  };

  const resetDraftName = () => {
    setDraft((current) => ({ ...current, name: generatedTimerName(current), nameIsCustom: false }));
  };

  const saveTimer = () => {
    const normalizedDraft = normalizeTimerValues(draft);
    const customName = normalizedDraft.name.trim();
    const automaticName = generatedTimerName(normalizedDraft);
    const localizedAutomaticName = localizeTimerName({ ...normalizedDraft, nameIsCustom: false }, copy);
    const nameIsCustom = Boolean(
      normalizedDraft.nameIsCustom
      && customName
      && customName !== localizedAutomaticName,
    );
    const safeTimer: TimerConfig = {
      ...normalizedDraft,
      id: draft.id || `timer-${Date.now()}`,
      name: nameIsCustom ? customName : automaticName,
      nameIsCustom,
    };

    setTimers((current) => {
      const exists = current.some((timer) => timer.id === safeTimer.id);
      return exists
        ? current.map((timer) => timer.id === safeTimer.id ? safeTimer : timer)
        : [safeTimer, ...current];
    });
    setScreen(returnScreen);
  };

  const deleteTimer = () => {
    if (!draft.id) return;
    setTimers((current) => current.filter((timer) => timer.id !== draft.id));
    setRecentTimerIds((current) => current.filter((id) => id !== draft.id));
    setScreen('library');
  };

  const moveTimer = (index: number, offset: -1 | 1) => {
    setTimers((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(destination, 0, moved);
      return next;
    });
  };

  const beginWorkout = (timer: TimerConfig) => {
    const normalizedTimer = normalizeTimerValues(timer);
    const firstSequence = buildSequence(normalizedTimer);
    suppressWorkoutCuesRef.current = false;
    invalidatePendingWorkoutStart();
    invalidateAudioRecovery();
    stopWorkoutAudio();
    cancelCoachSpeech();
    workoutTimelineRef.current = new WorkoutTimeline(firstSequence);
    sequenceRef.current = firstSequence;
    phaseIndexRef.current = 0;
    runningRef.current = false;
    setRecentTimerIds((current) => [normalizedTimer.id, ...current.filter((id) => id !== normalizedTimer.id)].slice(0, HOME_TIMER_LIMIT));
    workoutRunGenerationRef.current += 1;
    finishIntentRef.current = false;
    resumeAfterFinishDialogRef.current = false;
    workoutStartedAtRef.current = null;
    recordedWorkoutSessionIdRef.current = null;
    transitionLockRef.current = false;
    activeCoachRef.current = null;
    coachMemoryRef.current = createCoachMemory();
    setRunnerMessageSelection(null);
    setNewMilestones([]);
    setActiveTimer(normalizedTimer);
    setSessionAdjustment({
      prepare: normalizedTimer.prepare,
      work: normalizedTimer.work,
      rest: normalizedTimer.rest,
      rounds: normalizedTimer.rounds,
      cycles: normalizedTimer.cycles,
      cycleRest: normalizedTimer.cycleRest,
      cooldown: normalizedTimer.cooldown,
    });
    setPhaseIndex(0);
    setRemaining(firstSequence[0]?.duration ?? 0);
    lastTickSecondRef.current = firstSequence[0]?.duration ?? 0;
    setRunning(false);
    setFinished(false);
    setHasWorkoutStarted(false);
    setScreen('runner');
    void applyOrientation(settings.rotation);
  };

  const toggleWorkout = async () => {
    if (workoutStartPendingRef.current) return;
    if (finished) {
      suppressWorkoutCuesRef.current = false;
      invalidatePendingWorkoutStart();
      invalidateAudioRecovery();
      stopWorkoutAudio();
      cancelCoachSpeech();
      workoutTimelineRef.current = new WorkoutTimeline(sequence);
      workoutRunGenerationRef.current += 1;
      finishIntentRef.current = false;
      resumeAfterFinishDialogRef.current = false;
      workoutStartedAtRef.current = null;
      recordedWorkoutSessionIdRef.current = null;
      activeCoachRef.current = null;
      coachMemoryRef.current = createCoachMemory();
      setRunnerMessageSelection(null);
      setNewMilestones([]);
      phaseIndexRef.current = 0;
      runningRef.current = false;
      setPhaseIndex(0);
      setRemaining(sequence[0]?.duration ?? 0);
      lastTickSecondRef.current = sequence[0]?.duration ?? 0;
      setFinished(false);
      setHasWorkoutStarted(false);
      return;
    }

    if (runningRef.current) {
      workoutRunGenerationRef.current += 1;
      const snapshot = pauseWorkoutTiming();
      if (snapshot?.finished) {
        finishWorkout();
        return;
      }
      setRunning(false);
      cancelCoachSpeech();
      releaseWakeLock();
    } else {
      if (document.visibilityState !== 'visible') return;
      const isResuming = hasWorkoutStarted;
      const runGeneration = workoutRunGenerationRef.current + 1;
      const startToken = workoutStartTokenRef.current + 1;
      workoutStartTokenRef.current = startToken;
      workoutStartPendingRef.current = true;
      setWorkoutStartPending(true);
      workoutRunGenerationRef.current = runGeneration;
      finishIntentRef.current = false;
      getSpeechController()?.setVisible(true);
      resolveWorkoutCoach();
      const timeline = workoutTimelineRef.current ?? new WorkoutTimeline(sequence);
      workoutTimelineRef.current = timeline;
      const pausedSnapshot = timeline.snapshot(performance.now());
      const resumedPhase = sequence[pausedSnapshot.phaseIndex];
      let followUp: CoachSpeech | undefined;
      if (settings.coachPhrasesEnabled
        && runnerMessageSelection?.phaseIndex === pausedSnapshot.phaseIndex) {
        const personality = activeCoachRef.current?.personality
          ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
        followUp = makeDisplayMessageSpeech(
          personality,
          runnerMessageSelection.kind,
          runnerMessageSelection.message,
        );
      }

      invalidateAudioRecovery();
      const soundRequested = settingsRef.current.soundEnabled && settingsRef.current.volume > 0;
      const forceRecreate = mediaWasHiddenRef.current;
      mediaWasHiddenRef.current = false;
      if (!soundRequested) setAudioNeedsGesture(false);
      const audioRecovery = soundRequested
        ? ensureAudio(forceRecreate)
        : Promise.resolve<AudioContext | null>(null);
      const initialSpeech = resumedPhase && !isResuming
        ? announcePhase(resumedPhase, pausedSnapshot.phaseIndex, followUp)
        : null;

      try {
        const audioContext = await audioRecovery;
        if (workoutStartTokenRef.current !== startToken
          || workoutRunGenerationRef.current !== runGeneration
          || finishIntentRef.current
          || document.visibilityState !== 'visible') {
          initialSpeech?.cancel();
          return;
        }
        if (!workoutStartedAtRef.current) {
          workoutStartedAtRef.current = new Date().toISOString();
        }
        phaseIndexRef.current = pausedSnapshot.phaseIndex;
        lastTickSecondRef.current = pausedSnapshot.remainingSeconds;
        setPhaseIndex(pausedSnapshot.phaseIndex);
        setRemaining(pausedSnapshot.remainingSeconds);
        const leadSeconds = audioContext ? AUDIO_START_LEAD_SECONDS : 0;
        const monotonicStartMs = performance.now() + leadSeconds * 1000;
        suppressWorkoutCuesRef.current = false;
        timeline.start(monotonicStartMs);
        const scheduler = audioContext
          ? startWorkoutAudio(
            timeline,
            audioContext,
            pausedSnapshot.elapsedMs,
            audioContext.currentTime + leadSeconds,
            !isResuming,
          )
          : null;
        runningRef.current = true;
        setRunning(true);
        setHasWorkoutStarted(true);
        if (resumedPhase && !isResuming && audioContext && !scheduler?.hasScheduled(`current-phase-${pausedSnapshot.phaseIndex}`)) {
          void playCue(resumedPhase.kind);
        }
        keepScreenAwake();
      } finally {
        if (workoutStartTokenRef.current === startToken) {
          workoutStartPendingRef.current = false;
          setWorkoutStartPending(false);
        }
      }
    }
  };

  const resetWorkout = () => {
    suppressWorkoutCuesRef.current = false;
    invalidatePendingWorkoutStart();
    invalidateAudioRecovery();
    stopWorkoutAudio();
    workoutTimelineRef.current = new WorkoutTimeline(sequence);
    workoutRunGenerationRef.current += 1;
    finishIntentRef.current = false;
    resumeAfterFinishDialogRef.current = false;
    adjustSessionDialogRef.current?.close();
    finishSessionDialogRef.current?.close();
    workoutStartedAtRef.current = null;
    recordedWorkoutSessionIdRef.current = null;
    transitionLockRef.current = false;
    phaseIndexRef.current = 0;
    runningRef.current = false;
    setRunning(false);
    setFinished(false);
    setHasWorkoutStarted(false);
    activeCoachRef.current = null;
    coachMemoryRef.current = createCoachMemory();
    setRunnerMessageSelection(null);
    setNewMilestones([]);
    setPhaseIndex(0);
    setRemaining(sequence[0]?.duration ?? 0);
    lastTickSecondRef.current = sequence[0]?.duration ?? 0;
    cancelCoachSpeech();
    releaseWakeLock();
  };

  const exitWorkout = () => {
    suppressWorkoutCuesRef.current = false;
    invalidatePendingWorkoutStart();
    invalidateAudioRecovery();
    stopWorkoutAudio();
    workoutTimelineRef.current = null;
    workoutRunGenerationRef.current += 1;
    finishIntentRef.current = false;
    resumeAfterFinishDialogRef.current = false;
    adjustSessionDialogRef.current?.close();
    finishSessionDialogRef.current?.close();
    workoutStartedAtRef.current = null;
    recordedWorkoutSessionIdRef.current = null;
    transitionLockRef.current = false;
    runningRef.current = false;
    setRunning(false);
    setHasWorkoutStarted(false);
    activeCoachRef.current = null;
    coachMemoryRef.current = createCoachMemory();
    setRunnerMessageSelection(null);
    setNewMilestones([]);
    cancelCoachSpeech();
    releaseWakeLock();
    try { screenOrientation().unlock?.(); } catch { /* no-op */ }
    setScreen('home');
  };

  const openFinishSessionDialog = () => {
    if (!hasWorkoutStarted || finished) return;
    workoutRunGenerationRef.current += 1;
    finishIntentRef.current = true;
    resumeAfterFinishDialogRef.current = running;
    if (running) {
      const snapshot = pauseWorkoutTiming();
      if (snapshot?.finished) {
        finishIntentRef.current = false;
        finishWorkout();
        return;
      }
      setRunning(false);
      cancelCoachSpeech();
      releaseWakeLock();
    }
    window.requestAnimationFrame(() => {
      if (!finishSessionDialogRef.current?.open) finishSessionDialogRef.current?.showModal();
    });
  };

  const continueWorkoutAfterFinishDialog = () => {
    const shouldResume = resumeAfterFinishDialogRef.current;
    resumeAfterFinishDialogRef.current = false;
    finishIntentRef.current = false;
    finishSessionDialogRef.current?.close();
    if (shouldResume) void toggleWorkout();
  };

  const saveStoppedWorkout = () => {
    const stoppedRemaining = remaining
      + sequence.slice(phaseIndex + 1).reduce((sum, phase) => sum + phase.duration, 0);
    const stoppedElapsed = sequence.reduce((sum, phase) => sum + phase.duration, 0) - stoppedRemaining;
    const stoppedMetrics = calculateWorkoutSessionMetrics(
      activeTimer,
      stoppedElapsed,
    );
    if (stoppedMetrics.totalSeconds <= 0 || recordedWorkoutSessionIdRef.current) return;
    const stoppedAt = new Date();
    const storedStart = workoutStartedAtRef.current
      ? new Date(workoutStartedAtRef.current)
      : new Date(stoppedAt.getTime() - stoppedMetrics.totalSeconds * 1000);
    const startedAt = Number.isFinite(storedStart.getTime())
      ? storedStart
      : new Date(stoppedAt.getTime() - stoppedMetrics.totalSeconds * 1000);
    const session = createStoppedWorkoutSession(
      activeTimer,
      startedAt,
      stoppedMetrics.totalSeconds,
      stoppedAt,
    );

    transitionLockRef.current = true;
    suppressWorkoutCuesRef.current = false;
    invalidatePendingWorkoutStart();
    invalidateAudioRecovery();
    stopWorkoutAudio();
    workoutTimelineRef.current = null;
    workoutRunGenerationRef.current += 1;
    finishIntentRef.current = true;
    resumeAfterFinishDialogRef.current = false;
    recordedWorkoutSessionIdRef.current = session.id;
    runningRef.current = false;
    finishSessionDialogRef.current?.close();
    setWorkoutSessions((current) => [session, ...current]);
    setRunning(false);
    setFinished(false);
    setHasWorkoutStarted(false);
    setRunnerMessageSelection(null);
    setNewMilestones([]);
    workoutStartedAtRef.current = null;
    activeCoachRef.current = null;
    coachMemoryRef.current = createCoachMemory();
    cancelCoachSpeech();
    releaseWakeLock();
    try { screenOrientation().unlock?.(); } catch { /* no-op */ }
    setProgressAnnouncement(copy.runner.partialSessionSaved);
    setScreen('progress');
  };

  const leaveWorkout = () => {
    if (hasWorkoutStarted && !finished) {
      openFinishSessionDialog();
      return;
    }
    exitWorkout();
  };

  const openSettings = (origin: ReturnScreen) => {
    setReturnScreen(origin);
    setScreen('settings');
  };

  const activateVersionUnlock = () => {
    const transition = activateLabsUnlock(labsUnlockSequenceRef.current, Date.now());
    labsUnlockSequenceRef.current = transition.state;
    setLabsUnlockSequence(transition.state);
    if (transition.justUnlocked) {
      setLabsUnlocked(true);
      setLabsUnlockMessage(copy.status.labsUnlocked);
      writeLabsSettings(window.localStorage, { version: 1, unlocked: true });
    } else if (transition.remaining !== null) {
      setLabsUnlockMessage(copy.status.tapsUntilLabs(transition.remaining));
    } else {
      setLabsUnlockMessage('');
    }
  };

  const leaveLabs = () => {
    restoreLabsFocusRef.current = true;
    setScreen('settings');
  };

  const hidePulseLabs = () => {
    hideLabs(window.localStorage);
    setLabsUnlocked(false);
    const sequenceState = createLabsUnlockSequence(false);
    labsUnlockSequenceRef.current = sequenceState;
    setLabsUnlockSequence(sequenceState);
    setLabsUnlockMessage('');
    setScreen('settings');
  };

  const changeWeeklyActiveDayGoal = (offset: -1 | 1) => {
    setSettings((current) => ({
      ...current,
      weeklyActiveDayGoal: Math.min(7, Math.max(1, current.weeklyActiveDayGoal + offset)),
    }));
  };

  const toggleReminderDay = (day: ReminderDay) => {
    setCalendarStatus('');
    setSettings((current) => {
      const selected = current.reminderDays.includes(day);
      if (selected && current.reminderDays.length === 1) return current;
      const reminderDays = selected
        ? current.reminderDays.filter((candidate) => candidate !== day)
        : normalizeReminderDays([...current.reminderDays, day]);
      return { ...current, reminderDays };
    });
  };

  const addCalendarReminders = () => {
    setCalendarStatus('');

    try {
      const url = createWorkoutReminderCalendarDataUrl(
        settings.reminderDays,
        settings.reminderTime,
        new Date(),
        copy.settings.calendarEvent,
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pulse-workout-reminders.ics';
      link.rel = 'noopener';
      link.target = '_self';
      link.type = 'text/calendar';
      document.body.appendChild(link);
      setCalendarStatus(copy.status.calendarOpened);
      link.click();
      link.remove();
    } catch {
      setCalendarStatus(copy.status.calendarError);
    }
  };

  const deleteWorkoutSession = (sessionId: string) => {
    const session = workoutSessions.find((candidate) => candidate.id === sessionId);
    if (!session) return;
    if (!window.confirm(copy.status.deleteHistory(displayWorkoutSessionTimerName(session, copy)))) return;
    setWorkoutSessions((current) => current.filter((candidate) => candidate.id !== sessionId));
  };

  const previewCoach = () => {
    const liveVoices = getSpeechController()?.getVoices()
      ?? (availableVoices.length > 0
        ? availableVoices
        : ('speechSynthesis' in window ? window.speechSynthesis.getVoices() : []));
    const personality = resolveCoachPersonality(settings.coachPersonality);
    const preview = resolveActiveCoach({
      voices: liveVoices,
      personality,
      preference: settings.voicePreference,
      selectedVoiceURI: settings.voiceURI,
      previousAutomaticVoiceURI: '',
      locale,
      random: () => 0,
    });
    speakCoach(makePreviewSpeech(personality, locale), { interrupt: true, voiceURI: preview.voiceURI });
  };

  const restoreWorkoutAudio = () => {
    if (audioRestorePromiseRef.current) return;
    audioEngineRef.current?.stopRecovery();
    audioEnsurePromiseRef.current = null;
    audioRecoveryPromiseRef.current = null;
    const recovery = recoverWorkoutAudio(true);
    audioRestorePromiseRef.current = recovery;
    setAudioRestorePending(true);
    void recovery.finally(() => {
      if (audioRestorePromiseRef.current !== recovery) return;
      audioRestorePromiseRef.current = null;
      setAudioRestorePending(false);
    });
  };

  const totalRemaining = finished
    ? 0
    : remaining + sequence.slice(phaseIndex + 1).reduce((sum, phase) => sum + phase.duration, 0);

  const phaseProgress = currentPhase && currentPhase.duration > 0
    ? Math.min(1, Math.max(0, (currentPhase.duration - remaining) / currentPhase.duration))
    : finished ? 1 : 0;

  const totalDuration = sequence.reduce((sum, phase) => sum + phase.duration, 0);
  const workoutProgress = totalDuration > 0
    ? Math.min(1, Math.max(0, (totalDuration - totalRemaining) / totalDuration))
    : finished ? 1 : 0;
  const executionMetrics = calculateWorkoutSessionMetrics(activeTimer, totalDuration - totalRemaining);

  const currentMessageKind: DisplayMessageKind | null = currentPhase?.kind === 'rest' || currentPhase?.kind === 'cycleRest'
    ? 'motivation'
    : currentPhase?.kind === 'cooldown'
      ? 'aspiration'
      : null;
  const runnerMessage = runnerMessageSelection?.phaseIndex === phaseIndex && runnerMessageSelection.kind === currentMessageKind
    ? runnerMessageSelection.message
    : null;
  const thisWeekProgress = summarizeProgress(workoutSessions, 'week');
  const progressStreaks = calculateProgressStreaks(workoutSessions, new Date(), settings.weeklyActiveDayGoal);

  if (screen === 'labs') {
    return (
      <Suspense fallback={<main className="app-shell labs-screen"><p className="screen-loading" role="status">{copy.status.openingLabs}</p></main>}>
        <PulseLabsScreen onBack={leaveLabs} onHideLabs={hidePulseLabs} />
      </Suspense>
    );
  }

  if (screen === 'editor') {
    return (
      <main className="app-shell editor-screen">
        <header className="screen-header">
          <button className="text-button muted" onClick={() => setScreen(returnScreen)}>{copy.common.cancel}</button>
          <div className="header-title"><span className="eyebrow">{copy.editor.eyebrow}</span><strong>{draft.id ? copy.editor.editTitle : copy.editor.newTitle}</strong></div>
          <button className="text-button accent" onClick={saveTimer}>{copy.common.save}</button>
        </header>

        <section className="editor-content">
          <label className="name-field">
            <span>{copy.editor.nameLabel}</span>
            <input value={localizeTimerName(draft, copy)} maxLength={48} onChange={(event) => updateDraftName(event.target.value)} placeholder={localizeTimerName({ ...draft, nameIsCustom: false }, copy)} />
          </label>
          <div className="name-helper">
            <span>{draft.nameIsCustom ? copy.editor.customName : copy.editor.automaticNameHelper}</span>
            {draft.nameIsCustom && <button onClick={resetDraftName}>{copy.editor.useAutomaticName}</button>}
          </div>

          <div className="editor-section-title"><span>{copy.editor.intervals}</span><small>{copy.editor.time}</small></div>
          <div className="metric-list">
            <DurationInput label={copy.editor.prepare} helper={copy.editor.prepareHelper} value={draft.prepare} min={0} max={600} minutesUnit={copy.editor.minutesUnit} secondsUnit={copy.editor.secondsUnit} onChange={(value) => updateDraftMetric('prepare', value)} />
            <DurationInput label={copy.editor.work} helper={copy.editor.workHelper} value={draft.work} min={1} max={MAX_WHEEL_DURATION_SECONDS} minutesUnit={copy.editor.minutesUnit} secondsUnit={copy.editor.secondsUnit} onChange={(value) => updateDraftMetric('work', value)} />
            <DurationInput label={copy.editor.rest} helper={copy.editor.restHelper} value={draft.rest} min={0} max={MAX_WHEEL_DURATION_SECONDS} minutesUnit={copy.editor.minutesUnit} secondsUnit={copy.editor.secondsUnit} onChange={(value) => updateDraftMetric('rest', value)} />
            <DurationInput label={copy.editor.cooldown} helper={copy.editor.cooldownHelper} value={draft.cooldown} min={0} max={MAX_WHEEL_DURATION_SECONDS} minutesUnit={copy.editor.minutesUnit} secondsUnit={copy.editor.secondsUnit} onChange={(value) => updateDraftMetric('cooldown', value)} />
          </div>

          <div className="editor-section-title"><span>{copy.editor.structure}</span><small>{copy.editor.repeats}</small></div>
          <div className="metric-list">
            <MetricInput label={copy.editor.rounds} helper={copy.editor.roundsHelper} value={draft.rounds} unit="×" min={1} max={99} onChange={(value) => updateDraftMetric('rounds', value)} />
            <MetricInput label={copy.editor.cycles} helper={copy.editor.cyclesHelper(draft.rounds)} value={draft.cycles} unit="×" min={1} max={20} onChange={(value) => updateDraftMetric('cycles', value)} />
            <DurationInput label={copy.editor.cycleRest} helper={copy.editor.cycleRestHelper} value={draft.cycleRest} min={0} max={MAX_WHEEL_DURATION_SECONDS} minutesUnit={copy.editor.minutesUnit} secondsUnit={copy.editor.secondsUnit} onChange={(value) => updateDraftMetric('cycleRest', value)} />
          </div>

          <aside className="cycle-explainer">
            <span className="explainer-number">?</span>
            <div><strong>{copy.editor.cycleExplainerTitle}</strong><p>{copy.editor.cycleExplainerBody}</p></div>
          </aside>

          <div className="workout-summary"><span>{copy.editor.estimatedDuration}</span><strong>{formatTime(workoutDuration(draft))}</strong></div>
          {draft.id && <button className="delete-button" onClick={deleteTimer}>{copy.editor.deleteTimer}</button>}
        </section>
      </main>
    );
  }

  if (screen === 'settings') {
    return (
      <main className="app-shell settings-screen">
        <header className="screen-header">
          <button className="text-button muted" onClick={() => setScreen(returnScreen)}>{copy.common.back}</button>
          <div className="header-title"><span className="eyebrow">{copy.settings.eyebrow}</span><strong>{copy.settings.title}</strong></div>
          <button className="text-button accent" onClick={() => setScreen(returnScreen)}>{copy.common.done}</button>
        </header>

        <section className="settings-content">
          <div className="settings-group">
            <p className="settings-kicker">{copy.settings.languageKicker}</p>
            <div className="language-setting-row">
              <div><strong>{copy.settings.appLanguage}</strong><small>{copy.settings.languageHelper}</small></div>
              <div className="language-grid" role="group" aria-label={copy.settings.appLanguageAria}>
                {LOCALE_OPTIONS.map((option) => (
                  <button
                    type="button"
                    className={locale === option.locale ? 'selected' : ''}
                    aria-label={option.name}
                    aria-pressed={locale === option.locale}
                    lang={option.locale}
                    key={option.locale}
                    onClick={() => setLocale(option.locale)}
                  >{option.code}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-group">
            <p className="settings-kicker">{copy.settings.trainingKicker}</p>
            <div className="setting-row goal-setting-row">
              <div><strong>{copy.settings.activeDaysPerWeek}</strong><small>{copy.settings.activeDaysGoalHelper}</small></div>
              <div className="goal-stepper" aria-label={copy.settings.weeklyGoalAria}>
                <button aria-label={copy.settings.decreaseWeeklyGoal} disabled={settings.weeklyActiveDayGoal <= 1} onClick={() => changeWeeklyActiveDayGoal(-1)}>-</button>
                <output><strong>{settings.weeklyActiveDayGoal}</strong><small>{copy.settings.perWeek}</small></output>
                <button aria-label={copy.settings.increaseWeeklyGoal} disabled={settings.weeklyActiveDayGoal >= 7} onClick={() => changeWeeklyActiveDayGoal(1)}>+</button>
              </div>
            </div>
            <fieldset className="reminder-settings">
              <legend>{copy.settings.workoutReminders}</legend>
              <p>{copy.settings.reminderIntro}</p>
              <div className="reminder-days" aria-label={copy.settings.reminderDaysAria}>
                {REMINDER_DAY_OPTIONS.map((day) => {
                  const selected = settings.reminderDays.includes(day.value);
                  const dayCopy = copy.settings.reminderDays[day.value];
                  return (
                    <button
                      type="button"
                      aria-label={dayCopy.label}
                      aria-pressed={selected}
                      className={selected ? 'selected' : ''}
                      key={day.value}
                      onClick={() => toggleReminderDay(day.value)}
                    >{dayCopy.short}</button>
                  );
                })}
              </div>
              <label className="reminder-time-row">
                <span><strong>{copy.settings.reminderTime}</strong><small>{copy.settings.calendarHandlesDelivery}</small></span>
                <input
                  aria-label={copy.settings.reminderTimeAria}
                  type="time"
                  value={settings.reminderTime}
                  onChange={(event) => {
                    setCalendarStatus('');
                    setSettings((current) => ({ ...current, reminderTime: event.target.value }));
                  }}
                  onBlur={() => setSettings((current) => ({ ...current, reminderTime: normalizeReminderTime(current.reminderTime) }))}
                />
              </label>
              <button className="calendar-reminder-button" onClick={addCalendarReminders}>
                <AppIcon name="calendar" size={21} strokeWidth={1.9} />
                <span><strong>{copy.settings.addRemindersToCalendar}</strong><small>{copy.settings.worksAfterPulseCloses}</small></span>
                <AppIcon name="arrow-right" size={18} />
              </button>
              {calendarStatus && <p className="calendar-status" role="status">{calendarStatus}</p>}
            </fieldset>
            <p className="setting-note">{copy.settings.reminderPrivacyNote}</p>
          </div>

          <div className="settings-group">
            <p className="settings-kicker">{copy.audioSettings.kicker}</p>
            <div className="setting-row">
              <div><strong>{copy.audioSettings.soundEffects}</strong><small>{copy.audioSettings.soundEffectsHelper}</small></div>
              <Switch label={copy.audioSettings.soundEffects} checked={settings.soundEnabled} onChange={(soundEnabled) => setSettings((current) => ({ ...current, soundEnabled }))} />
            </div>
            <button className="setting-row setting-action" onClick={() => { void playCue('work'); }}>
              <div><strong>{copy.audioSettings.soundScheme}</strong><small>{copy.audioSettings.soundSchemeHelper}</small></div>
              <span className="setting-value">{copy.audioSettings.pulseBeep} <i className="mini-play"><PlayGlyph /></i></span>
            </button>
            <label className="volume-row">
              <span className="volume-icon">−</span>
              <input
                aria-label={copy.audioSettings.appVolume}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.volume}
                onChange={(event) => setSettings((current) => ({ ...current, volume: Number(event.target.value) }))}
                style={{ '--range-value': `${settings.volume * 100}%` } as CSSProperties}
              />
              <span className="volume-icon loud">＋</span>
              <output>{Math.round(settings.volume * 100)}%</output>
            </label>
            <div className="setting-row">
              <div><strong>{copy.audioSettings.tickingSound}</strong><small>{copy.audioSettings.tickingHelper}</small></div>
              <Switch label={copy.audioSettings.tickingSound} checked={settings.ticking} onChange={(ticking) => setSettings((current) => ({ ...current, ticking }))} />
            </div>
            <p className="setting-note">{copy.audioSettings.silentModeNote}</p>
          </div>

          <div className="settings-group">
            <p className="settings-kicker">{copy.coachSettings.kicker}</p>
            <div className="setting-row">
              <div><strong>{copy.coachSettings.voiceCoach}</strong><small>{copy.coachSettings.voiceCoachHelper}</small></div>
              <Switch label={copy.coachSettings.voiceCoachSwitch} checked={settings.voiceEnabled} onChange={(voiceEnabled) => setSettings((current) => ({ ...current, voiceEnabled }))} />
            </div>
            <div className={`setting-row ${!settings.voiceEnabled ? 'unavailable' : ''}`}>
              <div><strong>{copy.coachSettings.coachingPhrases}</strong><small>{copy.coachSettings.coachingPhrasesHelper}</small></div>
              <Switch
                label={copy.coachSettings.coachingPhrasesSwitch}
                checked={settings.coachPhrasesEnabled}
                disabled={!settings.voiceEnabled}
                onChange={(coachPhrasesEnabled) => setSettings((current) => ({ ...current, coachPhrasesEnabled }))}
              />
            </div>
            <fieldset className={`coach-choice-section ${!settings.voiceEnabled ? 'unavailable' : ''}`} disabled={!settings.voiceEnabled}>
              <legend>{copy.coachSettings.personality}</legend>
              <p>{copy.coachSettings.personalityHelper}</p>
              <div className="personality-grid">
                {Object.values(COACH_PERSONALITIES).map((personality) => {
                  const presentation = getCoachPersonalityPresentation(personality.id, locale);
                  return <button
                    type="button"
                    className={settings.coachPersonality === personality.id ? 'selected' : ''}
                    aria-pressed={settings.coachPersonality === personality.id}
                    key={personality.id}
                    onClick={() => setSettings((current) => ({ ...current, coachPersonality: personality.id }))}
                  >
                    <strong>{presentation.label}</strong>
                    <small>{presentation.description}</small>
                  </button>;
                })}
                <button
                  type="button"
                  className={`surprise-personality ${settings.coachPersonality === 'surprise' ? 'selected' : ''}`}
                  aria-pressed={settings.coachPersonality === 'surprise'}
                  onClick={() => setSettings((current) => ({ ...current, coachPersonality: 'surprise' }))}
                >
                  <strong>{copy.coachSettings.surpriseMe}</strong>
                  <small>{copy.coachSettings.surprisePersonalityHelper}</small>
                </button>
              </div>
            </fieldset>
            <fieldset className={`coach-choice-section compact ${!settings.voiceEnabled ? 'unavailable' : ''}`} disabled={!settings.voiceEnabled}>
              <legend>{copy.coachSettings.voicePreference}</legend>
              <p>{copy.coachSettings.automaticPreferenceHelper}</p>
              <div className="preference-grid">
                {(['female', 'male', 'either'] as VoicePreference[]).map((preference) => (
                  <button
                    type="button"
                    className={settings.voicePreference === preference ? 'selected' : ''}
                    aria-pressed={settings.voicePreference === preference}
                    key={preference}
                    onClick={() => setSettings((current) => ({ ...current, voicePreference: preference }))}
                  >{copy.coachSettings.preference[preference]}</button>
                ))}
              </div>
            </fieldset>
            <label className={`voice-select-row ${!settings.voiceEnabled ? 'unavailable' : ''}`}>
              <span><strong>{copy.coachSettings.systemVoice}</strong><small>{copy.coachSettings.systemVoiceHelper}</small></span>
              <select
                aria-label={copy.coachSettings.coachVoiceAria}
                value={settings.voiceURI}
                disabled={!settings.voiceEnabled}
                onChange={(event) => setSettings((current) => ({ ...current, voiceURI: event.target.value }))}
              >
                <option value="">{copy.coachSettings.automatic}</option>
                {settings.voiceURI && !curatedVoices.some(({ voice }) => voice.voiceURI === settings.voiceURI) && (
                  <option value={settings.voiceURI}>{copy.coachSettings.savedVoiceUnavailable}</option>
                )}
                {recommendedVoices.length > 0 && (
                  <optgroup label={copy.coachSettings.recommended}>
                    {recommendedVoices.map(({ voice, profile }) => (
                      <option value={voice.voiceURI} key={voice.voiceURI}>
                        {voice.name} · {copy.coachSettings.preference[profile.gender ?? 'either']}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherVoices.length > 0 && (
                  <optgroup label={copy.coachSettings.otherSystemVoices}>
                    {otherVoices.map(({ voice, profile }) => (
                      <option value={voice.voiceURI} key={voice.voiceURI}>
                        {voice.name} · {voice.lang}{profile.novelty ? ` · ${copy.coachSettings.effect}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            <button className="setting-row setting-action" disabled={!settings.voiceEnabled} onClick={previewCoach}>
              <div><strong>{copy.coachSettings.testCoach}</strong><small>{copy.coachSettings.previewCoach(settings.coachPersonality === 'surprise')}</small></div>
              <span className="setting-value">{copy.coachSettings.play} <i className="mini-play"><PlayGlyph /></i></span>
            </button>
            <div className="setting-row unavailable">
              <div><strong>{copy.coachSettings.ducking}</strong><small>{copy.coachSettings.duckingHelper}</small></div>
              <Switch label={copy.coachSettings.duckingUnavailable} checked={settings.ducking} onChange={() => undefined} disabled />
            </div>
            <p className="setting-note">{curatedVoices.length > 0
              ? copy.coachSettings.voiceNote(localeName)
              : copy.coachSettings.noCompatibleVoice(localeName)}</p>
            <p className="setting-note secondary">{copy.coachSettings.musicNote}</p>
          </div>

          <div className="settings-group">
            <p className="settings-kicker">{copy.displaySettings.kicker}</p>
            <div className="setting-row">
              <div><strong>{copy.displaySettings.rotation}</strong><small>{copy.displaySettings.rotationHelper}</small></div>
              <Switch label={copy.displaySettings.rotationAria} checked={settings.rotation} onChange={(rotation) => setSettings((current) => ({ ...current, rotation }))} />
            </div>
            <p className="setting-note">{copy.displaySettings.orientationNote}</p>
          </div>

          {labsUnlocked && (
            <div className="settings-group">
              <p className="settings-kicker">{copy.experimentalSettings.kicker}</p>
              <button ref={labsOpeningControlRef} className="setting-row setting-action" onClick={() => setScreen('labs')}>
                <div><strong>Pulse Labs</strong><small>{copy.experimentalSettings.labsHelper}</small></div>
                <span className="setting-value">{copy.experimentalSettings.open} <AppIcon name="arrow-right" size={17} /></span>
              </button>
              <p className="setting-note">{copy.experimentalSettings.labsNote}</p>
            </div>
          )}

          <footer className="version-card">
            <span className="brand-mark small">P</span>
            <div>
              <strong>Pulse</strong>
              <small>
                <button
                  type="button"
                  className="version-unlock-button"
                  aria-label={copy.about.versionAria(APP_VERSION)}
                  onClick={activateVersionUnlock}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    activateVersionUnlock();
                  }}
                >{copy.about.version} {APP_VERSION}</button>
                {` · ${copy.about.installablePwa} · `}
                <a href="./third-party-notices.txt" target="_blank" rel="noreferrer">{copy.about.contentCredits}</a>
              </small>
              <span className="version-unlock-status" role="status" aria-live="polite">{labsUnlockMessage}</span>
            </div>
          </footer>
        </section>
      </main>
    );
  }

  if (screen === 'progress') {
    return (
      <ProgressScreen
        sessions={workoutSessions}
        onHome={() => { setProgressAnnouncement(''); setScreen('home'); }}
        onTimers={() => { setProgressAnnouncement(''); setScreen('library'); }}
        onSettings={() => { setProgressAnnouncement(''); openSettings('progress'); }}
        onDeleteSession={deleteWorkoutSession}
        weeklyGoal={settings.weeklyActiveDayGoal}
        locale={locale}
        sessionTimerName={(session) => displayWorkoutSessionTimerName(session, copy)}
        announcement={progressAnnouncement}
      />
    );
  }

  if (screen === 'runner') {
    const phaseKind = finished ? 'complete' : currentPhase?.kind ?? 'prepare';
    const phaseClass = phaseKind === 'complete' ? 'complete' : phaseKind;
    const adjustedTimerPreview = { ...activeTimer, ...sessionAdjustment };
    return (
      <main className={`runner-screen phase-${phaseClass}`}>
        <header className="runner-header">
          <button className="round-icon-button" onClick={leaveWorkout} aria-label={copy.runner.backToTimers}><AppIcon name="arrow-left" /></button>
          <div><p>{localizeTimerName(activeTimer, copy)}</p><strong>{copy.runner.timeLeft(formatTime(totalRemaining))}</strong></div>
          <button className="round-icon-button" onClick={resetWorkout} aria-label={copy.runner.resetWorkout}><AppIcon name="reset" /></button>
        </header>

        <section className="runner-main" aria-live="polite" aria-atomic="true">
          <p className="phase-kicker">{finished ? copy.runner.sessionKicker : copy.phase[currentPhase?.kind ?? 'prepare'].short}</p>
          <h1>{finished ? copy.runner.complete : copy.phase[currentPhase?.kind ?? 'prepare'].label}</h1>
          <div className="giant-time">{finished ? <AppIcon name="check" size={132} strokeWidth={2.2} /> : formatTime(remaining)}</div>
          {finished && (
            <div className="completion-progress-card">
              <strong>{copy.runner.trainingAdded(formatTime(workoutDuration(activeTimer)))}</strong>
              <span>{copy.runner.weeklySummary(progressStreaks.activeDaysThisWeek, progressStreaks.weeklyGoal, progressStreaks.currentActiveDays)}</span>
              {newMilestones.length > 0 && (
                <div className="milestone-celebration">
                  <AppIcon name="trophy" size={20} strokeWidth={2} />
                  <span><strong>{copy.runner.milestonesUnlocked(newMilestones.length)}</strong>{newMilestones.map(({ id }) => copy.progress.milestones[id].title).join(' · ')}</span>
                </div>
              )}
              <button onClick={() => setScreen('progress')}>{copy.runner.viewProgress} <AppIcon name="arrow-right" size={14} /></button>
            </div>
          )}
          {runnerMessage && (
            <figure className={`runner-message ${currentPhase?.kind === 'cooldown' ? 'reflection' : ''}`}>
              <blockquote>{runnerMessage.author ? `“${runnerMessage.text}”` : runnerMessage.text}</blockquote>
              {runnerMessage.author && <figcaption>— {runnerMessage.author}</figcaption>}
            </figure>
          )}
          <div
            className="phase-progress"
            role="progressbar"
            aria-label={finished
              ? copy.runner.sessionComplete
              : copy.runner.stageProgress(copy.phase[currentPhase?.kind ?? 'prepare'].label)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(phaseProgress * 100)}
          >
            <div className="phase-progress-label">
              <span>{finished ? copy.runner.session : copy.runner.currentStage}</span>
            </div>
            <div className="phase-progress-track" aria-hidden="true"><span style={{ width: `${phaseProgress * 100}%` }} /></div>
          </div>
        </section>

        <section className="runner-up-next">
          <div>
            <span>{finished ? copy.runner.workout : copy.runner.upNext}</span>
            <strong>{finished
              ? copy.runner.total(formatTime(workoutDuration(activeTimer)))
              : nextPhase
                ? `${copy.phase[nextPhase.kind].label} · ${formatTime(nextPhase.duration)}`
                : copy.runner.finish}</strong>
          </div>
          <div
            className="workout-progress"
            role="progressbar"
            aria-label={copy.runner.workoutProgress(
              finished ? activeTimer.rounds : currentPhase?.round ?? 1,
              activeTimer.rounds,
              finished ? activeTimer.cycles : currentPhase?.cycle ?? 1,
              activeTimer.cycles,
            )}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(workoutProgress * 100)}
          >
            <div className="workout-progress-label">
              <span>{copy.runner.workout}</span>
              <small>R {finished ? activeTimer.rounds : currentPhase?.round ?? 1}/{activeTimer.rounds} · C {finished ? activeTimer.cycles : currentPhase?.cycle ?? 1}/{activeTimer.cycles}</small>
              <strong>{Math.round(workoutProgress * 100)}%</strong>
            </div>
            <div className="workout-timeline" aria-hidden="true">
              {sequence.map((phase, index) => {
                const segmentProgress = finished || index < phaseIndex
                  ? 1
                  : index === phaseIndex ? phaseProgress : 0;
                const startsCycle = index > 0 && sequence[index - 1]?.cycle !== phase.cycle;
                return (
                  <span
                    className={`workout-segment${startsCycle ? ' starts-cycle' : ''}`}
                    style={{ flexGrow: Math.max(phase.duration, 1) }}
                    key={`${phase.kind}-${phase.cycle}-${phase.round}-${index}`}
                  >
                    <i style={{ width: `${segmentProgress * 100}%` }} />
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        <section className="runner-controls">
          <div className="runner-stat"><strong>{finished ? activeTimer.rounds : currentPhase?.round ?? 1}</strong><span>{copy.runner.round} / {activeTimer.rounds}</span></div>
          <div className="runner-control-center">
            <button
              className={`main-control ${running ? 'is-running' : ''}`}
              disabled={workoutStartPending}
              aria-busy={workoutStartPending}
              onClick={() => { void toggleWorkout(); }}
              aria-label={finished ? copy.runner.restartWorkout : running ? copy.runner.pauseWorkout : hasWorkoutStarted ? copy.runner.resume : copy.runner.startWorkout}
            >
              <span>{finished ? <AppIcon name="reset" size={34} /> : running ? <PauseGlyph /> : <PlayGlyph />}</span>
              <small>{finished ? copy.runner.again : running ? copy.runner.pause : hasWorkoutStarted ? copy.runner.resume : copy.runner.start}</small>
            </button>
            {!finished && running && audioNeedsGesture && (
              <button
                className="runner-secondary-action audio-recovery"
                disabled={audioRestorePending}
                aria-busy={audioRestorePending}
                title={copy.runner.restoreAudioHint}
                onClick={restoreWorkoutAudio}
              >{copy.runner.restoreAudio}</button>
            )}
            {!finished && !running && !hasWorkoutStarted && !workoutStartPending && (
              <button className="runner-secondary-action" onClick={openAdjustSessionDialog}>{copy.runner.adjustSession}</button>
            )}
            {!finished && hasWorkoutStarted && !running && (
              <button className="runner-secondary-action danger" onClick={openFinishSessionDialog}>{copy.runner.finishSession}</button>
            )}
          </div>
          <div className="runner-stat"><strong>{finished ? activeTimer.cycles : currentPhase?.cycle ?? 1}</strong><span>{copy.runner.cycle} / {activeTimer.cycles}</span></div>
        </section>

        <dialog
          className="runner-dialog"
          ref={adjustSessionDialogRef}
          aria-labelledby="adjust-session-title"
          aria-describedby="adjust-session-helper"
        >
          <form className="runner-dialog-content" onSubmit={(event) => { event.preventDefault(); applySessionAdjustment(); }}>
            <header>
              <p className="eyebrow">{copy.runner.adjustSession}</p>
              <h2 id="adjust-session-title">{copy.runner.adjustSessionTitle}</h2>
              <p id="adjust-session-helper">{copy.runner.adjustSessionHelper}</p>
            </header>
            <div className="runner-dialog-section">
              <span className="runner-dialog-section-title">{copy.editor.intervals}</span>
              <div className="metric-list">
                <DurationInput
                  label={copy.editor.prepare}
                  helper={copy.editor.prepareHelper}
                  value={sessionAdjustment.prepare}
                  min={0}
                  max={600}
                  minutesUnit={copy.editor.minutesUnit}
                  secondsUnit={copy.editor.secondsUnit}
                  onChange={(prepare) => setSessionAdjustment((current) => ({ ...current, prepare }))}
                />
                <DurationInput
                  label={copy.editor.work}
                  helper={copy.editor.workHelper}
                  value={sessionAdjustment.work}
                  min={1}
                  max={MAX_WHEEL_DURATION_SECONDS}
                  minutesUnit={copy.editor.minutesUnit}
                  secondsUnit={copy.editor.secondsUnit}
                  onChange={(work) => setSessionAdjustment((current) => ({ ...current, work }))}
                />
                <DurationInput
                  label={copy.editor.rest}
                  helper={copy.editor.restHelper}
                  value={sessionAdjustment.rest}
                  min={0}
                  max={MAX_WHEEL_DURATION_SECONDS}
                  minutesUnit={copy.editor.minutesUnit}
                  secondsUnit={copy.editor.secondsUnit}
                  onChange={(rest) => setSessionAdjustment((current) => ({ ...current, rest }))}
                />
                <DurationInput
                  label={copy.editor.cooldown}
                  helper={copy.editor.cooldownHelper}
                  value={sessionAdjustment.cooldown}
                  min={0}
                  max={MAX_WHEEL_DURATION_SECONDS}
                  minutesUnit={copy.editor.minutesUnit}
                  secondsUnit={copy.editor.secondsUnit}
                  onChange={(cooldown) => setSessionAdjustment((current) => ({ ...current, cooldown }))}
                />
              </div>
            </div>
            <div className="runner-dialog-section">
              <span className="runner-dialog-section-title">{copy.editor.structure}</span>
              <div className="metric-list">
              <MetricInput
                label={copy.runner.adjustSessionRounds}
                helper={copy.editor.roundsHelper}
                value={sessionAdjustment.rounds}
                unit="×"
                min={1}
                max={99}
                onChange={(rounds) => setSessionAdjustment((current) => ({ ...current, rounds }))}
              />
              <MetricInput
                label={copy.runner.adjustSessionCycles}
                helper={copy.editor.cyclesHelper(sessionAdjustment.rounds)}
                value={sessionAdjustment.cycles}
                unit="×"
                min={1}
                max={20}
                onChange={(cycles) => setSessionAdjustment((current) => ({ ...current, cycles }))}
              />
                <DurationInput
                  label={copy.editor.cycleRest}
                  helper={copy.editor.cycleRestHelper}
                  value={sessionAdjustment.cycleRest}
                  min={0}
                  max={MAX_WHEEL_DURATION_SECONDS}
                  minutesUnit={copy.editor.minutesUnit}
                  secondsUnit={copy.editor.secondsUnit}
                  onChange={(cycleRest) => setSessionAdjustment((current) => ({ ...current, cycleRest }))}
                />
              </div>
            </div>
            <strong className="runner-dialog-summary" aria-live="polite">{copy.runner.adjustSessionEstimatedDuration(formatTime(workoutDuration(adjustedTimerPreview)))}</strong>
            <div className="runner-dialog-actions">
              <button type="button" className="secondary" onClick={() => adjustSessionDialogRef.current?.close()}>{copy.runner.cancelSessionAdjustments}</button>
              <button type="submit" className="primary">{copy.runner.applySessionAdjustments}</button>
            </div>
          </form>
        </dialog>

        <dialog
          className="runner-dialog"
          ref={finishSessionDialogRef}
          aria-labelledby="finish-session-title"
          aria-describedby="finish-session-progress"
          onCancel={(event) => { event.preventDefault(); continueWorkoutAfterFinishDialog(); }}
        >
          <div className="runner-dialog-content">
            <header>
              <p className="eyebrow">{copy.runner.finishSession}</p>
              <h2 id="finish-session-title">{copy.runner.finishSessionTitle}</h2>
              <p id="finish-session-progress">{copy.runner.finishSessionProgress(
                executionMetrics.completedWorkIntervals,
                executionMetrics.plannedWorkIntervals,
                formatTime(executionMetrics.totalSeconds),
              )}</p>
            </header>
            <div className="runner-dialog-actions finish-actions">
              <button type="button" className="secondary" onClick={continueWorkoutAfterFinishDialog}>{copy.runner.continueSession}</button>
              <button type="button" className="primary" disabled={executionMetrics.totalSeconds <= 0} onClick={saveStoppedWorkout}>{copy.runner.savePartialSession}</button>
              <button type="button" className="danger" onClick={exitWorkout}>{copy.runner.discardSession}</button>
            </div>
          </div>
        </dialog>
      </main>
    );
  }

  if (screen === 'library') {
    return (
      <main className="app-shell library-screen">
        <header className="screen-header">
          <button className="text-button muted" onClick={() => setScreen('home')}>{copy.common.home}</button>
          <div className="header-title"><span className="eyebrow">{copy.library.eyebrow}</span><strong>{copy.common.timers}</strong></div>
          <button className="text-button accent" onClick={() => openEditor(undefined, 'library')}>{copy.common.new}</button>
        </header>

        <section className="library-content">
          <div className="library-intro"><div><p className="eyebrow">{copy.library.allPrograms}</p><h1>{copy.library.timerCount(timers.length)}</h1></div><p>{copy.library.description}</p></div>
          <div className="library-list">
            {timers.map((timer, index) => {
              const timerName = localizeTimerName(timer, copy);
              return <article className="library-card" key={timer.id}>
                <button className="library-run" onClick={() => beginWorkout(timer)} aria-label={copy.common.startTimer(timerName)}>
                  <TimerDetails timer={timer} index={index} copy={copy} />
                  <span className="play-button"><PlayGlyph /></span>
                </button>
                <div className="library-actions">
                  <button onClick={() => moveTimer(index, -1)} disabled={index === 0} aria-label={copy.common.moveTimerUp(timerName)}><AppIcon name="chevron-up" size={18} /></button>
                  <button onClick={() => moveTimer(index, 1)} disabled={index === timers.length - 1} aria-label={copy.common.moveTimerDown(timerName)}><AppIcon name="chevron-down" size={18} /></button>
                  <button className="edit-action" onClick={() => openEditor(timer, 'library')} aria-label={copy.common.editTimer(timerName)}>{copy.common.edit}</button>
                </div>
              </article>;
            })}
          </div>
        </section>

        <nav className="bottom-nav" aria-label={copy.common.primaryNavigation}>
          <button className="nav-item" onClick={() => setScreen('home')}><AppIcon name="home" />{copy.common.home}</button>
          <button className="nav-item active" onClick={() => setScreen('library')}><AppIcon name="timer" />{copy.common.timers}</button>
          <button className="nav-item" onClick={() => setScreen('progress')}><AppIcon name="progress" />{copy.common.progress}</button>
          <button className="nav-item" onClick={() => openSettings('library')}><AppIcon name="settings" />{copy.common.settings}</button>
        </nav>
      </main>
    );
  }

  const homeTimers = selectHomeTimers(timers, recentTimerIds);
  return (
      <main className="app-shell home-screen">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">P</span><div><p className="eyebrow">{copy.home.brandEyebrow}</p><h1>Pulse</h1></div></div>
        <button className="icon-button" aria-label={copy.common.openSettings} onClick={() => openSettings('home')}><AppIcon name="settings" /></button>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow dark">{copy.home.readyEyebrow}</p>
          <h2 id="hero-title">{copy.home.heroFirstLine}<br />{copy.home.heroSecondLine}</h2>
          <p>{copy.home.description}</p>
        </div>
        <button className="new-timer-button" onClick={() => openEditor(undefined, 'home')}><span className="plus">+</span>{copy.home.newTimer}</button>
      </section>

      <section className="home-progress" aria-label={copy.home.weeklyProgress}>
        <button className="home-progress-card" onClick={() => setScreen('progress')}>
          <div>
            <p className="eyebrow">{copy.home.thisWeek}</p>
            <strong>{formatProgressMinutes(thisWeekProgress.totalSeconds)}<small> {copy.home.minutesUnit}</small></strong>
          </div>
          <div className="home-progress-stat">
            <span>{progressStreaks.currentActiveDays}</span>
            <small>{copy.home.dayStreak}</small>
          </div>
          <span className="home-progress-arrow"><AppIcon name="arrow-right" size={20} /></span>
        </button>
      </section>

      <section className="workouts" aria-labelledby="workouts-title">
        <div className="section-heading">
          <div><p className="eyebrow">{copy.home.quickStart}</p><h2 id="workouts-title">{copy.home.recentTimers}</h2></div>
          <button className="manage-link" onClick={() => setScreen('library')}>{copy.home.manage(timers.length)} <AppIcon name="arrow-right" size={13} /></button>
        </div>

        {homeTimers.length === 0 ? (
          <div className="empty-state"><strong>{copy.home.emptyTitle}</strong><p>{copy.home.emptyBody}</p><button onClick={() => openEditor(undefined, 'home')}>{copy.home.createTimer}</button></div>
        ) : (
          <div className="timer-list">
            {homeTimers.map((timer, index) => {
              const timerName = localizeTimerName(timer, copy);
              return <button className="timer-card timer-launch" key={timer.id} onClick={() => beginWorkout(timer)} aria-label={copy.common.startTimer(timerName)}>
                <TimerDetails timer={timer} index={index} copy={copy} />
                <span className="play-button"><PlayGlyph /></span>
              </button>;
            })}
          </div>
        )}
      </section>

      <nav className="bottom-nav" aria-label={copy.common.primaryNavigation}>
        <button className="nav-item active" onClick={() => setScreen('home')}><AppIcon name="home" />{copy.common.home}</button>
        <button className="nav-item" onClick={() => setScreen('library')}><AppIcon name="timer" />{copy.common.timers}</button>
        <button className="nav-item" onClick={() => setScreen('progress')}><AppIcon name="progress" />{copy.common.progress}</button>
        <button className="nav-item" onClick={() => openSettings('home')}><AppIcon name="settings" />{copy.common.settings}</button>
      </nav>
    </main>
  );
}
