import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCandidate,
  DEFAULT_LABS_SETTINGS,
  deleteCandidate,
  deleteCandidatePack,
  hideLabs,
  LABS_PHRASES_STORAGE_KEY,
  LABS_SETTINGS_STORAGE_KEY,
  MAX_PHRASE_CANDIDATES,
  parseCandidatePack,
  parseLabsSettings,
  rateCandidate,
  readLabsSettings,
} from './storage.ts';
import type { PhraseCandidate } from './types.ts';

class MemoryStorage {
  values = new Map<string, string>();
  throwWrites = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.throwWrites) throw new Error('quota');
    this.values.set(key, value);
  }
  removeItem(key: string) {
    if (this.throwWrites) throw new Error('quota');
    this.values.delete(key);
  }
}

function candidate(overrides: Partial<PhraseCandidate> = {}): PhraseCandidate {
  return {
    id: 'candidate-1',
    text: 'Stay steady.',
    personality: 'focused',
    fatigueZone: 'fresh',
    intent: 'encourage',
    delivery: 'contextual',
    adapter: 'base',
    modelRevision: 'revision',
    promptVersion: 1,
    createdAt: '2026-08-30T12:00:00.000Z',
    ...overrides,
  };
}

test('UT-STORAGE-001 valid Labs settings are parsed', () => {
  assert.deepEqual(parseLabsSettings({ version: 1, unlocked: true }), { version: 1, unlocked: true });
});

test('UT-STORAGE-002 invalid JSON returns defaults without throwing', () => {
  const storage = new MemoryStorage();
  storage.values.set(LABS_SETTINGS_STORAGE_KEY, '{bad');
  assert.deepEqual(readLabsSettings(storage), DEFAULT_LABS_SETTINGS);
});

test('UT-STORAGE-003 unknown schema version is ignored', () => {
  assert.deepEqual(parseLabsSettings({ version: 2, unlocked: true }), DEFAULT_LABS_SETTINGS);
});

test('UT-STORAGE-004 Hide Labs resets unlock without changing candidate data', () => {
  const storage = new MemoryStorage();
  storage.values.set(LABS_PHRASES_STORAGE_KEY, 'keep');
  assert.deepEqual(hideLabs(storage), DEFAULT_LABS_SETTINGS);
  assert.equal(storage.getItem(LABS_PHRASES_STORAGE_KEY), 'keep');
});

test('UT-STORAGE-005 candidate cap evicts oldest deterministically', () => {
  const candidates = Array.from({ length: MAX_PHRASE_CANDIDATES }, (_, index) => candidate({ id: String(index), text: `Phrase ${index}` }));
  const result = addCandidate(new MemoryStorage(), { version: 1, candidates }, candidate({ id: 'new', text: 'Newest' }));
  assert.equal(result.pack.candidates.length, MAX_PHRASE_CANDIDATES);
  assert.equal(result.pack.candidates[0].id, '1');
  assert.equal(result.pack.candidates.at(-1)?.id, 'new');
});

test('UT-STORAGE-007 storage write failure retains in-memory candidate', () => {
  const storage = new MemoryStorage();
  storage.throwWrites = true;
  const result = addCandidate(storage, { version: 1, candidates: [] }, candidate());
  assert.equal(result.error, 'storage');
  assert.equal(result.pack.candidates.length, 1);
});

test('UT-PHRASE-001 valid candidate retains all provenance', () => {
  const parsed = parseCandidatePack({ version: 1, candidates: [candidate()] });
  assert.deepEqual(parsed.candidates[0], candidate());
});

test('UT-PHRASE-002/003 normalized duplicate text is rejected', () => {
  const pack = { version: 1 as const, candidates: [candidate()] };
  const result = addCandidate(new MemoryStorage(), pack, candidate({ id: 'two', text: '  STAY   steady. ' }));
  assert.equal(result.error, 'duplicate');
});

test('UT-PHRASE-004/005 invalid personality and fatigue zone records are ignored', () => {
  const invalidPersonality = { ...candidate(), personality: 'unknown' };
  const invalidZone = { ...candidate({ id: 'two' }), fatigueZone: 'unknown' };
  assert.deepEqual(parseCandidatePack({ version: 1, candidates: [invalidPersonality, invalidZone] }).candidates, []);
});

test('UT-PHRASE-006 rating updates only the selected candidate', () => {
  const pack = { version: 1 as const, candidates: [candidate(), candidate({ id: 'two', text: 'Keep moving.' })] };
  const result = rateCandidate(new MemoryStorage(), pack, 'two', 'helpful');
  assert.equal(result.pack.candidates[0].rating, undefined);
  assert.equal(result.pack.candidates[1].rating, 'helpful');
});

test('UT-PHRASE-007 deleting a candidate removes only that record', () => {
  const pack = { version: 1 as const, candidates: [candidate(), candidate({ id: 'two', text: 'Keep moving.' })] };
  const result = deleteCandidate(new MemoryStorage(), pack, 'candidate-1');
  assert.deepEqual(result.pack.candidates.map(({ id }) => id), ['two']);
});

test('UT-PHRASE-008 deleting the pack leaves other storage intact', () => {
  const storage = new MemoryStorage();
  storage.values.set(LABS_PHRASES_STORAGE_KEY, 'phrases');
  storage.values.set('mentria-models', 'untouched');
  assert.equal(deleteCandidatePack(storage), true);
  assert.equal(storage.getItem('mentria-models'), 'untouched');
});
