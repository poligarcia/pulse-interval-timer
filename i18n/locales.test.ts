import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  localeUrlCode,
  matchSupportedLocale,
  readLocaleFromSearch,
  readStoredLocale,
  resolveInitialLocale,
  resolveLocale,
  urlWithLocale,
  writeStoredLocale,
} from './locales.ts';

class MemoryStorage {
  values = new Map<string, string>();
  throwReads = false;
  throwWrites = false;

  getItem(key: string) {
    if (this.throwReads) throw new Error('read failed');
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.throwWrites) throw new Error('write failed');
    this.values.set(key, value);
  }
}

test('matches supported language families to their product locales', () => {
  assert.equal(matchSupportedLocale('en'), 'en');
  assert.equal(matchSupportedLocale('en-GB'), 'en');
  assert.equal(matchSupportedLocale('es'), 'es-AR');
  assert.equal(matchSupportedLocale('ES_ar'), 'es-AR');
  assert.equal(matchSupportedLocale('pt-PT'), 'pt-BR');
  assert.equal(matchSupportedLocale('pt_BR'), 'pt-BR');
  assert.equal(matchSupportedLocale('fr-FR'), null);
});

test('stored locale wins over browser preferences', () => {
  assert.equal(resolveLocale('pt-BR', ['es-AR', 'en-US']), 'pt-BR');
});

test('browser preferences are considered in order', () => {
  assert.equal(resolveLocale(null, ['fr-FR', 'es-MX', 'en-US']), 'es-AR');
  assert.equal(resolveLocale(undefined, ['de-DE', 'pt-PT']), 'pt-BR');
});

test('unsupported preferences fall back to English', () => {
  assert.equal(resolveLocale('invalid', ['fr-FR', 'de-DE']), DEFAULT_LOCALE);
});

test('share-link locale aliases map to product locales', () => {
  assert.equal(readLocaleFromSearch('?lang=es'), 'es-AR');
  assert.equal(readLocaleFromSearch('?lang=pt-BR'), 'pt-BR');
  assert.equal(readLocaleFromSearch('?lang=en-GB'), 'en');
  assert.equal(readLocaleFromSearch('?lang=fr'), null);
  assert.equal(readLocaleFromSearch('?other=es'), null);
});

test('a valid share-link locale wins over storage and browser preferences', () => {
  assert.equal(resolveInitialLocale('es-AR', 'pt-BR', ['en-US']), 'es-AR');
  assert.equal(resolveInitialLocale(null, 'pt-BR', ['es-AR']), 'pt-BR');
});

test('language links use public codes and preserve other URL state', () => {
  assert.equal(localeUrlCode('es-AR'), 'es');
  assert.equal(
    urlWithLocale('https://example.com/pulse/?source=friend#timer', 'pt-BR'),
    'https://example.com/pulse/?source=friend&lang=pt#timer',
  );
});

test('locale storage reads and writes valid raw locale values', () => {
  const storage = new MemoryStorage();
  assert.equal(readStoredLocale(storage), null);
  assert.equal(writeStoredLocale(storage, 'es-AR'), true);
  assert.equal(storage.values.get(LOCALE_STORAGE_KEY), 'es-AR');
  assert.equal(readStoredLocale(storage), 'es-AR');
});

test('locale storage fails safely', () => {
  const storage = new MemoryStorage();
  storage.values.set(LOCALE_STORAGE_KEY, 'fr-FR');
  assert.equal(readStoredLocale(storage), null);

  storage.throwReads = true;
  assert.equal(readStoredLocale(storage), null);

  storage.throwWrites = true;
  assert.equal(writeStoredLocale(storage, 'pt-BR'), false);
});
