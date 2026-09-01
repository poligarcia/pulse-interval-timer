import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function manifest(filename: string) {
  return JSON.parse(readFileSync(new URL(`../public/${filename}`, import.meta.url), 'utf8')) as {
    id: string;
    lang: string;
    name: string;
    start_url: string;
  };
}

test('localized manifests share one app identity and preserve their launch locale', () => {
  const english = manifest('manifest.webmanifest');
  const spanish = manifest('manifest.es.webmanifest');
  const portuguese = manifest('manifest.pt.webmanifest');

  assert.deepEqual([english.id, spanish.id, portuguese.id], ['./', './', './']);
  assert.deepEqual([english.lang, spanish.lang, portuguese.lang], ['en', 'es-AR', 'pt-BR']);
  assert.deepEqual(
    [english.start_url, spanish.start_url, portuguese.start_url],
    ['./?lang=en', './?lang=es', './?lang=pt'],
  );
  assert.match(spanish.name, /Timer de intervalos/);
  assert.match(portuguese.name, /Timer intervalado/);
});
