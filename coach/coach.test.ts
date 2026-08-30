import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveCoachContext } from './context.ts';
import { createCoachMemory, planCoachIntervention } from './interventions.ts';
import { resolveCoachPersonality } from './personalities.ts';
import type { CoachContext, SystemVoiceLike } from './types.ts';
import { classifyVoice, curateVoices, resolveActiveCoach } from './voices.ts';

const voices: SystemVoiceLike[] = [
  { name: 'Bubbles', voiceURI: 'bubbles', lang: 'en-US' },
  { name: 'Samantha (Enhanced)', voiceURI: 'samantha', lang: 'en-US' },
  { name: 'Daniel', voiceURI: 'daniel', lang: 'en-GB' },
  { name: 'Unknown Natural Voice', voiceURI: 'unknown', lang: 'en-US' },
  { name: 'Amelie', voiceURI: 'amelie', lang: 'fr-FR' },
];

function interventionContext(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    phase: 'work',
    phaseIndex: 8,
    totalPhases: 10,
    round: 4,
    totalRounds: 4,
    cycle: 1,
    totalCycles: 1,
    elapsedInPhase: 12,
    remainingInPhase: 8,
    phaseDuration: 20,
    elapsedWorkout: 100,
    workoutDuration: 120,
    workoutProgress: 0.83,
    isFirstRound: false,
    isFinalRound: true,
    isFinalCycle: true,
    fatigueZone: 'finishing',
    ...overrides,
  };
}

test('derives explicit finishing context from workout state', () => {
  const sequence = [
    { kind: 'prepare' as const, duration: 5, round: 1, cycle: 1 },
    { kind: 'work' as const, duration: 20, round: 1, cycle: 1 },
    { kind: 'rest' as const, duration: 10, round: 1, cycle: 1 },
    { kind: 'work' as const, duration: 20, round: 2, cycle: 1 },
  ];
  const context = deriveCoachContext({
    phase: sequence[3],
    phaseIndex: 3,
    sequence,
    remainingInPhase: 8,
    totalRounds: 2,
    totalCycles: 1,
  });

  assert.equal(context.elapsedWorkout, 47);
  assert.equal(context.isFinalRound, true);
  assert.equal(context.isFinalCycle, true);
  assert.equal(context.fatigueZone, 'finishing');
});

test('curates English voices and classifies known Apple effect voices', () => {
  assert.deepEqual(curateVoices(voices).map(({ voice }) => voice.voiceURI), [
    'bubbles', 'samantha', 'daniel', 'unknown',
  ]);
  assert.equal(classifyVoice(voices[0]).novelty, true);
  assert.deepEqual(classifyVoice(voices[1]), {
    name: 'Samantha', gender: 'female', recommended: true,
  });
});

test('automatic voice selection respects preference and excludes novelty voices', () => {
  const female = resolveActiveCoach({
    voices,
    personality: 'calm',
    preference: 'female',
    selectedVoiceURI: '',
    random: () => 0,
  });
  assert.equal(female.voiceURI, 'samantha');

  const manualOverride = resolveActiveCoach({
    voices,
    personality: 'calm',
    preference: 'female',
    selectedVoiceURI: 'daniel',
    random: () => 0,
  });
  assert.equal(manualOverride.voiceURI, 'daniel');
});

test('automatic selection avoids the previous workout voice when possible', () => {
  const selected = resolveActiveCoach({
    voices,
    personality: 'focused',
    preference: 'either',
    selectedVoiceURI: '',
    previousAutomaticVoiceURI: 'samantha',
    random: () => 0,
  });
  assert.equal(selected.voiceURI, 'daniel');
});

test('surprise personality resolves once to a concrete personality', () => {
  assert.equal(resolveCoachPersonality('surprise', () => 0), 'focused');
  assert.equal(resolveCoachPersonality('surprise', () => 0.999), 'calm');
  assert.equal(resolveCoachPersonality('tough', () => 0), 'tough');
});

test('interventions are considered once per phase and honor cooldown memory', () => {
  const first = planCoachIntervention('tough', interventionContext(), createCoachMemory(), () => 0);
  assert.ok(first.speech);
  assert.equal(first.memory.interventionsThisWorkout, 1);

  const duplicate = planCoachIntervention('tough', interventionContext(), first.memory, () => 0);
  assert.equal(duplicate.speech, undefined);

  const cooldown = planCoachIntervention(
    'tough',
    interventionContext({ phaseIndex: 9, elapsedWorkout: 110 }),
    first.memory,
    () => 0,
  );
  assert.equal(cooldown.speech, undefined);
});

test('challenge intent does not repeat back-to-back', () => {
  const first = planCoachIntervention('energetic', interventionContext(), createCoachMemory(), () => 0);
  assert.equal(first.speech?.intent, 'challenge');

  const next = planCoachIntervention(
    'energetic',
    interventionContext({ phaseIndex: 9, elapsedWorkout: 125 }),
    first.memory,
    () => 0,
  );
  assert.ok(next.speech);
  assert.notEqual(next.speech.intent, 'challenge');
  assert.notEqual(next.speech.id, first.speech?.id);
});
