import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_LOCALES } from './locales.ts';
import { getMessages } from './messages.ts';

test('every locale provides the main product vocabulary', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const messages = getMessages(locale);
    assert.equal(messages.common.timers, 'Timers');
    assert.ok(messages.phase.prepare.label);
    assert.ok(messages.phase.work.label);
    assert.ok(messages.phase.rest.label);
    assert.ok(messages.phase.cycleRest.label);
    assert.ok(messages.phase.cooldown.label);
  }
});

test('timer structure copy handles singular and plural forms', () => {
  assert.equal(getMessages('en').timerDetails.structure(1, 2), '1 round · 2 cycles');
  assert.equal(getMessages('es-AR').timerDetails.structure(2, 1), '2 rondas · 1 ciclo');
  assert.equal(getMessages('pt-BR').timerDetails.structure(2, 2), '2 rodadas · 2 ciclos');
});

test('locale-specific copy keeps timer as the global product term', () => {
  assert.equal(getMessages('es-AR').home.newTimer, 'Nuevo timer');
  assert.equal(getMessages('pt-BR').home.newTimer, 'Novo timer');
  assert.equal(getMessages('pt-BR').phase.rest.short, 'Recupere-se');
  assert.match(getMessages('es-AR').runner.weeklySummary(1, 3, 1), /racha de 1 día$/);
  assert.match(getMessages('pt-BR').runner.weeklySummary(1, 3, 1), /sequência de 1 dia$/);
});

test('automatic timer names render from semantic interval values in the active locale', () => {
  assert.equal(getMessages('en').timerDetails.automaticName(30, 15, 6, 1), '30s work - 15s rest × 6');
  assert.equal(getMessages('es-AR').timerDetails.automaticName(30, 15, 6, 2), '30s trabajo - 15s descanso × 6 × 2');
  assert.equal(getMessages('pt-BR').timerDetails.automaticName(30, 15, 6, 2), '30s trabalho - 15s descanso × 6 × 2');
});

test('progress milestones and reminder days are locale-specific', () => {
  assert.equal(getMessages('es-AR').progress.milestones['first-workout'].title, 'Primer paso');
  assert.equal(getMessages('pt-BR').progress.milestones['five-hours'].title, 'Clube das cinco horas');
  assert.deepEqual(getMessages('es-AR').settings.reminderDays[3], { label: 'Miércoles', short: 'X' });
  assert.equal(getMessages('pt-BR').settings.calendarEvent.summary, 'Treino Pulse');
});
