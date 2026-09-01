import type {
  ProgressBucket,
  ProgressMilestone,
  ProgressPeriod,
  ProgressStreaks,
  ProgressSummary,
  WorkoutHistoryMonth,
  WorkoutSession,
  WorkoutSessionMetrics,
  WorkoutTimerSnapshot,
} from './types.ts';

const DAY_MS = 86_400_000;
export const DEFAULT_WEEKLY_ACTIVE_DAY_GOAL = 3;

const TIMER_LIMITS = {
  prepare: { min: 0, max: 600 },
  work: { min: 1, max: 3600 },
  rest: { min: 0, max: 3600 },
  rounds: { min: 1, max: 99 },
  cycles: { min: 1, max: 20 },
  cycleRest: { min: 0, max: 3600 },
  cooldown: { min: 0, max: 3600 },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && value >= min && value <= max;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return isNumberInRange(value, min, max) && Number.isInteger(value);
}

function isTimerSnapshot(value: unknown): value is WorkoutTimerSnapshot {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && (value.nameIsCustom === undefined || typeof value.nameIsCustom === 'boolean')
    && isNumberInRange(value.prepare, TIMER_LIMITS.prepare.min, TIMER_LIMITS.prepare.max)
    && isNumberInRange(value.work, TIMER_LIMITS.work.min, TIMER_LIMITS.work.max)
    && isNumberInRange(value.rest, TIMER_LIMITS.rest.min, TIMER_LIMITS.rest.max)
    && isIntegerInRange(value.rounds, TIMER_LIMITS.rounds.min, TIMER_LIMITS.rounds.max)
    && isIntegerInRange(value.cycles, TIMER_LIMITS.cycles.min, TIMER_LIMITS.cycles.max)
    && isNumberInRange(value.cycleRest, TIMER_LIMITS.cycleRest.min, TIMER_LIMITS.cycleRest.max)
    && isNumberInRange(value.cooldown, TIMER_LIMITS.cooldown.min, TIMER_LIMITS.cooldown.max);
}

type StoredWorkoutSessionBase = {
  schemaVersion: 1 | 2;
  id: string;
  timerId: string;
  timerName: string;
  startedAt: string;
  completedAt: string;
  localDate: string;
  timezoneOffsetMinutes: number;
  totalSeconds: number;
  activeWorkSeconds: number;
  rounds: number;
  cycles: number;
  timerSnapshot: WorkoutTimerSnapshot;
};

function isStoredWorkoutSessionBase(value: unknown): value is StoredWorkoutSessionBase {
  if (!isRecord(value)) return false;
  return (value.schemaVersion === 1 || value.schemaVersion === 2)
    && typeof value.id === 'string'
    && typeof value.timerId === 'string'
    && typeof value.timerName === 'string'
    && typeof value.startedAt === 'string'
    && typeof value.completedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(String(value.localDate))
    && isFiniteNumber(value.timezoneOffsetMinutes)
    && isFiniteNumber(value.totalSeconds)
    && value.totalSeconds >= 0
    && isFiniteNumber(value.activeWorkSeconds)
    && value.activeWorkSeconds >= 0
    && value.activeWorkSeconds <= value.totalSeconds
    && isIntegerInRange(value.rounds, TIMER_LIMITS.rounds.min, TIMER_LIMITS.rounds.max)
    && isIntegerInRange(value.cycles, TIMER_LIMITS.cycles.min, TIMER_LIMITS.cycles.max)
    && isTimerSnapshot(value.timerSnapshot)
    && value.rounds === value.timerSnapshot.rounds
    && value.cycles === value.timerSnapshot.cycles
    && Number.isFinite(Date.parse(value.startedAt))
    && Number.isFinite(Date.parse(value.completedAt));
}

type WorkoutPlanPhase = {
  kind: 'work' | 'other';
  duration: number;
};

function boundedNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function boundedInteger(value: number, min: number, max: number) {
  return Math.trunc(boundedNumber(value, min, max));
}

function boundedTimerSnapshot(timer: WorkoutTimerSnapshot): WorkoutTimerSnapshot {
  return {
    ...timer,
    prepare: boundedNumber(timer.prepare, TIMER_LIMITS.prepare.min, TIMER_LIMITS.prepare.max),
    work: boundedNumber(timer.work, TIMER_LIMITS.work.min, TIMER_LIMITS.work.max),
    rest: boundedNumber(timer.rest, TIMER_LIMITS.rest.min, TIMER_LIMITS.rest.max),
    rounds: boundedInteger(timer.rounds, TIMER_LIMITS.rounds.min, TIMER_LIMITS.rounds.max),
    cycles: boundedInteger(timer.cycles, TIMER_LIMITS.cycles.min, TIMER_LIMITS.cycles.max),
    cycleRest: boundedNumber(timer.cycleRest, TIMER_LIMITS.cycleRest.min, TIMER_LIMITS.cycleRest.max),
    cooldown: boundedNumber(timer.cooldown, TIMER_LIMITS.cooldown.min, TIMER_LIMITS.cooldown.max),
  };
}

function workoutPlan(timer: WorkoutTimerSnapshot) {
  const phases: WorkoutPlanPhase[] = [];
  const boundedTimer = boundedTimerSnapshot(timer);
  const rounds = boundedTimer.rounds;
  const cycles = boundedTimer.cycles;

  if (boundedTimer.prepare > 0) {
    phases.push({ kind: 'other', duration: boundedTimer.prepare });
  }
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    for (let round = 1; round <= rounds; round += 1) {
      phases.push({ kind: 'work', duration: boundedTimer.work });
      if (round < rounds && boundedTimer.rest > 0) {
        phases.push({ kind: 'other', duration: boundedTimer.rest });
      }
    }
    if (cycle < cycles && boundedTimer.cycleRest > 0) {
      phases.push({ kind: 'other', duration: boundedTimer.cycleRest });
    }
  }
  if (boundedTimer.cooldown > 0) {
    phases.push({ kind: 'other', duration: boundedTimer.cooldown });
  }

  return {
    phases,
    plannedWorkIntervals: rounds * cycles,
    plannedTotalSeconds: phases.reduce((sum, phase) => sum + phase.duration, 0),
  };
}

/**
 * Converts scheduled time consumed in the runner into durable progress metrics.
 * Elapsed time is clamped to the timer plan, so paused wall-clock time is never counted.
 */
export function calculateWorkoutSessionMetrics(
  timer: WorkoutTimerSnapshot,
  elapsedSeconds: number,
): WorkoutSessionMetrics {
  const plan = workoutPlan(timer);
  const totalSeconds = Math.min(
    plan.plannedTotalSeconds,
    Math.max(0, isFiniteNumber(elapsedSeconds) ? elapsedSeconds : 0),
  );
  let unallocatedSeconds = totalSeconds;
  let activeWorkSeconds = 0;
  let completedWorkIntervals = 0;

  for (const phase of plan.phases) {
    if (unallocatedSeconds <= 0) break;
    const consumedSeconds = Math.min(phase.duration, unallocatedSeconds);
    if (phase.kind === 'work') {
      activeWorkSeconds += consumedSeconds;
      if (phase.duration > 0 && consumedSeconds >= phase.duration) completedWorkIntervals += 1;
    }
    unallocatedSeconds -= consumedSeconds;
  }

  return {
    totalSeconds,
    activeWorkSeconds,
    completedWorkIntervals,
    plannedWorkIntervals: plan.plannedWorkIntervals,
    plannedTotalSeconds: plan.plannedTotalSeconds,
  };
}

function nonNegativeInteger(value: unknown) {
  return isFiniteNumber(value) && value >= 0 && Number.isInteger(value) ? value : null;
}

function nonNegativeNumber(value: unknown) {
  return isFiniteNumber(value) && value >= 0 ? value : null;
}

function storedSessionFields(value: StoredWorkoutSessionBase) {
  return {
    id: value.id,
    timerId: value.timerId,
    timerName: value.timerName,
    startedAt: value.startedAt,
    completedAt: value.completedAt,
    localDate: value.localDate,
    timezoneOffsetMinutes: value.timezoneOffsetMinutes,
    rounds: value.rounds,
    cycles: value.cycles,
    timerSnapshot: { ...value.timerSnapshot },
  };
}

function migrateLegacyWorkoutSession(value: StoredWorkoutSessionBase): WorkoutSession {
  const plan = calculateWorkoutSessionMetrics(value.timerSnapshot, value.totalSeconds);
  return {
    schemaVersion: 2,
    ...storedSessionFields(value),
    status: 'completed',
    totalSeconds: value.totalSeconds,
    activeWorkSeconds: value.activeWorkSeconds,
    completedWorkIntervals: plan.plannedWorkIntervals,
    plannedWorkIntervals: plan.plannedWorkIntervals,
    plannedTotalSeconds: Math.max(plan.plannedTotalSeconds, value.totalSeconds),
  };
}

function normalizeV2WorkoutSession(
  rawValue: Record<string, unknown>,
  value: StoredWorkoutSessionBase,
): WorkoutSession | null {
  const status = rawValue.status === 'completed' || rawValue.status === 'stopped'
    ? rawValue.status
    : null;
  const completedWorkIntervals = nonNegativeInteger(rawValue.completedWorkIntervals);
  const plannedWorkIntervals = nonNegativeInteger(rawValue.plannedWorkIntervals);
  const plannedTotalSeconds = nonNegativeNumber(rawValue.plannedTotalSeconds);
  if (!status
    || completedWorkIntervals === null
    || plannedWorkIntervals === null
    || plannedTotalSeconds === null) return null;

  const derivedMetrics = calculateWorkoutSessionMetrics(value.timerSnapshot, value.totalSeconds);
  if (value.totalSeconds !== derivedMetrics.totalSeconds
    || value.activeWorkSeconds !== derivedMetrics.activeWorkSeconds
    || completedWorkIntervals !== derivedMetrics.completedWorkIntervals
    || plannedWorkIntervals !== derivedMetrics.plannedWorkIntervals
    || plannedTotalSeconds !== derivedMetrics.plannedTotalSeconds
    || (status === 'completed' && value.totalSeconds !== plannedTotalSeconds)) return null;

  return {
    schemaVersion: 2,
    ...storedSessionFields(value),
    status,
    totalSeconds: value.totalSeconds,
    activeWorkSeconds: value.activeWorkSeconds,
    completedWorkIntervals,
    plannedWorkIntervals,
    plannedTotalSeconds,
  };
}

function normalizeWorkoutSession(value: unknown): WorkoutSession | null {
  if (!isRecord(value) || !isStoredWorkoutSessionBase(value)) return null;
  if (value.schemaVersion === 1) return migrateLegacyWorkoutSession(value);
  return normalizeV2WorkoutSession(value, value);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(key: string, amount: number) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function calendarOrdinal(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

function startOfWeekKey(dateOrKey: Date | string) {
  const date = typeof dateOrKey === 'string' ? dateFromKey(dateOrKey) : new Date(dateOrKey);
  date.setHours(12, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return localDateKey(date);
}

function monthKey(dateOrLocalDate: Date | string) {
  const key = typeof dateOrLocalDate === 'string' ? dateOrLocalDate : localDateKey(dateOrLocalDate);
  return key.slice(0, 7);
}

function sumSessions(sessions: WorkoutSession[]): ProgressSummary {
  return {
    totalSeconds: sessions.reduce((sum, session) => sum + session.totalSeconds, 0),
    activeWorkSeconds: sessions.reduce((sum, session) => sum + session.activeWorkSeconds, 0),
    workouts: sessions.length,
    activeDays: new Set(sessions.filter(countsAsActiveDay).map((session) => session.localDate)).size,
  };
}

function countsAsActiveDay(session: WorkoutSession) {
  return session.status === 'completed' || session.completedWorkIntervals > 0;
}

function sessionId(completedAt: Date) {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `workout-${completedAt.getTime()}-${random}`;
}

export function createWorkoutSession(
  timer: WorkoutTimerSnapshot,
  startedAt: Date,
  completedAt = new Date(),
): WorkoutSession {
  const timerSnapshot = boundedTimerSnapshot(timer);
  const plan = workoutPlan(timerSnapshot);
  const metrics = calculateWorkoutSessionMetrics(timerSnapshot, plan.plannedTotalSeconds);

  return {
    schemaVersion: 2,
    id: sessionId(completedAt),
    timerId: timerSnapshot.id,
    timerName: timerSnapshot.name,
    status: 'completed',
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    localDate: localDateKey(completedAt),
    timezoneOffsetMinutes: -completedAt.getTimezoneOffset(),
    ...metrics,
    rounds: timerSnapshot.rounds,
    cycles: timerSnapshot.cycles,
    timerSnapshot,
  };
}

/**
 * Creates a stopped session from the scheduled seconds consumed before stopping.
 * The immutable timer snapshot remains the full plan; the session metrics describe actual progress.
 */
export function createStoppedWorkoutSession(
  timer: WorkoutTimerSnapshot,
  startedAt: Date,
  elapsedSeconds: number,
  stoppedAt = new Date(),
): WorkoutSession {
  const timerSnapshot = boundedTimerSnapshot(timer);
  return {
    schemaVersion: 2,
    id: sessionId(stoppedAt),
    timerId: timerSnapshot.id,
    timerName: timerSnapshot.name,
    status: 'stopped',
    startedAt: startedAt.toISOString(),
    completedAt: stoppedAt.toISOString(),
    localDate: localDateKey(stoppedAt),
    timezoneOffsetMinutes: -stoppedAt.getTimezoneOffset(),
    ...calculateWorkoutSessionMetrics(timerSnapshot, elapsedSeconds),
    rounds: timerSnapshot.rounds,
    cycles: timerSnapshot.cycles,
    timerSnapshot,
  };
}

export function parseWorkoutSessions(value: unknown): WorkoutSession[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(normalizeWorkoutSession)
    .filter((session): session is WorkoutSession => session !== null)
    .filter((session) => {
      if (seen.has(session.id)) return false;
      seen.add(session.id);
      return true;
    })
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));
}

export function summarizeProgress(
  sessions: WorkoutSession[],
  period: ProgressPeriod,
  now = new Date(),
): ProgressSummary {
  const today = localDateKey(now);
  const currentWeek = startOfWeekKey(now);
  const currentMonth = monthKey(now);
  return sumSessions(sessions.filter((session) => {
    if (period === 'day') return session.localDate === today;
    if (period === 'week') return startOfWeekKey(session.localDate) === currentWeek;
    return monthKey(session.localDate) === currentMonth;
  }));
}

function bucketLabel(key: string, period: ProgressPeriod, locale?: string) {
  const date = dateFromKey(period === 'month' ? `${key}-01` : key);
  if (period === 'day') {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).slice(0, 2);
  }
  if (period === 'week') {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
}

export function progressBuckets(
  sessions: WorkoutSession[],
  period: ProgressPeriod,
  now = new Date(),
  locale?: string,
): ProgressBucket[] {
  const today = localDateKey(now);
  const keys: string[] = [];

  if (period === 'day') {
    for (let offset = -6; offset <= 0; offset += 1) keys.push(addDays(today, offset));
  } else if (period === 'week') {
    const currentWeek = startOfWeekKey(now);
    for (let offset = -7; offset <= 0; offset += 1) keys.push(addDays(currentWeek, offset * 7));
  } else {
    for (let offset = -5; offset <= 0; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12);
      keys.push(monthKey(date));
    }
  }

  const currentKey = period === 'day'
    ? today
    : period === 'week'
      ? startOfWeekKey(now)
      : monthKey(now);

  return keys.map((key) => {
    const matching = sessions.filter((session) => {
      if (period === 'day') return session.localDate === key;
      if (period === 'week') return startOfWeekKey(session.localDate) === key;
      return monthKey(session.localDate) === key;
    });
    return {
      key,
      label: bucketLabel(key, period, locale),
      totalSeconds: matching.reduce((sum, session) => sum + session.totalSeconds, 0),
      isCurrent: key === currentKey,
    };
  });
}

function activeDaysByWeek(sessions: WorkoutSession[]) {
  const activeDays = new Map<string, Set<string>>();
  for (const session of sessions.filter(countsAsActiveDay)) {
    const week = startOfWeekKey(session.localDate);
    const days = activeDays.get(week) ?? new Set<string>();
    days.add(session.localDate);
    activeDays.set(week, days);
  }
  return new Map([...activeDays].map(([week, days]) => [week, days.size]));
}

export function calculateProgressStreaks(
  sessions: WorkoutSession[],
  now = new Date(),
  weeklyGoal = DEFAULT_WEEKLY_ACTIVE_DAY_GOAL,
): ProgressStreaks {
  const activeDates = [...new Set(
    sessions.filter(countsAsActiveDay).map((session) => session.localDate),
  )].sort();
  const activeDateSet = new Set(activeDates);
  const today = localDateKey(now);
  const yesterday = addDays(today, -1);
  const activeAnchor = activeDateSet.has(today) ? today : activeDateSet.has(yesterday) ? yesterday : null;

  let currentActiveDays = 0;
  if (activeAnchor) {
    let cursor = activeAnchor;
    while (activeDateSet.has(cursor)) {
      currentActiveDays += 1;
      cursor = addDays(cursor, -1);
    }
  }

  let longestActiveDays = 0;
  let running = 0;
  let previousOrdinal: number | null = null;
  for (const key of activeDates) {
    const ordinal = calendarOrdinal(key);
    running = previousOrdinal !== null && ordinal === previousOrdinal + 1 ? running + 1 : 1;
    longestActiveDays = Math.max(longestActiveDays, running);
    previousOrdinal = ordinal;
  }

  const weeklyCounts = activeDaysByWeek(sessions);
  const currentWeek = startOfWeekKey(now);
  const activeDaysThisWeek = weeklyCounts.get(currentWeek) ?? 0;
  const previousWeek = addDays(currentWeek, -7);
  const weeklyAnchor = activeDaysThisWeek >= weeklyGoal
    ? currentWeek
    : (weeklyCounts.get(previousWeek) ?? 0) >= weeklyGoal
      ? previousWeek
      : null;

  let weeklyGoalStreak = 0;
  if (weeklyAnchor) {
    let cursor = weeklyAnchor;
    while ((weeklyCounts.get(cursor) ?? 0) >= weeklyGoal) {
      weeklyGoalStreak += 1;
      cursor = addDays(cursor, -7);
    }
  }

  const qualifiedWeeks = [...weeklyCounts.entries()]
    .filter(([, count]) => count >= weeklyGoal)
    .map(([week]) => week)
    .sort();
  let longestWeeklyGoalStreak = 0;
  let runningWeeklyGoalStreak = 0;
  let previousWeekOrdinal: number | null = null;
  for (const week of qualifiedWeeks) {
    const ordinal = calendarOrdinal(week);
    runningWeeklyGoalStreak = previousWeekOrdinal !== null && ordinal === previousWeekOrdinal + 7
      ? runningWeeklyGoalStreak + 1
      : 1;
    longestWeeklyGoalStreak = Math.max(longestWeeklyGoalStreak, runningWeeklyGoalStreak);
    previousWeekOrdinal = ordinal;
  }

  return {
    currentActiveDays,
    longestActiveDays,
    weeklyGoal,
    activeDaysThisWeek,
    weeklyGoalStreak,
    longestWeeklyGoalStreak,
  };
}

export function calculateProgressMilestones(
  sessions: WorkoutSession[],
  now = new Date(),
  weeklyGoal = DEFAULT_WEEKLY_ACTIVE_DAY_GOAL,
): ProgressMilestone[] {
  const streaks = calculateProgressStreaks(sessions, now, weeklyGoal);
  const totalSeconds = sessions.reduce((sum, session) => sum + session.totalSeconds, 0);
  const totalHours = totalSeconds / 3600;
  const completedWorkoutCount = sessions.filter((session) => session.status === 'completed').length;

  return [
    {
      id: 'first-workout',
      progress: Math.min(completedWorkoutCount, 1),
      target: 1,
      unlocked: completedWorkoutCount >= 1,
    },
    {
      id: 'ten-workouts',
      progress: Math.min(completedWorkoutCount, 10),
      target: 10,
      unlocked: completedWorkoutCount >= 10,
    },
    {
      id: 'two-goal-weeks',
      progress: Math.min(streaks.longestWeeklyGoalStreak, 2),
      target: 2,
      unlocked: streaks.longestWeeklyGoalStreak >= 2,
    },
    {
      id: 'five-hours',
      progress: Math.min(totalHours, 5),
      target: 5,
      unlocked: totalHours >= 5,
    },
  ];
}

function historyDateLabel(key: string, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(dateFromKey(key));
}

function historyMonthLabel(key: string, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(`${key}-01`));
}

export function groupWorkoutHistory(sessions: WorkoutSession[], locale?: string): WorkoutHistoryMonth[] {
  const monthMap = new Map<string, Map<string, WorkoutSession[]>>();
  for (const session of [...sessions].sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))) {
    const month = monthKey(session.localDate);
    const dayMap = monthMap.get(month) ?? new Map<string, WorkoutSession[]>();
    dayMap.set(session.localDate, [...(dayMap.get(session.localDate) ?? []), session]);
    monthMap.set(month, dayMap);
  }

  return [...monthMap.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, dayMap]) => {
      const days = [...dayMap.entries()]
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([dayKey, daySessions]) => ({
          key: dayKey,
          label: historyDateLabel(dayKey, locale),
          totalSeconds: daySessions.reduce((sum, session) => sum + session.totalSeconds, 0),
          sessions: daySessions,
        }));
      return {
        key,
        label: historyMonthLabel(key, locale),
        totalSeconds: days.reduce((sum, day) => sum + day.totalSeconds, 0),
        days,
      };
    });
}
