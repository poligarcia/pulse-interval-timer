import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_VERSION, createBackup, prepareImport, restoreBackup, MAX_BACKUP_BYTES } from './backup.ts';
import { DEFAULT_SETTINGS } from './model.ts';
import { createWorkoutSession, createStoppedWorkoutSession } from '../progress/progress.ts';
import { saveBackupFile } from './files.ts';

function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
}
const timer = { id: 'one', name: 'Custom ☀️', nameIsCustom: true, prepare: 5, work: 30, rest: 10, rounds: 4, cycles: 2, cycleRest: 30, cooldown: 10 };
function backup() {
  return createBackup({ settings: structuredClone(DEFAULT_SETTINGS), timers: [timer, { ...timer, id: 'two' }], recentTimerIds: ['two', 'one'], locale: 'es-AR', workoutSessions: [
    createWorkoutSession(timer, new Date('2026-09-10T12:00:00Z'), new Date('2026-09-10T12:10:00Z')),
    createStoppedWorkoutSession(timer, new Date('2026-09-11T12:00:00Z'), 25, new Date('2026-09-11T12:00:30Z')),
  ] }, storage(), new Date('2026-09-11T12:00:00Z'));
}

test('round trip preserves settings including defaults, both orders, and completed/stopped history metadata', () => {
  const original = backup();
  const plan = prepareImport(JSON.stringify(original));
  assert.deepEqual(plan.issues, []);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.backup)), JSON.parse(JSON.stringify(original)));
  assert.equal(plan.backup.appVersion, APP_VERSION);
  const target = storage(); target.setItem('unrelated', 'keep');
  restoreBackup(target, plan.backup);
  assert.deepEqual(JSON.parse(target.getItem('pulse-timers-v2')!), original.state.timers);
  assert.deepEqual(JSON.parse(target.getItem('pulse-recent-timers-v1')!), ['two', 'one']);
  assert.deepEqual(JSON.parse(target.getItem('pulse-workout-sessions-v2')!), original.state.workoutSessions);
  assert.equal(target.getItem('pulse-locale-v1'), 'es-AR');
  assert.equal(target.getItem('unrelated'), 'keep');
  assert.equal(target.getItem('laptiva-analytics-consent'), null);
});

test('rejects malformed, foreign, future-envelope, incomplete and oversized files', () => {
  for (const text of ['{', 'null', '[]', '{}', JSON.stringify({ ...backup(), schemaVersion: 2 }), JSON.stringify({ ...backup(), state: {} })]) assert.throws(() => prepareImport(text));
  assert.throws(() => prepareImport(' '.repeat(MAX_BACKUP_BYTES + 1)), /size/);
});

test('reports defaults and version differences while retaining explicit saved preferences', () => {
  const value = backup(); value.appVersion = '0.9.0'; value.defaults.settings.volume = 0.5;
  value.state.settings.volume = 0.2;
  const plan = prepareImport(JSON.stringify(value));
  assert.ok(plan.issues.some(i => i.kind === 'version'));
  assert.ok(plan.issues.some(i => i.kind === 'defaults' && i.path === 'settings.volume'));
  assert.equal(plan.backup.state.settings.volume, 0.2);
});

test('validates setting types, bounds, enums and missing/removed settings without silent changes', () => {
  const value = JSON.parse(JSON.stringify(backup()));
  value.state.settings = { volume: 100, voiceEnabled: 'yes', coachPersonality: 'unknown', voicePreference: 'bad', reminderDays: [9], reminderTime: '99:99', weeklyActiveDayGoal: -3, retired: true };
  const plan = prepareImport(JSON.stringify(value));
  assert.equal(plan.backup.state.settings.volume, 1);
  assert.equal(plan.backup.state.settings.voiceEnabled, false);
  assert.equal(plan.backup.state.settings.coachPersonality, 'focused');
  assert.equal(plan.backup.state.settings.weeklyActiveDayGoal, 1);
  assert.equal(plan.backup.state.settings.reminderTime, '18:00');
  assert.ok(plan.issues.some(i => i.path === 'settings.retired'));
  assert.ok(plan.issues.some(i => i.path === 'settings.rotation'));
});

test('previews invalid/duplicate timers, changed ranges, stale home IDs and unknown fields', () => {
  const value = JSON.parse(JSON.stringify(backup()));
  value.state.timers.push(null, timer); value.state.timers[0].work = 9000; value.state.timers[0].future = true;
  value.state.recentTimerIds = ['two', 'missing', 'two', 'one']; value.state.future = true;
  const plan = prepareImport(JSON.stringify(value));
  assert.equal(plan.backup.state.timers.length, 2);
  assert.equal(plan.backup.state.timers[0].work, 3600);
  assert.deepEqual(plan.backup.state.recentTimerIds, ['two', 'one']);
  assert.equal(plan.issues.filter(i => i.kind === 'skipped').length, 3);
});

test('history validation preserves good records and reports malformed, duplicate and future schema records', () => {
  const value = backup();
  value.state.workoutSessions.push(value.state.workoutSessions[0], { ...value.state.workoutSessions[0], id: 'bad', totalSeconds: -1 }, { ...value.state.workoutSessions[0], id: 'future', schemaVersion: 3 as 2 });
  const plan = prepareImport(JSON.stringify(value));
  assert.equal(plan.backup.state.workoutSessions.length, 2);
  assert.equal(plan.issues.filter(i => i.kind === 'skipped').length, 3);
});

test('empty library and history remain empty', () => {
  const value = backup(); value.state.timers = []; value.state.workoutSessions = []; value.state.recentTimerIds = [];
  const plan = prepareImport(JSON.stringify(value));
  assert.deepEqual(plan.issues, []); assert.deepEqual(plan.backup.state.timers, []);
});

test('voice availability is checked and invalid locale and unsupported auxiliary data are reported', () => {
  const value = JSON.parse(JSON.stringify(backup())); value.state.settings.voiceURI = 'device-voice'; value.state.locale = 'xx'; value.auxiliary.future = {};
  const plan = prepareImport(JSON.stringify(value), []);
  assert.equal(plan.backup.state.settings.voiceURI, ''); assert.equal(plan.backup.state.locale, 'en');
  assert.ok(plan.issues.some(i => i.kind === 'voice')); assert.ok(plan.issues.some(i => i.path === 'future'));
  assert.equal(prepareImport(JSON.stringify(value), ['device-voice']).backup.state.settings.voiceURI, 'device-voice');
});

test('storage failure rolls back changes and leaves unrelated state intact', () => {
  const target = storage(); target.setItem('pulse-settings-v1', 'original'); target.setItem('other', 'keep');
  const before = new Map(target.data); let calls = 0;
  const failing = { ...target, setItem: (k: string, v: string) => { if (++calls === 3) throw new Error('quota'); target.setItem(k, v); } };
  assert.throws(() => restoreBackup(failing, backup()), /storage/);
  assert.deepEqual(target.data, before);
});

test('rollback failures are surfaced instead of claiming the original state was retained', () => {
  const target = storage(); target.setItem('pulse-settings-v1', 'original');
  assert.throws(() => restoreBackup({ ...target, setItem: () => { throw new Error('blocked'); } }, backup()), /rollback/);
});

test('save picker writes JSON and closes; cancellation does not download', async () => {
  let content = ''; let closed = false;
  assert.equal(await saveBackupFile('{"ok":true}', async options => {
    assert.match(options.suggestedName, /^laptiva-backup-.*\.json$/);
    return { createWritable: async () => ({ write: async blob => { content = await blob.text(); }, close: async () => { closed = true; }, abort: async () => {} }) };
  }), 'saved');
  assert.equal(content, '{"ok":true}'); assert.equal(closed, true);
  assert.equal(await saveBackupFile('{}', async () => { throw new DOMException('cancel', 'AbortError'); }), 'cancelled');
});

test('write errors abort the file and propagate', async () => {
  let aborted = false;
  await assert.rejects(saveBackupFile('{}', async () => ({ createWritable: async () => ({ write: async () => { throw new Error('disk'); }, close: async () => {}, abort: async () => { aborted = true; } }) })), /disk/);
  assert.equal(aborted, true);
});

test('browser download fallback attaches link and revokes its blob URL after use', async t => {
  const calls: string[] = [];
  let cleanup: (() => void) | undefined;
  const link = { href: '', download: '', click: () => { calls.push('click'); }, remove: () => { calls.push('remove'); } };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => link, body: { appendChild: () => { calls.push('append'); } } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(URL, 'revokeObjectURL', (url: string) => { calls.push(url); });
  t.mock.method(globalThis, 'setTimeout', (callback: () => void) => { cleanup = callback; });
  assert.equal(await saveBackupFile('{}'), 'downloaded');
  assert.equal(link.href, 'blob:test'); assert.match(link.download, /\.json$/);
  assert.deepEqual(calls, ['append', 'click', 'remove']);
  cleanup!(); assert.equal(calls.at(-1), 'blob:test');
});

test('legacy history migration is disclosed, not silently presented as an exact restore', () => {
  const value = JSON.parse(JSON.stringify(backup()));
  value.state.workoutSessions[0].schemaVersion = 1;
  const plan = prepareImport(JSON.stringify(value));
  assert.equal(plan.backup.state.workoutSessions[0].schemaVersion, 2);
  assert.ok(plan.issues.some(i => i.kind === 'changed' && i.path === 'workoutSessions[0]'));
});

test('import cannot write arbitrary local storage keys or prototype fields', () => {
  const value = JSON.parse(JSON.stringify(backup()));
  value.auxiliary['laptiva-analytics-consent'] = 'accepted';
  value.state.settings = JSON.parse('{"__proto__":{"polluted":true}}');
  const plan = prepareImport(JSON.stringify(value));
  const target = storage(); restoreBackup(target, plan.backup);
  assert.equal(target.getItem('laptiva-analytics-consent'), null);
  assert.equal(Object.hasOwn(plan.backup.state.settings, '__proto__'), false);
});

test('experimental preferences and coach memory survive export and import', () => {
  const source = storage();
  source.setItem('pulse-labs-settings-v1', JSON.stringify({ version: 1, unlocked: true, speechEngineEnabled: true }));
  source.setItem('laptiva-drill-v1', JSON.stringify({ unlocked: true, recent: [] }));
  const value = createBackup({ ...backup().state, settings: { ...DEFAULT_SETTINGS, coachPersonality: 'drill', rotation: false, reminderDays: [6, 0] } }, source);
  const plan = prepareImport(JSON.stringify(value));
  assert.deepEqual(plan.issues, []);
  assert.equal(plan.backup.state.settings.coachPersonality, 'drill');
  const target = storage(); restoreBackup(target, plan.backup);
  assert.deepEqual(JSON.parse(target.getItem('pulse-labs-settings-v1')!), { version: 1, unlocked: true, speechEngineEnabled: true });
  assert.deepEqual(JSON.parse(target.getItem('laptiva-drill-v1')!).unlocked, true);
});

test('Drill without its unlock is adjusted and disclosed', () => {
  const value = backup(); value.state.settings.coachPersonality = 'drill';
  const plan = prepareImport(JSON.stringify(value));
  assert.equal(plan.backup.state.settings.coachPersonality, 'tough');
  assert.ok(plan.issues.some(i => i.path === 'settings.coachPersonality'));
});
