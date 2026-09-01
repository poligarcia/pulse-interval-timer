export type RecoverableAudioContext = {
  readonly currentTime: number;
  readonly state: AudioContextState | 'interrupted';
  close: () => Promise<void>;
  resume: () => Promise<void>;
};

export type AudioRecoveryReason =
  | 'clock-stalled'
  | 'context-closed'
  | 'context-unavailable'
  | 'not-running'
  | 'resume-rejected'
  | 'resume-timeout';

export type AudioRecoveryResult<TContext extends RecoverableAudioContext = AudioContext> =
  | {
      status: 'ready';
      context: TContext;
      generation: number;
      recreated: boolean;
    }
  | {
      status: 'needs-gesture';
      generation: number;
      reason: AudioRecoveryReason;
    }
  | {
      status: 'aborted';
      generation: number;
    };

export type AudioEngineEnvironment<TContext extends RecoverableAudioContext> = {
  clearTimer: (handle: unknown) => void;
  createContext: () => TContext | null;
  setTimer: (callback: () => void, delayMs: number) => unknown;
};

export type AudioEngineOptions = {
  minimumClockAdvanceSeconds?: number;
  probeDelayMs?: number;
  resumeTimeoutMs?: number;
};

export type AudioRecoveryOptions = {
  /**
   * Replaces the current context before checking it. This is useful after an
   * iOS standalone PWA returns from the background: WebKit can report a
   * context as running even though it no longer reaches the output device.
   */
  forceRecreate?: boolean;
};

type AttemptResult =
  | { status: 'ready' }
  | { status: 'failed'; reason: AudioRecoveryReason }
  | { status: 'aborted' };

type TimedResult = 'aborted' | 'rejected' | 'resolved' | 'timeout';

const DEFAULT_MINIMUM_CLOCK_ADVANCE_SECONDS = 0.001;
const DEFAULT_PROBE_DELAY_MS = 60;
const DEFAULT_RESUME_TIMEOUT_MS = 750;

function finiteNonNegative(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

class RecoveryOperation {
  readonly generation: number;
  private abortListeners = new Set<() => void>();
  private aborted = false;

  constructor(generation: number) {
    this.generation = generation;
  }

  get isAborted() {
    return this.aborted;
  }

  abort() {
    if (this.aborted) return;
    this.aborted = true;
    const listeners = [...this.abortListeners];
    this.abortListeners.clear();
    for (const listener of listeners) listener();
  }

  onAbort(listener: () => void) {
    if (this.aborted) {
      listener();
      return () => undefined;
    }
    this.abortListeners.add(listener);
    return () => {
      this.abortListeners.delete(listener);
    };
  }
}

/**
 * Owns one reusable Web Audio context and bounds every asynchronous recovery.
 *
 * The engine deliberately does not own page visibility or workout scheduling.
 * Call `invalidate()` when the page is hidden, then `recover()` when it becomes
 * visible again. Reserve `forceRecreate` for an explicit hard-recovery path.
 */
export class AudioEngine<TContext extends RecoverableAudioContext = AudioContext> {
  private activeOperation: RecoveryOperation | null = null;
  private contextValue: TContext | null = null;
  private readonly environment: AudioEngineEnvironment<TContext>;
  private generationValue = 0;
  private readonly minimumClockAdvanceSeconds: number;
  private readonly probeDelayMs: number;
  private readonly resumeTimeoutMs: number;
  private verifiedContext: TContext | null = null;

  constructor(
    environment: AudioEngineEnvironment<TContext>,
    options: AudioEngineOptions = {},
  ) {
    this.environment = environment;
    this.minimumClockAdvanceSeconds = finiteNonNegative(
      options.minimumClockAdvanceSeconds,
      DEFAULT_MINIMUM_CLOCK_ADVANCE_SECONDS,
    );
    this.probeDelayMs = finiteNonNegative(options.probeDelayMs, DEFAULT_PROBE_DELAY_MS);
    this.resumeTimeoutMs = finiteNonNegative(options.resumeTimeoutMs, DEFAULT_RESUME_TIMEOUT_MS);
  }

  get context() {
    return this.contextValue;
  }

  get generation() {
    return this.generationValue;
  }

  /**
   * Cancels the pending recovery and marks a retained context as unverified.
   * The context is intentionally kept so a normal foreground recovery may
   * probe and reuse it; use `forceRecreate` when platform policy calls for it.
   */
  invalidate() {
    this.generationValue += 1;
    this.activeOperation?.abort();
    this.activeOperation = null;
    this.verifiedContext = null;
  }

  stopRecovery() {
    this.invalidate();
  }

  /** Invalidates recovery and releases the retained context without waiting. */
  dispose() {
    this.invalidate();
    const context = this.contextValue;
    this.contextValue = null;
    if (context) this.closeBestEffort(context);
  }

  async recover({ forceRecreate = false }: AudioRecoveryOptions = {}): Promise<AudioRecoveryResult<TContext>> {
    const operation = this.beginOperation();
    let recreated = false;

    if (forceRecreate && this.contextValue) {
      this.discardContext(this.contextValue);
      recreated = true;
    }

    let context = this.contextValue ?? this.createContext();
    if (!context) return this.finishNeedsGesture(operation, 'context-unavailable');

    if (context === this.verifiedContext && context.state === 'running') {
      return this.finishReady(operation, context, recreated);
    }

    const firstAttempt = await this.prepareContext(context, operation);
    if (firstAttempt.status === 'aborted') return this.abortedResult(operation);
    if (firstAttempt.status === 'ready') {
      return this.finishReady(operation, context, recreated);
    }
    if (!this.isCurrent(operation)) return this.abortedResult(operation);

    this.discardContext(context);
    recreated = true;
    context = this.createContext();
    if (!context) return this.finishNeedsGesture(operation, 'context-unavailable');

    const replacementAttempt = await this.prepareContext(context, operation);
    if (replacementAttempt.status === 'aborted') return this.abortedResult(operation);
    if (replacementAttempt.status === 'ready') {
      return this.finishReady(operation, context, recreated);
    }
    return this.finishNeedsGesture(operation, replacementAttempt.reason);
  }

  private abortedResult(operation: RecoveryOperation): AudioRecoveryResult<TContext> {
    return { status: 'aborted', generation: operation.generation };
  }

  private beginOperation() {
    this.activeOperation?.abort();
    const operation = new RecoveryOperation(this.generationValue + 1);
    this.generationValue = operation.generation;
    this.activeOperation = operation;
    return operation;
  }

  private closeBestEffort(context: TContext) {
    try {
      void Promise.resolve(context.close()).catch(() => undefined);
    } catch {
      // A broken platform context must not block replacement.
    }
  }

  private createContext() {
    try {
      const context = this.environment.createContext();
      if (!context) return null;
      this.contextValue = context;
      this.verifiedContext = null;
      return context;
    } catch {
      return null;
    }
  }

  private discardContext(context: TContext) {
    if (this.contextValue === context) this.contextValue = null;
    if (this.verifiedContext === context) this.verifiedContext = null;
    this.closeBestEffort(context);
  }

  private finishNeedsGesture(
    operation: RecoveryOperation,
    reason: AudioRecoveryReason,
  ): AudioRecoveryResult<TContext> {
    if (!this.isCurrent(operation)) return this.abortedResult(operation);
    this.activeOperation = null;
    return { status: 'needs-gesture', generation: operation.generation, reason };
  }

  private finishReady(
    operation: RecoveryOperation,
    context: TContext,
    recreated: boolean,
  ): AudioRecoveryResult<TContext> {
    if (!this.isCurrent(operation) || this.contextValue !== context) {
      return this.abortedResult(operation);
    }
    this.verifiedContext = context;
    this.activeOperation = null;
    return {
      status: 'ready',
      context,
      generation: operation.generation,
      recreated,
    };
  }

  private isCurrent(operation: RecoveryOperation) {
    return !operation.isAborted
      && this.activeOperation === operation
      && this.generationValue === operation.generation;
  }

  private async prepareContext(context: TContext, operation: RecoveryOperation): Promise<AttemptResult> {
    if (!this.isCurrent(operation)) return { status: 'aborted' };
    if (context.state === 'closed') return { status: 'failed', reason: 'context-closed' };

    if (context.state !== 'running') {
      let resumePromise: Promise<void>;
      try {
        resumePromise = context.resume();
      } catch {
        return { status: 'failed', reason: 'resume-rejected' };
      }

      const resumeResult = await this.withTimeout(resumePromise, this.resumeTimeoutMs, operation);
      if (resumeResult === 'aborted') return { status: 'aborted' };
      if (resumeResult === 'timeout') return { status: 'failed', reason: 'resume-timeout' };
      if (resumeResult === 'rejected') return { status: 'failed', reason: 'resume-rejected' };
    }

    if (!this.isCurrent(operation)) return { status: 'aborted' };
    if (context.state !== 'running') return { status: 'failed', reason: 'not-running' };

    const clockBefore = context.currentTime;
    const probeResult = await this.wait(this.probeDelayMs, operation);
    if (probeResult === 'aborted') return { status: 'aborted' };
    if (!this.isCurrent(operation)) return { status: 'aborted' };

    const clockAdvance = context.currentTime - clockBefore;
    if (!Number.isFinite(clockBefore)
      || !Number.isFinite(context.currentTime)
      || clockAdvance < this.minimumClockAdvanceSeconds) {
      return { status: 'failed', reason: 'clock-stalled' };
    }
    return { status: 'ready' };
  }

  private wait(delayMs: number, operation: RecoveryOperation): Promise<'aborted' | 'resolved'> {
    return new Promise((resolve) => {
      let settled = false;
      let timerHandle: unknown = null;
      let removeAbortListener: () => void = () => undefined;

      const finish = (result: 'aborted' | 'resolved') => {
        if (settled) return;
        settled = true;
        if (timerHandle !== null) this.environment.clearTimer(timerHandle);
        removeAbortListener();
        resolve(result);
      };

      removeAbortListener = operation.onAbort(() => finish('aborted'));
      if (settled) return;
      timerHandle = this.environment.setTimer(() => finish('resolved'), delayMs);
    });
  }

  private withTimeout(
    promise: Promise<void>,
    timeoutMs: number,
    operation: RecoveryOperation,
  ): Promise<TimedResult> {
    return new Promise((resolve) => {
      let settled = false;
      let timerHandle: unknown = null;
      let removeAbortListener: () => void = () => undefined;

      const finish = (result: TimedResult) => {
        if (settled) return;
        settled = true;
        if (timerHandle !== null) this.environment.clearTimer(timerHandle);
        removeAbortListener();
        resolve(result);
      };

      removeAbortListener = operation.onAbort(() => finish('aborted'));
      if (settled) return;
      timerHandle = this.environment.setTimer(() => finish('timeout'), timeoutMs);
      void promise.then(
        () => finish('resolved'),
        () => finish('rejected'),
      );
    });
  }
}

export function createBrowserAudioEngine(options: AudioEngineOptions = {}) {
  return new AudioEngine<AudioContext>({
    createContext: () => {
      if (typeof window === 'undefined') return null;
      const AudioContextClass = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return AudioContextClass ? new AudioContextClass() : null;
    },
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  }, options);
}
