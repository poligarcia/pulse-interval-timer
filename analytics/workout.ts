import type { AnalyticsEvents, Track } from './events.ts';

// One end per actual execution, independently of the local-history save operation.
export class WorkoutAnalytics {
  private active = false;
  private track: Track;
  constructor(track: Track) { this.track = track; }
  start(parameters: AnalyticsEvents['workout_started']) {
    this.active = true;
    this.track('workout_started', parameters);
  }
  end(parameters: AnalyticsEvents['workout_ended']) {
    if (!this.active) return;
    this.active = false;
    this.track('workout_ended', parameters);
  }
}
