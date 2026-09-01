export type WorkoutTimelinePhase = {
  duration: number;
};

export type WorkoutTimelineSnapshot = {
  elapsedMs: number;
  finished: boolean;
  phaseElapsedMs: number;
  phaseIndex: number;
  remainingSeconds: number;
  running: boolean;
  totalMs: number;
};

export type WorkoutTimelineEvent =
  | {
    atElapsedMs: number;
    id: string;
    kind: 'phase';
    phaseIndex: number;
  }
  | {
    atElapsedMs: number;
    id: string;
    kind: 'tick';
    phaseIndex: number;
    remainingSeconds: number;
  }
  | {
    atElapsedMs: number;
    id: 'complete';
    kind: 'complete';
    phaseIndex: number;
  };

/**
 * Monotonic workout time. It owns elapsed active time; UI and audio only observe it.
 */
export class WorkoutTimeline {
  readonly totalMs: number;

  private accumulatedElapsedMs = 0;
  private readonly phaseDurationsMs: number[];
  private readonly phaseEndsMs: number[];
  private readonly phaseStartsMs: number[];
  private startedAtMs: number | null = null;

  constructor(phases: readonly WorkoutTimelinePhase[]) {
    if (phases.length === 0) throw new RangeError('WorkoutTimeline requires at least one phase.');

    this.phaseDurationsMs = phases.map(({ duration }) => {
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new RangeError('WorkoutTimeline phase durations must be positive finite numbers.');
      }
      return duration * 1000;
    });

    this.phaseStartsMs = [];
    this.phaseEndsMs = [];
    let elapsedMs = 0;
    for (const durationMs of this.phaseDurationsMs) {
      this.phaseStartsMs.push(elapsedMs);
      elapsedMs += durationMs;
      this.phaseEndsMs.push(elapsedMs);
    }
    this.totalMs = elapsedMs;
  }

  get isRunning() {
    return this.startedAtMs !== null;
  }

  start(monotonicStartMs: number) {
    if (!Number.isFinite(monotonicStartMs)) throw new RangeError('WorkoutTimeline start time must be finite.');
    if (this.startedAtMs !== null || this.accumulatedElapsedMs >= this.totalMs) return;
    this.startedAtMs = monotonicStartMs;
  }

  pause(monotonicNowMs: number) {
    this.accumulatedElapsedMs = this.elapsedAt(monotonicNowMs);
    this.startedAtMs = null;
    return this.snapshot(monotonicNowMs);
  }

  reset() {
    this.accumulatedElapsedMs = 0;
    this.startedAtMs = null;
  }

  elapsedAt(monotonicNowMs: number) {
    const runningElapsedMs = this.startedAtMs === null
      ? 0
      : Math.max(0, monotonicNowMs - this.startedAtMs);
    return Math.min(this.totalMs, Math.max(0, this.accumulatedElapsedMs + runningElapsedMs));
  }

  phaseIndexAtElapsed(elapsedMs: number) {
    const boundedElapsedMs = Math.min(
      this.totalMs - Number.EPSILON,
      Math.max(0, elapsedMs),
    );
    return this.findPhaseIndex(boundedElapsedMs);
  }

  snapshot(monotonicNowMs: number): WorkoutTimelineSnapshot {
    const elapsedMs = this.elapsedAt(monotonicNowMs);
    const finished = elapsedMs >= this.totalMs;
    const phaseIndex = finished
      ? this.phaseDurationsMs.length - 1
      : this.findPhaseIndex(elapsedMs);
    const phaseStartMs = this.phaseStartsMs[phaseIndex];
    const phaseEndMs = this.phaseEndsMs[phaseIndex];

    return {
      elapsedMs,
      finished,
      phaseElapsedMs: finished
        ? this.phaseDurationsMs[phaseIndex]
        : elapsedMs - phaseStartMs,
      phaseIndex,
      remainingSeconds: finished ? 0 : Math.ceil((phaseEndMs - elapsedMs) / 1000),
      running: this.isRunning,
      totalMs: this.totalMs,
    };
  }

  /** Returns audio-worthy events in the half-open/closed range (after, through]. */
  eventsBetween(afterElapsedMs: number, throughElapsedMs: number): WorkoutTimelineEvent[] {
    const afterMs = Math.max(0, afterElapsedMs);
    const throughMs = Math.min(this.totalMs, Math.max(0, throughElapsedMs));
    if (throughMs <= afterMs) return [];

    const events: WorkoutTimelineEvent[] = [];
    let phaseIndex = this.findPhaseIndex(Math.min(afterMs, this.totalMs - Number.EPSILON));

    for (; phaseIndex < this.phaseDurationsMs.length; phaseIndex += 1) {
      const phaseStartMs = this.phaseStartsMs[phaseIndex];
      if (phaseStartMs > throughMs) break;

      if (phaseStartMs > afterMs) {
        events.push({
          atElapsedMs: phaseStartMs,
          id: `phase-${phaseIndex}`,
          kind: 'phase',
          phaseIndex,
        });
      }

      const durationMs = this.phaseDurationsMs[phaseIndex];
      const firstTick = Math.max(1, Math.floor((afterMs - phaseStartMs) / 1000) + 1);
      for (let tick = firstTick; tick * 1000 < durationMs; tick += 1) {
        const atElapsedMs = phaseStartMs + tick * 1000;
        if (atElapsedMs > throughMs) break;
        if (atElapsedMs <= afterMs) continue;
        events.push({
          atElapsedMs,
          id: `tick-${phaseIndex}-${tick}`,
          kind: 'tick',
          phaseIndex,
          remainingSeconds: Math.ceil((durationMs - tick * 1000) / 1000),
        });
      }
    }

    if (this.totalMs > afterMs && this.totalMs <= throughMs) {
      events.push({
        atElapsedMs: this.totalMs,
        id: 'complete',
        kind: 'complete',
        phaseIndex: this.phaseDurationsMs.length - 1,
      });
    }

    return events.sort((left, right) => left.atElapsedMs - right.atElapsedMs);
  }

  private findPhaseIndex(elapsedMs: number) {
    let lower = 0;
    let upper = this.phaseEndsMs.length - 1;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (elapsedMs < this.phaseEndsMs[middle]) upper = middle;
      else lower = middle + 1;
    }
    return lower;
  }
}
