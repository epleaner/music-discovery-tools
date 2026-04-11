import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LASTFM_USERNAME_STORAGE_KEY,
  persistLastfmUsername,
  resolveInitialLastfmUsername,
} from './lastfm-username-storage.js';

test('resolveInitialLastfmUsername prefers the hash username over localStorage', () => {
  assert.equal(
    resolveInitialLastfmUsername({
      hashUsername: 'from-hash',
      storedUsername: 'from-storage',
    }),
    'from-hash'
  );
});

test('resolveInitialLastfmUsername falls back to localStorage when the hash is empty', () => {
  assert.equal(
    resolveInitialLastfmUsername({
      hashUsername: '',
      storedUsername: 'from-storage',
    }),
    'from-storage'
  );
});

test('persistLastfmUsername stores trimmed usernames and removes empty ones', () => {
  const storage = new Map<string, string>();
  const localStorageLike = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  };

  persistLastfmUsername(localStorageLike, '  eli  ');
  assert.equal(storage.get(LASTFM_USERNAME_STORAGE_KEY), 'eli');

  persistLastfmUsername(localStorageLike, '   ');
  assert.equal(storage.has(LASTFM_USERNAME_STORAGE_KEY), false);
});
