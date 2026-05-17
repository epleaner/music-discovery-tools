import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInitialDockviewPanels,
  createDockviewPanelDescriptor,
  createSiteDockviewPanelDescriptor,
  dockviewPanelTypes,
  type DockviewPanelType,
} from './dockview-panel-catalog.js';

test('dockview panel catalog exposes site panels instead of a combined sites panel', () => {
  assert.deepEqual(
    dockviewPanelTypes.map((panel) => panel.id),
    [
      'library',
      'similar-artists',
      'newsletters',
      'site',
      'genre-stats',
      'rym-charts',
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

test('createSiteDockviewPanelDescriptor creates one panel for one site', () => {
  assert.deepEqual(
    createSiteDockviewPanelDescriptor(
      { id: 'secret-ambient', name: 'Secret Ambient Club' },
      2
    ),
    {
      id: 'site-2',
      component: 'site',
      tabComponent: 'soundscape-tab',
      title: 'Secret Ambient Club',
      params: { siteId: 'secret-ambient' },
    }
  );
});

test('buildInitialDockviewPanels creates one panel per configured site', () => {
  assert.deepEqual(
    buildInitialDockviewPanels([
      { id: 'secret-ambient', name: 'Secret Ambient Club' },
    ]),
    [
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
        id: 'site-1',
        component: 'site',
        tabComponent: 'soundscape-tab',
        title: 'Secret Ambient Club',
        params: { siteId: 'secret-ambient' },
        position: { referencePanel: 'library-1', direction: 'below' },
        initialHeight: 300,
      },
    ]
  );
});
