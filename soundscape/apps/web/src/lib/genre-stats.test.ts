import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArtistInfoResponse } from '@soundscape/types';
import { aggregateArtistGenreStats, normalizeGenreTag } from './genre-stats.js';

const artistInfo = (...tags: string[]): ArtistInfoResponse => ({
  artist: {
    name: 'Artist',
    mbid: '',
    url: '',
    image: [],
    streamable: '0',
    ontour: '0',
    stats: { listeners: '0', playcount: '0' },
    similar: { artist: [] },
    tags: { tag: tags.map((name) => ({ name, url: '' })) },
  },
});

test('normalizeGenreTag removes noisy non-genre tags', () => {
  assert.equal(normalizeGenreTag('seen live'), undefined);
  assert.equal(normalizeGenreTag('My Favorites'), undefined);
  assert.equal(normalizeGenreTag('female vocalists'), undefined);
  assert.equal(normalizeGenreTag('Hip-Hop'), 'hip hop');
});

test('aggregateArtistGenreStats weights artist tags by listening playcount', async () => {
  const stats = await aggregateArtistGenreStats(
    [
      { name: 'A', playcount: '10' },
      { name: 'B', playcount: '5' },
    ],
    async (artistName) =>
      artistName === 'A'
        ? artistInfo('Rock', 'Indie Rock')
        : artistInfo('rock', 'Electronic')
  );

  assert.deepEqual(stats.slice(0, 3), [
    { name: 'rock', playcount: 15, artists: 2 },
    { name: 'indie rock', playcount: 10, artists: 1 },
    { name: 'electronic', playcount: 5, artists: 1 },
  ]);
});

test('aggregateArtistGenreStats skips artists whose tag lookup fails', async () => {
  const stats = await aggregateArtistGenreStats(
    [
      { name: 'A', playcount: '10' },
      { name: 'B', playcount: '5' },
    ],
    async (artistName) => {
      if (artistName === 'B') throw new Error('Last.fm artist lookup failed');
      return artistInfo('Ambient');
    }
  );

  assert.deepEqual(stats, [{ name: 'ambient', playcount: 10, artists: 1 }]);
});
