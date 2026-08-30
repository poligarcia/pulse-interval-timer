import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateProgressStreaks,
  calculateProgressMilestones,
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

function session(localDate: string, id = localDate): WorkoutSession {
  return {
    schemaVersion: 1,
    id,
    timerId: TIMER.id,
    timerName: TIMER.name,
    startedAt: `${localDate}T12:00:00.000Z`,
    completedAt: `${localDate}T12:10:00.000Z`,
    localDate,
    timezoneOffsetMinutes: 0,
    totalSeconds: 600,
    activeWorkSeconds: 240,
    rounds: TIMER.rounds,
    cycles: TIMER.cycles,
    timerSnapshot: TIMER,
  };
}

test('creates a stable workout snapshot with total and active duration', () => {
  const result = createWorkoutSession(
    TIMER,
    new Date(2026, 7, 30, 10, 0),
    new Date(2026, 7, 30, 10, 6, 10),
  );

  assert.equal(result.localDate, '2026-08-30');
  assert.equal(result.totalSeconds, 430);
  assert.equal(result.activeWorkSeconds, 240);
  assert.deepEqual(result.timerSnapshot, TIMER);
});

test('parses, deduplicates, and sorts valid stored sessions', () => {
  const older = session('2026-08-28', 'same-id');
  const newer = { ...session('2026-08-30', 'newer'), completedAt: '2026-08-30T18:00:00.000Z' };
  const parsed = parseWorkoutSessions([older, older, { nope: true }, newer]);

  assert.deepEqual(parsed.map(({ id }) => id), ['newer', 'same-id']);
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

test('keeps an active-day streak alive through yesterday and tracks weekly goals', () => {
  const sessions = [
    session('2026-08-29', 'day-29'),
    session('2026-08-28', 'day-28'),
    session('2026-08-27', 'day-27'),
    session('2026-08-23', 'week-1a'),
    session('2026-08-22', 'week-1b'),
    session('2026-08-21', 'week-1c'),
  ];
  const streaks = calculateProgressStreaks(sessions, new Date(2026, 7, 30, 12), 3);

  assert.equal(streaks.currentActiveDays, 3);
  assert.equal(streaks.longestActiveDays, 3);
  assert.equal(streaks.workoutsThisWeek, 3);
  assert.equal(streaks.weeklyGoalStreak, 2);
  assert.equal(streaks.longestWeeklyGoalStreak, 2);
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
  assert.equal(milestones.find(({ id }) => id === 'five-hours')?.progressLabel, '1.7 / 5 hours');
});

test('builds chart buckets and reverse-chronological history groups', () => {
  const sessions = [
    session('2026-08-30', 'aug-30'),
    session('2026-08-29', 'aug-29'),
    session('2026-07-31', 'jul-31'),
  ];
  const buckets = progressBuckets(sessions, 'day', new Date(2026, 7, 30, 12));
  const history = groupWorkoutHistory(sessions);

  assert.equal(buckets.length, 7);
  assert.equal(buckets.at(-1)?.totalSeconds, 600);
  assert.deepEqual(history.map(({ key }) => key), ['2026-08', '2026-07']);
  assert.deepEqual(history[0].days.map(({ key }) => key), ['2026-08-30', '2026-08-29']);
});
