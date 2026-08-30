export { deriveCoachContext } from './context.ts';
export { createCoachMemory, planCoachIntervention } from './interventions.ts';
export {
  COACH_PERSONALITIES,
  makeCountdownSpeech,
  makePreviewSpeech,
  selectPhaseSpeech,
} from './personalities.ts';
export { curateVoices, resolveActiveCoach } from './voices.ts';
export type {
  ActiveCoach,
  CoachMemory,
  CoachPersonalityId,
  CoachSpeech,
  PhaseKind,
  VoicePreference,
} from './types.ts';
