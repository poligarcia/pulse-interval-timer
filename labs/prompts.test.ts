import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPhrasePrompt, PHRASE_PROMPT_VERSION } from './prompts.ts';
import { selectDeterministicCoachPhrase } from '../coach/personalities.ts';

test('PHRASE-002 prompt is versioned, bounded, and includes selected context', () => {
  const prompt = buildPhrasePrompt({
    operation: 'rewrite',
    personality: 'calm',
    fatigueZone: 'finishing',
    intent: 'challenge',
    customText: 'Finish this.',
  });
  assert.equal(PHRASE_PROMPT_VERSION, 1);
  assert.match(prompt, /Calm/);
  assert.match(prompt, /finishing/);
  assert.match(prompt, /challenge/);
  assert.match(prompt, /plain text only/);
  assert.match(prompt, /Finish this\./);
});

test('UT-PHRASE-009 deterministic production selection never reads candidates', () => {
  assert.equal(selectDeterministicCoachPhrase('focused', 'fresh', 'encourage').text, 'Settle into it.');
});
