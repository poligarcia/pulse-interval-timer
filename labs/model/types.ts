import type {
  GenerationRequest,
  GenerationResult,
  ModelAdapter,
  ModelProgress,
  ModelSupport,
} from '../types.ts';

export interface LocalTextModel {
  checkSupport(): Promise<ModelSupport>;
  load(options: { onProgress: (progress: ModelProgress) => void }): Promise<void>;
  generate(request: GenerationRequest, onToken: (token: string) => void): Promise<GenerationResult>;
  swapAdapter(adapter: ModelAdapter, options: { onProgress: (progress: ModelProgress) => void }): Promise<void>;
  cancel(): void;
  unload(): Promise<void>;
  deleteCache(): Promise<void>;
  setErrorHandler?(handler: (message: string) => void): void;
}
