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

export type WorkoutSession = {
  schemaVersion: 1;
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
