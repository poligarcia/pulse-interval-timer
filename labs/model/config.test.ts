import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MENTRIA_MODEL_BASE_URL,
  MENTRIA_MODEL_REVISION,
  MENTRIA_RUNTIME_REVISION,
  MENTRIA_TEXT_MODEL_OPTIONS,
  mentriaRuntimeUrls,
} from './config.ts';

test('UT-CONFIG-001 local runtime URL resolves beneath the root', () => {
  const urls = mentriaRuntimeUrls('http://localhost:3000/');
  assert.equal(urls.runtimeUrl, 'http://localhost:3000/mentria/dist/mentria.mjs');
});

test('UT-CONFIG-002 GitHub Pages runtime URL includes the subpath exactly once', () => {
  const urls = mentriaRuntimeUrls('https://example.test/pulse-interval-timer/');
  assert.equal(urls.runtimeUrl, 'https://example.test/pulse-interval-timer/mentria/dist/mentria.mjs');
  assert.equal(urls.runtimeUrl.match(/pulse-interval-timer/g)?.length, 1);
});

test('UT-CONFIG-003 worker resolves beside the vendored runtime', () => {
  const urls = mentriaRuntimeUrls('https://example.test/pulse-interval-timer/');
  assert.equal(urls.workerUrl, 'https://example.test/pulse-interval-timer/mentria/dist/worker.mjs');
});

test('UT-CONFIG-004 model URL pins an exact revision and never main', () => {
  assert.match(MENTRIA_MODEL_BASE_URL, new RegExp(MENTRIA_MODEL_REVISION));
  assert.doesNotMatch(MENTRIA_MODEL_BASE_URL, /resolve\/main/);
  assert.match(MENTRIA_RUNTIME_REVISION, /^[a-f0-9]{40}$/);
});

test('UT-CONFIG-005 load options are text-only', () => {
  const serialized = JSON.stringify(MENTRIA_TEXT_MODEL_OPTIONS);
  assert.doesNotMatch(serialized, /vision|image|vl-q4/i);
  assert.deepEqual(MENTRIA_TEXT_MODEL_OPTIONS.shards, ['qwen3.5-0.8b-q4-tied.safetensors']);
});

test('UT-CONFIG-006 model and runtime URLs are constants rather than user input', () => {
  assert.equal(Object.isFrozen(MENTRIA_TEXT_MODEL_OPTIONS), true);
  assert.equal(Object.isFrozen(MENTRIA_TEXT_MODEL_OPTIONS.shards), true);
});
