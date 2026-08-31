import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateLabsUnlock,
  createLabsUnlockSequence,
  LABS_UNLOCK_WINDOW_MS,
} from './unlock.ts';

test('UT-UNLOCK-001 initial activation increments without a hint', () => {
  const result = activateLabsUnlock(createLabsUnlockSequence(), 1_000);
  assert.equal(result.state.count, 1);
  assert.equal(result.remaining, null);
});

test('UT-UNLOCK-002 third activation reports four remaining', () => {
  let state = createLabsUnlockSequence();
  state = activateLabsUnlock(state, 1_000).state;
  state = activateLabsUnlock(state, 1_100).state;
  const result = activateLabsUnlock(state, 1_200);
  assert.equal(result.state.count, 3);
  assert.equal(result.remaining, 4);
});

test('UT-UNLOCK-003 seventh activation unlocks', () => {
  const state = createLabsUnlockSequence();
  let result = activateLabsUnlock(state, 0);
  for (let index = 1; index < 7; index += 1) result = activateLabsUnlock(result.state, index * 100);
  assert.equal(result.justUnlocked, true);
  assert.equal(result.state.unlocked, true);
});

test('UT-UNLOCK-004 elapsed window resets before accepting a new tap', () => {
  let state = activateLabsUnlock(createLabsUnlockSequence(), 100).state;
  state = activateLabsUnlock(state, 200).state;
  const result = activateLabsUnlock(state, 100 + LABS_UNLOCK_WINDOW_MS + 1);
  assert.equal(result.state.count, 1);
  assert.equal(result.remaining, null);
});

test('UT-UNLOCK-005 already unlocked stays unlocked', () => {
  const state = createLabsUnlockSequence(true);
  assert.equal(activateLabsUnlock(state, 100).state, state);
});

test('UT-UNLOCK-006 credits interactions do not increment', () => {
  const state = createLabsUnlockSequence();
  assert.equal(activateLabsUnlock(state, 100, 'credits').state, state);
});

test('UT-UNLOCK-007 non-monotonic time resets safely', () => {
  let state = activateLabsUnlock(createLabsUnlockSequence(), 500).state;
  state = activateLabsUnlock(state, 600).state;
  const result = activateLabsUnlock(state, 400);
  assert.equal(result.state.count, 1);
  assert.equal(result.state.startedAt, 400);
});

test('UT-UNLOCK-008 exact five-second boundary is inclusive', () => {
  let state = activateLabsUnlock(createLabsUnlockSequence(), 0).state;
  for (let index = 1; index < 6; index += 1) state = activateLabsUnlock(state, index * 100).state;
  const result = activateLabsUnlock(state, LABS_UNLOCK_WINDOW_MS);
  assert.equal(result.justUnlocked, true);
});
