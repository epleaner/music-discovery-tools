import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppLayoutModel } from './lib/app-layout.js';

test('buildAppLayoutModel keeps the main layout visible without a username', () => {
  const layout = buildAppLayoutModel('');

  assert.equal(layout.showMainLayout, true);
  assert.equal(layout.showUsernamePrompt, false);
  assert.equal(layout.showLibraryEmptyState, true);
});

test('buildAppLayoutModel keeps the library empty state off once a username exists', () => {
  const layout = buildAppLayoutModel('eli');

  assert.equal(layout.showMainLayout, true);
  assert.equal(layout.showUsernamePrompt, false);
  assert.equal(layout.showLibraryEmptyState, false);
});
