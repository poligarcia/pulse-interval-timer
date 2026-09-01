export type WorkoutTimerSnapshot = {
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

export type WorkoutSessionStatus = 'completed' | 'stopped';

export type WorkoutSessionMetrics = {
  /** Scheduled workout time that was actually consumed, excluding time spent paused. */
  totalSeconds: number;
  /** Time actually consumed inside work intervals, including a partially completed interval. */
  activeWorkSeconds: number;
  completedWorkIntervals: number;
  plannedWorkIntervals: number;
  plannedTotalSeconds: number;
};

export type WorkoutSession = WorkoutSessionMetrics & {
  schemaVersion: 2;
  id: string;
  timerId: string;
  timerName: string;
  status: WorkoutSessionStatus;
  startedAt: string;
  completedAt: string;
  localDate: string;
  timezoneOffsetMinutes: number;
  rounds: number;
  cycles: number;
  timerSnapshot: WorkoutTimerSnapshot;
};

export type ProgressPeriod = 'day' | 'week' | 'month';

export type ProgressSummary = {
  totalSeconds: number;
  activeWorkSeconds: number;
  workouts: number;
  activeDays: number;
};

export type ProgressBucket = {
  key: string;
  label: string;
  totalSeconds: number;
  isCurrent: boolean;
};

export type ProgressStreaks = {
  currentActiveDays: number;
  longestActiveDays: number;
  weeklyGoal: number;
  activeDaysThisWeek: number;
  weeklyGoalStreak: number;
  longestWeeklyGoalStreak: number;
};

export type ProgressMilestoneId = 'first-workout' | 'ten-workouts' | 'two-goal-weeks' | 'five-hours';

export type ProgressMilestone = {
  id: ProgressMilestoneId;
  progress: number;
  target: number;
  unlocked: boolean;
};

export type WorkoutHistoryDay = {
  key: string;
  label: string;
  totalSeconds: number;
  sessions: WorkoutSession[];
};

export type WorkoutHistoryMonth = {
  key: string;
  label: string;
  totalSeconds: number;
  days: WorkoutHistoryDay[];
};
