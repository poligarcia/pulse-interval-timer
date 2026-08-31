import assert from 'node:assert/strict';
import test from 'node:test';
import { speakPhrasePreview } from './speech.ts';
import type { PreviewUtterance, SpeechPreviewEnvironment } from './speech.ts';

function environment() {
  const spoken: PreviewUtterance[] = [];
  let cancelled = 0;
  const env: SpeechPreviewEnvironment = {
    voices: () => [{ voiceURI: 'voice-1', lang: 'en-GB' }],
    createUtterance: () => ({ voice: null, lang: '', rate: 1, pitch: 1, volume: 1 }),
    speak: (utterance) => spoken.push(utterance),
    cancel: () => { cancelled += 1; },
  };
  return { env, spoken, cancelled: () => cancelled };
}

test('UT-SPEECH-001 empty phrase creates no utterance', () => {
  const fixture = environment();
  assert.equal(speakPhrasePreview(fixture.env, '  ', { voiceURI: '', rate: 1, pitch: 1 }), null);
  assert.equal(fixture.spoken.length, 0);
});

test('UT-SPEECH-002 selected voice and tuning are applied', () => {
  const fixture = environment();
  const utterance = speakPhrasePreview(fixture.env, 'Go.', { voiceURI: 'voice-1', rate: 1.2, pitch: 0.9 });
  assert.equal(utterance?.voice?.voiceURI, 'voice-1');
  assert.equal(utterance?.lang, 'en-GB');
  assert.equal(utterance?.rate, 1.2);
  assert.equal(utterance?.pitch, 0.9);
  assert.equal(fixture.cancelled(), 1);
});

test('UT-SPEECH-003 missing saved voice falls back safely', () => {
  const fixture = environment();
  const utterance = speakPhrasePreview(fixture.env, 'Go.', { voiceURI: 'missing', rate: 1, pitch: 1 });
  assert.equal(utterance?.voice, null);
  assert.equal(utterance?.lang, 'en-US');
});

test('UT-SPEECH-004 caller can cancel on component exit', () => {
  const fixture = environment();
  fixture.env.cancel();
  assert.equal(fixture.cancelled(), 1);
});
