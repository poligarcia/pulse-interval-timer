import assert from 'node:assert/strict';
import test from 'node:test';
import { CoachSpeechDirector } from './speech-director.ts';
import { createSpeechController } from './speech-controller.ts';
import type { SpeechVoiceLike } from './speech-controller.ts';
import { parseSpeechScript } from './speech-script.ts';
import { workoutDeliveryExamples } from './workout-delivery-examples.ts';

class Clock {
  now = 0;
  next = 0;
  tasks = new Map<number, { at: number; callback: () => void }>();
  set = (callback: () => void, ms: number) => { const id = ++this.next; this.tasks.set(id, { at: this.now + ms, callback }); return id; };
  clear = (id: unknown) => { this.tasks.delete(id as number); };
  tick(ms: number) {
    const end = this.now + ms;
    for (;;) {
      const next = [...this.tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      this.now = next[1].at; this.tasks.delete(next[0]); next[1].callback();
    }
    this.now = end;
  }
}
class Utterance extends EventTarget {
  text: string;
  voice: SpeechVoiceLike | null = null;
  lang = ''; rate = 1; pitch = 1; volume = 1;
  constructor(text: string) { super(); this.text = text; }
  emit(name: string, error?: string) {
    const event = new Event(name);
    if (error) Object.defineProperty(event, 'error', { value: error });
    this.dispatchEvent(event);
  }
}
function setup() {
  const clock = new Clock();
  const voices: SpeechVoiceLike[] = [{ voiceURI: 'local', lang: 'en-US', localService: true }];
  const spoken: Utterance[] = [];
  let volume = .5;
  const synthesis = {
    speaking: false, pending: false, voices,
    getVoices: () => synthesis.voices,
    speak: (utterance: Utterance) => { spoken.push(utterance); synthesis.pending = true; },
    cancel: () => { synthesis.pending = false; synthesis.speaking = false; spoken.at(-1)?.emit('error', 'canceled'); },
    addEventListener: () => {}, removeEventListener: () => {},
  };
  const controller = createSpeechController({ synthesis, createUtterance: (text) => new Utterance(text), setTimer: clock.set, clearTimer: clock.clear }, { startWatchdogMs: 100, replacementDelayMs: 40 });
  const director = new CoachSpeechDirector({ controller, now: () => clock.now, setTimer: clock.set, clearTimer: clock.clear, masterVolume: () => volume });
  const say = (source = 'One[[pause:450]]Two', extra = {}) => {
    const parsed = parseSpeechScript(source);
    assert.ok(parsed.ok);
    return director.speak(parsed.script, { locale: 'en-US', voiceURI: 'local', ...extra });
  };
  const start = () => { synthesis.pending = false; synthesis.speaking = true; spoken.at(-1)!.emit('start'); };
  const end = () => { synthesis.pending = false; synthesis.speaking = false; spoken.at(-1)!.emit('end'); };
  return { clock, synthesis, spoken, director, say, start, end, setVolume: (value: number) => { volume = value; } };
}

test('one native utterance at a time, explicit pause from end, same voice and dynamic volume', async () => {
  const f = setup(); const handle = f.say('One[[pause:450]][[volume:*0.7]]Two');
  f.start(); f.clock.tick(700); assert.equal(f.spoken.length, 1);
  f.end(); assert.equal(handle.state, 'pausing');
  f.setVolume(.2); f.clock.tick(449); assert.equal(f.spoken.length, 1);
  f.clock.tick(1); assert.equal(f.spoken.length, 2);
  assert.equal(f.spoken[1].volume, .2 * .7);
  assert.equal(f.spoken[0].voice, f.spoken[1].voice);
  f.start(); f.end(); assert.deepEqual(await handle.done, { status: 'completed' });
  assert.equal(f.clock.tasks.size, 0);
});
test('cancel during a pause clears all remaining speech and settles once', async () => {
  const f = setup(); const handle = f.say(); f.start(); f.end(); handle.cancel(); handle.cancel();
  f.clock.tick(5000); assert.equal(f.spoken.length, 1);
  assert.equal((await handle.done).status, 'canceled'); assert.equal(f.clock.tasks.size, 0);
});
test('interrupt replaces the complete script and ignores synchronous cancel errors and stale end events', async () => {
  const f = setup(); const first = f.say(); f.start(); const old = f.spoken[0];
  const next = f.say('BEGIN!', { interrupt: true });
  old.emit('end'); f.clock.tick(40); assert.equal(f.spoken.length, 2);
  f.start(); f.end(); f.clock.tick(5000);
  assert.equal((await first.done).status, 'canceled'); assert.equal((await next.done).status, 'completed'); assert.equal(f.spoken.length, 2);
});
test('higher priority preempts motivation and queued handle cancellation leaves active speech alone', async () => {
  const f = setup(); const motivation = f.say('Long phrase', { priority: 100 }); f.start();
  const queued = f.say('Later', { priority: 100 }); queued.cancel(); assert.equal(motivation.state, 'speaking');
  const critical = f.say('Three', { priority: 300 }); f.clock.tick(40); f.start(); f.end();
  assert.equal((await motivation.done).status, 'canceled'); assert.equal((await critical.done).status, 'completed'); assert.equal((await queued.done).status, 'canceled');
});
test('deadlines survive segment advancement and cut off native speech', async () => {
  const f = setup(); const handle = f.say('One[[pause:450]]Two', { mustFinishByMs: 1000 });
  f.start(); f.end(); f.clock.tick(450); f.start(); f.clock.tick(550);
  assert.equal((await handle.done).status, 'expired'); assert.equal(f.synthesis.speaking, false); assert.equal(f.clock.tasks.size, 0);
});
test('deadline during pause or queue never starts stale text', async () => {
  const f = setup(); const first = f.say('One[[pause:450]]Two', { mustFinishByMs: 300 }); f.start(); f.end();
  const queued = f.say('Later', { mustStartByMs: 200 }); f.clock.tick(1000);
  assert.equal((await first.done).status, 'expired'); assert.equal((await queued.done).status, 'expired'); assert.equal(f.spoken.length, 1);
});
test('missing start retries once, while a started segment never retries after an error', async () => {
  const f = setup(); const handle = f.say('One'); f.clock.tick(140); assert.equal(f.spoken.length, 2);
  f.start(); f.spoken[1].emit('error', 'synthesis-failed'); f.clock.tick(1000);
  assert.equal((await handle.done).status, 'failed'); assert.equal(f.spoken.length, 2);
});
test('missing end fails by watchdog and does not hang the logical operation', async () => {
  const f = setup(); const handle = f.say('One'); f.start(); f.clock.tick(30000);
  assert.deepEqual(await handle.done, { status: 'failed', reason: 'end-timeout' }); assert.equal(f.clock.tasks.size, 0);
});
test('hiding cancels speech and foreground never replays a partial script', async () => {
  const f = setup(); const handle = f.say(); f.start(); f.end(); f.director.setVisible(false); f.clock.tick(2000); f.director.setVisible(true);
  assert.equal((await handle.done).status, 'canceled'); assert.equal(f.spoken.length, 1);
});
test('voice removal between segments fails rather than selecting another voice', async () => {
  const f = setup(); const handle = f.say(); f.start(); f.end();
  f.synthesis.voices = [{ voiceURI: 'different', lang: 'en-US' }]; f.clock.tick(450);
  assert.deepEqual(await handle.done, { status: 'failed', reason: 'voice-unavailable' }); assert.equal(f.spoken.length, 1);
});
test('admission rejects optional scripts and expired work without touching active speech', async () => {
  const f = setup(); const current = f.say('Current'); f.start();
  const rejected = f.say('Long phrase', { interrupt: true, mustFinishByMs: 500, admissionBudgetMs: 2000 });
  const expired = f.say('Old', { mustStartByMs: 0 });
  assert.equal((await rejected.done).status, 'dropped'); assert.equal((await expired.done).status, 'expired'); assert.equal(current.state, 'speaking'); f.end();
});

test('deadline cancels scheduled retries and late start callbacks cannot revive expired speech', async () => {
  const f = setup(); const handle = f.say('One', { mustStartByMs: 120 });
  f.clock.tick(100); f.clock.tick(20);
  f.spoken[0].emit('start'); f.spoken[0].emit('end'); f.clock.tick(1000);
  assert.equal((await handle.done).status, 'expired'); assert.equal(f.spoken.length, 1); assert.equal(f.clock.tasks.size, 0);
});

test('strict voice resolution checks again before retry and never falls back to a different voice', async () => {
  const f = setup(); const handle = f.say('One'); f.clock.tick(100);
  f.synthesis.voices = [{ voiceURI: 'replacement', lang: 'en-US' }]; f.clock.tick(40);
  assert.equal((await handle.done).status, 'failed'); assert.equal(f.spoken.length, 1);
});

test('a real recovery script is canceled during its internal pause and cannot spill into the real countdown', async () => {
  const f = setup();
  const recovery = workoutDeliveryExamples('calm', 'en').find((example) => example.label === 'Recovery 1')!.script;
  const handle = f.director.speak(recovery, { locale: 'en-US', voiceURI: 'local', priority: 400, interrupt: true, mustFinishByMs: 1000 });
  f.start(); f.end(); // Phase cue, followed by the 400 ms inter-phrase pause.
  f.clock.tick(400); f.start(); f.end(); // First recovery thought, then its authored 700 ms pause.
  assert.equal(handle.state, 'pausing');
  assert.equal(f.spoken.length, 2);
  f.clock.tick(600);
  assert.equal((await handle.done).status, 'expired');
  const countdown = f.say('Three', { priority: 300, interrupt: true, mustFinishByMs: 2000 });
  f.start(); f.end(); f.clock.tick(2000);
  assert.equal((await countdown.done).status, 'completed');
  assert.deepEqual(f.spoken.map((utterance) => utterance.text), ['Recover.', 'Let your shoulders soften.', 'Three']);
  assert.equal(f.clock.tasks.size, 0);
});
