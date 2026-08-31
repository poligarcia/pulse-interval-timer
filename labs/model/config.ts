export const MENTRIA_RUNTIME_REVISION = '8688f15585957926a7332eda6546cb586ee9f562';
export const MENTRIA_MODEL_REVISION = 'b0bdedca9258b059b1b0f8cfbb2751d12bd8dab8';
export const MENTRIA_MODEL_REPOSITORY = 'mentriaai/Qwen3.5-0.8B-mentria';
export const MENTRIA_TEXT_MODEL_SIZE_BYTES = 484_780_364;
export const MENTRIA_QUOTES_ADAPTER_SIZE_BYTES = 45_699_193;
export const MENTRIA_RUNTIME_PATH = 'mentria/dist/mentria.mjs';
export const MENTRIA_WORKER_PATH = 'mentria/dist/worker.mjs';
export const MENTRIA_MODEL_BASE_URL = `https://huggingface.co/${MENTRIA_MODEL_REPOSITORY}/resolve/${MENTRIA_MODEL_REVISION}/`;
export const MENTRIA_TEXT_SHARDS = Object.freeze(['qwen3.5-0.8b-q4-tied.safetensors'] as const);
export const MENTRIA_QUOTES_CONFIG_URL = `${MENTRIA_MODEL_BASE_URL}loras/quotes/adapter_config.json`;
export const MENTRIA_QUOTES_WEIGHTS_URL = `${MENTRIA_MODEL_BASE_URL}loras/quotes/adapter_model.safetensors`;

export function publicAssetUrl(relativePath: string, baseURI?: string): string {
  const base = baseURI ?? (typeof document !== 'undefined' ? document.baseURI : undefined);
  if (!base) throw new Error('Browser-only asset URL requires a base URI.');
  return new URL(relativePath.replace(/^\/+/, ''), base).href;
}

export function mentriaRuntimeUrls(baseURI?: string) {
  return {
    runtimeUrl: publicAssetUrl(MENTRIA_RUNTIME_PATH, baseURI),
    workerUrl: publicAssetUrl(MENTRIA_WORKER_PATH, baseURI),
  };
}

export const MENTRIA_TEXT_MODEL_OPTIONS = Object.freeze({
  modelUrl: MENTRIA_MODEL_BASE_URL,
  shards: MENTRIA_TEXT_SHARDS,
  tokenizerUrl: MENTRIA_MODEL_BASE_URL,
  allowTiedEmbed: true,
});
