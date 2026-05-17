import assert from 'node:assert/strict';
import test from 'node:test';
import { createNewSite, upsertSite } from './site-catalog.js';

test('createNewSite creates a remembered blank site after existing sites', () => {
  assert.deepEqual(
    createNewSite([
      {
        id: 'secret-ambient',
        name: 'Secret Ambient Club',
        url: 'https://secretambient.club/',
      },
    ]),
    { id: 'site-2', name: 'New Site', url: '' }
  );
});

test('createNewSite skips ids already used by previous new sites', () => {
  assert.deepEqual(
    createNewSite([
      { id: 'site-2', name: 'New Site', url: '' },
      { id: 'site-3', name: 'Other Site', url: '' },
    ]),
    { id: 'site-4', name: 'New Site', url: '' }
  );
});

test('upsertSite remembers newly created sites and updates existing sites', () => {
  const first = {
    id: 'secret-ambient',
    name: 'Secret Ambient Club',
    url: 'https://secretambient.club/',
  };
  const second = { id: 'site-2', name: 'New Site', url: '' };

  assert.deepEqual(upsertSite([first], second), [first, second]);
  assert.deepEqual(upsertSite([first, second], { ...second, name: 'Edited' }), [
    first,
    { ...second, name: 'Edited' },
  ]);
});
