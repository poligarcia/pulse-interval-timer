import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_LOCALES } from '../i18n/locales.ts';
import { makeCountdownSpeech, selectPhaseSpeech } from './personalities.ts';
import { createDisplayMessageMemory, makeDisplayMessageSpeech, selectDisplayMessage } from './display-messages.ts';
import { recoveryMessages, recoverySpeechScript } from './recovery-scripts.ts';
import { compileSpeechScript, flatSpeechScript, parseSpeechScript } from './speech-script.ts';
import type { SpeechScript } from './speech-script.ts';
import { phaseAnnouncementScript, phaseSpeechScript, speechBudgetMs, workoutSpeechCutoff, workoutSpeechSchedule } from './workout-speech.ts';
import { speechScriptMarkup, workoutDeliveryExamples } from './workout-delivery-examples.ts';

const personalities = ['focused', 'energetic', 'tough', 'calm'] as const;
const context = { round: 2, cycle: 1, isFinalRound: true, isFinalCycle: true };
function steps(script: SpeechScript) {
  const compiled = compileSpeechScript(script);
  assert.ok(compiled.ok);
  return compiled.steps;
}
const text = (script: SpeechScript) => steps(script).filter((step) => step.kind === 'speak').map((step) => step.text).join(' ');

test('all 36 recovery texts have explicit delivery, matching display text, bounded settings and a minimum budget', () => {
  const ids = new Set<string>();
  for (const locale of SUPPORTED_LOCALES) for (const personality of personalities) for (const kind of ['motivation', 'aspiration'] as const) {
    for (const message of recoveryMessages(locale, personality, kind)) {
      assert.ok(!ids.has(message.id)); ids.add(message.id);
      assert.equal(message.author, 'Laptiva Coach');
      const speech = makeDisplayMessageSpeech(personality, kind, message);
      const result = recoverySpeechScript(speech, personality, locale);
      assert.equal(text(result.script), message.text);
      assert.equal(steps(result.script).length, 3);
      assert.ok(result.minimumBudgetMs >= 6500);
      assert.ok(speechBudgetMs(result.script) < 20000);
      for (const step of steps(result.script)) if (step.kind === 'speak') {
        assert.ok(step.rate >= .8 && step.rate <= 1.3);
        assert.ok(step.pitch >= .8 && step.pitch <= 1.2);
        assert.ok(step.volumeScale > 0 && step.volumeScale <= 1);
      }
      const changed = { ...speech, text: 'Updated copy, with punctuation.' };
      assert.deepEqual(recoverySpeechScript(changed, personality, locale).script, flatSpeechScript(changed));
    }
  }
  assert.equal(ids.size, 36);
});

test('Labs recovery selection is personality-specific, avoids immediate repeats, and survives persistence and engine switches', () => {
  for (const locale of SUPPORTED_LOCALES) for (const personality of personalities) {
    let memory = createDisplayMessageMemory();
    const seen: string[] = [];
    for (let index = 0; index < 6; index++) {
      const selected = selectDisplayMessage('motivation', memory, locale, () => 0, { scriptedPersonality: personality });
      assert.ok(recoveryMessages(locale, personality, 'motivation').some((message) => message.id === selected.message.id));
      assert.notEqual(selected.message.id, seen.at(-1));
      seen.push(selected.message.id);
      memory = createDisplayMessageMemory(JSON.parse(JSON.stringify(selected.memory)), locale);
    }
    const normal = selectDisplayMessage('motivation', memory, locale, () => 0);
    assert.ok(!normal.message.id.startsWith('delivery-'));
    const again = selectDisplayMessage('motivation', normal.memory, locale, () => 0, { scriptedPersonality: personality });
    assert.notEqual(again.message.id, seen.at(-1));
    // A one-item cooldown pool remains usable across workouts, never empty.
    const cooldown = selectDisplayMessage('aspiration', memory, locale, () => 0, { scriptedPersonality: personality });
    assert.equal(selectDisplayMessage('aspiration', cooldown.memory, locale, () => 0, { scriptedPersonality: personality }).message.id, cooldown.message.id);
  }
});

test('authored phase boundaries preserve localized copy; short commands and countdowns remain single utterances', () => {
  for (const locale of SUPPORTED_LOCALES) for (const personality of personalities) {
    for (const phase of ['prepare', 'work', 'rest', 'cycleRest', 'cooldown', 'complete'] as const) {
      const speech = selectPhaseSpeech(personality, phase, context, locale);
      const script = phaseSpeechScript(speech, personality, locale);
      assert.equal(text(script), speech.text);
      if (phase === 'prepare' || phase === 'rest') assert.equal(steps(script).length, 1);
      if (phase === 'cycleRest' || phase === 'work') assert.equal(steps(script).length, 3);
      assert.deepEqual(phaseSpeechScript({ ...speech, text: 'Revised.' }, personality, locale), flatSpeechScript({ ...speech, text: 'Revised.' }));
    }
    for (const count of [3, 2, 1]) {
      const speech = makeCountdownSpeech(personality, count);
      assert.deepEqual(phaseSpeechScript(speech, personality, locale), flatSpeechScript(speech));
    }
  }
});

test('full recovery falls back to flat delivery, cue only, then silence without changing the cutoff', () => {
  for (const locale of SUPPORTED_LOCALES) for (const personality of personalities) {
    const cue = selectPhaseSpeech(personality, 'rest', context, locale);
    const follow = makeDisplayMessageSpeech(personality, 'motivation', recoveryMessages(locale, personality, 'motivation')[0]);
    const full = phaseAnnouncementScript(cue, personality, locale, 30000, follow)!;
    assert.equal(steps(full).length, 5);
    assert.equal(text(full), `${cue.text} ${follow.text}`);
    const flatBudget = speechBudgetMs(flatSpeechScript(cue)) + 400 + speechBudgetMs(flatSpeechScript(follow));
    const compact = phaseAnnouncementScript(cue, personality, locale, flatBudget + 1, follow)!;
    assert.equal(steps(compact).length, 3);
    assert.equal(text(compact), text(full));
    const cueBudget = speechBudgetMs(flatSpeechScript(cue));
    assert.deepEqual(phaseAnnouncementScript(cue, personality, locale, cueBudget + 1, follow), flatSpeechScript(cue));
    assert.equal(phaseAnnouncementScript(cue, personality, locale, cueBudget, follow), null);
    assert.equal(phaseAnnouncementScript(cue, personality, locale, -100, follow), null);
    assert.equal(phaseAnnouncementScript(cue, personality, locale, NaN, follow), null);
    const deadline = workoutSpeechCutoff(20000, true);
    assert.equal(workoutSpeechSchedule(full, 'phase', 0, 20000).mustFinishByMs, deadline);
    assert.equal(deadline, 16750);
  }
});

test('phase emphasis is scoped and never leaks into the recovery settings', () => {
  for (const locale of SUPPORTED_LOCALES) for (const personality of personalities) {
    const cue = selectPhaseSpeech(personality, 'cycleRest', context, locale);
    const follow = makeDisplayMessageSpeech(personality, 'motivation', recoveryMessages(locale, personality, 'motivation')[0]);
    const full = phaseAnnouncementScript(cue, personality, locale, 30000, follow)!;
    const actual = steps(full).slice(-3);
    const expected = steps(recoverySpeechScript(follow, personality, locale).script);
    assert.deepEqual(actual, expected);
  }
});

test('short final-round windows use flat delivery instead of waiting for the emphasized command', () => {
  const cue = selectPhaseSpeech('focused', 'work', context, 'en');
  const budget = speechBudgetMs(flatSpeechScript(cue)) + 1;
  assert.deepEqual(phaseAnnouncementScript(cue, 'focused', 'en', budget), flatSpeechScript(cue));
});

test('invalid follow-up text falls back to the cue without leaving an empty segment or trailing pause', () => {
  const cue = selectPhaseSpeech('focused', 'rest', context, 'en');
  assert.deepEqual(phaseAnnouncementScript(cue, 'focused', 'en', 30000, { ...cue, text: ' ' }), flatSpeechScript(cue));
});

test('all actual workout examples load as equivalent editable DSL scripts', () => {
  for (const locale of SUPPORTED_LOCALES) for (const personality of personalities) {
    const examples = workoutDeliveryExamples(personality, locale);
    assert.equal(examples.length, 5);
    for (const { script, estimatedMs } of examples) {
      assert.ok(Number.isFinite(estimatedMs));
      const parsed = parseSpeechScript(speechScriptMarkup(script), { id: script.id, rate: script.rate, pitch: script.pitch });
      assert.ok(parsed.ok);
      const original = steps(script);
      const roundTrip = steps(parsed.script);
      assert.equal(roundTrip.length, original.length);
      roundTrip.forEach((step, index) => {
        const expected = original[index];
        if (step.kind === 'speak' && expected.kind === 'speak') {
          assert.equal(step.text, expected.text);
          assert.ok(Math.abs(step.rate - expected.rate) < .00001);
          assert.ok(Math.abs(step.pitch - expected.pitch) < .00001);
          assert.equal(step.volumeScale, expected.volumeScale);
        } else assert.deepEqual(step, expected);
      });
    }
  }
});
