import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDockviewEmptyStateMenuItemLabels,
  getDockviewEmptyStateOverlayClass,
  shouldResetDockviewBeforeEmptyStatePanelAdd,
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

test('shouldResetDockviewBeforeEmptyStatePanelAdd clears stale empty groups before adding a panel', () => {
  assert.equal(shouldResetDockviewBeforeEmptyStatePanelAdd(0), true);
  assert.equal(shouldResetDockviewBeforeEmptyStatePanelAdd(1), false);
});

test('getDockviewEmptyStateMenuItemLabels mirrors the header add-panel menu', () => {
  assert.deepEqual(getDockviewEmptyStateMenuItemLabels(), [
    'Library',
    'Similar Artists',
    'Newsletters',
    'Site',
    'RYM Charts',
    'WebSocket',
  ]);
});
