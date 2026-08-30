export type PhaseKind = 'prepare' | 'work' | 'rest' | 'cycleRest' | 'cooldown';

export type CoachPersonalityId = 'focused' | 'energetic' | 'tough' | 'calm';
export type VoicePreference = 'female' | 'male' | 'either';
export type VoiceGender = Exclude<VoicePreference, 'either'>;
export type CoachIntent = 'neutral' | 'encourage' | 'challenge' | 'acknowledge';
export type FatigueZone = 'fresh' | 'settled' | 'challenging' | 'finishing';
export type SpeechDelivery = 'phase' | 'countdown' | 'contextual' | 'preview';

export type CoachPhase = {
  kind: PhaseKind;
  duration: number;
  round: number;
  cycle: number;
};

export type CoachContext = {
  phase: PhaseKind;
  phaseIndex: number;
  totalPhases: number;
  round: number;
  totalRounds: number;
  cycle: number;
  totalCycles: number;
  elapsedInPhase: number;
  remainingInPhase: number;
  phaseDuration: number;
  elapsedWorkout: number;
  workoutDuration: number;
  workoutProgress: number;
  isFirstRound: boolean;
  isFinalRound: boolean;
  isFinalCycle: boolean;
  fatigueZone: FatigueZone;
};

export type CoachMemory = {
  recentPhraseIds: string[];
  consideredPhaseKeys: string[];
  lastInterventionAt: number | null;
  interventionsThisWorkout: number;
  lastIntent?: CoachIntent;
};

export type CoachPhrase = {
  id: string;
  text: string;
  intent: CoachIntent;
  zones: FatigueZone[];
  rateOffset?: number;
  pitchOffset?: number;
};

export type CoachSpeech = {
  id: string;
  text: string;
  intent: CoachIntent;
  rate: number;
  pitch: number;
};

export type ActiveCoach = {
  personality: CoachPersonalityId;
  voiceURI: string;
};

export type SystemVoiceLike = {
  name: string;
  voiceURI: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
};

export type VoiceProfile = {
  name: string;
  gender?: VoiceGender;
  recommended: boolean;
  novelty?: boolean;
};
