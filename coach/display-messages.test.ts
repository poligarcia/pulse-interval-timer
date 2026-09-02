import assert from 'node:assert/strict';
import test from 'node:test';
import { ASPIRATIONAL_MESSAGES, MOTIVATIONAL_MESSAGES } from './display-message-data.ts';
import { displayMessagesForLocale } from './display-message-locales.ts';
import { createDisplayMessageMemory, makeDisplayMessageSpeech, selectDisplayMessage } from './display-messages.ts';

test('display messages use the supplied random source', () => {
  const memory = createDisplayMessageMemory();
  const first = selectDisplayMessage('motivation', memory, 'en', () => 0);
  const last = selectDisplayMessage('motivation', memory, 'en', () => 0.999);

  assert.notEqual(first.message.id, last.message.id);
});

test('display messages become coach speech with phase-appropriate delivery', () => {
  const motivation = MOTIVATIONAL_MESSAGES[0];
  const aspiration = ASPIRATIONAL_MESSAGES[0];
  const motivationalSpeech = makeDisplayMessageSpeech('energetic', 'motivation', motivation);
  const aspirationalSpeech = makeDisplayMessageSpeech('calm', 'aspiration', aspiration);

  assert.equal(motivationalSpeech.id, `display-${motivation.id}`);
  assert.equal(motivationalSpeech.text, motivation.text);
  assert.equal(motivationalSpeech.intent, 'encourage');
  assert.ok(motivationalSpeech.rate < 1.1);
  assert.equal(aspirationalSpeech.id, `display-${aspiration.id}`);
  assert.equal(aspirationalSpeech.text, aspiration.text);
  assert.equal(aspirationalSpeech.intent, 'acknowledge');
  assert.ok(aspirationalSpeech.rate < 0.9);
});

test('display message libraries have the reviewed target sizes and unique content', () => {
  assert.equal(MOTIVATIONAL_MESSAGES.length, 120);
  assert.equal(ASPIRATIONAL_MESSAGES.length, 40);

  const messages = [...MOTIVATIONAL_MESSAGES, ...ASPIRATIONAL_MESSAGES];
  const normalizedTexts = messages.map(({ text }) => text.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  assert.equal(new Set(messages.map(({ id }) => id)).size, messages.length);
  assert.equal(new Set(normalizedTexts).size, messages.length);
  assert.ok(messages.every(({ text }) => text === text.trim() && text.length <= 180));
  assert.ok(MOTIVATIONAL_MESSAGES.every(({ author }) => author === 'Mentria'));
  assert.ok(ASPIRATIONAL_MESSAGES.every(({ author }) => author === 'Laptiva Coach'));
});

test('motivational messages avoid the twenty most recently shown messages', () => {
  let memory = createDisplayMessageMemory();
  const selectedIds: string[] = [];

  for (let index = 0; index < 21; index += 1) {
    const selection = selectDisplayMessage('motivation', memory, 'en', () => 0);
    selectedIds.push(selection.message.id);
    memory = selection.memory;
  }

  assert.equal(new Set(selectedIds).size, 21);
  assert.deepEqual(memory.motivation, selectedIds.slice(-20));
});

test('aspirational messages avoid the twelve most recently shown messages', () => {
  let memory = createDisplayMessageMemory();
  const selectedIds: string[] = [];

  for (let index = 0; index < 13; index += 1) {
    const selection = selectDisplayMessage('aspiration', memory, 'en', () => 0);
    selectedIds.push(selection.message.id);
    memory = selection.memory;
  }

  assert.equal(new Set(selectedIds).size, 13);
  assert.deepEqual(memory.aspiration, selectedIds.slice(-12));
});

test('stored message memory ignores unknown and malformed entries', () => {
  const restored = createDisplayMessageMemory({
    motivation: ['unknown', 42, 'motivation-002'],
    aspiration: 'aspiration-003',
  });

  assert.deepEqual(restored, {
    motivation: ['motivation-002'],
    aspiration: [],
  });
});

test('Spanish and Portuguese use original unattributed Laptiva message libraries', () => {
  for (const locale of ['es-AR', 'pt-BR'] as const) {
    const messages = displayMessagesForLocale(locale);
    assert.equal(messages.motivation.length, 24);
    assert.equal(messages.aspiration.length, 14);
    assert.ok([...messages.motivation, ...messages.aspiration].every(({ author }) => author === null));
  }

  const spanish = selectDisplayMessage('motivation', createDisplayMessageMemory(undefined, 'es-AR'), 'es-AR', () => 0);
  const portuguese = selectDisplayMessage('aspiration', createDisplayMessageMemory(undefined, 'pt-BR'), 'pt-BR', () => 0);
  assert.match(spanish.message.id, /^es-motivation-/);
  assert.match(portuguese.message.id, /^pt-aspiration-/);
});
