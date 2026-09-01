export type SpeechVoiceLike = {
  name?: string;
  voiceURI: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
};

export type SpeechUtteranceLike<Voice extends SpeechVoiceLike> = {
  voice: Voice | null;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  addEventListener: (
    type: 'start' | 'end' | 'error',
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ) => void;
};

export type SpeechSynthesisLike<
  Voice extends SpeechVoiceLike,
  Utterance extends SpeechUtteranceLike<Voice>,
> = {
  readonly speaking: boolean;
  readonly pending: boolean;
  getVoices: () => Voice[];
  speak: (utterance: Utterance) => void;
  cancel: () => void;
  addEventListener: (
    type: 'voiceschanged',
    listener: EventListenerOrEventListenerObject,
  ) => void;
  removeEventListener: (
    type: 'voiceschanged',
    listener: EventListenerOrEventListenerObject,
  ) => void;
};

export type SpeechVisibilitySource = {
  isVisible: () => boolean;
  subscribe: (listener: () => void) => () => void;
};

export type SpeechControllerEnvironment<
  Voice extends SpeechVoiceLike,
  Utterance extends SpeechUtteranceLike<Voice>,
  TimerHandle = unknown,
> = {
  synthesis: SpeechSynthesisLike<Voice, Utterance>;
  createUtterance: (text: string) => Utterance;
  setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
  visibility?: SpeechVisibilitySource;
};

export type SpeechControllerOptions = {
  replacementDelayMs?: number;
  startWatchdogMs?: number;
  voiceWaitMs?: number;
  retryLimit?: 0 | 1;
  isRetryableError?: (code: string) => boolean;
};

export type SpeechRequest<Voice extends SpeechVoiceLike> = {
  text: string;
  locale: string;
  preferredVoiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  interrupt?: boolean;
  retry?: boolean;
  onStart?: (event: Event, context: SpeechAttemptContext<Voice>) => void;
  onEnd?: (event: Event, context: SpeechAttemptContext<Voice>) => void;
  onError?: (failure: SpeechFailure<Voice>) => void;
};

export type SpeechAttemptContext<Voice extends SpeechVoiceLike> = {
  generation: number;
  attempt: number;
  voice: Voice | null;
};

export type SpeechFailure<Voice extends SpeechVoiceLike> = {
  code: string;
  generation: number;
  attempt: number;
  voice: Voice | null;
  event?: Event;
  willRetry: boolean;
};

export type SpeechHandleState =
  | 'queued'
  | 'waiting-for-voice'
  | 'scheduled'
  | 'pending'
  | 'speaking'
  | 'ended'
  | 'failed'
  | 'canceled';

export type SpeechHandle<Utterance> = {
  readonly generation: number;
  readonly state: SpeechHandleState;
  readonly utterance: Utterance | null;
  cancel: () => void;
};

type SpeechJob<
  Voice extends SpeechVoiceLike,
  Utterance extends SpeechUtteranceLike<Voice>,
  TimerHandle,
> = {
  generation: number;
  request: SpeechRequest<Voice>;
  state: SpeechHandleState;
  attempt: number;
  retriesUsed: number;
  attemptToken: number;
  started: boolean;
  submitted: boolean;
  voice: Voice | null;
  utterance: Utterance | null;
  timer: TimerHandle | null;
  handle: SpeechHandle<Utterance> | null;
};

const DEFAULT_REPLACEMENT_DELAY_MS = 40;
const DEFAULT_START_WATCHDOG_MS = 1_500;
const DEFAULT_VOICE_WAIT_MS = 1_500;

const NON_RETRYABLE_ERRORS = new Set([
  'canceled',
  'interrupted',
  'invalid-argument',
  'not-allowed',
  'text-too-long',
  'visibility-hidden',
]);

function normalizeLanguageTag(value: string) {
  return value.trim().replaceAll('_', '-').toLocaleLowerCase();
}

function languageFamily(value: string) {
  return normalizeLanguageTag(value).split('-')[0] ?? '';
}

function preferredFromPool<Voice extends SpeechVoiceLike>(pool: Voice[]) {
  const local = pool.filter((voice) => voice.localService === true);
  const candidates = local.length > 0 ? local : pool;
  return candidates.find((voice) => voice.default) ?? candidates[0] ?? null;
}

/** Selects a concrete, language-compatible voice without falling back to a nullable default. */
export function selectSpeechVoice<Voice extends SpeechVoiceLike>(
  voices: readonly Voice[],
  locale: string,
  preferredVoiceURI = '',
): Voice | null {
  const normalizedLocale = normalizeLanguageTag(locale);
  const family = languageFamily(normalizedLocale);
  const compatible = voices.filter((voice) => languageFamily(voice.lang) === family);
  const normalizedPreferredVoiceURI = preferredVoiceURI.trim();
  const preferred = normalizedPreferredVoiceURI
    ? compatible.find((voice) => voice.voiceURI === normalizedPreferredVoiceURI)
    : undefined;
  if (preferred) return preferred;

  const exact = compatible.filter((voice) => normalizeLanguageTag(voice.lang) === normalizedLocale);
  if (exact.length > 0) return preferredFromPool(exact);
  return preferredFromPool(compatible);
}

function voicesMatch<Voice extends SpeechVoiceLike>(left: readonly Voice[], right: readonly Voice[]) {
  if (left.length !== right.length) return false;
  return left.every((voice, index) => {
    const candidate = right[index];
    return candidate?.voiceURI === voice.voiceURI
      && candidate.lang === voice.lang
      && candidate.localService === voice.localService
      && candidate.default === voice.default
      && candidate.name === voice.name;
  });
}

function errorCode(event: Event) {
  const value = (event as Event & { error?: unknown }).error;
  return typeof value === 'string' && value ? value : 'synthesis-failed';
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export class SpeechController<
  Voice extends SpeechVoiceLike,
  Utterance extends SpeechUtteranceLike<Voice>,
  TimerHandle = unknown,
> {
  private readonly environment: SpeechControllerEnvironment<Voice, Utterance, TimerHandle>;
  private readonly replacementDelayMs: number;
  private readonly startWatchdogMs: number;
  private readonly voiceWaitMs: number;
  private readonly retryLimit: 0 | 1;
  private readonly isRetryableError: (code: string) => boolean;
  private readonly voiceListeners = new Set<(voices: readonly Voice[]) => void>();
  private readonly voicesChangedListener: EventListener;
  private visibilityUnsubscribe: (() => void) | null = null;
  private voices: Voice[] = [];
  private queue: Array<SpeechJob<Voice, Utterance, TimerHandle>> = [];
  private currentJob: SpeechJob<Voice, Utterance, TimerHandle> | null = null;
  private generation = 0;
  private visible = true;
  private disposed = false;

  constructor(
    environment: SpeechControllerEnvironment<Voice, Utterance, TimerHandle>,
    options: SpeechControllerOptions = {},
  ) {
    this.environment = environment;
    this.replacementDelayMs = Math.max(0, options.replacementDelayMs ?? DEFAULT_REPLACEMENT_DELAY_MS);
    this.startWatchdogMs = Math.max(1, options.startWatchdogMs ?? DEFAULT_START_WATCHDOG_MS);
    this.voiceWaitMs = Math.max(1, options.voiceWaitMs ?? DEFAULT_VOICE_WAIT_MS);
    this.retryLimit = options.retryLimit ?? 1;
    this.isRetryableError = options.isRetryableError
      ?? ((code) => !NON_RETRYABLE_ERRORS.has(code));
    this.visible = environment.visibility?.isVisible() ?? true;
    this.voicesChangedListener = () => this.refreshVoices();

    this.refreshVoices(false);
    environment.synthesis.addEventListener('voiceschanged', this.voicesChangedListener);
    if (environment.visibility) {
      this.visibilityUnsubscribe = environment.visibility.subscribe(() => {
        this.setVisible(environment.visibility?.isVisible() ?? true);
      });
    }
  }

  getVoices() {
    return [...this.voices];
  }

  subscribeVoices(listener: (voices: readonly Voice[]) => void) {
    this.voiceListeners.add(listener);
    listener(this.getVoices());
    return () => this.voiceListeners.delete(listener);
  }

  refreshVoices(resumeWaitingJob = true) {
    if (this.disposed) return this.getVoices();
    let nextVoices: Voice[];
    try {
      nextVoices = [...this.environment.synthesis.getVoices()];
    } catch {
      nextVoices = [];
    }

    const changed = !voicesMatch(this.voices, nextVoices);
    this.voices = nextVoices;
    if (changed) {
      const snapshot = this.getVoices();
      for (const listener of this.voiceListeners) listener(snapshot);
    }

    const activeJob = this.currentJob;
    const compatibleVoice = activeJob && this.selectVoiceFor(activeJob.request);
    if (resumeWaitingJob
      && activeJob?.state === 'waiting-for-voice'
      && this.isCurrent(activeJob)
      && compatibleVoice) {
      this.clearJobTimer(activeJob);
      this.startJob(activeJob);
    } else if (resumeWaitingJob
      && activeJob?.state === 'pending'
      && activeJob.submitted
      && !activeJob.started
      && activeJob.voice === null
      && this.isCurrent(activeJob)
      && compatibleVoice
      && activeJob.request.retry !== false
      && activeJob.retriesUsed < this.retryLimit) {
      // The fallback utterance preserved the initiating gesture. Once the browser exposes
      // voices, replace it safely with the now-explicit compatible voice if it has not started.
      this.clearJobTimer(activeJob);
      this.scheduleRetry(activeJob);
    }
    return this.getVoices();
  }

  resolveVoice(locale: string, preferredVoiceURI = '') {
    this.refreshVoices(false);
    return selectSpeechVoice(this.voices, locale, preferredVoiceURI);
  }

  speak(request: SpeechRequest<Voice>): SpeechHandle<Utterance> | null {
    const text = request.text.trim();
    if (!text || this.disposed) return null;

    let deferForReplacement = false;
    if (request.interrupt) {
      const hadSubmittedSpeech = Boolean(this.currentJob?.submitted)
        || this.environment.synthesis.speaking
        || this.environment.synthesis.pending;
      this.invalidateJobs(hadSubmittedSpeech);
      deferForReplacement = hadSubmittedSpeech;
    } else if (this.generation === 0) {
      this.generation = 1;
    }

    const normalizedRequest = { ...request, text };
    const job: SpeechJob<Voice, Utterance, TimerHandle> = {
      generation: this.generation || 1,
      request: normalizedRequest,
      state: 'queued',
      attempt: 0,
      retriesUsed: 0,
      attemptToken: 0,
      started: false,
      submitted: false,
      voice: null,
      utterance: null,
      timer: null,
      handle: null,
    };
    if (this.generation === 0) this.generation = job.generation;
    job.handle = this.createHandle(job);

    if (!this.visible) {
      job.state = 'canceled';
      request.onError?.({
        code: 'visibility-hidden',
        generation: job.generation,
        attempt: 0,
        voice: null,
        willRetry: false,
      });
      return job.handle;
    }

    if (this.currentJob) {
      this.queue.push(job);
      return job.handle;
    }

    this.currentJob = job;
    if (deferForReplacement) {
      job.state = 'scheduled';
      job.timer = this.environment.setTimer(() => {
        job.timer = null;
        if (this.isCurrent(job)) this.startJob(job);
      }, this.replacementDelayMs);
    } else {
      this.startJob(job);
    }
    return job.handle;
  }

  cancel() {
    if (this.disposed && !this.currentJob && this.queue.length === 0) return;
    const shouldCancelNative = Boolean(this.currentJob?.submitted)
      || this.environment.synthesis.speaking
      || this.environment.synthesis.pending;
    this.invalidateJobs(shouldCancelNative);
  }

  setVisible(visible: boolean) {
    if (this.disposed || this.visible === visible) return;
    this.visible = visible;
    if (!visible) {
      this.cancel();
      return;
    }
    this.refreshVoices();
  }

  dispose() {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
    this.environment.synthesis.removeEventListener('voiceschanged', this.voicesChangedListener);
    this.visibilityUnsubscribe?.();
    this.visibilityUnsubscribe = null;
    this.voiceListeners.clear();
  }

  private createHandle(job: SpeechJob<Voice, Utterance, TimerHandle>): SpeechHandle<Utterance> {
    return {
      get generation() { return job.generation; },
      get state() { return job.state; },
      get utterance() { return job.utterance; },
      cancel: () => this.cancelJob(job),
    };
  }

  private cancelJob(job: SpeechJob<Voice, Utterance, TimerHandle>) {
    const queuedIndex = this.queue.indexOf(job);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
      job.state = 'canceled';
      this.clearJobTimer(job);
      job.attemptToken += 1;
      return;
    }
    if (this.currentJob === job) this.cancel();
  }

  private invalidateJobs(cancelNative: boolean) {
    this.generation += 1;
    if (this.currentJob) {
      this.clearJobTimer(this.currentJob);
      this.currentJob.attemptToken += 1;
      this.currentJob.state = 'canceled';
      this.currentJob.submitted = false;
    }
    for (const job of this.queue) {
      this.clearJobTimer(job);
      job.attemptToken += 1;
      job.state = 'canceled';
    }
    this.currentJob = null;
    this.queue = [];
    if (cancelNative) {
      try { this.environment.synthesis.cancel(); } catch { /* Treat cancellation as best effort. */ }
    }
  }

  private startJob(job: SpeechJob<Voice, Utterance, TimerHandle>) {
    if (!this.isCurrent(job)) return;
    this.clearJobTimer(job);
    this.refreshVoices(false);
    const voice = this.selectVoiceFor(job.request);
    if (!voice && job.attempt > 0) {
      job.state = 'waiting-for-voice';
      job.voice = null;
      job.utterance = null;
      job.timer = this.environment.setTimer(() => {
        job.timer = null;
        if (!this.isCurrent(job)) return;
        this.refreshVoices(false);
        if (this.selectVoiceFor(job.request)) {
          this.startJob(job);
          return;
        }
        this.terminateWithFailure(job, 'voice-unavailable');
      }, this.voiceWaitMs);
      return;
    }

    job.voice = voice;
    job.started = false;
    job.attempt += 1;
    job.attemptToken += 1;
    const attemptToken = job.attemptToken;

    let utterance: Utterance;
    try {
      utterance = this.environment.createUtterance(job.request.text);
      utterance.voice = voice;
      utterance.lang = voice?.lang ?? job.request.locale;
      utterance.rate = clamp(job.request.rate ?? 1, 0.1, 10);
      utterance.pitch = clamp(job.request.pitch ?? 1, 0, 2);
      utterance.volume = clamp(job.request.volume ?? 1, 0, 1);
    } catch {
      this.handleAttemptFailure(job, attemptToken, 'synthesis-failed');
      return;
    }

    job.utterance = utterance;
    job.submitted = true;
    job.state = 'pending';
    const onStart: EventListener = (event) => this.handleStart(job, attemptToken, event);
    const onEnd: EventListener = (event) => this.handleEnd(job, attemptToken, event);
    const onError: EventListener = (event) => this.handleAttemptFailure(
      job,
      attemptToken,
      errorCode(event),
      event,
    );
    utterance.addEventListener('start', onStart, { once: true });
    utterance.addEventListener('end', onEnd, { once: true });
    utterance.addEventListener('error', onError, { once: true });
    job.timer = this.environment.setTimer(() => {
      job.timer = null;
      if (this.isAttemptCurrent(job, attemptToken) && !job.started) {
        this.handleAttemptFailure(job, attemptToken, 'start-timeout');
      }
    }, this.startWatchdogMs);

    try {
      this.environment.synthesis.speak(utterance);
    } catch {
      job.submitted = false;
      this.handleAttemptFailure(job, attemptToken, 'synthesis-failed');
    }
  }

  private handleStart(job: SpeechJob<Voice, Utterance, TimerHandle>, token: number, event: Event) {
    if (!this.isAttemptCurrent(job, token)) return;
    this.clearJobTimer(job);
    job.started = true;
    job.state = 'speaking';
    job.request.onStart?.(event, this.attemptContext(job));
  }

  private handleEnd(job: SpeechJob<Voice, Utterance, TimerHandle>, token: number, event: Event) {
    if (!this.isAttemptCurrent(job, token)) return;
    this.clearJobTimer(job);
    job.submitted = false;
    const context = this.attemptContext(job);
    this.completeJob(job, 'ended', () => job.request.onEnd?.(event, context));
  }

  private handleAttemptFailure(
    job: SpeechJob<Voice, Utterance, TimerHandle>,
    token: number,
    code: string,
    event?: Event,
  ) {
    if (!this.isAttemptCurrent(job, token)) return;
    this.clearJobTimer(job);
    // A native error event is terminal for that utterance. Keep `submitted` true only for
    // watchdog failures, where cancelling is necessary to unstick a silent native queue.
    if (event) job.submitted = false;
    const willRetry = !job.started
      && job.request.retry !== false
      && job.retriesUsed < this.retryLimit
      && this.isRetryableError(code)
      && this.visible;
    const failure: SpeechFailure<Voice> = {
      code,
      generation: job.generation,
      attempt: job.attempt,
      voice: job.voice,
      event,
      willRetry,
    };
    job.request.onError?.(failure);
    if (!this.isAttemptCurrent(job, token)) return;
    if (willRetry) {
      this.scheduleRetry(job);
      return;
    }

    const shouldCancelNative = job.submitted
      || this.environment.synthesis.speaking
      || this.environment.synthesis.pending;
    job.attemptToken += 1;
    job.submitted = false;
    if (shouldCancelNative) {
      try { this.environment.synthesis.cancel(); } catch { /* Treat cancellation as best effort. */ }
    }
    this.completeJob(job, 'failed');
  }

  private scheduleRetry(job: SpeechJob<Voice, Utterance, TimerHandle>) {
    const shouldCancelNative = job.submitted
      || this.environment.synthesis.speaking
      || this.environment.synthesis.pending;
    job.retriesUsed += 1;
    job.attemptToken += 1;
    job.started = false;
    job.submitted = false;
    job.utterance = null;
    job.state = 'scheduled';
    if (shouldCancelNative) {
      try { this.environment.synthesis.cancel(); } catch { /* Treat cancellation as best effort. */ }
    }
    job.timer = this.environment.setTimer(() => {
      job.timer = null;
      if (this.isCurrent(job)) this.startJob(job);
    }, this.replacementDelayMs);
  }

  private terminateWithFailure(job: SpeechJob<Voice, Utterance, TimerHandle>, code: string) {
    if (!this.isCurrent(job)) return;
    const failure: SpeechFailure<Voice> = {
      code,
      generation: job.generation,
      attempt: job.attempt,
      voice: job.voice,
      willRetry: false,
    };
    this.completeJob(job, 'failed', () => job.request.onError?.(failure));
  }

  private completeJob(
    job: SpeechJob<Voice, Utterance, TimerHandle>,
    state: Extract<SpeechHandleState, 'ended' | 'failed'>,
    callback?: () => void,
  ) {
    if (this.currentJob !== job) return;
    this.clearJobTimer(job);
    job.attemptToken += 1;
    job.submitted = false;
    job.state = state;
    this.currentJob = null;
    try {
      callback?.();
    } finally {
      this.startNextJob(job.generation);
    }
  }

  private startNextJob(completedGeneration: number) {
    if (this.currentJob || !this.visible || this.generation !== completedGeneration) return;
    const next = this.queue.shift();
    if (!next || next.generation !== this.generation) return;
    this.currentJob = next;
    this.startJob(next);
  }

  private attemptContext(job: SpeechJob<Voice, Utterance, TimerHandle>): SpeechAttemptContext<Voice> {
    return {
      generation: job.generation,
      attempt: job.attempt,
      voice: job.voice,
    };
  }

  private selectVoiceFor(request: SpeechRequest<Voice>) {
    return selectSpeechVoice(this.voices, request.locale, request.preferredVoiceURI);
  }

  private clearJobTimer(job: SpeechJob<Voice, Utterance, TimerHandle>) {
    if (job.timer === null) return;
    this.environment.clearTimer(job.timer);
    job.timer = null;
  }

  private isCurrent(job: SpeechJob<Voice, Utterance, TimerHandle>) {
    return !this.disposed
      && this.visible
      && this.currentJob === job
      && this.generation === job.generation;
  }

  private isAttemptCurrent(job: SpeechJob<Voice, Utterance, TimerHandle>, token: number) {
    return this.isCurrent(job) && job.attemptToken === token;
  }
}

export function createSpeechController<
  Voice extends SpeechVoiceLike,
  Utterance extends SpeechUtteranceLike<Voice>,
  TimerHandle = unknown,
>(
  environment: SpeechControllerEnvironment<Voice, Utterance, TimerHandle>,
  options?: SpeechControllerOptions,
) {
  return new SpeechController(environment, options);
}
