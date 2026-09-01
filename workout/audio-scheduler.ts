import type { WorkoutTimelineEvent } from './timeline.ts';
import { WorkoutTimeline } from './timeline.ts';

export type ScheduledAudioHandle = {
  cancel: () => void;
  endsAt: number;
};

type AudioSchedulerEnvironment = {
  audioNow: () => number;
  clearTimer: (handle: unknown) => void;
  schedule: (
    event: WorkoutTimelineEvent,
    audioTime: number,
  ) => ScheduledAudioHandle | ScheduledAudioHandle[] | undefined;
  setTimer: (callback: () => void, intervalMs: number) => unknown;
};

type StartOptions = {
  anchorAudioTime: number;
  anchorElapsedMs: number;
  includeCurrentPhaseCue?: boolean;
};

type StopOptions = {
  cancelPending?: boolean;
};

const DEFAULT_LOOKAHEAD_MS = 25;
const DEFAULT_SCHEDULE_AHEAD_SECONDS = 0.25;
const DEFAULT_MINIMUM_LEAD_SECONDS = 0.015;

/**
 * Uses inexpensive JavaScript lookahead to place events on Web Audio's precise clock.
 */
export class WorkoutAudioScheduler {
  private anchorAudioTime = 0;
  private anchorElapsedMs = 0;
  private cursorElapsedMs = 0;
  private handles: ScheduledAudioHandle[] = [];
  private scheduledEventIds = new Set<string>();
  private timerHandle: unknown = null;
  private readonly environment: AudioSchedulerEnvironment;
  private readonly lookaheadMs: number;
  private readonly minimumLeadSeconds: number;
  private readonly scheduleAheadSeconds: number;
  private readonly timeline: WorkoutTimeline;

  constructor(
    timeline: WorkoutTimeline,
    environment: AudioSchedulerEnvironment,
    lookaheadMs = DEFAULT_LOOKAHEAD_MS,
    scheduleAheadSeconds = DEFAULT_SCHEDULE_AHEAD_SECONDS,
    minimumLeadSeconds = DEFAULT_MINIMUM_LEAD_SECONDS,
  ) {
    this.timeline = timeline;
    this.environment = environment;
    this.lookaheadMs = lookaheadMs;
    this.scheduleAheadSeconds = scheduleAheadSeconds;
    this.minimumLeadSeconds = minimumLeadSeconds;
  }

  start({ anchorAudioTime, anchorElapsedMs, includeCurrentPhaseCue = true }: StartOptions) {
    this.stop();
    this.scheduledEventIds.clear();
    this.anchorAudioTime = anchorAudioTime;
    this.anchorElapsedMs = Math.min(this.timeline.totalMs, Math.max(0, anchorElapsedMs));
    this.cursorElapsedMs = this.anchorElapsedMs;

    if (includeCurrentPhaseCue && this.anchorElapsedMs < this.timeline.totalMs) {
      const phaseIndex = this.timeline.phaseIndexAtElapsed(this.anchorElapsedMs);
      this.scheduleEvent({
        atElapsedMs: this.anchorElapsedMs,
        id: `current-phase-${phaseIndex}`,
        kind: 'phase',
        phaseIndex,
      }, anchorAudioTime);
    }

    this.pump();
    if (this.cursorElapsedMs < this.timeline.totalMs) {
      this.timerHandle = this.environment.setTimer(() => this.pump(), this.lookaheadMs);
    }
  }

  pump() {
    const audioNow = this.environment.audioNow();
    this.handles = this.handles.filter(({ endsAt }) => endsAt > audioNow);

    const horizonAudioTime = audioNow + this.scheduleAheadSeconds;
    const horizonElapsedMs = Math.min(
      this.timeline.totalMs,
      this.anchorElapsedMs + (horizonAudioTime - this.anchorAudioTime) * 1000,
    );
    if (horizonElapsedMs <= this.cursorElapsedMs) return;

    for (const event of this.timeline.eventsBetween(this.cursorElapsedMs, horizonElapsedMs)) {
      const audioTime = this.anchorAudioTime + (event.atElapsedMs - this.anchorElapsedMs) / 1000;
      if (audioTime < audioNow + this.minimumLeadSeconds) continue;
      this.scheduleEvent(event, audioTime);
    }
    this.cursorElapsedMs = horizonElapsedMs;

    if (this.cursorElapsedMs >= this.timeline.totalMs && this.timerHandle !== null) {
      this.environment.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }
  }

  hasScheduled(eventId: string) {
    return this.scheduledEventIds.has(eventId);
  }

  stop({ cancelPending = true }: StopOptions = {}) {
    if (this.timerHandle !== null) {
      this.environment.clearTimer(this.timerHandle);
      this.timerHandle = null;
    }
    if (cancelPending) {
      for (const handle of this.handles) handle.cancel();
    }
    this.handles = [];
  }

  private scheduleEvent(event: WorkoutTimelineEvent, audioTime: number) {
    const result = this.environment.schedule(event, audioTime);
    if (!result) return;
    this.scheduledEventIds.add(event.id);
    this.handles.push(...(Array.isArray(result) ? result : [result]));
  }
}
