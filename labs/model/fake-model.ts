import type { LocalTextModel } from './types.ts';
import type {
  GenerationRequest,
  GenerationResult,
  ModelAdapter,
  ModelProgress,
  ModelSupport,
} from '../types.ts';

export class DeterministicFakeModel implements LocalTextModel {
  support: ModelSupport = { supported: true, cached: false };
  response = 'Stay steady. Finish the round.';
  loadCalls = 0;
  generateCalls = 0;
  unloadCalls = 0;
  deleteCalls = 0;
  cancelCalls = 0;
  adapter: ModelAdapter = 'base';
  loaded = false;
  #errorHandler: (message: string) => void = () => undefined;

  setErrorHandler(handler: (message: string) => void): void {
    this.#errorHandler = handler;
  }

  failDevice(message = 'Fake WebGPU device lost.'): void {
    this.loaded = false;
    this.#errorHandler(message);
  }

  async checkSupport(): Promise<ModelSupport> {
    return this.support;
  }

  async load({ onProgress }: { onProgress: (progress: ModelProgress) => void }): Promise<void> {
    this.loadCalls += 1;
    onProgress({ phase: 'download', loaded: 50, total: 100, message: 'Fake download' });
    onProgress({ phase: 'compile', message: 'Fake compile' });
    this.loaded = true;
  }

  async generate(request: GenerationRequest, onToken: (token: string) => void): Promise<GenerationResult> {
    if (!this.loaded) throw new Error('Fake model is not loaded.');
    this.generateCalls += 1;
    request.signal?.throwIfAborted();
    for (const token of this.response.split(/(?<=\s)/)) {
      request.signal?.throwIfAborted();
      onToken(token);
    }
    return { text: this.response, finishReason: 'eos' };
  }

  async swapAdapter(adapter: ModelAdapter, { onProgress }: { onProgress: (progress: ModelProgress) => void }): Promise<void> {
    onProgress({ phase: adapter === 'quotes' ? 'download' : 'compile', loaded: 1, total: 1 });
    this.adapter = adapter;
  }

  cancel(): void {
    this.cancelCalls += 1;
  }

  async unload(): Promise<void> {
    this.unloadCalls += 1;
    this.loaded = false;
  }

  async deleteCache(): Promise<void> {
    this.deleteCalls += 1;
  }
}
