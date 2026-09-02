import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BRAND_MARK, BRAND_NAME } from '../branding.ts';
import { getMessages } from './messages.ts';

const PROJECT_ROOT = new URL('../', import.meta.url);

function projectFile(path: string) {
  return readFileSync(new URL(path, PROJECT_ROOT), 'utf8');
}

test('Laptiva is the product identity in every localized shell', () => {
  assert.equal(BRAND_NAME, 'Laptiva');
  assert.equal(BRAND_MARK, 'L');
  assert.ok(BRAND_NAME.length > 'Pulse'.length);

  for (const locale of ['en', 'es-AR', 'pt-BR'] as const) {
    const messages = getMessages(locale);
    assert.ok(messages.shell.title.startsWith(`${BRAND_NAME} — `));
    assert.ok(messages.shell.openingApp.includes(BRAND_NAME));
    assert.ok(messages.settings.calendarEvent.summary.includes(BRAND_NAME));
  }
});

test('install and social metadata use Laptiva without changing the legacy deployment path', () => {
  const layout = projectFile('app/layout.tsx');
  const manifests = [
    projectFile('public/manifest.webmanifest'),
    projectFile('public/manifest.es.webmanifest'),
    projectFile('public/manifest.pt.webmanifest'),
  ].map((source) => JSON.parse(source) as { name: string; short_name: string });

  assert.match(layout, /applicationName: BRAND_NAME/);
  assert.match(layout, /pulse-interval-timer\/og\.png/);
  assert.ok(manifests.every(({ name, short_name }) => name.startsWith(`${BRAND_NAME} — `) && short_name === BRAND_NAME));
});

test('the longer wordmark has explicit narrow-screen safeguards', () => {
  const styles = projectFile('app/globals.css');
  const splashRule = styles.match(/\.splash-brand strong\s*{([^}]*)}/s)?.[1] ?? '';
  const lockupRule = styles.match(/\.brand-lockup\s*{([^}]*)}/s)?.[1] ?? '';
  const topbarNameRule = styles.match(/\.topbar h1\s*{([^}]*)}/s)?.[1] ?? '';

  assert.match(splashRule, /font-size:\s*clamp\(/);
  assert.match(splashRule, /white-space:\s*nowrap/);
  assert.match(lockupRule, /min-width:\s*0/);
  assert.match(topbarNameRule, /white-space:\s*nowrap/);
});

test('the regenerated Open Graph image preserves its required canvas size', () => {
  const image = readFileSync(new URL('public/og.png', PROJECT_ROOT));
  assert.equal(image.toString('ascii', 1, 4), 'PNG');
  assert.equal(image.readUInt32BE(16), 1672);
  assert.equal(image.readUInt32BE(20), 941);
});
