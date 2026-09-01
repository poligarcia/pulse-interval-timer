import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSpeechController,
  selectSpeechVoice,
} from './speech-controller.ts';
import type {
  SpeechControllerOptions,
  SpeechSynthesisLike,
  SpeechUtteranceLike,
  SpeechVisibilitySource,
  SpeechVoiceLike,
} from './speech-controller.ts';

type FakeVoice = SpeechVoiceLike & { name: string };
type UtteranceEventType = 'start' | 'end' | 'error';

type StoredListener = {
  listener: EventListenerOrEventListenerObject;
  once: boolean;
};

class FakeUtterance implements SpeechUtteranceLike<FakeVoice> {
  voice: FakeVoice | null = null;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  readonly text: string;
  private readonly listeners = new Map<UtteranceEventType, StoredListener[]>();

  constructor(text: string) {
    this.text = text;
  }

  addEventListener(
    type: UtteranceEventType,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ) {
    const once = typeof options === 'object' && options.once === true;
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ listener, once });
    this.listeners.set(type, listeners);
  }

  emit(type: UtteranceEventType, code?: string) {
    const event = new Event(type);
    if (code) Object.defineProperty(event, 'error', { value: code });
    const listeners = [...(this.listeners.get(type) ?? [])];
    for (const stored of listeners) {
      if (typeof stored.listener === 'function') stored.listener(event);
      else stored.listener.handleEvent(event);
      if (stored.once) {
        const current = this.listeners.get(type) ?? [];
        this.listeners.set(type, current.filter((candidate) => candidate !== stored));
      }
    }
  }
}

class FakeSynthesis implements SpeechSynthesisLike<FakeVoice, FakeUtterance> {
  speaking = false;
  pending = false;
  cancelCalls = 0;
  getVoicesCalls = 0;
  throwsOnSpeak = 0;
  voices: FakeVoice[];
  readonly spoken: FakeUtterance[] = [];
  private readonly voiceListeners = new Set<EventListenerOrEventListenerObject>();

  constructor(voices: FakeVoice[]) {
    this.voices = voices;
  }

  getVoices = () => {
    this.getVoicesCalls += 1;
    return [...this.voices];
  };

  speak = (utterance: FakeUtterance) => {
    if (this.throwsOnSpeak > 0) {
      this.throwsOnSpeak -= 1;
      throw new Error('speak failed');
    }
    this.spoken.push(utterance);
    this.pending = true;
  };

  cancel = () => {
    this.cancelCalls += 1;
    this.pending = false;
    this.speaking = false;
  };

  addEventListener = (
    _type: 'voiceschanged',
    listener: EventListenerOrEventListenerObject,
  ) => {
    this.voiceListeners.add(listener);
  };

  removeEventListener = (
    _type: 'voiceschanged',
    listener: EventListenerOrEventListenerObject,
  ) => {
    this.voiceListeners.delete(listener);
  };

  emitVoicesChanged() {
    const event = new Event('voiceschanged');
    for (const listener of this.voiceListeners) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  }

  emitStart(utterance: FakeUtterance) {
    this.pending = false;
    this.speaking = true;
    utterance.emit('start');
  }

  emitEnd(utterance: FakeUtterance) {
    this.pending = false;
    this.speaking = false;
    utterance.emit('end');
  }

  emitError(utterance: FakeUtterance, code: string) {
    this.pending = false;
    this.speaking = false;
    utterance.emit('error', code);
  }
}

type TimerTask = {
  atMs: number;
  callback: () => void;
};

class FakeTimers {
  nowMs = 0;
  private nextHandle = 1;
  private readonly tasks = new Map<number, TimerTask>();

  setTimer = (callback: () => void, delayMs: number) => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.tasks.set(handle, { atMs: this.nowMs + delayMs, callback });
    return handle;
  };

  clearTimer = (handle: number) => {
    this.tasks.delete(handle);
  };

  advanceBy(delayMs: number) {
    const targetMs = this.nowMs + delayMs;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.atMs <= targetMs)
        .sort((left, right) => left[1].atMs - right[1].atMs || left[0] - right[0])[0];
      if (!next) break;
      const [handle, task] = next;
      this.tasks.delete(handle);
      this.nowMs = task.atMs;
      task.callback();
    }
    this.nowMs = targetMs;
  }

  get pendingCount() {
    return this.tasks.size;
  }
}

class FakeVisibility implements SpeechVisibilitySource {
  visible = true;
  private readonly listeners = new Set<() => void>();

  isVisible = () => this.visible;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setVisible(visible: boolean) {
    this.visible = visible;
    for (const listener of this.listeners) listener();
  }
}

const esArLocal: FakeVoice = {
  default: false,
  lang: 'es-AR',
  localService: true,
  name: 'Local AR',
  voiceURI: 'local-es-ar',
};

function fixture(
  voices: FakeVoice[] = [esArLocal],
  options: SpeechControllerOptions = {},
  visibility?: FakeVisibility,
) {
  const synthesis = new FakeSynthesis(voices);
  const timers = new FakeTimers();
  const controller = createSpeechController<FakeVoice, FakeUtterance, number>({
    synthesis,
    createUtterance: (text) => new FakeUtterance(text),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    visibility,
  }, {
    replacementDelayMs: 10,
    startWatchdogMs: 100,
    voiceWaitMs: 100,
    retryLimit: 1,
    ...options,
  });
  return { controller, synthesis, timers };
}

test('voice resolution honors a compatible URI, then exact locale, then language family, preferring local voices', () => {
  const voices: FakeVoice[] = [
    { name: 'Exact remote preferred', voiceURI: 'preferred', lang: 'es_AR', localService: false },
    { name: 'Exact local', voiceURI: 'exact-local', lang: 'es-AR', localService: true },
    { name: 'Family local', voiceURI: 'family-local', lang: 'es-ES', localService: true },
    { name: 'English', voiceURI: 'english', lang: 'en-US', localService: true },
  ];

  assert.equal(selectSpeechVoice(voices, 'es-AR', 'preferred')?.voiceURI, 'preferred');
  assert.equal(selectSpeechVoice(voices, 'es-AR')?.voiceURI, 'exact-local');
  assert.equal(selectSpeechVoice(voices, 'es-MX')?.voiceURI, 'exact-local');
  assert.equal(selectSpeechVoice(voices, 'es-AR', 'english')?.voiceURI, 'exact-local');
  assert.equal(selectSpeechVoice(voices, 'fr-FR'), null);
});

test('an empty preferred URI is treated as no preference and is not frozen', () => {
  const voices: FakeVoice[] = [
    { name: 'Empty remote', voiceURI: '', lang: 'es-AR', localService: false },
    esArLocal,
  ];

  assert.equal(selectSpeechVoice(voices, 'es-AR', '')?.voiceURI, esArLocal.voiceURI);
});

test('refreshes voices immediately and publishes later voiceschanged updates', () => {
  const initial = [esArLocal];
  const { controller, synthesis } = fixture(initial);
  const snapshots: string[][] = [];
  const unsubscribe = controller.subscribeVoices((voices) => {
    snapshots.push(voices.map((voice) => voice.voiceURI));
  });

  assert.equal(synthesis.getVoicesCalls, 1);
  assert.deepEqual(snapshots, [['local-es-ar']]);

  synthesis.voices = [
    esArLocal,
    { name: 'English', voiceURI: 'local-en', lang: 'en-US', localService: true },
  ];
  synthesis.emitVoicesChanged();
  assert.deepEqual(snapshots, [['local-es-ar'], ['local-es-ar', 'local-en']]);

  unsubscribe();
  controller.dispose();
  synthesis.voices = [];
  synthesis.emitVoicesChanged();
  assert.equal(snapshots.length, 2);
});

test('submits the cold-start fallback synchronously, then safely upgrades it when voices arrive', () => {
  const { controller, synthesis, timers } = fixture([]);
  const handle = controller.speak({ text: 'Empezá', locale: 'es-AR', interrupt: true });

  assert.equal(handle?.state, 'pending');
  assert.equal(synthesis.spoken.length, 1);
  assert.equal(handle?.utterance?.voice, null);
  assert.equal(handle?.utterance?.lang, 'es-AR');
  assert.equal(synthesis.cancelCalls, 0);
  assert.equal(timers.pendingCount, 1);

  synthesis.voices = [esArLocal];
  synthesis.emitVoicesChanged();

  assert.equal(synthesis.cancelCalls, 1);
  assert.equal(handle?.state, 'scheduled');
  assert.equal(synthesis.spoken.length, 1);
  timers.advanceBy(10);

  assert.equal(synthesis.spoken.length, 2);
  assert.equal(handle?.utterance?.voice, esArLocal);
  assert.equal(handle?.utterance?.lang, 'es-AR');
  assert.equal(timers.pendingCount, 1);
});

test('does not replace a cold-start fallback that has already begun speaking', () => {
  const { controller, synthesis } = fixture([]);
  const seenVoices: Array<string | null> = [];
  const handle = controller.speak({
    text: 'Activación',
    locale: 'es-AR',
    onStart: (_event, context) => seenVoices.push(context.voice?.voiceURI ?? null),
    onEnd: (_event, context) => seenVoices.push(context.voice?.voiceURI ?? null),
  });
  const fallback = synthesis.spoken[0];

  synthesis.emitStart(fallback);
  synthesis.voices = [esArLocal];
  synthesis.emitVoicesChanged();

  assert.equal(synthesis.cancelCalls, 0);
  assert.equal(synthesis.spoken.length, 1);
  assert.equal(handle?.state, 'speaking');
  synthesis.emitEnd(fallback);
  assert.equal(handle?.state, 'ended');
  assert.deepEqual(seenVoices, [null, null]);
});

test('an interrupting first request speaks synchronously without cancelling an idle engine', () => {
  const { controller, synthesis } = fixture();

  const handle = controller.speak({ text: 'Primera ronda', locale: 'es-AR', interrupt: true });

  assert.equal(synthesis.cancelCalls, 0);
  assert.equal(synthesis.spoken.length, 1);
  assert.equal(handle?.state, 'pending');
});

test('replacement cancels an active utterance and defers the new speak call', () => {
  const { controller, synthesis, timers } = fixture();
  let staleEnds = 0;
  const first = controller.speak({
    text: 'Anterior',
    locale: 'es-AR',
    interrupt: true,
    onEnd: () => { staleEnds += 1; },
  });
  const oldUtterance = synthesis.spoken[0];

  const replacement = controller.speak({ text: 'Nueva', locale: 'es-AR', interrupt: true });

  assert.equal(synthesis.cancelCalls, 1);
  assert.equal(first?.state, 'canceled');
  assert.equal(replacement?.state, 'scheduled');
  assert.equal(synthesis.spoken.length, 1);

  oldUtterance.emit('end');
  assert.equal(staleEnds, 0);
  timers.advanceBy(9);
  assert.equal(synthesis.spoken.length, 1);
  timers.advanceBy(1);
  assert.equal(synthesis.spoken.length, 2);
  assert.equal(replacement?.state, 'pending');
});

test('non-interrupting requests use the controller queue', () => {
  const { controller, synthesis } = fixture();
  const first = controller.speak({ text: 'Uno', locale: 'es-AR' });
  const second = controller.speak({ text: 'Dos', locale: 'es-AR' });

  assert.equal(first?.state, 'pending');
  assert.equal(second?.state, 'queued');
  assert.equal(synthesis.spoken.length, 1);

  synthesis.emitStart(synthesis.spoken[0]);
  synthesis.emitEnd(synthesis.spoken[0]);

  assert.equal(first?.state, 'ended');
  assert.equal(second?.state, 'pending');
  assert.equal(synthesis.spoken.length, 2);
  assert.equal(synthesis.spoken[1].text, 'Dos');
});

test('reports start and end with the selected voice and updates the handle state', () => {
  const { controller, synthesis, timers } = fixture();
  const events: string[] = [];
  const handle = controller.speak({
    text: 'Trabajo',
    locale: 'es-AR',
    rate: 20,
    pitch: -1,
    volume: 2,
    onStart: (_event, context) => events.push(`start:${context.attempt}:${context.voice?.voiceURI}`),
    onEnd: (_event, context) => events.push(`end:${context.attempt}:${context.voice?.voiceURI}`),
  });
  const utterance = synthesis.spoken[0];

  assert.equal(utterance.rate, 10);
  assert.equal(utterance.pitch, 0);
  assert.equal(utterance.volume, 1);
  synthesis.emitStart(utterance);
  assert.equal(handle?.state, 'speaking');
  assert.equal(timers.pendingCount, 0);
  synthesis.emitEnd(utterance);

  assert.equal(handle?.state, 'ended');
  assert.deepEqual(events, ['start:1:local-es-ar', 'end:1:local-es-ar']);
});

test('the no-start watchdog retries once, cancels the stuck native attempt, and ignores stale callbacks', () => {
  const { controller, synthesis, timers } = fixture();
  const failures: Array<{ attempt: number; willRetry: boolean }> = [];
  let starts = 0;
  let ends = 0;
  const handle = controller.speak({
    text: 'No arranca',
    locale: 'es-AR',
    onStart: () => { starts += 1; },
    onEnd: () => { ends += 1; },
    onError: ({ attempt, willRetry }) => failures.push({ attempt, willRetry }),
  });
  const staleUtterance = synthesis.spoken[0];

  timers.advanceBy(100);
  assert.equal(synthesis.cancelCalls, 1);
  assert.equal(handle?.state, 'scheduled');
  assert.deepEqual(failures, [{ attempt: 1, willRetry: true }]);

  timers.advanceBy(10);
  assert.equal(synthesis.spoken.length, 2);
  assert.equal(handle?.state, 'pending');

  staleUtterance.emit('start');
  staleUtterance.emit('end');
  assert.equal(starts, 0);
  assert.equal(ends, 0);
  assert.equal(handle?.state, 'pending');

  timers.advanceBy(100);
  assert.equal(synthesis.cancelCalls, 2);
  assert.equal(handle?.state, 'failed');
  assert.deepEqual(failures, [
    { attempt: 1, willRetry: true },
    { attempt: 2, willRetry: false },
  ]);
  timers.advanceBy(100);
  assert.equal(synthesis.spoken.length, 2);
});

test('a retryable native error retries exactly once without cancelling an already-idle engine', () => {
  const { controller, synthesis, timers } = fixture();
  const failures: Array<{ code: string; willRetry: boolean }> = [];
  const handle = controller.speak({
    text: 'Red',
    locale: 'es-AR',
    onError: ({ code, willRetry }) => failures.push({ code, willRetry }),
  });

  synthesis.emitError(synthesis.spoken[0], 'network');
  assert.equal(handle?.state, 'scheduled');
  assert.equal(synthesis.cancelCalls, 0);
  timers.advanceBy(10);
  synthesis.emitError(synthesis.spoken[1], 'network');

  assert.equal(handle?.state, 'failed');
  assert.equal(synthesis.cancelCalls, 0);
  assert.equal(synthesis.spoken.length, 2);
  assert.deepEqual(failures, [
    { code: 'network', willRetry: true },
    { code: 'network', willRetry: false },
  ]);
  timers.advanceBy(100);
  assert.equal(synthesis.spoken.length, 2);
});

test('a non-retryable native error fails immediately without cancelling an idle engine', () => {
  const { controller, synthesis, timers } = fixture();
  const failures: Array<{ code: string; willRetry: boolean }> = [];
  const handle = controller.speak({
    text: 'Permiso',
    locale: 'es-AR',
    onError: ({ code, willRetry }) => failures.push({ code, willRetry }),
  });

  synthesis.emitError(synthesis.spoken[0], 'not-allowed');

  assert.equal(handle?.state, 'failed');
  assert.equal(synthesis.cancelCalls, 0);
  assert.deepEqual(failures, [{ code: 'not-allowed', willRetry: false }]);
  assert.equal(timers.pendingCount, 0);
});

test('a synchronous speak failure retries without treating the unsubmitted utterance as active', () => {
  const { controller, synthesis, timers } = fixture();
  synthesis.throwsOnSpeak = 1;

  const handle = controller.speak({ text: 'Intento', locale: 'es-AR' });

  assert.equal(handle?.state, 'scheduled');
  assert.equal(synthesis.cancelCalls, 0);
  assert.equal(synthesis.spoken.length, 0);
  timers.advanceBy(10);
  assert.equal(handle?.state, 'pending');
  assert.equal(synthesis.spoken.length, 1);
});

test('a newer generation clears a scheduled retry so stale work cannot speak', () => {
  const { controller, synthesis, timers } = fixture();
  const stale = controller.speak({ text: 'Vieja', locale: 'es-AR' });
  synthesis.emitError(synthesis.spoken[0], 'network');
  assert.equal(stale?.state, 'scheduled');

  const current = controller.speak({ text: 'Actual', locale: 'es-AR', interrupt: true });
  assert.equal(stale?.state, 'canceled');
  assert.equal(current?.state, 'pending');
  assert.equal(synthesis.spoken.length, 2);

  timers.advanceBy(100);
  assert.equal(synthesis.spoken.length, 2);
});

test('hiding invalidates and cancels active speech; showing does not replay it', () => {
  const visibility = new FakeVisibility();
  const { controller, synthesis, timers } = fixture([esArLocal], {}, visibility);
  let ends = 0;
  const handle = controller.speak({
    text: 'Ocultable',
    locale: 'es-AR',
    onEnd: () => { ends += 1; },
  });
  const staleUtterance = synthesis.spoken[0];

  visibility.setVisible(false);
  assert.equal(handle?.state, 'canceled');
  assert.equal(synthesis.cancelCalls, 1);
  assert.equal(timers.pendingCount, 0);

  staleUtterance.emit('end');
  visibility.setVisible(true);
  timers.advanceBy(100);
  assert.equal(ends, 0);
  assert.equal(synthesis.spoken.length, 1);
});

test('a request made while hidden is canceled explicitly and never submitted', () => {
  const visibility = new FakeVisibility();
  visibility.visible = false;
  const { controller, synthesis } = fixture([esArLocal], {}, visibility);
  const failures: string[] = [];

  const handle = controller.speak({
    text: 'Invisible',
    locale: 'es-AR',
    onError: ({ code }) => failures.push(code),
  });

  assert.equal(handle?.state, 'canceled');
  assert.equal(synthesis.spoken.length, 0);
  assert.equal(synthesis.cancelCalls, 0);
  assert.deepEqual(failures, ['visibility-hidden']);
});

test('cancel does not touch the native engine when the controller is idle', () => {
  const { controller, synthesis } = fixture();

  controller.cancel();

  assert.equal(synthesis.cancelCalls, 0);
});

test('after a silent default attempt, voice wait fails terminally if no explicit voice appears', () => {
  const { controller, synthesis, timers } = fixture([]);
  const failures: Array<{ code: string; attempt: number; willRetry: boolean }> = [];
  const handle = controller.speak({
    text: 'Sin voz',
    locale: 'es-AR',
    onError: ({ code, attempt, willRetry }) => failures.push({ code, attempt, willRetry }),
  });

  timers.advanceBy(100);
  assert.equal(handle?.state, 'scheduled');
  timers.advanceBy(10);
  assert.equal(handle?.state, 'waiting-for-voice');
  timers.advanceBy(100);

  assert.equal(handle?.state, 'failed');
  assert.equal(synthesis.spoken.length, 1);
  assert.deepEqual(failures, [
    { code: 'start-timeout', attempt: 1, willRetry: true },
    { code: 'voice-unavailable', attempt: 1, willRetry: false },
  ]);
});

test('a voice arriving after the fallback watchdog supplies the one explicit retry', () => {
  const { controller, synthesis, timers } = fixture([]);
  const handle = controller.speak({ text: 'Esperá voz', locale: 'es-AR' });

  timers.advanceBy(100);
  timers.advanceBy(10);
  assert.equal(handle?.state, 'waiting-for-voice');
  assert.equal(synthesis.spoken.length, 1);

  synthesis.voices = [esArLocal];
  synthesis.emitVoicesChanged();

  assert.equal(handle?.state, 'pending');
  assert.equal(handle?.utterance?.voice, esArLocal);
  assert.equal(synthesis.spoken.length, 2);
});
