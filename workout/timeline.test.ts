import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkoutTimeline } from './timeline.ts';

test('timeline derives phase state from one monotonic elapsed value', () => {
  const timeline = new WorkoutTimeline([{ duration: 3 }, { duration: 2 }]);
  timeline.start(100);

  assert.deepEqual(timeline.snapshot(100), {
    elapsedMs: 0,
    finished: false,
    phaseElapsedMs: 0,
    phaseIndex: 0,
    remainingSeconds: 3,
    running: true,
    totalMs: 5000,
  });
  assert.equal(timeline.snapshot(3100).phaseIndex, 1);
  assert.equal(timeline.snapshot(3100).remainingSeconds, 2);
  assert.equal(timeline.snapshot(5100).finished, true);
  assert.equal(timeline.snapshot(5100).remainingSeconds, 0);
});

test('pause and resume preserve fractional elapsed time without wall-clock drift', () => {
  const timeline = new WorkoutTimeline([{ duration: 4 }]);
  timeline.start(100);
  const paused = timeline.pause(1350);

  assert.equal(paused.elapsedMs, 1250);
  assert.equal(paused.remainingSeconds, 3);
  assert.equal(timeline.snapshot(4000).elapsedMs, 1250);

  timeline.start(5000);
  assert.equal(timeline.snapshot(5750).elapsedMs, 2000);
  assert.equal(timeline.snapshot(5750).remainingSeconds, 2);
});

test('audio events keep exact one-second spacing across phase boundaries', () => {
  const timeline = new WorkoutTimeline([{ duration: 3 }, { duration: 2 }]);

  assert.deepEqual(timeline.eventsBetween(0, 5000), [
    { atElapsedMs: 1000, id: 'tick-0-1', kind: 'tick', phaseIndex: 0, remainingSeconds: 2 },
    { atElapsedMs: 2000, id: 'tick-0-2', kind: 'tick', phaseIndex: 0, remainingSeconds: 1 },
    { atElapsedMs: 3000, id: 'phase-1', kind: 'phase', phaseIndex: 1 },
    { atElapsedMs: 4000, id: 'tick-1-1', kind: 'tick', phaseIndex: 1, remainingSeconds: 1 },
    { atElapsedMs: 5000, id: 'complete', kind: 'complete', phaseIndex: 1 },
  ]);
});

test('events already passed are never replayed after a delayed observer', () => {
  const timeline = new WorkoutTimeline([{ duration: 5 }]);

  assert.deepEqual(
    timeline.eventsBetween(2100, 4100).map(({ id }) => id),
    ['tick-0-3', 'tick-0-4'],
  );
});
