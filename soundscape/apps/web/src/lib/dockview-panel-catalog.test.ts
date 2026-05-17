import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInitialDockviewPanels,
  createDockviewPanelDescriptor,
  dockviewPanelTypes,
  type DockviewPanelType,
} from './dockview-panel-catalog.js';

test('dockview panel catalog exposes every spawnable UI panel type', () => {
  assert.deepEqual(
    dockviewPanelTypes.map((panel) => panel.id),
    [
      'library',
      'similar-artists',
      'newsletters',
      'sites',
      'websocket',
    ] satisfies DockviewPanelType[]
  );
});

test('createDockviewPanelDescriptor creates stable duplicate-safe panel ids', () => {
  assert.deepEqual(createDockviewPanelDescriptor('newsletters', 3), {
    id: 'newsletters-3',
    component: 'newsletters',
    tabComponent: 'soundscape-tab',
    title: 'Newsletters',
  });
});

test('buildInitialDockviewPanels preserves the legacy three-pane split layout', () => {
  assert.deepEqual(buildInitialDockviewPanels(), [
    {
      id: 'library-1',
      component: 'library',
      tabComponent: 'soundscape-tab',
      title: 'Library',
      initialWidth: 700,
    },
    {
      id: 'similar-artists-1',
      component: 'similar-artists',
      tabComponent: 'soundscape-tab',
      title: 'Similar Artists',
      position: { referencePanel: 'library-1', direction: 'right' },
      initialWidth: 300,
    },
    {
      id: 'sites-1',
      component: 'sites',
      tabComponent: 'soundscape-tab',
      title: 'Sites',
      position: { referencePanel: 'library-1', direction: 'below' },
      initialHeight: 300,
    },
  ]);
});
