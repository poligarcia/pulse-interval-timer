import assert from 'node:assert/strict';
import test from 'node:test';
import { compileSpeechScript, flatSpeechScript, parseSpeechScript } from './speech-script.ts';
import { phaseSpeechScript, workoutSpeechSchedule } from './workout-speech.ts';
import { selectPhaseSpeech } from './personalities.ts';

const base = { id: 'test', rate: 1, pitch: 1 };
test('explicit markup compiles pauses and persistent/scoped delivery without punctuation splitting', () => {
  const result = parseSpeechScript('FINAL ROUND, READY?[[pause:450]][[rate:+0.12]][[pitch:-0.03]]BEGIN![[reset:rate]]Continue.', base);
  assert.ok(result.ok);
  const compiled = compileSpeechScript(result.script);
  assert.ok(compiled.ok);
  assert.deepEqual(compiled.steps, [
    { kind: 'speak', text: 'FINAL ROUND, READY?', rate: 1, pitch: 1, volumeScale: 1 },
    { kind: 'pause', ms: 450 },
    { kind: 'speak', text: 'BEGIN!', rate: 1.12, pitch: .97, volumeScale: 1 },
    { kind: 'speak', text: 'Continue.', rate: 1, pitch: .97, volumeScale: 1 },
  ]);
});
test('scoped style restores persistent settings and all properties are product clamped', () => {
  const result = compileSpeechScript({ ...base, segments: [
    { kind: 'set', style: { rateDelta: -.1, volumeScale: .7 } },
    { kind: 'text', text: 'One', style: { rateDelta: 99, pitchDelta: -99, volumeScale: .2 } },
    { kind: 'text', text: 'Two' }, { kind: 'reset' }, { kind: 'text', text: 'Three' },
  ] });
  assert.ok(result.ok);
  assert.deepEqual(result.steps.map((step) => step.kind === 'speak' ? [step.rate, step.pitch, step.volumeScale] : []), [[1.3, .8, .2], [.9, 1, .7], [1, 1, 1]]);
});
test('malformed, empty, nonfinite and excessive scripts fail safely', () => {
  for (const source of ['', '  ', '[[pause:20]]', 'Hi[[pause:6000]]', 'Hi[[rate:NaN]]', 'Hi[[volume:*2]]', 'Hi[[unknown:2]]', 'Hi[[pause:50', 'Hi[[reset:voice]]', 'a'.repeat(8001), 'x[[pause:5000]]'.repeat(4)]) {
    assert.equal(parseSpeechScript(source).ok, false, source.slice(0, 50));
  }
  assert.equal(compileSpeechScript({ ...base, rate: NaN, segments: [] }).ok, false);
  assert.equal(compileSpeechScript({ ...base, segments: [{ kind: 'text', text: ' ' }] }).ok, false);
});
test('escaping is literal and flat CoachSpeech never enters the markup parser', () => {
  const parsed = parseSpeechScript('Say \\[[pause:50]] and \\\\ now');
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.script.segments, [{ kind: 'text', text: 'Say [[pause:50]] and \\ now' }]);
  const flat = flatSpeechScript({ ...base, text: 'Hi, [[pause:50]]!', intent: 'neutral' });
  assert.deepEqual(flat.segments, [{ kind: 'text', text: 'Hi, [[pause:50]]!' }]);
});
test('workout policy protects genuine countdown and phase boundaries without changing the clock', () => {
  const script = { ...base, segments: [{ kind: 'text' as const, text: 'Keep moving.' }] };
  const schedule = workoutSpeechSchedule(script, 'motivation', 1000, 10000);
  assert.equal(schedule.mustFinishByMs, 6750);
  assert.ok(schedule.admissionBudgetMs! > 0);
  assert.deepEqual(workoutSpeechSchedule(script, 'countdown', 7100, 10000), { priority: 300, interrupt: true, mustStartByMs: 7700, mustFinishByMs: 7960 });
  assert.equal(workoutSpeechSchedule(script, 'countdown', 7600, 10000).mustFinishByMs, 7960);
});

test('authored final-round splits preserve every personality and locale, with flat fallback for revised copy', () => {
  for (const locale of ['en', 'es-AR', 'pt-BR'] as const) for (const personality of ['focused', 'energetic', 'tough', 'calm'] as const) {
    const speech = selectPhaseSpeech(personality, 'work', { round: 4, cycle: 1, isFinalRound: true, isFinalCycle: true }, locale);
    const script = phaseSpeechScript(speech, personality, locale);
    assert.equal(script.segments.length, 3);
    assert.equal(script.segments.filter((step) => step.kind === 'text').map((step) => step.text).join(' '), speech.text);
    assert.deepEqual(script.segments[1], { kind: 'pause', ms: 450 });
    assert.equal(phaseSpeechScript({ ...speech, text: 'Changed copy.' }, personality, locale).segments.length, 1);
  }
});
