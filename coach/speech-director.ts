import type { SpeechController, SpeechHandle, SpeechUtteranceLike, SpeechVoiceLike } from './speech-controller.ts';
import { clampSpeech, compileSpeechScript, estimateSpeechBudget } from './speech-script.ts';
import type { SpeechScript, SpeechStep } from './speech-script.ts';

export type SpeechOutcome = { status: 'completed' | 'canceled' | 'expired' | 'dropped' | 'failed' | 'invalid'; reason?: string };
export type ScriptState = 'queued' | 'pausing' | 'pending' | 'speaking' | 'settled';
export type ScriptHandle = { readonly state: ScriptState; readonly segmentIndex: number; readonly done: Promise<SpeechOutcome>; cancel: () => void };
export type ScriptOptions = {
  locale: string;
  voiceURI: string;
  priority?: number;
  interrupt?: boolean;
  mustStartByMs?: number;
  mustFinishByMs?: number;
  admissionBudgetMs?: number;
  onStart?: (voice: SpeechVoiceLike) => void;
  onEnd?: () => void;
};
type Operation<U> = {
  steps: SpeechStep[]; options: ScriptOptions; index: number; state: ScriptState;
  started: boolean; settled: boolean; token: number;
  native: SpeechHandle<U> | null; timers: Set<unknown>;
  finish: (outcome: SpeechOutcome) => void;
};

/** Owns logical scripts; only the browser adapter creates native utterances. */
export class CoachSpeechDirector<V extends SpeechVoiceLike, U extends SpeechUtteranceLike<V>> {
  private active: Operation<U> | null = null;
  private queue: Operation<U>[] = [];
  private visible = true;
  private replacementUntil = 0;
  private readonly environment: {
    controller: Pick<SpeechController<V, U, number>, 'speak' | 'cancel' | 'getVoices'>;
    now: () => number;
    setTimer: (callback: () => void, ms: number) => unknown;
    clearTimer: (handle: unknown) => void;
    masterVolume: () => number;
  };
  constructor(environment: CoachSpeechDirector<V, U>['environment']) { this.environment = environment; }

  get busy() { return this.active !== null || this.queue.length > 0; }

  speak(script: SpeechScript, options: ScriptOptions): ScriptHandle {
    let resolve!: (outcome: SpeechOutcome) => void;
    const done = new Promise<SpeechOutcome>((result) => { resolve = result; });
    const compiled = compileSpeechScript(script);
    const op: Operation<U> = { steps: compiled.ok ? compiled.steps : [], options: { ...options }, index: 0, state: 'queued', started: false, settled: false, token: 0, native: null, timers: new Set(), finish: resolve };
    const handle: ScriptHandle = { get state() { return op.state; }, get segmentIndex() { return op.index; }, done, cancel: () => this.settle(op, { status: 'canceled', reason: 'handle' }) };
    if (!compiled.ok) { this.settle(op, { status: 'invalid', reason: compiled.error }); return handle; }
    if (!this.visible) { this.settle(op, { status: 'canceled', reason: 'hidden' }); return handle; }
    if (!Object.entries(options).filter(([key]) => ['priority', 'mustStartByMs', 'mustFinishByMs', 'admissionBudgetMs'].includes(key)).every(([, value]) => value === undefined || (typeof value === 'number' && Number.isFinite(value)))) {
      this.settle(op, { status: 'invalid', reason: 'Invalid scheduling value.' }); return handle;
    }
    if (this.expired(op)) { this.settle(op, { status: 'expired' }); return handle; }
    if (!this.fits(op)) { this.settle(op, { status: 'dropped', reason: 'insufficient-budget' }); return handle; }
    if (options.interrupt) this.cancelAll('interrupted');
    else if (this.active && (options.priority ?? 0) > (this.active.options.priority ?? 0)) this.cancelAll('preempted');
    this.queue.push(op);
    this.queue.sort((a, b) => (b.options.priority ?? 0) - (a.options.priority ?? 0));
    for (const cutoff of [options.mustStartByMs, options.mustFinishByMs]) {
      if (cutoff !== undefined) this.timer(op, () => { if (this.expired(op)) this.settle(op, { status: 'expired' }); }, cutoff - this.environment.now());
    }
    this.pump();
    return handle;
  }

  cancelAll(reason = 'canceled') {
    const operations = [...this.queue, ...(this.active ? [this.active] : [])];
    this.queue = [];
    for (const op of operations) this.settle(op, { status: 'canceled', reason }, false);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) this.cancelAll('hidden');
  }

  private expired(op: Operation<U>) {
    const now = this.environment.now();
    return (op.options.mustFinishByMs !== undefined && now >= op.options.mustFinishByMs)
      || (!op.started && op.options.mustStartByMs !== undefined && now >= op.options.mustStartByMs);
  }

  private fits(op: Operation<U>) {
    const deadline = op.options.mustFinishByMs;
    // Only optional phrases supply an admission budget. Critical cues use cutoffs alone.
    if (deadline === undefined || op.options.admissionBudgetMs === undefined) return true;
    const budget = op.index === 0 ? op.options.admissionBudgetMs : estimateSpeechBudget(op.steps.slice(op.index));
    return this.environment.now() + Math.max(0, budget) < deadline;
  }

  private timer(op: Operation<U>, callback: () => void, ms: number) {
    const timer = this.environment.setTimer(() => {
      op.timers.delete(timer);
      if (!op.settled) callback();
    }, Math.max(0, ms));
    op.timers.add(timer);
  }

  private pump() {
    if (this.active || !this.visible) return;
    const next = this.queue.shift();
    if (!next) return;
    this.active = next;
    const delay = this.replacementUntil - this.environment.now();
    if (delay > 0) this.timer(next, () => this.advance(next), delay);
    else this.advance(next);
  }

  private advance(op: Operation<U>) {
    if (op.settled || this.active !== op) return;
    if (this.expired(op)) { this.settle(op, { status: 'expired' }); return; }
    if (!this.fits(op)) { this.settle(op, { status: 'dropped', reason: 'insufficient-budget' }); return; }
    const step = op.steps[op.index];
    if (!step) { this.settle(op, { status: 'completed' }); return; }
    if (step.kind === 'pause') {
      op.state = 'pausing';
      this.timer(op, () => { op.index++; this.advance(op); }, step.ms);
      return;
    }
    const voice = this.environment.controller.getVoices().find((voice) => voice.voiceURI === op.options.voiceURI);
    if (!voice) { this.settle(op, { status: 'failed', reason: 'voice-unavailable' }); return; }
    op.state = 'pending';
    const token = ++op.token;
    const current = () => !op.settled && op.token === token && this.active === op;
    const master = clampSpeech(this.environment.masterVolume(), 0, 1);
    const native = this.environment.controller.speak({
      text: step.text, locale: op.options.locale, preferredVoiceURI: voice.voiceURI,
      interrupt: !op.started && op.options.interrupt === true,
      strictVoice: true, canStart: () => current() && !this.expired(op), completionTimeoutMs: 30000,
      rate: step.rate, pitch: step.pitch, volume: clampSpeech(master * step.volumeScale, 0, master), retry: true,
      onStart: () => {
        if (!current()) return;
        if (this.expired(op)) { this.settle(op, { status: 'expired' }); return; }
        op.started = true; op.state = 'speaking'; op.options.onStart?.(voice);
      },
      onEnd: () => { if (current()) { op.native = null; op.index++; this.advance(op); } },
      onError: (failure) => { if (current() && !failure.willRetry) this.settle(op, { status: 'failed', reason: failure.code }); },
    });
    if (current()) {
      op.native = native;
      if (!native) this.settle(op, { status: 'failed', reason: 'unavailable' });
    }
  }

  private settle(op: Operation<U>, outcome: SpeechOutcome, pump = true) {
    if (op.settled) return;
    const hadNative = op.state === 'pending' || op.state === 'speaking';
    op.settled = true; op.token++; op.state = 'settled';
    for (const timer of op.timers) this.environment.clearTimer(timer);
    op.timers.clear();
    this.queue = this.queue.filter((candidate) => candidate !== op);
    if (this.active === op) {
      this.active = null;
      if (outcome.status !== 'completed' && (op.native || hadNative)) {
        this.replacementUntil = this.environment.now() + 40;
        this.environment.controller.cancel();
      }
    }
    op.finish(outcome);
    try { if (outcome.status === 'completed') op.options.onEnd?.(); }
    finally { if (pump) this.pump(); }
  }
}
