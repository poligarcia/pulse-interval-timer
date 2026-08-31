import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanGeneratedPhrase, MAX_GENERATED_PHRASE_LENGTH } from './output.ts';

test('UT-OUTPUT-001 normal short phrase is unchanged', () => {
  assert.deepEqual(cleanGeneratedPhrase('Stay steady.'), { ok: true, text: 'Stay steady.' });
});

test('UT-OUTPUT-002 whitespace is trimmed and normalized', () => {
  assert.deepEqual(cleanGeneratedPhrase('  Stay   steady.  '), { ok: true, text: 'Stay steady.' });
});

test('UT-OUTPUT-003/004 matching straight and curly quotes are removed', () => {
  assert.deepEqual(cleanGeneratedPhrase('"Keep moving."'), { ok: true, text: 'Keep moving.' });
  assert.deepEqual(cleanGeneratedPhrase('“Keep moving.”'), { ok: true, text: 'Keep moving.' });
});

test('UT-OUTPUT-005/006 Qwen tokens and think blocks are stripped', () => {
  assert.deepEqual(
    cleanGeneratedPhrase('<think>draft</think>\n<|assistant|>"Keep moving."<|im_end|>'),
    { ok: true, text: 'Keep moving.' },
  );
});

test('UT-OUTPUT-007 empty after cleanup is rejected', () => {
  assert.equal(cleanGeneratedPhrase('<think>nothing</think>').ok, false);
});

test('UT-OUTPUT-008 over-limit output is rejected', () => {
  assert.equal(cleanGeneratedPhrase('x'.repeat(MAX_GENERATED_PHRASE_LENGTH + 1)).ok, false);
});

test('UT-OUTPUT-009 HTML remains inert text', () => {
  assert.deepEqual(cleanGeneratedPhrase('<img src=x onerror=alert(1)> Keep moving.'), { ok: true, text: '<img src=x onerror=alert(1)> Keep moving.' });
});

test('UT-OUTPUT-010 multiple paragraphs are rejected', () => {
  assert.equal(cleanGeneratedPhrase('First.\n\nSecond.').ok, false);
});
