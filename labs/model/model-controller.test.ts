import assert from 'node:assert/strict';
import test from 'node:test';
import { DeterministicFakeModel } from './fake-model.ts';
import { ModelController } from './model-controller.ts';
import type { LocalTextModel } from './types.ts';
import type {
  GenerationRequest,
  GenerationResult,
  ModelSupport,
} from '../types.ts';

async function readyController(fake = new DeterministicFakeModel()) {
  const controller = new ModelController(fake);
  await controller.initialize();
  controller.requestLoad();
  await controller.approveLoad();
  return { controller, fake };
}

test('UT-MODEL-005 opening Labs checks support but does not load', async () => {
  const fake = new DeterministicFakeModel();
  const controller = new ModelController(fake);
  await controller.initialize();
  assert.equal(fake.loadCalls, 0);
  assert.deepEqual(controller.status, { kind: 'idle', cached: false });
});

test('UT-MODEL-001–004 support results normalize to unsupported or idle', async () => {
  const fake = new DeterministicFakeModel();
  fake.support = { supported: false, reason: 'No WebGPU' };
  const unsupported = new ModelController(fake);
  await unsupported.initialize();
  assert.deepEqual(unsupported.status, { kind: 'unsupported', reason: 'No WebGPU' });

  fake.support = { supported: true, cached: true };
  const supported = new ModelController(fake);
  await supported.initialize();
  assert.deepEqual(supported.status, { kind: 'idle', cached: true });
});

test('UT-MODEL-006 declining consent never loads the runtime/model', async () => {
  const fake = new DeterministicFakeModel();
  const controller = new ModelController(fake);
  await controller.initialize();
  controller.requestLoad();
  controller.declineLoad();
  assert.equal(fake.loadCalls, 0);
  assert.equal(controller.status.kind, 'idle');
});

test('UT-MODEL-007–009 approval starts exactly one load and becomes ready/base', async () => {
  const fake = new DeterministicFakeModel();
  const controller = new ModelController(fake);
  await controller.initialize();
  controller.requestLoad();
  const first = controller.approveLoad();
  const second = controller.approveLoad();
  await Promise.all([first, second]);
  assert.equal(fake.loadCalls, 1);
  assert.deepEqual(controller.status, { kind: 'ready', adapter: 'base' });
});

test('UT-MODEL-010 load failure becomes a recoverable error', async () => {
  const fake = new DeterministicFakeModel();
  fake.load = async () => { fake.loadCalls += 1; throw new Error('download failed'); };
  const controller = new ModelController(fake);
  await controller.initialize();
  controller.requestLoad();
  await controller.approveLoad();
  assert.deepEqual(controller.status, { kind: 'error', message: 'download failed' });
  controller.requestLoad();
  assert.equal(controller.status.kind, 'awaiting-consent');
});

test('UT-MODEL-011 progress is clamped and normalized', async () => {
  const fake = new DeterministicFakeModel();
  let release = () => undefined;
  fake.load = ({ onProgress }) => {
    fake.loadCalls += 1;
    onProgress({ phase: 'download', loaded: 200, total: 100 });
    return new Promise<void>((resolve) => { release = resolve; });
  };
  const controller = new ModelController(fake);
  await controller.initialize();
  controller.requestLoad();
  const loading = controller.approveLoad();
  assert.deepEqual(controller.status, { kind: 'downloading', loaded: 100, total: 100, message: undefined });
  release();
  await loading;
});

test('UT-MODEL-012 generation before ready is rejected without engine invocation', async () => {
  const fake = new DeterministicFakeModel();
  const controller = new ModelController(fake);
  await assert.rejects(() => controller.generate({ prompt: 'x', maxTokens: 2, temperature: 0 }, () => undefined), /not ready/);
  assert.equal(fake.generateCalls, 0);
});

test('UT-MODEL-013 generation streams in order and returns to ready', async () => {
  const { controller, fake } = await readyController();
  const tokens: string[] = [];
  const result = await controller.generate({ prompt: 'x', maxTokens: 20, temperature: 0 }, (token) => tokens.push(token));
  assert.equal(tokens.join(''), fake.response);
  assert.equal(result.text, fake.response);
  assert.deepEqual(controller.status, { kind: 'ready', adapter: 'base' });
});

class DelayedModel implements LocalTextModel {
  resolveGeneration: ((result: GenerationResult) => void) | null = null;
  rejectGeneration: ((error: Error) => void) | null = null;
  signal: AbortSignal | undefined;
  generateCalls = 0;
  cancelCalls = 0;
  async checkSupport(): Promise<ModelSupport> { return { supported: true, cached: false }; }
  async load(): Promise<void> { return undefined; }
  generate(request: GenerationRequest): Promise<GenerationResult> {
    this.generateCalls += 1;
    this.signal = request.signal;
    return new Promise((resolve, reject) => {
      this.resolveGeneration = resolve;
      this.rejectGeneration = reject;
      request.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  }
  async swapAdapter(): Promise<void> { return undefined; }
  cancel(): void { this.cancelCalls += 1; }
  async unload(): Promise<void> { return undefined; }
  async deleteCache(): Promise<void> { return undefined; }
}

test('UT-MODEL-014 duplicate generation is rejected', async () => {
  const model = new DelayedModel();
  const { controller } = await readyController(model as unknown as DeterministicFakeModel);
  const first = controller.generate({ prompt: 'x', maxTokens: 2, temperature: 0 }, () => undefined);
  await assert.rejects(() => controller.generate({ prompt: 'y', maxTokens: 2, temperature: 0 }, () => undefined), /not ready|already running/);
  model.resolveGeneration?.({ text: 'done' });
  await first;
});

test('UT-MODEL-015 abort reaches the engine and controller recovers', async () => {
  const model = new DelayedModel();
  const controller = new ModelController(model);
  await controller.initialize();
  controller.requestLoad();
  await controller.approveLoad();
  const generation = controller.generate({ prompt: 'x', maxTokens: 2, temperature: 0 }, () => undefined);
  controller.cancelGeneration();
  await assert.rejects(() => generation, { name: 'AbortError' });
  assert.equal(model.signal?.aborted, true);
  assert.equal(model.cancelCalls, 1);
  assert.deepEqual(controller.status, { kind: 'ready', adapter: 'base' });
});

test('UT-MODEL-016 device loss transitions to recoverable error', async () => {
  const { controller, fake } = await readyController();
  fake.failDevice('device lost');
  assert.deepEqual(controller.status, { kind: 'error', message: 'device lost' });
});

test('UT-MODEL-017 unload releases engine and retains cache state', async () => {
  const { controller, fake } = await readyController();
  await controller.unload();
  assert.equal(fake.unloadCalls, 1);
  assert.deepEqual(controller.status, { kind: 'idle', cached: true });
});

test('UT-CACHE-007 delete terminates before cache deletion', async () => {
  const events: string[] = [];
  const fake = new DeterministicFakeModel();
  fake.unload = async () => { events.push('unload'); };
  fake.deleteCache = async () => { events.push('delete'); };
  const { controller } = await readyController(fake);
  assert.equal(await controller.deleteModel(), true);
  assert.deepEqual(events, ['unload', 'delete']);
  assert.deepEqual(controller.status, { kind: 'idle', cached: false });
});

test('UT-MODEL-018 quote adapter failure labels base-model recovery', async () => {
  const fake = new DeterministicFakeModel();
  fake.swapAdapter = async () => { throw new Error('adapter failed'); };
  const { controller } = await readyController(fake);
  assert.equal(await controller.switchAdapter('quotes'), false);
  assert.equal(controller.status.kind, 'error');
  assert.match(controller.status.kind === 'error' ? controller.status.message : '', /base model/i);
});
