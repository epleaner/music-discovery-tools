import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendOrReplace,
  deserialize,
  homeState,
  moveHistory,
  serialize,
  type NavState,
  type NavView,
} from './nav-store.js';

const home: NavView = {
  id: 'home',
  label: 'Home',
  kind: 'home',
  restore: { type: 'tab', panel: 'home' },
};

test('appendOrReplace appends when no matching siblingGroup', () => {
  const state: NavState = { stack: [home], index: 0 };
  const tabView: Omit<NavView, 'id'> = {
    label: 'Tab',
    kind: 'tab',
    restore: { type: 'tab', panel: 'tab' },
  };

  const result = appendOrReplace(state, tabView, 't1');

  assert.equal(result.stack.length, 2);
  assert.equal(result.index, 1);
  assert.equal(result.stack[1].id, 't1');
});

test('appendOrReplace replaces entry sharing the same siblingGroup', () => {
  const subA: Omit<NavView, 'id'> = {
    label: 'Sub A',
    kind: 'tab',
    restore: { type: 'tab', panel: 'recent' },
    siblingGroup: 'recent-sub',
  };
  const subB: Omit<NavView, 'id'> = {
    label: 'Sub B',
    kind: 'tab',
    restore: { type: 'tab', panel: 'recent' },
    siblingGroup: 'recent-sub',
  };

  const s1 = appendOrReplace({ stack: [home], index: 0 }, subA, 'a');
  const s2 = appendOrReplace(s1, subB, 'b');

  assert.equal(s2.stack.length, 2);
  assert.equal(s2.index, 1);
  assert.equal(s2.stack[1].label, subB.label);
});

test('appendOrReplace drops forward history when branching', () => {
  let state: NavState = { stack: [home], index: 0 };
  for (let i = 0; i < 3; i++) {
    state = appendOrReplace(
      state,
      {
        label: `View ${i}`,
        kind: 'tab',
        restore: { type: 'tab', panel: `p${i}` },
      },
      `v${i}`
    );
  }
  assert.equal(state.stack.length, 4);
  assert.equal(state.index, 3);

  const rewound = moveHistory(moveHistory(state, -1), -1);
  const result = appendOrReplace(
    rewound,
    { label: 'New', kind: 'tab', restore: { type: 'tab', panel: 'new' } },
    'new'
  );

  assert.equal(result.stack.length, 3);
  assert.equal(result.index, 2);
  assert.deepEqual(
    result.stack.map((view) => view.id),
    ['home', 'v0', 'new']
  );
  assert.equal(moveHistory(result, 1), result);
});

test('selection history restores artist and album without losing forward entries', () => {
  const artist = appendOrReplace(
    homeState(home),
    {
      label: 'Hiroshi Yoshimura',
      kind: 'item',
      restore: {
        type: 'item',
        artist: 'Hiroshi Yoshimura',
        itemKind: 'artist',
      },
    },
    'artist'
  );
  const album = appendOrReplace(
    artist,
    {
      label: 'Green',
      kind: 'item',
      restore: {
        type: 'item',
        artist: 'Hiroshi Yoshimura',
        album: 'Green',
        itemKind: 'album',
      },
    },
    'album'
  );

  const previous = moveHistory(album, -1);
  assert.deepEqual(
    previous.stack[previous.index].restore,
    artist.stack[1].restore
  );
  assert.equal(previous.stack, album.stack);
  assert.equal(album.index, 2);

  const next = moveHistory(previous, 1);
  assert.deepEqual(next.stack[next.index].restore, album.stack[2].restore);
  assert.equal(next.stack, album.stack);
  assert.equal(moveHistory(next, 1), next);

  const first = moveHistory(previous, -1);
  assert.equal(first.stack[first.index], home);
  assert.equal(moveHistory(first, -1), first);
});

test('homeState builds a single-entry stack at index 0', () => {
  const result = homeState(home);
  assert.deepEqual(result, { stack: [home], index: 0 });
});

test('serialize/deserialize round-trip and reject malformed input', () => {
  const subA: Omit<NavView, 'id'> = {
    label: 'Sub A',
    kind: 'artist',
    restore: { type: 'artist', name: 'Some Artist' },
  };
  const scrapeView: Omit<NavView, 'id'> = {
    label: 'Scrape',
    kind: 'scrape',
    restore: { type: 'scrape', requestId: 'req-1', title: 'My Scrape' },
  };

  const s1 = appendOrReplace({ stack: [home], index: 0 }, subA, 'a');
  const s2 = appendOrReplace(s1, scrapeView, 'scrape-1');

  assert.equal(s2.stack.length, 3);

  const roundTripped = deserialize(serialize(s2));
  assert.deepEqual(roundTripped, s2);

  assert.equal(deserialize('%%%'), null);
  assert.equal(deserialize(encodeURIComponent(JSON.stringify({ foo: 1 }))), null);
});

test('appendOrReplace does not mutate the input state stack', () => {
  const state: NavState = { stack: [home], index: 0 };
  const originalStack = state.stack;

  appendOrReplace(
    state,
    { label: 'Tab', kind: 'tab', restore: { type: 'tab', panel: 'tab' } },
    't1',
  );

  assert.equal(state.stack, originalStack);
  assert.equal(state.stack.length, 1);
});
