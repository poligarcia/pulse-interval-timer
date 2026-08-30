import { ASPIRATIONAL_MESSAGES, MOTIVATIONAL_MESSAGES } from './display-message-data.ts';
import { makeCoachSpeech } from './personalities.ts';
import type { CoachPersonalityId } from './types.ts';

export type DisplayMessageKind = 'motivation' | 'aspiration';

export type DisplayMessage = {
  id: string;
  text: string;
  author: string;
};

export type DisplayMessageMemory = Record<DisplayMessageKind, string[]>;

const RECENT_MESSAGE_LIMITS: Record<DisplayMessageKind, number> = {
  motivation: 20,
  aspiration: 12,
};

const DISPLAY_MESSAGES: Record<DisplayMessageKind, DisplayMessage[]> = {
  motivation: MOTIVATIONAL_MESSAGES,
  aspiration: ASPIRATIONAL_MESSAGES,
};

function recentLimit(kind: DisplayMessageKind) {
  return Math.min(RECENT_MESSAGE_LIMITS[kind], DISPLAY_MESSAGES[kind].length - 1);
}

function validRecentIds(kind: DisplayMessageKind, value: unknown) {
  if (!Array.isArray(value)) return [];
  const knownIds = new Set(DISPLAY_MESSAGES[kind].map((message) => message.id));
  return value
    .filter((id): id is string => typeof id === 'string' && knownIds.has(id))
    .slice(-recentLimit(kind));
}

export function createDisplayMessageMemory(value?: unknown): DisplayMessageMemory {
  const stored = value && typeof value === 'object'
    ? value as Partial<Record<DisplayMessageKind, unknown>>
    : {};
  return {
    motivation: validRecentIds('motivation', stored.motivation),
    aspiration: validRecentIds('aspiration', stored.aspiration),
  };
}

export function selectDisplayMessage(
  kind: DisplayMessageKind,
  memory: DisplayMessageMemory,
  random: () => number = Math.random,
) {
  const messages = DISPLAY_MESSAGES[kind];
  const recentIds = validRecentIds(kind, memory[kind]);
  const freshMessages = messages.filter((message) => !recentIds.includes(message.id));
  const pool = freshMessages.length > 0 ? freshMessages : messages;
  const sample = random();
  const normalizedSample = Number.isFinite(sample)
    ? Math.min(1 - Number.EPSILON, Math.max(0, sample))
    : 0;
  const message = pool[Math.floor(normalizedSample * pool.length)];

  return {
    message,
    memory: {
      ...memory,
      [kind]: [...recentIds, message.id].slice(-recentLimit(kind)),
    },
  };
}

export function makeDisplayMessageSpeech(
  personalityId: CoachPersonalityId,
  kind: DisplayMessageKind,
  message: DisplayMessage,
) {
  return makeCoachSpeech(
    personalityId,
    `display-${message.id}`,
    message.text,
    'message',
    kind === 'motivation' ? 'encourage' : 'acknowledge',
  );
}
