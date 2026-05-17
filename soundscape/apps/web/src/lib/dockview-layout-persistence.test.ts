import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectDockviewPanelInstanceCounts,
  decodeDockviewLayout,
  hasUnsupportedDockviewPanels,
  dockviewLayoutHashKey,
  encodeDockviewLayout,
  readDockviewLayoutFromHash,
  writeDockviewLayoutToHash,
} from './dockview-layout-persistence.js';

const serializedLayout = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: [
              { id: 'library-1', contentComponent: 'library' },
              { id: 'site-3', contentComponent: 'site' },
            ],
          },
        },
      ],
    },
  },
};

test('encodeDockviewLayout keeps the complete serialized layout JSON', () => {
  assert.deepEqual(
    decodeDockviewLayout(encodeDockviewLayout(serializedLayout)),
    serializedLayout
  );
});

test('readDockviewLayoutFromHash prefers the dockview layout hash value', () => {
  const hash = writeDockviewLayoutToHash('#view=recent', serializedLayout);

  assert.deepEqual(readDockviewLayoutFromHash(hash), serializedLayout);
  assert.ok(hash.includes(`${dockviewLayoutHashKey}=`));
});

test('writeDockviewLayoutToHash preserves unrelated hash state', () => {
  const hash = writeDockviewLayoutToHash(
    '#view=top&period=7day',
    serializedLayout
  );

  assert.equal(new URLSearchParams(hash.slice(1)).get('view'), 'top');
  assert.equal(new URLSearchParams(hash.slice(1)).get('period'), '7day');
  assert.deepEqual(readDockviewLayoutFromHash(hash), serializedLayout);
});

test('collectDockviewPanelInstanceCounts resumes duplicate panel ids after restored layouts', () => {
  assert.deepEqual(
    Array.from(collectDockviewPanelInstanceCounts(serializedLayout)),
    [
      ['library', 1],
      ['site', 3],
    ]
  );
});

test('hasUnsupportedDockviewPanels rejects obsolete persisted Sites panels', () => {
  assert.equal(hasUnsupportedDockviewPanels(serializedLayout), false);
  assert.equal(
    hasUnsupportedDockviewPanels({
      grid: {
        root: {
          data: {
            views: [{ id: 'sites-1', contentComponent: 'sites' }],
          },
        },
      },
    }),
    true
  );
});
