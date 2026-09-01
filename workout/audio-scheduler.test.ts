import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkoutAudioScheduler } from './audio-scheduler.ts';
import type { ScheduledAudioHandle } from './audio-scheduler.ts';
import { WorkoutTimeline } from './timeline.ts';
import type { WorkoutTimelineEvent } from './timeline.ts';

type ScheduledEvent = {
  audioTime: number;
  event: WorkoutTimelineEvent;
  handle: ScheduledAudioHandle;
};

function schedulerFixture(phases = [{ duration: 4 }]) {
  let audioNow = 0;
  let timerCallback: (() => void) | null = null;
  const scheduled: ScheduledEvent[] = [];
  const timeline = new WorkoutTimeline(phases);
  const scheduler = new WorkoutAudioScheduler(timeline, {
    audioNow: () => audioNow,
    clearTimer: () => { timerCallback = null; },
    schedule: (event, audioTime) => {
      const handle = {
        cancel: () => { handle.cancelled = true; },
        cancelled: false,
        endsAt: audioTime + 0.2,
      };
      scheduled.push({ audioTime, event, handle });
      return handle;
    },
    setTimer: (callback) => {
      timerCallback = callback;
      return 1;
    },
  });

  return {
    scheduled,
    scheduler,
    setAudioNow(value: number) { audioNow = value; },
    tickTimer() { timerCallback?.(); },
  };
}

test('scheduler places ticks on Web Audio time instead of callback time', () => {
  const fixture = schedulerFixture();
  fixture.scheduler.start({ anchorAudioTime: 0.1, anchorElapsedMs: 0 });

  fixture.setAudioNow(0.86);
  fixture.tickTimer();
  fixture.setAudioNow(1.86);
  fixture.tickTimer();

  const ticks = fixture.scheduled.filter(({ event }) => event.kind === 'tick');
  assert.deepEqual(ticks.map(({ audioTime }) => audioTime), [1.1, 2.1]);
  assert.equal(ticks[1].audioTime - ticks[0].audioTime, 1);
  assert.equal(fixture.scheduler.hasScheduled('tick-0-2'), true);
});

test('phase boundaries retain their absolute time when the JavaScript pump is uneven', () => {
  const fixture = schedulerFixture([{ duration: 2 }, { duration: 2 }]);
  fixture.scheduler.start({ anchorAudioTime: 5, anchorElapsedMs: 0 });

  fixture.setAudioNow(5.76);
  fixture.scheduler.pump();
  fixture.setAudioNow(6.76);
  fixture.scheduler.pump();
  fixture.setAudioNow(7.76);
  fixture.scheduler.pump();

  const events = fixture.scheduled.filter(({ event }) => event.kind !== 'phase' || event.id === 'phase-1');
  assert.deepEqual(events.map(({ event, audioTime }) => [event.id, audioTime]), [
    ['tick-0-1', 6],
    ['phase-1', 7],
    ['tick-1-1', 8],
  ]);
});

test('a missed tick is skipped rather than replayed late or duplicated', () => {
  const fixture = schedulerFixture();
  fixture.scheduler.start({ anchorAudioTime: 0.1, anchorElapsedMs: 0 });

  fixture.setAudioNow(1.2);
  fixture.scheduler.pump();
  fixture.scheduler.pump();
  fixture.setAudioNow(1.86);
  fixture.scheduler.pump();

  const ticks = fixture.scheduled.filter(({ event }) => event.kind === 'tick');
  assert.deepEqual(ticks.map(({ event }) => event.id), ['tick-0-2']);
  assert.equal(ticks[0].audioTime, 2.1);
});

test('pause cancels audio already placed inside the lookahead window', () => {
  const fixture = schedulerFixture();
  fixture.scheduler.start({ anchorAudioTime: 0.1, anchorElapsedMs: 0 });
  fixture.setAudioNow(0.86);
  fixture.scheduler.pump();

  const tick = fixture.scheduled.find(({ event }) => event.kind === 'tick');
  assert.ok(tick);
  fixture.scheduler.stop();
  assert.equal((tick.handle as ScheduledAudioHandle & { cancelled: boolean }).cancelled, true);
});

test('resume continues from fractional elapsed time without replaying an old tick', () => {
  const fixture = schedulerFixture();
  fixture.scheduler.start({ anchorAudioTime: 0.1, anchorElapsedMs: 0 });
  fixture.setAudioNow(0.86);
  fixture.scheduler.pump();
  fixture.scheduler.stop();

  const eventsBeforeResume = fixture.scheduled.length;
  fixture.setAudioNow(5);
  fixture.scheduler.start({ anchorAudioTime: 5.075, anchorElapsedMs: 1250 });
  fixture.setAudioNow(5.58);
  fixture.scheduler.pump();

  const resumedEvents = fixture.scheduled.slice(eventsBeforeResume);
  const resumedTicks = resumedEvents.filter(({ event }) => event.kind === 'tick');
  assert.deepEqual(resumedTicks.map(({ event }) => event.id), ['tick-0-2']);
  assert.equal(resumedTicks[0].audioTime, 5.825);
});
