import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBandcampLookupKey,
  findBandcampHref,
  findBandcampLookupItem,
  shouldEnableBandcampLookup,
} from './newsletter-bandcamp-query.js';

test('buildBandcampLookupKey scopes cache entries by newsletter id', () => {
  assert.deepEqual(buildBandcampLookupKey(7), ['newsletter-bandcamp-lookup', 7]);
});

test('shouldEnableBandcampLookup turns on when modal or entity sections are opened', () => {
  assert.equal(
    shouldEnableBandcampLookup({
      isModalOpen: false,
      showArtists: false,
      showAlbums: false,
      showTracks: false,
    }),
    false
  );

  assert.equal(
    shouldEnableBandcampLookup({
      isModalOpen: true,
      showArtists: false,
      showAlbums: false,
      showTracks: false,
    }),
    true
  );

  assert.equal(
    shouldEnableBandcampLookup({
      isModalOpen: false,
      showArtists: true,
      showAlbums: false,
      showTracks: false,
    }),
    true
  );

  assert.equal(
    shouldEnableBandcampLookup({
      isModalOpen: false,
      showArtists: false,
      showAlbums: true,
      showTracks: false,
    }),
    true
  );

  assert.equal(
    shouldEnableBandcampLookup({
      isModalOpen: false,
      showArtists: false,
      showAlbums: false,
      showTracks: true,
    }),
    true
  );
});

test('findBandcampLookupItem matches by name and primary artist', () => {
  const items = [
    {
      name: 'Jessica Pratt',
      primaryArtistName: null,
      url: 'https://jessicapratt.bandcamp.com/',
      label: 'Jessica Pratt',
    },
    {
      name: 'Sunset',
      primaryArtistName: 'Caroline Polachek',
      url: 'https://carolinepolachek.bandcamp.com/track/sunset',
      label: 'Sunset',
    },
  ];

  assert.deepEqual(
    findBandcampLookupItem(items, {
      name: 'Jessica Pratt',
    }),
    items[0]
  );

  assert.deepEqual(
    findBandcampLookupItem(items, {
      name: 'Sunset',
      primaryArtistName: 'Caroline Polachek',
    }),
    items[1]
  );

  assert.equal(
    findBandcampLookupItem(items, {
      name: 'Sunset',
      primaryArtistName: 'Wrong Artist',
    }),
    null
  );
});

test('findBandcampHref returns the matched Bandcamp URL for direct text linking', () => {
  const items = [
    {
      name: 'Jessica Pratt',
      primaryArtistName: null,
      url: 'https://jessicapratt.bandcamp.com/',
      label: 'Jessica Pratt',
    },
  ];

  assert.equal(
    findBandcampHref(items, {
      name: 'Jessica Pratt',
      primaryArtistName: null,
    }),
    'https://jessicapratt.bandcamp.com/'
  );

  assert.equal(
    findBandcampHref(items, {
      name: 'No Match',
      primaryArtistName: null,
    }),
    null
  );
});
