import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowDockviewEmptyState } from './dockview-empty-state.js';

test('shouldShowDockviewEmptyState is true when every panel is closed', () => {
  assert.equal(shouldShowDockviewEmptyState(0), true);
});

test('shouldShowDockviewEmptyState is false while panels remain open', () => {
  assert.equal(shouldShowDockviewEmptyState(1), false);
});
