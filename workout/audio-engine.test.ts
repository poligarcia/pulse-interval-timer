import assert from 'node:assert/strict';
import test from 'node:test';
import { AudioEngine } from './audio-engine.ts';
import type { RecoverableAudioContext } from './audio-engine.ts';

type TimerTask = {
  atMs: number;
  callback: () => void;
};

class FakeTimers {
  nowMs = 0;
  private nextHandle = 1;
  private tasks = new Map<number, TimerTask>();

  clearTimer = (handle: unknown) => {
    this.tasks.delete(handle as number);
  };

  setTimer = (callback: () => void, delayMs: number) => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.tasks.set(handle, { atMs: this.nowMs + delayMs, callback });
    return handle;
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

type ResumeMode = 'pending' | 'reject' | 'resolve';

class FakeAudioContext implements RecoverableAudioContext {
  closeCalls = 0;
  clockFrozen = false;
  resumeCalls = 0;
  resumeMode: ResumeMode;
  state: AudioContextState | 'interrupted';
  private readonly pendingResumeResolvers: Array<() => void> = [];
  private readonly timers: FakeTimers;

  constructor(
    timers: FakeTimers,
    options: {
      clockFrozen?: boolean;
      resumeMode?: ResumeMode;
      state?: AudioContextState | 'interrupted';
    } = {},
  ) {
    this.timers = timers;
    this.clockFrozen = options.clockFrozen ?? false;
    this.resumeMode = options.resumeMode ?? 'resolve';
    this.state = options.state ?? 'suspended';
  }

  get currentTime() {
    return this.clockFrozen || this.state !== 'running' ? 0 : this.timers.nowMs / 1000;
  }

  close() {
    this.closeCalls += 1;
    this.state = 'closed';
    return Promise.resolve();
  }

  resume() {
    this.resumeCalls += 1;
    if (this.resumeMode === 'reject') return Promise.reject(new Error('resume rejected'));
    if (this.resumeMode === 'pending') {
      return new Promise<void>((resolve) => {
        this.pendingResumeResolvers.push(() => {
          this.state = 'running';
          resolve();
        });
      });
    }
    this.state = 'running';
    return Promise.resolve();
  }

  resolvePendingResume() {
    this.pendingResumeResolvers.shift()?.();
  }
}

function engineFixture(timers: FakeTimers, contexts: FakeAudioContext[]) {
  let createCalls = 0;
  const engine = new AudioEngine<FakeAudioContext>({
    createContext: () => {
      const context = contexts[createCalls] ?? null;
      createCalls += 1;
      return context;
    },
    clearTimer: timers.clearTimer,
    setTimer: timers.setTimer,
  }, {
    minimumClockAdvanceSeconds: 0.001,
    probeDelayMs: 20,
    resumeTimeoutMs: 30,
  });
  return { engine, timers, createCalls: () => createCalls };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

test('creates, verifies, and then reuses one healthy context without another probe', async () => {
  const timers = new FakeTimers();
  const context = new FakeAudioContext(timers);
  const fixture = engineFixture(timers, [context]);

  const firstPromise = fixture.engine.recover();
  await flushMicrotasks();
  timers.advanceBy(20);
  const first = await firstPromise;

  assert.equal(first.status, 'ready');
  assert.equal(first.status === 'ready' && first.context, context);
  assert.equal(first.status === 'ready' && first.recreated, false);
  assert.equal(context.resumeCalls, 1);
  assert.equal(fixture.createCalls(), 1);

  const second = await fixture.engine.recover();
  assert.equal(second.status, 'ready');
  assert.equal(fixture.createCalls(), 1);
  assert.equal(fixture.timers.pendingCount, 0);
});

test('bounds a hanging resume, recreates once, and reports that a gesture is needed', async () => {
  const timers = new FakeTimers();
  const first = new FakeAudioContext(timers, { resumeMode: 'pending' });
  const replacement = new FakeAudioContext(timers, { resumeMode: 'pending' });
  const fixture = engineFixture(timers, [first, replacement]);

  const recovery = fixture.engine.recover();
  timers.advanceBy(30);
  await flushMicrotasks();
  timers.advanceBy(30);
  const result = await recovery;

  assert.deepEqual(result, {
    status: 'needs-gesture',
    generation: 1,
    reason: 'resume-timeout',
  });
  assert.equal(first.closeCalls, 1);
  assert.equal(replacement.closeCalls, 0);
  assert.equal(fixture.engine.context, replacement);
  assert.equal(fixture.createCalls(), 2);
});

test('detects a frozen running clock and replaces the unhealthy context', async () => {
  const timers = new FakeTimers();
  const frozen = new FakeAudioContext(timers, { clockFrozen: true, state: 'running' });
  const healthy = new FakeAudioContext(timers, { state: 'running' });
  const fixture = engineFixture(timers, [frozen, healthy]);

  const recovery = fixture.engine.recover();
  timers.advanceBy(20);
  await flushMicrotasks();
  timers.advanceBy(20);
  const result = await recovery;

  assert.equal(result.status, 'ready');
  assert.equal(result.status === 'ready' && result.context, healthy);
  assert.equal(result.status === 'ready' && result.recreated, true);
  assert.equal(frozen.closeCalls, 1);
  assert.equal(fixture.engine.context, healthy);
});

test('invalidate aborts an in-flight recovery and clears its timeout', async () => {
  const timers = new FakeTimers();
  const context = new FakeAudioContext(timers, { resumeMode: 'pending' });
  const fixture = engineFixture(timers, [context]);

  const recovery = fixture.engine.recover();
  assert.equal(timers.pendingCount, 1);
  fixture.engine.invalidate();
  const result = await recovery;

  assert.deepEqual(result, { status: 'aborted', generation: 1 });
  assert.equal(fixture.engine.generation, 2);
  assert.equal(timers.pendingCount, 0);
  assert.equal(fixture.engine.context, context);
});

test('a newer forced recovery wins even if the superseded resume resolves later', async () => {
  const timers = new FakeTimers();
  const stale = new FakeAudioContext(timers, { resumeMode: 'pending' });
  const fresh = new FakeAudioContext(timers, { state: 'running' });
  const fixture = engineFixture(timers, [stale, fresh]);

  const staleRecovery = fixture.engine.recover();
  const freshRecovery = fixture.engine.recover({ forceRecreate: true });
  const staleResult = await staleRecovery;
  assert.deepEqual(staleResult, { status: 'aborted', generation: 1 });

  timers.advanceBy(20);
  const freshResult = await freshRecovery;
  stale.resolvePendingResume();
  await flushMicrotasks();

  assert.equal(freshResult.status, 'ready');
  assert.equal(freshResult.status === 'ready' && freshResult.context, fresh);
  assert.equal(freshResult.status === 'ready' && freshResult.recreated, true);
  assert.equal(fixture.engine.context, fresh);
  assert.equal(stale.closeCalls, 1);
});

test('a rejected close does not block recovery with a replacement', async () => {
  const timers = new FakeTimers();
  const broken = new FakeAudioContext(timers, { resumeMode: 'reject' });
  broken.close = () => {
    broken.closeCalls += 1;
    return Promise.reject(new Error('close rejected'));
  };
  const healthy = new FakeAudioContext(timers, { state: 'running' });
  const fixture = engineFixture(timers, [broken, healthy]);

  const recovery = fixture.engine.recover();
  await flushMicrotasks();
  timers.advanceBy(20);
  const result = await recovery;

  assert.equal(result.status, 'ready');
  assert.equal(result.status === 'ready' && result.context, healthy);
  assert.equal(broken.closeCalls, 1);
});

test('dispose aborts recovery, drops the context, and closes it best-effort', async () => {
  const timers = new FakeTimers();
  const context = new FakeAudioContext(timers, { resumeMode: 'pending' });
  const fixture = engineFixture(timers, [context]);

  const recovery = fixture.engine.recover();
  fixture.engine.dispose();
  const result = await recovery;

  assert.equal(result.status, 'aborted');
  assert.equal(context.closeCalls, 1);
  assert.equal(fixture.engine.context, null);
  assert.equal(timers.pendingCount, 0);
});
