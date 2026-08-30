import type {
  ProgressBucket,
  ProgressMilestone,
  ProgressPeriod,
  ProgressStreaks,
  ProgressSummary,
  WorkoutHistoryMonth,
  WorkoutSession,
  WorkoutTimerSnapshot,
} from './types.ts';

const DAY_MS = 86_400_000;
export const DEFAULT_WEEKLY_ACTIVE_DAY_GOAL = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTimerSnapshot(value: unknown): value is WorkoutTimerSnapshot {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && isFiniteNumber(value.prepare)
    && isFiniteNumber(value.work)
    && isFiniteNumber(value.rest)
    && isFiniteNumber(value.rounds)
    && isFiniteNumber(value.cycles)
    && isFiniteNumber(value.cycleRest)
    && isFiniteNumber(value.cooldown);
}

function isWorkoutSession(value: unknown): value is WorkoutSession {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1
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
    && isFiniteNumber(value.rounds)
    && isFiniteNumber(value.cycles)
    && isTimerSnapshot(value.timerSnapshot)
    && Number.isFinite(Date.parse(value.startedAt))
    && Number.isFinite(Date.parse(value.completedAt));
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
    activeDays: new Set(sessions.map((session) => session.localDate)).size,
  };
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
  const totalSeconds = timer.prepare
    + timer.work * timer.rounds * timer.cycles
    + timer.rest * Math.max(0, timer.rounds - 1) * timer.cycles
    + timer.cycleRest * Math.max(0, timer.cycles - 1)
    + timer.cooldown;

  return {
    schemaVersion: 1,
    id: sessionId(completedAt),
    timerId: timer.id,
    timerName: timer.name,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    localDate: localDateKey(completedAt),
    timezoneOffsetMinutes: -completedAt.getTimezoneOffset(),
    totalSeconds,
    activeWorkSeconds: timer.work * timer.rounds * timer.cycles,
    rounds: timer.rounds,
    cycles: timer.cycles,
    timerSnapshot: { ...timer },
  };
}

export function parseWorkoutSessions(value: unknown): WorkoutSession[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(isWorkoutSession)
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

function bucketLabel(key: string, period: ProgressPeriod) {
  const date = dateFromKey(period === 'month' ? `${key}-01` : key);
  if (period === 'day') {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date).slice(0, 2);
  }
  if (period === 'week') {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date);
}

export function progressBuckets(
  sessions: WorkoutSession[],
  period: ProgressPeriod,
  now = new Date(),
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
      label: bucketLabel(key, period),
      totalSeconds: matching.reduce((sum, session) => sum + session.totalSeconds, 0),
      isCurrent: key === currentKey,
    };
  });
}

function activeDaysByWeek(sessions: WorkoutSession[]) {
  const activeDays = new Map<string, Set<string>>();
  for (const session of sessions) {
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
  const activeDates = [...new Set(sessions.map((session) => session.localDate))].sort();
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
  const hoursProgressLabel = totalSeconds === 0
    ? '0 / 5 hours'
    : totalHours < 0.1
      ? '<0.1 / 5 hours'
      : `${Math.min(totalHours, 5).toFixed(1)} / 5 hours`;

  return [
    {
      id: 'first-workout',
      title: 'First step',
      description: 'Complete your first workout.',
      progress: Math.min(sessions.length, 1),
      target: 1,
      progressLabel: sessions.length > 0 ? 'Complete' : '0 / 1 workout',
      unlocked: sessions.length >= 1,
    },
    {
      id: 'ten-workouts',
      title: 'Momentum',
      description: 'Complete 10 workouts.',
      progress: Math.min(sessions.length, 10),
      target: 10,
      progressLabel: `${Math.min(sessions.length, 10)} / 10 workouts`,
      unlocked: sessions.length >= 10,
    },
    {
      id: 'two-goal-weeks',
      title: 'In rhythm',
      description: 'Reach your goal two weeks in a row.',
      progress: Math.min(streaks.longestWeeklyGoalStreak, 2),
      target: 2,
      progressLabel: `${Math.min(streaks.longestWeeklyGoalStreak, 2)} / 2 goal weeks`,
      unlocked: streaks.longestWeeklyGoalStreak >= 2,
    },
    {
      id: 'five-hours',
      title: 'Five-hour club',
      description: 'Accumulate five hours of training.',
      progress: Math.min(totalHours, 5),
      target: 5,
      progressLabel: hoursProgressLabel,
      unlocked: totalHours >= 5,
    },
  ];
}

function historyDateLabel(key: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(dateFromKey(key));
}

function historyMonthLabel(key: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(`${key}-01`));
}

export function groupWorkoutHistory(sessions: WorkoutSession[]): WorkoutHistoryMonth[] {
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
          label: historyDateLabel(dayKey),
          totalSeconds: daySessions.reduce((sum, session) => sum + session.totalSeconds, 0),
          sessions: daySessions,
        }));
      return {
        key,
        label: historyMonthLabel(key),
        totalSeconds: days.reduce((sum, day) => sum + day.totalSeconds, 0),
        days,
      };
    });
}
