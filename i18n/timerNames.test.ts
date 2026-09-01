import assert from 'node:assert/strict';
import test from 'node:test';
import { getMessages } from './messages.ts';
import { localizeTimerName } from './timerNames.ts';

const AUTOMATIC_TIMER = {
  name: '30s work - 15s rest X 6',
  nameIsCustom: false,
  work: 30,
  rest: 15,
  rounds: 6,
  cycles: 1,
};

test('automatic timer names follow the active locale without changing stored data', () => {
  assert.equal(localizeTimerName(AUTOMATIC_TIMER, getMessages('en')), '30s work - 15s rest × 6');
  assert.equal(localizeTimerName(AUTOMATIC_TIMER, getMessages('es-AR')), '30s trabajo - 15s descanso × 6');
  assert.equal(AUTOMATIC_TIMER.name, '30s work - 15s rest X 6');
});

test('custom and legacy names remain exactly as the user stored them', () => {
  const custom = { ...AUTOMATIC_TIMER, name: 'Mi escalera', nameIsCustom: true };
  const legacy = { ...AUTOMATIC_TIMER, name: 'Legacy intervals', nameIsCustom: undefined };

  assert.equal(localizeTimerName(custom, getMessages('pt-BR')), 'Mi escalera');
  assert.equal(localizeTimerName(legacy, getMessages('es-AR')), 'Legacy intervals');
});
