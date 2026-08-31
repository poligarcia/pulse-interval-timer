import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { deleteOwnedModelStorage, OWNED_MODEL_CACHE_NAMES } from './cache.ts';

test('UT-CACHE-001–004 service worker removes only obsolete pulse app caches', () => {
  const sw = fs.readFileSync(path.resolve('public/sw.js'), 'utf8');
  assert.match(sw, /APP_CACHE_PREFIX = 'pulse-app-'/);
  assert.match(sw, /key\.startsWith\(APP_CACHE_PREFIX\) && key !== CACHE_NAME/);
  assert.doesNotMatch(sw, /key !== CACHE_NAME\)\.map/);
});

test('UT-CACHE-005 model deletion targets only the explicit allowlist', async () => {
  const deleted: string[] = [];
  await deleteOwnedModelStorage({ caches: { delete: async (name) => { deleted.push(String(name)); return true; } } });
  assert.deepEqual(deleted, [...OWNED_MODEL_CACHE_NAMES]);
  assert.equal(deleted.some((name) => name.startsWith('pulse-app-')), false);
});

test('UT-CACHE-006 missing Cache API is a recoverable rejection', async () => {
  await assert.rejects(() => deleteOwnedModelStorage({}), /unavailable/);
});
