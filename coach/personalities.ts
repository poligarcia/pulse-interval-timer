import type {
  CoachContext,
  CoachIntent,
  CoachPersonalityId,
  CoachPersonalityPreference,
  CoachPhrase,
  CoachSpeech,
  PhaseKind,
  SpeechDelivery,
} from './types.ts';

type CoachPersonality = {
  id: CoachPersonalityId;
  label: string;
  description: string;
  rate: number;
  pitch: number;
  phaseCues: Record<PhaseKind | 'complete' | 'finalWork', string[]>;
  phrases: CoachPhrase[];
};

const ZONES = {
  early: ['fresh'] as const,
  middle: ['settled'] as const,
  demanding: ['challenging'] as const,
  final: ['finishing'] as const,
};

export const COACH_PERSONALITIES: Record<CoachPersonalityId, CoachPersonality> = {
  focused: {
    id: 'focused',
    label: 'Focused',
    description: 'Precise, concise, and steady',
    rate: 1.04,
    pitch: 1,
    phaseCues: {
      prepare: ['Prepare.'],
      work: ['Start.', 'Work.'],
      finalWork: ['Final round. Start.'],
      rest: ['Rest.', 'Recover.'],
      cycleRest: ['Cycle rest. Reset.'],
      cooldown: ['Cool down.'],
      complete: ['Workout complete.'],
    },
    phrases: [
      { id: 'focused-find-pace', text: 'Find your pace.', intent: 'neutral', zones: [...ZONES.early] },
      { id: 'focused-controlled', text: 'Nice and controlled.', intent: 'acknowledge', zones: [...ZONES.early] },
      { id: 'focused-settle', text: 'Settle into it.', intent: 'encourage', zones: [...ZONES.early] },
      { id: 'focused-consistent', text: 'Stay consistent.', intent: 'encourage', zones: [...ZONES.middle] },
      { id: 'focused-rhythm', text: 'Keep the rhythm.', intent: 'neutral', zones: [...ZONES.middle] },
      { id: 'focused-hold', text: 'Good. Hold that.', intent: 'acknowledge', zones: [...ZONES.middle] },
      { id: 'focused-pace-slip', text: 'Don\'t let the pace slip.', intent: 'challenge', zones: [...ZONES.demanding], rateOffset: 0.02 },
      { id: 'focused-keep-working', text: 'Keep working.', intent: 'encourage', zones: [...ZONES.demanding] },
      { id: 'focused-stay-with-it', text: 'Stay with it.', intent: 'encourage', zones: [...ZONES.demanding] },
      { id: 'focused-finish-round', text: 'Finish the round.', intent: 'challenge', zones: [...ZONES.final], rateOffset: 0.03 },
      { id: 'focused-last-seconds', text: 'Last few seconds. Hold it.', intent: 'encourage', zones: [...ZONES.final] },
      { id: 'focused-no-save', text: 'Don\'t save it now.', intent: 'challenge', zones: [...ZONES.final], rateOffset: 0.04 },
    ],
  },
  energetic: {
    id: 'energetic',
    label: 'Energetic',
    description: 'Upbeat, responsive, and positive',
    rate: 1.14,
    pitch: 1.04,
    phaseCues: {
      prepare: ['Get ready!'],
      work: ['Go!', 'Let\'s go!'],
      finalWork: ['Last one. Go!'],
      rest: ['Recover.', 'Take the rest.'],
      cycleRest: ['Cycle rest. Reset.'],
      cooldown: ['Cool down. Breathe.'],
      complete: ['Workout complete. Nice work!'],
    },
    phrases: [
      { id: 'energetic-find-rhythm', text: 'Find your rhythm.', intent: 'neutral', zones: [...ZONES.early], rateOffset: -0.02 },
      { id: 'energetic-controlled', text: 'Smooth and controlled.', intent: 'acknowledge', zones: [...ZONES.early], rateOffset: -0.03 },
      { id: 'energetic-set-pace', text: 'Set the pace. You\'ve got this.', intent: 'encourage', zones: [...ZONES.early] },
      { id: 'energetic-stay-me', text: 'Stay with me!', intent: 'encourage', zones: [...ZONES.middle] },
      { id: 'energetic-rhythm', text: 'That\'s it. Keep the rhythm!', intent: 'acknowledge', zones: [...ZONES.middle] },
      { id: 'energetic-keep-moving', text: 'Keep moving!', intent: 'encourage', zones: [...ZONES.middle] },
      { id: 'energetic-work', text: 'Keep working!', intent: 'encourage', zones: [...ZONES.demanding] },
      { id: 'energetic-dont-drop', text: 'Stay with it. Don\'t drop the pace!', intent: 'challenge', zones: [...ZONES.demanding], rateOffset: 0.02 },
      { id: 'energetic-now', text: 'This is the work. Stay with me!', intent: 'encourage', zones: [...ZONES.demanding] },
      { id: 'energetic-everything', text: 'Last one! Give me everything!', intent: 'challenge', zones: [...ZONES.final], rateOffset: 0.03, pitchOffset: 0.01 },
      { id: 'energetic-finish', text: 'Finish strong. Let\'s go!', intent: 'challenge', zones: [...ZONES.final], rateOffset: 0.03 },
      { id: 'energetic-hold', text: 'Last few seconds. Hold it!', intent: 'encourage', zones: [...ZONES.final] },
    ],
  },
  tough: {
    id: 'tough',
    label: 'Tough',
    description: 'Direct, demanding, and composed',
    rate: 1.07,
    pitch: 0.96,
    phaseCues: {
      prepare: ['Get ready.'],
      work: ['Go.', 'Work.'],
      finalWork: ['Last round. Go.'],
      rest: ['Rest.', 'Recover.'],
      cycleRest: ['Cycle rest. Reset.'],
      cooldown: ['Cool down.'],
      complete: ['Workout complete. Work done.'],
    },
    phrases: [
      { id: 'tough-control', text: 'Control the pace.', intent: 'neutral', zones: [...ZONES.early], rateOffset: -0.02 },
      { id: 'tough-settle', text: 'Settle in. Keep working.', intent: 'encourage', zones: [...ZONES.early] },
      { id: 'tough-no-rush', text: 'No rush. No wasted effort.', intent: 'neutral', zones: [...ZONES.early], rateOffset: -0.02 },
      { id: 'tough-consistent', text: 'Stay consistent.', intent: 'encourage', zones: [...ZONES.middle] },
      { id: 'tough-standard', text: 'Hold the standard.', intent: 'challenge', zones: [...ZONES.middle] },
      { id: 'tough-good-work', text: 'Good. Keep working.', intent: 'acknowledge', zones: [...ZONES.middle] },
      { id: 'tough-coast', text: 'Don\'t coast now.', intent: 'challenge', zones: [...ZONES.demanding], rateOffset: 0.02 },
      { id: 'tough-hard', text: 'This is where it gets hard. Keep working.', intent: 'challenge', zones: [...ZONES.demanding] },
      { id: 'tough-stay', text: 'Stay with it.', intent: 'encourage', zones: [...ZONES.demanding] },
      { id: 'tough-started', text: 'Finish what you started.', intent: 'challenge', zones: [...ZONES.final], rateOffset: 0.02 },
      { id: 'tough-give-away', text: 'Don\'t give away these last seconds.', intent: 'challenge', zones: [...ZONES.final], rateOffset: 0.03 },
      { id: 'tough-finish-round', text: 'Finish the round.', intent: 'encourage', zones: [...ZONES.final] },
    ],
  },
  calm: {
    id: 'calm',
    label: 'Calm',
    description: 'Measured, grounded, and supportive',
    rate: 0.95,
    pitch: 1,
    phaseCues: {
      prepare: ['Prepare.'],
      work: ['Begin.', 'Start.'],
      finalWork: ['Final round. Begin.'],
      rest: ['Rest.', 'Recover.'],
      cycleRest: ['Cycle rest. Reset.'],
      cooldown: ['Cool down. Breathe.'],
      complete: ['Workout complete. Take a breath.'],
    },
    phrases: [
      { id: 'calm-rhythm', text: 'Find your rhythm.', intent: 'neutral', zones: [...ZONES.early], rateOffset: -0.02 },
      { id: 'calm-controlled', text: 'Stay smooth and controlled.', intent: 'encourage', zones: [...ZONES.early] },
      { id: 'calm-settle', text: 'Settle into the effort.', intent: 'neutral', zones: [...ZONES.early] },
      { id: 'calm-steady', text: 'Stay steady.', intent: 'encourage', zones: [...ZONES.middle] },
      { id: 'calm-pace', text: 'Keep the pace.', intent: 'neutral', zones: [...ZONES.middle] },
      { id: 'calm-hold', text: 'Good. Hold that rhythm.', intent: 'acknowledge', zones: [...ZONES.middle] },
      { id: 'calm-present', text: 'Stay present. Keep working.', intent: 'encourage', zones: [...ZONES.demanding] },
      { id: 'calm-dont-slip', text: 'Don\'t let the rhythm slip.', intent: 'challenge', zones: [...ZONES.demanding], rateOffset: 0.02 },
      { id: 'calm-with-it', text: 'Stay with it.', intent: 'encourage', zones: [...ZONES.demanding] },
      { id: 'calm-finish', text: 'Finish the round. Stay steady.', intent: 'challenge', zones: [...ZONES.final], rateOffset: 0.02 },
      { id: 'calm-last', text: 'Last few seconds. Hold it.', intent: 'encourage', zones: [...ZONES.final] },
      { id: 'calm-complete', text: 'Complete the work you started.', intent: 'challenge', zones: [...ZONES.final], rateOffset: 0.02 },
    ],
  },
};

export function resolveCoachPersonality(
  preference: CoachPersonalityPreference,
  random: () => number = Math.random,
): CoachPersonalityId {
  if (preference !== 'surprise') return preference;
  const personalities = Object.keys(COACH_PERSONALITIES) as CoachPersonalityId[];
  const index = Math.min(personalities.length - 1, Math.floor(random() * personalities.length));
  return personalities[Math.max(0, index)];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getSpeechTuning(
  personalityId: CoachPersonalityId,
  delivery: SpeechDelivery,
  intent: CoachIntent = 'neutral',
  rateOffset = 0,
  pitchOffset = 0,
) {
  const personality = COACH_PERSONALITIES[personalityId];
  const deliveryRate = delivery === 'countdown'
    ? 0.08
    : delivery === 'phase'
      ? 0.025
      : delivery === 'message'
        ? -0.08
        : delivery === 'contextual'
          ? -0.055
          : -0.04;
  const intentRate = intent === 'challenge' ? 0.035 : intent === 'encourage' ? 0.015 : intent === 'acknowledge' ? -0.015 : 0;
  const intentPitch = intent === 'challenge' ? (personalityId === 'tough' ? -0.01 : 0.01) : 0;
  return {
    rate: clamp(personality.rate + deliveryRate + intentRate + rateOffset, 0.8, 1.3),
    pitch: clamp(personality.pitch + intentPitch + pitchOffset, 0.8, 1.2),
  };
}

export function makeCoachSpeech(
  personalityId: CoachPersonalityId,
  id: string,
  text: string,
  delivery: SpeechDelivery,
  intent: CoachIntent = 'neutral',
  rateOffset = 0,
  pitchOffset = 0,
): CoachSpeech {
  return {
    id,
    text,
    intent,
    ...getSpeechTuning(personalityId, delivery, intent, rateOffset, pitchOffset),
  };
}

export function selectPhaseSpeech(
  personalityId: CoachPersonalityId,
  phase: PhaseKind | 'complete',
  context?: Pick<CoachContext, 'round' | 'cycle' | 'isFinalRound' | 'isFinalCycle'>,
): CoachSpeech {
  const personality = COACH_PERSONALITIES[personalityId];
  const cueKey = phase === 'work' && context?.isFinalRound && context.isFinalCycle ? 'finalWork' : phase;
  const cues = personality.phaseCues[cueKey];
  const variant = context ? (context.round + context.cycle) % cues.length : 0;
  return makeCoachSpeech(personalityId, `${personalityId}-${cueKey}-${variant}`, cues[variant], 'phase');
}

export function makeCountdownSpeech(personalityId: CoachPersonalityId, count: number): CoachSpeech {
  return makeCoachSpeech(personalityId, `countdown-${count}`, String(count), 'countdown');
}

export function makePreviewSpeech(personalityId: CoachPersonalityId): CoachSpeech {
  const previews: Record<CoachPersonalityId, string> = {
    focused: 'Ready. Find your pace. Three, two, one. Start.',
    energetic: 'Ready! Stay with me. Three, two, one. Go!',
    tough: 'Ready. Keep working. Three, two, one. Go.',
    calm: 'Ready. Find your rhythm. Three, two, one. Begin.',
  };
  return makeCoachSpeech(personalityId, `${personalityId}-preview`, previews[personalityId], 'preview');
}
