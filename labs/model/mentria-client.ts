import { BRAND_NAME } from '../../branding.ts';
import { deleteOwnedModelStorage, isTextModelCached } from './cache.ts';
import {
  MENTRIA_MODEL_REVISION,
  MENTRIA_QUOTES_CONFIG_URL,
  MENTRIA_QUOTES_WEIGHTS_URL,
  MENTRIA_TEXT_MODEL_OPTIONS,
  mentriaRuntimeUrls,
} from './config.ts';
import type { LocalTextModel } from './types.ts';
import type {
  GenerationRequest,
  GenerationResult,
  ModelAdapter,
  ModelProgress,
  ModelSupport,
} from '../types.ts';

type RuntimeProgress = {
  phase?: string;
  loaded?: number;
  total?: number;
  message?: string;
};

type RuntimeToken = {
  token?: string;
  finished?: boolean;
  finishReason?: string;
};

type MentriaEngineLike = {
  onProgress: ((progress: RuntimeProgress) => void) | null;
  onDeviceLost: ((info: { message?: string }) => void) | null;
  init(): Promise<unknown>;
  loadModel(options: Record<string, unknown>): Promise<unknown>;
  generate(
    request: Record<string, unknown>,
    onToken: (event: RuntimeToken) => void,
  ): Promise<RuntimeToken>;
  swapAdapter(options: { name: null } | { name: string; configUrl: string; weightsUrl: string }): Promise<unknown>;
  interrupt(): void;
  unload(): Promise<unknown>;
  terminate(): void;
};

type MentriaRuntimeModule = {
  MentriaEngine: new (workerUrl: string) => MentriaEngineLike;
  QWEN35_08B_CONFIG: Record<string, unknown>;
};

type GpuNavigator = Navigator & {
  gpu?: { requestAdapter: (options?: { powerPreference?: string }) => Promise<unknown> };
};

type GpuLike = GpuNavigator['gpu'];

export async function detectWebGpuSupport(gpu: GpuLike): Promise<ModelSupport> {
  if (!gpu) return { supported: false, reason: 'WebGPU is not available in this browser.' };
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    return adapter
      ? { supported: true, cached: false }
      : { supported: false, reason: 'This browser could not acquire a usable WebGPU adapter.' };
  } catch {
    return { supported: false, reason: `${BRAND_NAME} could not verify WebGPU support on this device. You can retry later.` };
  }
}

function toProgress(progress: RuntimeProgress): ModelProgress {
  const phase = progress.phase?.toLowerCase() ?? '';
  return {
    phase: /compile|upload|shader|init/.test(phase) ? 'compile' : 'download',
    loaded: Number.isFinite(progress.loaded) ? Math.max(0, Number(progress.loaded)) : undefined,
    total: Number.isFinite(progress.total) && Number(progress.total) > 0 ? Number(progress.total) : undefined,
    message: typeof progress.message === 'string' ? progress.message : undefined,
  };
}

async function deleteIndexedDatabase(name: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Database deletion failed.'));
    request.onblocked = () => reject(new Error('Database deletion was blocked.'));
  });
}

export class MentriaTextModel implements LocalTextModel {
  readonly modelRevision = MENTRIA_MODEL_REVISION;
  #engine: MentriaEngineLike | null = null;
  #errorHandler: (message: string) => void = () => undefined;
  #cancelController: AbortController | null = null;

  setErrorHandler(handler: (message: string) => void): void {
    this.#errorHandler = handler;
  }

  async checkSupport(): Promise<ModelSupport> {
    const support = await detectWebGpuSupport((navigator as GpuNavigator).gpu);
    return support.supported
      ? { supported: true, cached: await isTextModelCached(globalThis.caches) }
      : support;
  }

  async load({ onProgress }: { onProgress: (progress: ModelProgress) => void }): Promise<void> {
    if (this.#engine) return;
    const { runtimeUrl, workerUrl } = mentriaRuntimeUrls();
    const runtime = await import(/* webpackIgnore: true */ runtimeUrl) as MentriaRuntimeModule;
    const engine = new runtime.MentriaEngine(workerUrl);
    this.#engine = engine;
    engine.onProgress = (progress) => onProgress(toProgress(progress));
    engine.onDeviceLost = (info) => {
      const message = info?.message || 'The WebGPU device was lost. Reload the model to continue.';
      engine.terminate();
      if (this.#engine === engine) this.#engine = null;
      this.#errorHandler(message);
    };
    try {
      await engine.init();
      await engine.loadModel({
        ...MENTRIA_TEXT_MODEL_OPTIONS,
        shards: [...MENTRIA_TEXT_MODEL_OPTIONS.shards],
        config: runtime.QWEN35_08B_CONFIG,
      });
    } catch (error) {
      engine.terminate();
      if (this.#engine === engine) this.#engine = null;
      throw error;
    }
  }

  async generate(request: GenerationRequest, onToken: (token: string) => void): Promise<GenerationResult> {
    const engine = this.#engine;
    if (!engine) throw new Error('Load the model before generating a phrase.');
    const localController = new AbortController();
    this.#cancelController = localController;
    const abort = () => localController.abort(request.signal?.reason);
    request.signal?.addEventListener('abort', abort, { once: true });
    let text = '';
    try {
      const result = await engine.generate({
        messages: [{ role: 'user', content: request.prompt }],
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        topP: 0.92,
        topK: 40,
        repetitionPenalty: 1.08,
        enableThinking: false,
        signal: localController.signal,
      }, (event) => {
        if (typeof event.token !== 'string' || !event.token || /^<\|[^|]*\|>$/.test(event.token)) return;
        text += event.token;
        onToken(event.token);
      });
      return { text, finishReason: result.finishReason };
    } finally {
      request.signal?.removeEventListener('abort', abort);
      if (this.#cancelController === localController) this.#cancelController = null;
    }
  }

  async swapAdapter(
    adapter: ModelAdapter,
    { onProgress }: { onProgress: (progress: ModelProgress) => void },
  ): Promise<void> {
    const engine = this.#engine;
    if (!engine) throw new Error('Load the base model before switching adapters.');
    engine.onProgress = (progress) => onProgress(toProgress(progress));
    if (adapter === 'base') {
      await engine.swapAdapter({ name: null });
      return;
    }
    await engine.swapAdapter({
      name: 'pulse-quotes-v1',
      configUrl: MENTRIA_QUOTES_CONFIG_URL,
      weightsUrl: MENTRIA_QUOTES_WEIGHTS_URL,
    });
  }

  cancel(): void {
    this.#cancelController?.abort();
    this.#engine?.interrupt();
  }

  async unload(): Promise<void> {
    const engine = this.#engine;
    this.cancel();
    this.#engine = null;
    if (!engine) return;
    try {
      await engine.unload();
    } finally {
      engine.terminate();
    }
  }

  async deleteCache(): Promise<void> {
    await deleteOwnedModelStorage({
      caches: globalThis.caches,
      deleteDatabase: deleteIndexedDatabase,
    });
  }
}
