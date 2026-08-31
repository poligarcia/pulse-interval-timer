import assert from 'node:assert/strict';
import test from 'node:test';
import { detectWebGpuSupport } from './mentria-client.ts';

test('UT-MODEL-001 no navigator.gpu is unsupported without throwing', async () => {
  assert.deepEqual(await detectWebGpuSupport(undefined), { supported: false, reason: 'WebGPU is not available in this browser.' });
});

test('UT-MODEL-002 null adapter is unsupported without throwing', async () => {
  const gpu = { requestAdapter: async () => null };
  const result = await detectWebGpuSupport(gpu);
  assert.equal(result.supported, false);
});

test('UT-MODEL-003 adapter error becomes a recoverable unsupported result', async () => {
  const gpu = { requestAdapter: async () => { throw new Error('driver'); } };
  const result = await detectWebGpuSupport(gpu);
  assert.equal(result.supported, false);
  assert.match(result.supported ? '' : result.reason, /retry/i);
});

test('UT-MODEL-004 usable adapter is supported', async () => {
  const gpu = { requestAdapter: async () => ({ name: 'fake' }) };
  assert.deepEqual(await detectWebGpuSupport(gpu), { supported: true, cached: false });
});
