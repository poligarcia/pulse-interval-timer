import { COACH_PERSONALITIES, makeCoachSpeech } from './personalities.ts';
import type {
  CoachContext,
  CoachIntent,
  CoachMemory,
  CoachPersonalityId,
  CoachPhrase,
  CoachSpeech,
  FatigueZone,
} from './types.ts';

const RECENT_PHRASE_LIMIT = 5;
const BASE_COOLDOWN_SECONDS = 22;

export function createCoachMemory(): CoachMemory {
  return {
    recentPhraseIds: [],
    consideredPhaseKeys: [],
    lastInterventionAt: null,
    interventionsThisWorkout: 0,
  };
}

export function getInterventionProbability(context: CoachContext) {
  const baseByZone: Record<FatigueZone, number> = {
    fresh: 0.16,
    settled: 0.3,
    challenging: 0.46,
    finishing: 0.72,
  };
  const finalRoundBoost = context.isFinalRound ? 0.07 : 0;
  const finalCycleBoost = context.isFinalCycle && context.totalCycles > 1 ? 0.05 : 0;
  return Math.min(0.86, baseByZone[context.fatigueZone] + finalRoundBoost + finalCycleBoost);
}

export function isInterventionWindow(context: CoachContext) {
  if (context.phase !== 'work' || context.phaseDuration < 10 || context.remainingInPhase <= 4) return false;
  const targetElapsed = Math.max(4, Math.min(10, Math.ceil(context.phaseDuration * 0.42)));
  return context.elapsedInPhase >= targetElapsed;
}

export function selectCoachIntent(
  context: CoachContext,
  memory: CoachMemory,
  randomValue: number,
): CoachIntent {
  if (context.fatigueZone === 'fresh') return randomValue < 0.62 ? 'neutral' : 'encourage';
  if (context.fatigueZone === 'settled') return randomValue < 0.22 ? 'acknowledge' : 'encourage';
  if (memory.lastIntent === 'challenge') return randomValue < 0.25 ? 'acknowledge' : 'encourage';
  if (context.fatigueZone === 'finishing') return randomValue < 0.68 ? 'challenge' : 'encourage';
  return randomValue < 0.42 ? 'challenge' : 'encourage';
}

function choosePhrase(
  personalityId: CoachPersonalityId,
  context: CoachContext,
  intent: CoachIntent,
  recentPhraseIds: string[],
  randomValue: number,
): CoachPhrase {
  const phrases = COACH_PERSONALITIES[personalityId].phrases;
  const forZone = phrases.filter((phrase) => phrase.zones.includes(context.fatigueZone));
  const forIntent = forZone.filter((phrase) => phrase.intent === intent);
  const safeFallback = intent === 'challenge'
    ? forZone
    : forZone.filter((phrase) => phrase.intent !== 'challenge');
  const preferred = forIntent.length > 0 ? forIntent : safeFallback.length > 0 ? safeFallback : forZone;
  const unrepeated = preferred.filter((phrase) => !recentPhraseIds.includes(phrase.id));
  const pool = unrepeated.length > 0 ? unrepeated : preferred;
  return pool[Math.min(pool.length - 1, Math.floor(randomValue * pool.length))];
}

type InterventionPlan = {
  memory: CoachMemory;
  speech?: CoachSpeech;
};

export function planCoachIntervention(
  personalityId: CoachPersonalityId,
  context: CoachContext,
  memory: CoachMemory,
  random: () => number = Math.random,
): InterventionPlan {
  if (!isInterventionWindow(context)) return { memory };

  const phaseKey = `${context.phaseIndex}:${context.phase}`;
  if (memory.consideredPhaseKeys.includes(phaseKey)) return { memory };

  const consideredMemory: CoachMemory = {
    ...memory,
    consideredPhaseKeys: [...memory.consideredPhaseKeys, phaseKey],
  };
  const cooldown = context.fatigueZone === 'finishing' ? 18 : BASE_COOLDOWN_SECONDS;
  if (memory.lastInterventionAt !== null && context.elapsedWorkout - memory.lastInterventionAt < cooldown) {
    return { memory: consideredMemory };
  }

  const maxInterventions = Math.min(8, Math.max(2, Math.ceil(context.workoutDuration / 75)));
  if (memory.interventionsThisWorkout >= maxInterventions || random() >= getInterventionProbability(context)) {
    return { memory: consideredMemory };
  }

  const intent = selectCoachIntent(context, memory, random());
  const phrase = choosePhrase(personalityId, context, intent, memory.recentPhraseIds, random());
  const speech = makeCoachSpeech(
    personalityId,
    phrase.id,
    phrase.text,
    'contextual',
    phrase.intent,
    phrase.rateOffset,
    phrase.pitchOffset,
  );

  return {
    speech,
    memory: {
      ...consideredMemory,
      recentPhraseIds: [...memory.recentPhraseIds, phrase.id].slice(-RECENT_PHRASE_LIMIT),
      lastInterventionAt: context.elapsedWorkout,
      interventionsThisWorkout: memory.interventionsThisWorkout + 1,
      lastIntent: phrase.intent,
    },
  };
}
