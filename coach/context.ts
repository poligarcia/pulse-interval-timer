import type { CoachContext, CoachPhase, FatigueZone } from './types.ts';

type ContextInput = {
  phase: CoachPhase;
  phaseIndex: number;
  sequence: CoachPhase[];
  remainingInPhase: number;
  totalRounds: number;
  totalCycles: number;
};

function getFatigueZone(
  workoutProgress: number,
  isFinalRound: boolean,
  isFinalCycle: boolean,
  phase: CoachPhase['kind'],
): FatigueZone {
  if ((phase === 'work' && isFinalRound && isFinalCycle) || workoutProgress >= 0.88) return 'finishing';
  if (workoutProgress >= 0.62 || (isFinalCycle && workoutProgress >= 0.5)) return 'challenging';
  if (workoutProgress >= 0.24) return 'settled';
  return 'fresh';
}

export function deriveCoachContext({
  phase,
  phaseIndex,
  sequence,
  remainingInPhase,
  totalRounds,
  totalCycles,
}: ContextInput): CoachContext {
  const safeRemaining = Math.min(phase.duration, Math.max(0, remainingInPhase));
  const elapsedInPhase = Math.max(0, phase.duration - safeRemaining);
  const completedDuration = sequence
    .slice(0, phaseIndex)
    .reduce((total, item) => total + item.duration, 0);
  const workoutDuration = sequence.reduce((total, item) => total + item.duration, 0);
  const elapsedWorkout = completedDuration + elapsedInPhase;
  const workoutProgress = workoutDuration > 0
    ? Math.min(1, Math.max(0, elapsedWorkout / workoutDuration))
    : 1;
  const isFinalRound = phase.round === totalRounds;
  const isFinalCycle = phase.cycle === totalCycles;

  return {
    phase: phase.kind,
    phaseIndex,
    totalPhases: sequence.length,
    round: phase.round,
    totalRounds,
    cycle: phase.cycle,
    totalCycles,
    elapsedInPhase,
    remainingInPhase: safeRemaining,
    phaseDuration: phase.duration,
    elapsedWorkout,
    workoutDuration,
    workoutProgress,
    isFirstRound: phase.round === 1 && phase.cycle === 1,
    isFinalRound,
    isFinalCycle,
    fatigueZone: getFatigueZone(workoutProgress, isFinalRound, isFinalCycle, phase.kind),
  };
}
