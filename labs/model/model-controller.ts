import type { LocalTextModel } from './types.ts';
import type {
  GenerationRequest,
  GenerationResult,
  MentriaStatus,
  ModelAdapter,
  ModelProgress,
} from '../types.ts';

type Listener = (status: MentriaStatus) => void;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export class ModelController {
  readonly #model: LocalTextModel;
  #status: MentriaStatus = { kind: 'idle', cached: false };
  #listeners = new Set<Listener>();
  #loadPromise: Promise<void> | null = null;
  #generationPromise: Promise<GenerationResult> | null = null;
  #generationController: AbortController | null = null;
  #adapter: ModelAdapter = 'base';
  #cached = false;
  #disposed = false;

  constructor(model: LocalTextModel) {
    this.#model = model;
    model.setErrorHandler?.((message) => {
      this.#model.cancel();
      this.#generationController?.abort();
      this.#generationPromise = null;
      this.#loadPromise = null;
      this.#setStatus({ kind: 'error', message });
    });
  }

  get status(): MentriaStatus {
    return this.#status;
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.#status);
    return () => this.#listeners.delete(listener);
  }

  #setStatus(status: MentriaStatus): void {
    if (this.#disposed) return;
    this.#status = status;
    for (const listener of this.#listeners) listener(status);
  }

  async initialize(): Promise<void> {
    const support = await this.#model.checkSupport();
    if (this.#disposed) return;
    if (support.supported) this.#cached = support.cached;
    this.#setStatus(support.supported
      ? { kind: 'idle', cached: this.#cached }
      : { kind: 'unsupported', reason: support.reason });
  }

  requestLoad(): void {
    if (this.#status.kind === 'unsupported' || this.#status.kind === 'ready' || this.#status.kind === 'generating') return;
    this.#setStatus({ kind: 'awaiting-consent' });
  }

  declineLoad(): void {
    if (this.#status.kind !== 'awaiting-consent') return;
    this.#setStatus({ kind: 'idle', cached: this.#cached });
  }

  approveLoad(): Promise<void> {
    if (this.#loadPromise) return this.#loadPromise;
    if (this.#status.kind !== 'awaiting-consent' && this.#status.kind !== 'error') return Promise.resolve();
    this.#setStatus({ kind: 'loading-runtime' });
    this.#loadPromise = this.#model.load({ onProgress: (progress) => this.#handleProgress(progress) })
      .then(() => {
        this.#cached = true;
        this.#adapter = 'base';
        this.#setStatus({ kind: 'ready', adapter: 'base' });
      })
      .catch((error: unknown) => {
        this.#setStatus({ kind: 'error', message: errorMessage(error, 'The local model could not be loaded.') });
      })
      .finally(() => { this.#loadPromise = null; });
    return this.#loadPromise;
  }

  #handleProgress(progress: ModelProgress): void {
    if (progress.phase === 'compile') {
      this.#setStatus({ kind: 'compiling', message: progress.message });
      return;
    }
    const loaded = Math.max(0, progress.loaded ?? 0);
    const total = progress.total && progress.total > 0 ? progress.total : undefined;
    this.#setStatus({
      kind: 'downloading',
      loaded: total ? Math.min(loaded, total) : loaded,
      total,
      message: progress.message,
    });
  }

  async generate(
    request: Omit<GenerationRequest, 'signal'> & { signal?: AbortSignal },
    onToken: (token: string) => void,
  ): Promise<GenerationResult> {
    if (this.#status.kind !== 'ready') throw new Error('The local model is not ready.');
    if (this.#generationPromise) throw new Error('A generation is already running.');
    const controller = new AbortController();
    this.#generationController = controller;
    const abort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener('abort', abort, { once: true });
    this.#setStatus({ kind: 'generating' });
    const promise = this.#model.generate({ ...request, signal: controller.signal }, onToken);
    this.#generationPromise = promise;
    try {
      return await promise;
    } catch (error) {
      if (!isAbort(error)) {
        this.#setStatus({ kind: 'error', message: errorMessage(error, 'Phrase generation failed.') });
      }
      throw error;
    } finally {
      request.signal?.removeEventListener('abort', abort);
      if (this.#generationPromise === promise) this.#generationPromise = null;
      if (this.#generationController === controller) this.#generationController = null;
      if ((this.#status as MentriaStatus).kind === 'generating') {
        this.#setStatus({ kind: 'ready', adapter: this.#adapter });
      }
    }
  }

  cancelGeneration(): void {
    this.#generationController?.abort();
    this.#model.cancel();
  }

  async switchAdapter(adapter: ModelAdapter): Promise<boolean> {
    if (this.#status.kind !== 'ready') return false;
    if (adapter === this.#adapter) return true;
    this.#setStatus(adapter === 'quotes'
      ? { kind: 'downloading', loaded: 0, message: 'Downloading quote adapter' }
      : { kind: 'compiling', message: 'Switching to the base model' });
    try {
      await this.#model.swapAdapter(adapter, { onProgress: (progress) => this.#handleProgress(progress) });
      this.#adapter = adapter;
      this.#setStatus({ kind: 'ready', adapter });
      return true;
    } catch (error) {
      this.#adapter = 'base';
      this.#setStatus({
        kind: 'error',
        message: adapter === 'quotes'
          ? `${errorMessage(error, 'The quote adapter could not be loaded.')} The base model remains available after retry.`
          : errorMessage(error, 'The adapter could not be switched.'),
      });
      return false;
    }
  }

  async unload(): Promise<void> {
    this.cancelGeneration();
    await this.#model.unload();
    this.#cached = true;
    this.#adapter = 'base';
    this.#setStatus({ kind: 'idle', cached: true });
  }

  async deleteModel(): Promise<boolean> {
    try {
      await this.unload();
      await this.#model.deleteCache();
      this.#cached = false;
      this.#setStatus({ kind: 'idle', cached: false });
      return true;
    } catch (error) {
      this.#setStatus({ kind: 'error', message: errorMessage(error, 'The model cache could not be deleted.') });
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.cancelGeneration();
    this.#disposed = true;
    this.#listeners.clear();
    await this.#model.unload().catch(() => undefined);
  }
}
