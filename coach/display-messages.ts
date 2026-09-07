import { SUPPORTED_LOCALES } from '../i18n/locales.ts';
import type { Locale } from '../i18n/locales.ts';
import { displayMessagesForLocale } from './display-message-locales.ts';
import { makeCoachSpeech } from './personalities.ts';
import { recoveryMessages } from './recovery-scripts.ts';
import type { CoachPersonalityId } from './types.ts';

export type DisplayMessageKind = 'motivation' | 'aspiration';

export type DisplayMessage = {
  id: string;
  text: string;
  author: string | null;
};

export type DisplayMessageMemory = Record<DisplayMessageKind, string[]>;

const RECENT_MESSAGE_LIMITS: Record<DisplayMessageKind, number> = {
  motivation: 20,
  aspiration: 12,
};

function messagesFor(kind: DisplayMessageKind, locale: Locale, scriptedPersonality?: CoachPersonalityId) {
  return scriptedPersonality ? recoveryMessages(locale, scriptedPersonality, kind) : displayMessagesForLocale(locale)[kind];
}

function recentLimit(kind: DisplayMessageKind, locale: Locale, scriptedPersonality?: CoachPersonalityId) {
  return Math.min(RECENT_MESSAGE_LIMITS[kind], messagesFor(kind, locale, scriptedPersonality).length - 1);
}

function validRecentIds(kind: DisplayMessageKind, value: unknown, locale: Locale, scriptedPersonality?: CoachPersonalityId) {
  if (!Array.isArray(value)) return [];
  const limit = recentLimit(kind, locale, scriptedPersonality);
  if (limit === 0) return [];
  const knownIds = new Set(messagesFor(kind, locale, scriptedPersonality).map((message) => message.id));
  return value
    .filter((id): id is string => typeof id === 'string' && knownIds.has(id))
    .slice(-limit);
}

function validStoredIds(kind: DisplayMessageKind, value: unknown, locale?: Locale) {
  if (!Array.isArray(value)) return [];
  const knownIds = new Set((locale ? [locale] : SUPPORTED_LOCALES).flatMap((candidate) => [
    ...messagesFor(kind, candidate),
    ...(['focused', 'energetic', 'tough', 'calm'] as const).flatMap((personality) => recoveryMessages(candidate, personality, kind)),
  ]).map((message) => message.id));
  return value
    .filter((id): id is string => typeof id === 'string' && knownIds.has(id))
    .slice(-RECENT_MESSAGE_LIMITS[kind]);
}

export function createDisplayMessageMemory(value?: unknown, locale?: Locale): DisplayMessageMemory {
  const stored = value && typeof value === 'object'
    ? value as Partial<Record<DisplayMessageKind, unknown>>
    : {};
  return {
    motivation: validStoredIds('motivation', stored.motivation, locale),
    aspiration: validStoredIds('aspiration', stored.aspiration, locale),
  };
}

export function selectDisplayMessage(
  kind: DisplayMessageKind,
  memory: DisplayMessageMemory,
  locale: Locale = 'en',
  random: () => number = Math.random,
  options: { scriptedPersonality?: CoachPersonalityId } = {},
) {
  const messages = messagesFor(kind, locale, options.scriptedPersonality);
  const recentIds = validRecentIds(kind, memory[kind], locale, options.scriptedPersonality);
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
      [kind]: [...validStoredIds(kind, memory[kind]), message.id].slice(-RECENT_MESSAGE_LIMITS[kind]),
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
