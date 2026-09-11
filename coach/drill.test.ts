import assert from 'node:assert/strict';
import test from 'node:test';
import { DRILL_LINES, drillAvailable, drillBudget, drillExamples, drillPreviewScript, drillScript, drillText, fitDrillScript, nextDrillSlot, parseDrillMemory, pickDrill, planDrillWorkout, rememberDrill, resumeDrillPlan } from './drill.ts';
import { compileSpeechScript } from './speech-script.ts';
import { parseSpeechScript } from './speech-script.ts';
import { speechScriptMarkup } from './workout-delivery-examples.ts';
import type { SpeechScript } from './speech-script.ts';
import { resolveCoachPersonality } from './personalities.ts';
import type { CoachPhase } from './types.ts';

const work = (duration: number, round = 1): CoachPhase => ({ kind: 'work', duration, round, cycle: 1 });
function rng(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function steps(script: SpeechScript) {
  const result = compileSpeechScript(script);
  assert.ok(result.ok);
  return result.steps;
}

test('all 70 phrases have explicit delivery; full and compact preserve words, IDs and volume bounds', () => {
  const bank = Object.values(DRILL_LINES).flat();
  assert.equal(bank.length, 70);
  for (const line of bank) {
    assert.ok(line.source.includes('[['), line.id);
    assert.ok(!line.source.includes('|'), line.id);
    const full = drillScript(line, { round: 3 });
    const compact = drillScript(line, { round: 3 }, true);
    assert.equal(full.id, compact.id);
    assert.equal(drillText(full), drillText(compact));
    assert.ok(drillBudget(compact) <= drillBudget(full), line.id);
    for (const script of [full, compact]) {
      const compiled = steps(script);
      for (const step of compiled) if (step.kind === 'speak') {
        assert.ok(step.volumeScale >= .8 && step.volumeScale <= 1);
        assert.ok(!step.text.includes('[[') && !step.text.includes('{round}'));
      }
      const serialized = parseSpeechScript(speechScriptMarkup(script), { id: script.id, rate: script.rate, pitch: script.pitch });
      assert.ok(serialized.ok);
      assert.deepEqual(steps(serialized.script), compiled, `Labs must reproduce ${line.id}`);
    }
  }
});

test('commands accelerate, cooldown slows, punchlines have contrast, safety stays full volume', () => {
  const command = steps(drillScript(DRILL_LINES.final[0])).filter((s) => s.kind === 'speak');
  assert.equal(command[0].volumeScale, .9);
  assert.equal(command[1].volumeScale, 1);
  assert.ok(Math.abs(command[1].rate - 1.26) < 1e-9);
  for (const line of DRILL_LINES.cooldown) {
    const speech = steps(drillScript(line)).filter((s) => s.kind === 'speak');
    assert.ok(speech[1].rate < speech[0].rate, line.id);
    assert.equal(speech[1].volumeScale, 1);
  }
  const joke = steps(drillScript(DRILL_LINES.mind[0]));
  assert.ok(joke.some((s) => s.kind === 'pause' && s.ms === 650));
  const speech = joke.filter((s) => s.kind === 'speak');
  assert.ok(speech[1].rate < speech[0].rate && speech[1].pitch < speech[0].pitch);
  assert.equal(speech[1].volumeScale, .85);
  for (const step of steps(drillScript(DRILL_LINES.pause[6]))) if (step.kind === 'speak') assert.equal(step.volumeScale, 1);
});

test('fit selects full then compact then silence without mutating the authored performance', () => {
  for (const line of Object.values(DRILL_LINES).flat()) {
    const full = drillScript(line);
    const compact = drillScript(line, {}, true);
    assert.deepEqual(fitDrillScript(line, drillBudget(full) + 1), full);
    if (drillBudget(compact) < drillBudget(full)) assert.deepEqual(fitDrillScript(line, drillBudget(full)), compact);
    assert.equal(fitDrillScript(line, drillBudget(compact)), null);
    assert.deepEqual(drillScript(line), full);
  }
});

test('all six fake performances are distinct and both versions retain an audible reveal', () => {
  const deliveries = new Set<string>();
  for (const line of DRILL_LINES.fake) {
    for (const compact of [false, true]) {
      const compiled = steps(drillScript(line, {}, compact));
      const speech = compiled.filter((s) => s.kind === 'speak');
      assert.equal(speech.length, 2);
      assert.equal(speech[0].text, 'Five, four, three, two.');
      assert.match(speech[1].text, /working|remains/);
      assert.ok(compiled.some((s) => s.kind === 'pause'));
      assert.ok(drillBudget(drillScript(line, {}, compact)) < 6750);
      if (!compact) deliveries.add(JSON.stringify(speech[1], ['rate', 'pitch', 'volumeScale']));
    }
  }
  assert.equal(deliveries.size, 6);
});

test('auditions include every phrase, post-pause endings and the actual Settings preview', () => {
  const examples = drillExamples();
  for (const line of Object.values(DRILL_LINES).flat()) assert.ok(examples.some((entry) => entry.script.id === line.id));
  assert.equal(examples.filter((entry) => entry.label.startsWith('Completion after pausing')).length, 3);
  const preview = drillPreviewScript();
  assert.deepEqual(examples.find((entry) => entry.script.id === 'drill-preview')?.script, preview);
  const played = steps(preview).filter((s) => s.kind === 'speak');
  assert.deepEqual(played.slice(0, 2), steps(drillScript(DRILL_LINES.final[0])).filter((s) => s.kind === 'speak'));
  assert.deepEqual(played.slice(2), steps(drillScript(DRILL_LINES.mind[0])).filter((s) => s.kind === 'speak'));
  assert.ok(drillBudget(preview) < 10000);
});

test('Drill requires every gate, stays English-only, and Surprise never selects it', () => {
  assert.equal(drillAvailable('en', true, true, true), true);
  for (const locale of ['es', 'pt']) assert.equal(drillAvailable(locale, true, true, true), false);
  for (let missing = 0; missing < 3; missing++) {
    const flags = [true, true, true]; flags[missing] = false;
    assert.equal(drillAvailable('en', flags[0], flags[1], flags[2]), false);
  }
  const results = new Set(Array.from({ length: 1000 }, (_, n) => resolveCoachPersonality('surprise', () => n / 1000)));
  assert.deepEqual(results, new Set(['focused', 'energetic', 'tough', 'calm']));
  assert.equal(resolveCoachPersonality('drill'), 'drill');
});

test('all authored dialogue compiles, IDs are unique, and every fake fits the protected window', () => {
  const examples = drillExamples();
  assert.equal(new Set(examples.map(({ script }) => script.id)).size, examples.length);
  for (const { script } of examples) assert.equal(compileSpeechScript(script).ok, true, script.id);
  assert.ok(DRILL_LINES.fake.length >= 5);
  assert.ok(DRILL_LINES.pause.length >= 5);
  for (const line of DRILL_LINES.fake) assert.ok(drillBudget(drillScript(line)) < 6750, line.id);
});

test('planning adapts to interval length, disables optional speech, and does not change timing', () => {
  const short = planDrillWorkout([work(5)], [], () => 0);
  assert.equal(short.phases[0].script, null);
  assert.equal(short.phases[0].slots.length, 0);
  const long = planDrillWorkout([work(30)], [], () => 0);
  assert.ok(long.phases[0].script);
  assert.equal(long.phases[0].slots.filter((s) => s.kind === 'fake').length, 1);
  assert.ok(long.phases[0].slots.length > 1);
  const phases = [work(60), { ...work(30), kind: 'rest' as const }];
  const before = structuredClone(phases);
  const quiet = planDrillWorkout(phases, [], () => 0, false);
  assert.equal(quiet.phases.flatMap((p) => p.slots).length, 0);
  assert.equal(quiet.phases[1].script?.id, 'drill-short-rest');
  assert.deepEqual(phases, before);
  assert.equal(quiet.phases.at(-1)?.endMs, 90000);
});

test('plans reserve cue spacing, reveal budgets and real countdowns across randomized workouts', () => {
  const phases: CoachPhase[] = [
    { ...work(20), kind: 'prepare' }, work(5), { ...work(5), kind: 'rest' }, work(15, 2),
    { ...work(10), kind: 'cycleRest' }, work(30, 3), { ...work(30), kind: 'rest' },
    work(60, 4), { ...work(20), kind: 'cooldown' },
  ];
  let withFake = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const plan = planDrillWorkout(phases, [], rng(seed));
    const fakes = plan.phases.flatMap((p) => p.slots).filter((s) => s.kind === 'fake');
    assert.ok(fakes.length <= 1);
    withFake += fakes.length;
    for (const [i, phase] of plan.phases.entries()) {
      const cutoff = phase.endMs - (['prepare', 'work', 'rest'].includes(phases[i].kind) ? 3250 : 250);
      let priorEnd = phase.startMs + (phase.script ? drillBudget(phase.script) + 700 : 0);
      if (phase.script) assert.ok(priorEnd < cutoff);
      for (const slot of phase.slots) {
        assert.ok(slot.atMs >= priorEnd);
        assert.ok(slot.startByMs >= slot.atMs);
        assert.ok(slot.atMs + drillBudget(slot.script) < slot.finishByMs);
        assert.ok(slot.finishByMs <= cutoff);
        if (slot.kind === 'fake') {
          assert.ok(phases[i].duration >= 30);
          assert.equal(slot.atMs, phase.endMs - 10000);
        }
        priorEnd = slot.finishByMs;
      }
    }
  }
  assert.ok(withFake > 160 && withFake < 240, `fake frequency ${withFake}/1000`);
});

test('overdue or already attempted speech is discarded; resume cannot create new fake slots', () => {
  const plan = planDrillWorkout([work(30)], [], () => 0);
  const fake = plan.phases[0].slots.find((s) => s.kind === 'fake')!;
  assert.equal(nextDrillSlot(plan, 0, 0), undefined);
  assert.equal(nextDrillSlot(plan, 0, fake.startByMs + 1), undefined);
  assert.equal(nextDrillSlot(plan, 0, fake.atMs), undefined);
  const fresh = planDrillWorkout([work(30)], [], () => 0);
  const ids = fresh.phases[0].slots.map((s) => s.script.id);
  fresh.pauses++;
  resumeDrillPlan(fresh, 18000);
  assert.equal(nextDrillSlot(fresh, 0, 20000), undefined);
  assert.deepEqual(fresh.phases[0].slots.map((s) => s.script.id), ids);
});

test('on-time slots are delivered once, and praise waits after a pause', () => {
  const plan = planDrillWorkout([work(60)], [], () => 0);
  const slot = plan.phases[0].slots[0];
  assert.equal(nextDrillSlot(plan, 0, slot.atMs), slot);
  assert.equal(nextDrillSlot(plan, 0, slot.atMs), undefined);
  const paused = planDrillWorkout([work(60)], [], () => 0);
  paused.phases[0].slots[0].kind = 'praise';
  paused.pauses = 1;
  paused.resumedAtMs = 0;
  assert.equal(nextDrillSlot(paused, 0, paused.phases[0].slots[0].atMs), undefined);
});

test('memory validates stored data, rotates phrases and never repeats the last fake even when pools exhausted', () => {
  assert.deepEqual(parseDrillMemory(null), { unlocked: false, recent: [] });
  assert.deepEqual(parseDrillMemory({ unlocked: 'yes', recent: [42, 'bad', 'drill-pause-0'], lastFake: 'bad' }), { unlocked: false, recent: ['drill-pause-0'], lastFake: undefined });
  let memory = parseDrillMemory({ unlocked: true });
  memory = rememberDrill(memory, 'drill-fake-0');
  for (let i = 0; i < 25; i++) memory = rememberDrill(memory, `drill-motivation-${i}`);
  assert.equal(memory.recent.length, 20);
  assert.equal(memory.lastFake, 'drill-fake-0');
  const remembered = rememberDrill(memory, memory.recent[0]);
  assert.equal(new Set(remembered.recent).size, 20);
  assert.notEqual(pickDrill('pause', ['drill-pause-0'], () => 0).id, 'drill-pause-0');
  const plan = planDrillWorkout([work(30)], DRILL_LINES.fake.map((line) => line.id), () => 0, true, 'drill-fake-0');
  assert.notEqual(plan.phases[0].slots.find((s) => s.kind === 'fake')?.script.id, 'drill-fake-0');
});

test('a sufficiently long Prepare receives a truthful mission briefing', () => {
  const plan = planDrillWorkout([{ ...work(30), kind: 'prepare' }, work(40), { ...work(20), kind: 'rest' }, work(40, 2)], [], () => 0);
  const briefing = plan.phases[0].script!;
  assert.equal(briefing.id, 'drill-briefing');
  assert.match(JSON.stringify(briefing), /2 work intervals/);
  assert.match(JSON.stringify(briefing), /Work 40 seconds. Recover 20/);
});
