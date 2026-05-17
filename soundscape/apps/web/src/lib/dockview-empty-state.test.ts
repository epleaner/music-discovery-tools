import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDockviewEmptyStateOverlayClass,
  shouldHandleDockviewEmptyStateClick,
  shouldShowDockviewEmptyState,
} from './dockview-empty-state.js';

test('shouldShowDockviewEmptyState is true when every panel is closed', () => {
  assert.equal(shouldShowDockviewEmptyState(0), true);
});

test('shouldShowDockviewEmptyState is false while panels remain open', () => {
  assert.equal(shouldShowDockviewEmptyState(1), false);
});

test('getDockviewEmptyStateOverlayClass keeps the empty state above Dockview internals', () => {
  const className = getDockviewEmptyStateOverlayClass();

  assert.ok(className.split(' ').includes('z-[2147483647]'));
});

test('shouldHandleDockviewEmptyStateClick ignores the synthetic click after pointer spawn', () => {
  assert.equal(shouldHandleDockviewEmptyStateClick(1000, 1049), false);
  assert.equal(shouldHandleDockviewEmptyStateClick(1000, 1100), true);
  assert.equal(shouldHandleDockviewEmptyStateClick(undefined, 1049), true);
});
