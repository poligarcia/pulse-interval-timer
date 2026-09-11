import { mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const directories = ['coach', 'progress', 'reminders', 'labs', 'labs/model', 'i18n', 'workout', 'analytics', 'backup'];
const tests = directories.flatMap(dir => readdirSync(dir).filter(name => name.endsWith('.test.ts')).map(name => `${dir}/${name}`));
mkdirSync('coverage', { recursive: true });
const result = spawnSync(process.execPath, [
  '--experimental-strip-types', '--test', '--experimental-test-coverage',
  '--test-coverage-exclude=**/*.test.ts',
  '--test-coverage-lines=95', '--test-coverage-branches=85', '--test-coverage-functions=77',
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info',
  ...tests,
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
