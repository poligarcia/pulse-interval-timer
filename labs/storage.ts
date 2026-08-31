import type {
  CandidateRating,
  ModelAdapter,
  PhraseCandidate,
} from './types.ts';
import type {
  CoachIntent,
  CoachPersonalityId,
  FatigueZone,
  SpeechDelivery,
} from '../coach/types.ts';

export const LABS_SETTINGS_STORAGE_KEY = 'pulse-labs-settings-v1';
export const LABS_PHRASES_STORAGE_KEY = 'pulse-labs-phrases-v1';
export const LABS_STORAGE_VERSION = 1;
export const MAX_PHRASE_CANDIDATES = 100;

export type LabsSettings = {
  version: 1;
  unlocked: boolean;
};

export type CandidatePack = {
  version: 1;
  candidates: PhraseCandidate[];
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PERSONALITIES = new Set<CoachPersonalityId>(['focused', 'energetic', 'tough', 'calm']);
const FATIGUE_ZONES = new Set<FatigueZone>(['fresh', 'settled', 'challenging', 'finishing']);
const INTENTS = new Set<CoachIntent>(['neutral', 'encourage', 'challenge', 'acknowledge']);
const DELIVERIES = new Set<SpeechDelivery>(['phase', 'countdown', 'contextual', 'message', 'preview']);
const ADAPTERS = new Set<ModelAdapter>(['base', 'quotes']);
const RATINGS = new Set<CandidateRating>(['helpful', 'not-helpful']);

export const DEFAULT_LABS_SETTINGS: LabsSettings = { version: 1, unlocked: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseLabsSettings(value: unknown): LabsSettings {
  if (!isRecord(value) || value.version !== LABS_STORAGE_VERSION || typeof value.unlocked !== 'boolean') {
    return DEFAULT_LABS_SETTINGS;
  }
  return { version: 1, unlocked: value.unlocked };
}

export function readLabsSettings(storage: StorageLike): LabsSettings {
  try {
    const value = storage.getItem(LABS_SETTINGS_STORAGE_KEY);
    return value ? parseLabsSettings(JSON.parse(value)) : DEFAULT_LABS_SETTINGS;
  } catch {
    return DEFAULT_LABS_SETTINGS;
  }
}

export function writeLabsSettings(storage: StorageLike, settings: LabsSettings): boolean {
  try {
    storage.setItem(LABS_SETTINGS_STORAGE_KEY, JSON.stringify(parseLabsSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

export function hideLabs(storage: StorageLike): LabsSettings {
  const settings = { ...DEFAULT_LABS_SETTINGS };
  writeLabsSettings(storage, settings);
  return settings;
}

export function normalizeCandidateText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function parseCandidate(value: unknown): PhraseCandidate | null {
  if (!isRecord(value)) return null;
  const rating = value.rating;
  if (
    typeof value.id !== 'string' || !value.id ||
    typeof value.text !== 'string' || !normalizeCandidateText(value.text) ||
    typeof value.personality !== 'string' || !PERSONALITIES.has(value.personality as CoachPersonalityId) ||
    typeof value.fatigueZone !== 'string' || !FATIGUE_ZONES.has(value.fatigueZone as FatigueZone) ||
    typeof value.intent !== 'string' || !INTENTS.has(value.intent as CoachIntent) ||
    typeof value.delivery !== 'string' || !DELIVERIES.has(value.delivery as SpeechDelivery) ||
    typeof value.adapter !== 'string' || !ADAPTERS.has(value.adapter as ModelAdapter) ||
    typeof value.modelRevision !== 'string' || !value.modelRevision ||
    !Number.isInteger(value.promptVersion) || Number(value.promptVersion) < 1 ||
    typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
    (rating !== undefined && (typeof rating !== 'string' || !RATINGS.has(rating as CandidateRating)))
  ) return null;

  return {
    id: value.id,
    text: value.text.trim().replace(/\s+/g, ' '),
    personality: value.personality as CoachPersonalityId,
    fatigueZone: value.fatigueZone as FatigueZone,
    intent: value.intent as CoachIntent,
    delivery: value.delivery as SpeechDelivery,
    adapter: value.adapter as ModelAdapter,
    modelRevision: value.modelRevision,
    promptVersion: Number(value.promptVersion),
    createdAt: value.createdAt,
    ...(rating ? { rating: rating as CandidateRating } : {}),
  };
}

export function parseCandidatePack(value: unknown): CandidatePack {
  if (!isRecord(value) || value.version !== LABS_STORAGE_VERSION || !Array.isArray(value.candidates)) {
    return { version: 1, candidates: [] };
  }
  const seen = new Set<string>();
  const candidates: PhraseCandidate[] = [];
  for (const raw of value.candidates) {
    const candidate = parseCandidate(raw);
    if (!candidate) continue;
    const normalized = normalizeCandidateText(candidate.text);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push(candidate);
  }
  return { version: 1, candidates: candidates.slice(-MAX_PHRASE_CANDIDATES) };
}

export function readCandidatePack(storage: StorageLike): CandidatePack {
  try {
    const value = storage.getItem(LABS_PHRASES_STORAGE_KEY);
    return value ? parseCandidatePack(JSON.parse(value)) : { version: 1, candidates: [] };
  } catch {
    return { version: 1, candidates: [] };
  }
}

export type CandidateMutationResult = {
  pack: CandidatePack;
  persisted: boolean;
  error?: 'duplicate' | 'invalid' | 'storage';
};

function persistPack(storage: StorageLike, pack: CandidatePack): boolean {
  try {
    storage.setItem(LABS_PHRASES_STORAGE_KEY, JSON.stringify(pack));
    return true;
  } catch {
    return false;
  }
}

export function addCandidate(
  storage: StorageLike,
  pack: CandidatePack,
  candidateValue: PhraseCandidate,
): CandidateMutationResult {
  const candidate = parseCandidate(candidateValue);
  if (!candidate) return { pack, persisted: false, error: 'invalid' };
  const normalized = normalizeCandidateText(candidate.text);
  if (pack.candidates.some(({ text }) => normalizeCandidateText(text) === normalized)) {
    return { pack, persisted: false, error: 'duplicate' };
  }
  const next = {
    version: 1 as const,
    candidates: [...pack.candidates, candidate].slice(-MAX_PHRASE_CANDIDATES),
  };
  return persistPack(storage, next)
    ? { pack: next, persisted: true }
    : { pack: next, persisted: false, error: 'storage' };
}

export function rateCandidate(
  storage: StorageLike,
  pack: CandidatePack,
  id: string,
  rating: CandidateRating,
): CandidateMutationResult {
  const next = {
    version: 1 as const,
    candidates: pack.candidates.map((candidate) => candidate.id === id ? { ...candidate, rating } : candidate),
  };
  return persistPack(storage, next)
    ? { pack: next, persisted: true }
    : { pack: next, persisted: false, error: 'storage' };
}

export function deleteCandidate(storage: StorageLike, pack: CandidatePack, id: string): CandidateMutationResult {
  const next = { version: 1 as const, candidates: pack.candidates.filter((candidate) => candidate.id !== id) };
  return persistPack(storage, next)
    ? { pack: next, persisted: true }
    : { pack: next, persisted: false, error: 'storage' };
}

export function deleteCandidatePack(storage: StorageLike): boolean {
  try {
    storage.removeItem(LABS_PHRASES_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
