import { BRAND_NAME } from '../../branding.ts';

export const OWNED_MODEL_CACHE_NAMES = ['mentria-models'] as const;
export const OWNED_MODEL_DATABASE_NAMES: readonly string[] = [];

export type CacheStorageLike = Pick<CacheStorage, 'delete'>;

export type ModelStorageEnvironment = {
  caches?: CacheStorageLike;
  deleteDatabase?: (name: string) => Promise<void>;
};

export async function deleteOwnedModelStorage(environment: ModelStorageEnvironment): Promise<void> {
  if (!environment.caches) throw new Error('Cache Storage is unavailable on this device.');
  const failures: string[] = [];
  for (const name of OWNED_MODEL_CACHE_NAMES) {
    try {
      await environment.caches.delete(name);
    } catch {
      failures.push(`cache:${name}`);
    }
  }
  if (environment.deleteDatabase) {
    for (const name of OWNED_MODEL_DATABASE_NAMES) {
      try {
        await environment.deleteDatabase(name);
      } catch {
        failures.push(`database:${name}`);
      }
    }
  }
  if (failures.length > 0) throw new Error(`Some ${BRAND_NAME} Labs model storage could not be deleted.`);
}

export async function isTextModelCached(cacheStorage?: CacheStorage): Promise<boolean> {
  if (!cacheStorage) return false;
  try {
    if (!(await cacheStorage.has(OWNED_MODEL_CACHE_NAMES[0]))) return false;
    const cache = await cacheStorage.open(OWNED_MODEL_CACHE_NAMES[0]);
    const requests = await cache.keys();
    return requests.some(({ url }) => url.includes('qwen3.5-0.8b-q4-tied.safetensors'));
  } catch {
    return false;
  }
}
