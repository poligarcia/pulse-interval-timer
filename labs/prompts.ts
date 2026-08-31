import { COACH_PERSONALITIES } from '../coach/personalities.ts';
import type { CoachIntent, CoachPersonalityId, FatigueZone } from '../coach/types.ts';
import type { PhraseOperation } from './types.ts';

export const PHRASE_PROMPT_VERSION = 1;

export type PhrasePromptInput = {
  operation: PhraseOperation;
  personality: CoachPersonalityId;
  fatigueZone: FatigueZone;
  intent: CoachIntent;
  customText?: string;
};

export function buildPhrasePrompt(input: PhrasePromptInput): string {
  const personality = COACH_PERSONALITIES[input.personality];
  const text = input.customText?.trim() ?? '';
  const task = input.operation === 'rewrite'
    ? `Rewrite this coaching phrase while preserving its meaning: ${JSON.stringify(text)}`
    : input.operation === 'alternatives'
      ? `Create one distinct alternative to this coaching phrase: ${JSON.stringify(text)}`
      : 'Create one new coaching phrase.';

  return [
    'You write a single short phrase for an interval-workout coach.',
    `Personality: ${personality.label} — ${personality.description}.`,
    `Fatigue zone: ${input.fatigueZone}. Intent: ${input.intent}.`,
    task,
    'Return plain text only: one phrase, no quotation marks, no label, no list, no markdown, no analysis.',
    'Keep it under 140 characters. Do not give medical advice or invent workout metrics.',
  ].join('\n');
}
