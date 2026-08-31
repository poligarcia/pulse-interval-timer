import type {
  CoachIntent,
  CoachPersonalityId,
  FatigueZone,
  SpeechDelivery,
} from '../coach/types.ts';

export type ModelAdapter = 'base' | 'quotes';

export type MentriaStatus =
  | { kind: 'unsupported'; reason: string }
  | { kind: 'idle'; cached: boolean }
  | { kind: 'awaiting-consent' }
  | { kind: 'loading-runtime' }
  | { kind: 'downloading'; loaded: number; total?: number; message?: string }
  | { kind: 'compiling'; message?: string }
  | { kind: 'ready'; adapter: ModelAdapter }
  | { kind: 'generating' }
  | { kind: 'error'; message: string };

export type ModelSupport =
  | { supported: true; cached: boolean }
  | { supported: false; reason: string };

export type ModelProgress = {
  phase: 'download' | 'compile';
  loaded?: number;
  total?: number;
  message?: string;
};

export type GenerationRequest = {
  prompt: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
};

export type GenerationResult = {
  text: string;
  finishReason?: string;
};

export type CandidateRating = 'helpful' | 'not-helpful';

export type PhraseCandidate = {
  id: string;
  text: string;
  personality: CoachPersonalityId;
  fatigueZone: FatigueZone;
  intent: CoachIntent;
  delivery: SpeechDelivery;
  adapter: ModelAdapter;
  modelRevision: string;
  promptVersion: number;
  createdAt: string;
  rating?: CandidateRating;
};

export type PhraseOperation = 'generate' | 'rewrite' | 'alternatives';
