import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateProgressStreaks,
  calculateProgressMilestones,
  calculateWorkoutSessionMetrics,
  createStoppedWorkoutSession,
  createWorkoutSession,
  groupWorkoutHistory,
  parseWorkoutSessions,
  progressBuckets,
  summarizeProgress,
} from './index.ts';
import type { WorkoutSession, WorkoutTimerSnapshot } from './types.ts';

const TIMER: WorkoutTimerSnapshot = {
  id: 'timer-1',
  name: 'Test intervals',
  prepare: 10,
  work: 30,
  rest: 15,
  rounds: 4,
  cycles: 2,
  cycleRest: 60,
  cooldown: 30,
};

function session(
  localDate: string,
  id = localDate,
  overrides: Partial<WorkoutSession> = {},
): WorkoutSession {
  return {
    schemaVersion: 2,
    id,
    timerId: TIMER.id,
    timerName: TIMER.name,
    status: 'completed',
    startedAt: `${localDate}T12:00:00.000Z`,
    completedAt: `${localDate}T12:10:00.000Z`,
    localDate,
    timezoneOffsetMinutes: 0,
    totalSeconds: 600,
    activeWorkSeconds: 240,
    completedWorkIntervals: 8,
    plannedWorkIntervals: 8,
    plannedTotalSeconds: 600,
    rounds: TIMER.rounds,
    cycles: TIMER.cycles,
    timerSnapshot: TIMER,
    ...overrides,
  };
}

test('creates a stable workout snapshot with total and active duration', () => {
  const result = createWorkoutSession(
    TIMER,
    new Date(2026, 7, 30, 10, 0),
    new Date(2026, 7, 30, 10, 6, 10),
  );

  assert.equal(result.localDate, '2026-08-30');
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.totalSeconds, 430);
  assert.equal(result.activeWorkSeconds, 240);
  assert.equal(result.status, 'completed');
  assert.equal(result.completedWorkIntervals, 8);
  assert.equal(result.plannedWorkIntervals, 8);
  assert.equal(result.plannedTotalSeconds, 430);
  assert.deepEqual(result.timerSnapshot, TIMER);
});

test('parses legacy v1 sessions as completed, deduplicates, and sorts them', () => {
  const older = session('2026-08-28', 'same-id');
  const newer = {
    ...session('2026-08-30', 'newer', { totalSeconds: 430, plannedTotalSeconds: 430 }),
    completedAt: '2026-08-30T18:00:00.000Z',
  };
  const legacy: Record<string, unknown> = { ...older, schemaVersion: 1 };
  delete legacy.status;
  delete legacy.completedWorkIntervals;
  delete legacy.plannedWorkIntervals;
  delete legacy.plannedTotalSeconds;
  const parsed = parseWorkoutSessions([legacy, legacy, { nope: true }, newer]);

  assert.deepEqual(parsed.map(({ id }) => id), ['newer', 'same-id']);
  const parsedLegacy = parsed.find(({ id }) => id === 'same-id');
  assert.equal(parsedLegacy?.schemaVersion, 2);
  assert.equal(parsedLegacy?.status, 'completed');
  assert.equal(parsedLegacy?.completedWorkIntervals, 8);
  assert.equal(parsedLegacy?.plannedWorkIntervals, 8);
  assert.equal(parsedLegacy?.plannedTotalSeconds, 600);
});

test('parses stopped sessions with their actual metrics and rejects unknown statuses', () => {
  const stopped = session('2026-08-30', 'stopped', {
    status: 'stopped',
    totalSeconds: 110,
    activeWorkSeconds: 70,
    completedWorkIntervals: 2,
    plannedWorkIntervals: 8,
    plannedTotalSeconds: 430,
  });
  const parsed = parseWorkoutSessions([stopped, { ...stopped, id: 'invalid', status: 'paused' }]);

  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], stopped);
});

test('creates a stopped session with actual progress while preserving the full plan', () => {
  const metrics = calculateWorkoutSessionMetrics(TIMER, 110);
  const result = createStoppedWorkoutSession(
    TIMER,
    new Date(2026, 7, 30, 10, 0),
    110,
    new Date(2026, 7, 30, 10, 4),
  );

  assert.deepEqual(metrics, {
    totalSeconds: 110,
    activeWorkSeconds: 70,
    completedWorkIntervals: 2,
    plannedWorkIntervals: 8,
    plannedTotalSeconds: 430,
  });
  assert.equal(result.status, 'stopped');
  assert.equal(result.schemaVersion, 2);
  assert.deepEqual({
    totalSeconds: result.totalSeconds,
    activeWorkSeconds: result.activeWorkSeconds,
    completedWorkIntervals: result.completedWorkIntervals,
    plannedWorkIntervals: result.plannedWorkIntervals,
    plannedTotalSeconds: result.plannedTotalSeconds,
  }, metrics);
  assert.equal(result.rounds, TIMER.rounds);
  assert.equal(result.cycles, TIMER.cycles);
  assert.deepEqual(result.timerSnapshot, TIMER);
});

test('calculates partial metrics at every phase boundary and clamps elapsed time', () => {
  const boundaryTimer: WorkoutTimerSnapshot = {
    ...TIMER,
    prepare: 2,
    work: 3,
    rest: 2,
    rounds: 2,
    cycles: 2,
    cycleRest: 4,
    cooldown: 5,
  };
  const cases = [
    { label: 'before prepare', elapsed: -1, total: 0, active: 0, completed: 0 },
    { label: 'inside prepare', elapsed: 1, total: 1, active: 0, completed: 0 },
    { label: 'at end of prepare', elapsed: 2, total: 2, active: 0, completed: 0 },
    { label: 'inside first work', elapsed: 3, total: 3, active: 1, completed: 0 },
    { label: 'at end of first work', elapsed: 5, total: 5, active: 3, completed: 1 },
    { label: 'inside first rest', elapsed: 6, total: 6, active: 3, completed: 1 },
    { label: 'at end of first rest', elapsed: 7, total: 7, active: 3, completed: 1 },
    { label: 'inside second work', elapsed: 8, total: 8, active: 4, completed: 1 },
    { label: 'at end of first cycle', elapsed: 10, total: 10, active: 6, completed: 2 },
    { label: 'inside cycle rest', elapsed: 11, total: 11, active: 6, completed: 2 },
    { label: 'at start of second cycle', elapsed: 14, total: 14, active: 6, completed: 2 },
    { label: 'inside second cycle work', elapsed: 15, total: 15, active: 7, completed: 2 },
    { label: 'after first work in second cycle', elapsed: 17, total: 17, active: 9, completed: 3 },
    { label: 'inside second cycle rest', elapsed: 18, total: 18, active: 9, completed: 3 },
    { label: 'at final work start', elapsed: 19, total: 19, active: 9, completed: 3 },
    { label: 'at end of final work', elapsed: 22, total: 22, active: 12, completed: 4 },
    { label: 'inside cooldown', elapsed: 23, total: 23, active: 12, completed: 4 },
    { label: 'at end of cooldown', elapsed: 27, total: 27, active: 12, completed: 4 },
    { label: 'after planned finish', elapsed: 999, total: 27, active: 12, completed: 4 },
  ];

  for (const current of cases) {
    assert.deepEqual(calculateWorkoutSessionMetrics(boundaryTimer, current.elapsed), {
      totalSeconds: current.total,
      activeWorkSeconds: current.active,
      completedWorkIntervals: current.completed,
      plannedWorkIntervals: 4,
      plannedTotalSeconds: 27,
    }, current.label);
  }
});

test('calculates adjacent work intervals when every optional phase is zero', () => {
  const workOnlyTimer: WorkoutTimerSnapshot = {
    ...TIMER,
    prepare: 0,
    work: 3,
    rest: 0,
    rounds: 2,
    cycles: 2,
    cycleRest: 0,
    cooldown: 0,
  };
  const cases = [
    { elapsed: 0, active: 0, completed: 0 },
    { elapsed: 2, active: 2, completed: 0 },
    { elapsed: 3, active: 3, completed: 1 },
    { elapsed: 6, active: 6, completed: 2 },
    { elapsed: 9, active: 9, completed: 3 },
    { elapsed: 12, active: 12, completed: 4 },
    { elapsed: 50, active: 12, completed: 4 },
  ];

  for (const current of cases) {
    assert.deepEqual(calculateWorkoutSessionMetrics(workOnlyTimer, current.elapsed), {
      totalSeconds: Math.min(current.elapsed, 12),
      activeWorkSeconds: current.active,
      completedWorkIntervals: current.completed,
      plannedWorkIntervals: 4,
      plannedTotalSeconds: 12,
    });
  }
});

test('rejects stored sessions with corrupt or unsupported timer snapshots', () => {
  const valid = createWorkoutSession(
    TIMER,
    new Date('2026-08-30T12:00:00.000Z'),
    new Date('2026-08-30T12:10:00.000Z'),
  );
  const corruptSnapshots: Array<{ label: string; patch: Partial<WorkoutTimerSnapshot> }> = [
    { label: 'fractional rounds', patch: { rounds: 1.5 } },
    { label: 'too many rounds', patch: { rounds: 1_000_000 } },
    { label: 'too many cycles', patch: { cycles: 21 } },
    { label: 'prepare above UI maximum', patch: { prepare: 601 } },
    { label: 'work below UI minimum', patch: { work: 0 } },
    { label: 'rest above UI maximum', patch: { rest: 3601 } },
    { label: 'negative cycle rest', patch: { cycleRest: -1 } },
    { label: 'non-finite cooldown', patch: { cooldown: Number.POSITIVE_INFINITY } },
  ];

  for (const { label, patch } of corruptSnapshots) {
    const timerSnapshot = { ...valid.timerSnapshot, ...patch };
    const candidate = {
      ...valid,
      id: `corrupt-${label}`,
      rounds: timerSnapshot.rounds,
      cycles: timerSnapshot.cycles,
      timerSnapshot,
    };
    assert.deepEqual(parseWorkoutSessions([candidate]), [], label);
  }
});

test('bounds unsafe runtime timer values before constructing a workout plan', () => {
  const unsafeTimer = {
    ...TIMER,
    prepare: 10_000,
    work: 10_000,
    rest: 10_000,
    rounds: 1_000_000,
    cycles: 1_000_000,
    cycleRest: 10_000,
    cooldown: 10_000,
  };
  const result = calculateWorkoutSessionMetrics(unsafeTimer, Number.POSITIVE_INFINITY);

  assert.equal(result.plannedWorkIntervals, 99 * 20);
  assert.equal(result.plannedTotalSeconds, 14_256_600);
  assert.equal(result.totalSeconds, 0);
});

test('summarizes the current day, week, and month from session records', () => {
  const sessions = [
    session('2026-08-30', 'today-a'),
    session('2026-08-30', 'today-b'),
    session('2026-08-25', 'week'),
    session('2026-08-20', 'month'),
    session('2026-07-31', 'older'),
  ];
  const now = new Date(2026, 7, 30, 12);

  assert.deepEqual(summarizeProgress(sessions, 'day', now), {
    totalSeconds: 1200,
    activeWorkSeconds: 480,
    workouts: 2,
    activeDays: 1,
  });
  assert.equal(summarizeProgress(sessions, 'week', now).workouts, 3);
  assert.equal(summarizeProgress(sessions, 'month', now).workouts, 4);
});

test('includes stopped-session time in summaries but requires completed work for an active day', () => {
  const sessions = [
    session('2026-08-30', 'completed', { completedWorkIntervals: 0 }),
    session('2026-08-30', 'stopped-before-work', {
      status: 'stopped',
      totalSeconds: 10,
      activeWorkSeconds: 0,
      completedWorkIntervals: 0,
    }),
    session('2026-08-29', 'stopped-after-work', {
      status: 'stopped',
      totalSeconds: 40,
      activeWorkSeconds: 30,
      completedWorkIntervals: 1,
    }),
  ];

  assert.deepEqual(summarizeProgress(sessions, 'week', new Date(2026, 7, 30, 12)), {
    totalSeconds: 650,
    activeWorkSeconds: 270,
    workouts: 3,
    activeDays: 2,
  });
});

test('keeps an active-day streak alive through yesterday and tracks weekly goals', () => {
  const sessions = [
    session('2026-08-29', 'day-29'),
    session('2026-08-29', 'day-29-second-workout'),
    session('2026-08-28', 'day-28'),
    session('2026-08-27', 'day-27'),
    session('2026-08-23', 'week-1a'),
    session('2026-08-22', 'week-1b'),
    session('2026-08-21', 'week-1c'),
  ];
  const streaks = calculateProgressStreaks(sessions, new Date(2026, 7, 30, 12), 3);

  assert.equal(streaks.currentActiveDays, 3);
  assert.equal(streaks.longestActiveDays, 3);
  assert.equal(streaks.activeDaysThisWeek, 3);
  assert.equal(streaks.weeklyGoalStreak, 2);
  assert.equal(streaks.longestWeeklyGoalStreak, 2);
});

test('counts a stopped session toward streaks only after one complete work interval', () => {
  const sessions = [
    session('2026-08-27', 'completed-without-count', { completedWorkIntervals: 0 }),
    session('2026-08-28', 'qualified-stop', {
      status: 'stopped',
      completedWorkIntervals: 1,
    }),
    session('2026-08-29', 'unqualified-stop', {
      status: 'stopped',
      completedWorkIntervals: 0,
    }),
  ];
  const streaks = calculateProgressStreaks(sessions, new Date(2026, 7, 29, 12), 3);

  assert.equal(streaks.currentActiveDays, 2);
  assert.equal(streaks.longestActiveDays, 2);
  assert.equal(streaks.activeDaysThisWeek, 2);
});

test('tracks milestone progress from durable workout history', () => {
  const sessions = [
    session('2026-08-30', 'current-a'),
    session('2026-08-29', 'current-b'),
    session('2026-08-28', 'current-c'),
    session('2026-08-23', 'previous-a'),
    session('2026-08-22', 'previous-b'),
    session('2026-08-21', 'previous-c'),
    session('2026-08-20', 'extra-a'),
    session('2026-08-19', 'extra-b'),
    session('2026-08-18', 'extra-c'),
    session('2026-08-17', 'extra-d'),
  ];
  const milestones = calculateProgressMilestones(sessions, new Date(2026, 7, 30, 12), 3);

  assert.deepEqual(milestones.map(({ id, unlocked }) => [id, unlocked]), [
    ['first-workout', true],
    ['ten-workouts', true],
    ['two-goal-weeks', true],
    ['five-hours', false],
  ]);
  assert.equal(milestones.find(({ id }) => id === 'five-hours')?.progress.toFixed(1), '1.7');
});

test('uses completed sessions for quantity milestones and all actual time for hours', () => {
  const stoppedSessions = Array.from({ length: 10 }, (_, index) => session(
    '2026-08-30',
    `stopped-${index}`,
    {
      status: 'stopped',
      totalSeconds: 1800,
      activeWorkSeconds: 900,
      completedWorkIntervals: 1,
      plannedTotalSeconds: 2400,
    },
  ));
  const milestones = calculateProgressMilestones(stoppedSessions, new Date(2026, 7, 30, 12), 3);

  assert.deepEqual(milestones.map(({ id, unlocked }) => [id, unlocked]), [
    ['first-workout', false],
    ['ten-workouts', false],
    ['two-goal-weeks', false],
    ['five-hours', true],
  ]);
  assert.equal(milestones.find(({ id }) => id === 'five-hours')?.progress, 5);
});

test('builds chart buckets and reverse-chronological history groups', () => {
  const sessions = [
    session('2026-08-30', 'aug-30'),
    session('2026-08-30', 'aug-30-stopped', {
      status: 'stopped',
      totalSeconds: 40,
      activeWorkSeconds: 30,
      completedWorkIntervals: 1,
    }),
    session('2026-08-29', 'aug-29'),
    session('2026-07-31', 'jul-31'),
  ];
  const buckets = progressBuckets(sessions, 'day', new Date(2026, 7, 30, 12));
  const history = groupWorkoutHistory(sessions);

  assert.equal(buckets.length, 7);
  assert.equal(buckets.at(-1)?.totalSeconds, 640);
  assert.deepEqual(history.map(({ key }) => key), ['2026-08', '2026-07']);
  assert.deepEqual(history[0].days.map(({ key }) => key), ['2026-08-30', '2026-08-29']);
  assert.equal(history[0].days[0].totalSeconds, 640);
  assert.equal(history[0].days[0].sessions.some(({ status }) => status === 'stopped'), true);
});

test('formats chart and history dates with an explicit product locale', () => {
  const sessions = [session('2026-08-30', 'aug-30')];
  const now = new Date(2026, 7, 30, 12);
  const spanishBuckets = progressBuckets(sessions, 'month', now, 'es-AR');
  const portugueseHistory = groupWorkoutHistory(sessions, 'pt-BR');

  assert.match(spanishBuckets.at(-1)?.label ?? '', /ago/i);
  assert.match(portugueseHistory[0]?.label ?? '', /agosto/i);
});
