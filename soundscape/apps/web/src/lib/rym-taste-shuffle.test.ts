import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTasteGenreCandidates,
  shuffleTasteGenreCombination,
  type TasteGenreStat,
} from './rym-taste-shuffle.js';
import type { FlattenedGenre } from './flatten-genres.js';

const rymGenres: FlattenedGenre[] = [
  {
    name: 'Ambient',
    description: 'Atmospheric music focused on tone and mood.',
    url: 'https://rateyourmusic.com/genre/ambient/',
    path: 'Ambient',
  },
  {
    name: 'Dark Ambient',
    description: 'Darker ambient subgenre.',
    url: 'https://rateyourmusic.com/genre/dark-ambient/',
    path: 'Ambient > Dark Ambient',
  },
  {
    name: 'Lowercase',
    description: 'Quiet reductionist sound art.',
    url: 'https://rateyourmusic.com/genre/lowercase/',
    path: 'Experimental > Reductionism > Lowercase',
  },
  {
    name: 'Spiritual Jazz',
    description: 'Jazz with devotional and modal qualities.',
    url: 'https://rateyourmusic.com/genre/spiritual-jazz/',
    path: 'Jazz > Spiritual Jazz',
  },
  {
    name: 'Zamrock',
    description: 'Zambian rock fusion.',
    url: 'https://rateyourmusic.com/genre/zamrock/',
    path: 'Rock > Zamrock',
  },
];

const tasteStats: TasteGenreStat[] = [
  { name: 'ambient', playcount: 100, artists: 10 },
  { name: 'jazz', playcount: 20, artists: 3 },
];

test('buildTasteGenreCandidates includes direct, related, and fringe RYM genres from taste stats', () => {
  const candidates = buildTasteGenreCandidates(tasteStats, rymGenres);

  assert.equal(
    candidates.find((candidate) => candidate.name === 'Ambient')?.distance,
    'direct'
  );
  assert.equal(
    candidates.find((candidate) => candidate.name === 'Dark Ambient')?.distance,
    'related'
  );
  assert.equal(
    candidates.find((candidate) => candidate.name === 'Lowercase')?.distance,
    'fringe'
  );
  assert.equal(
    candidates.find((candidate) => candidate.name === 'Spiritual Jazz')
      ?.sourceTaste,
    'jazz'
  );
});

test('shuffleTasteGenreCombination returns a deterministic weighted combination with reasons', () => {
  const combination = shuffleTasteGenreCombination(tasteStats, rymGenres, {
    count: 2,
    mode: 'balanced',
    rng: () => 0,
  });

  assert.equal(combination.genres.length, 2);
  assert.deepEqual(
    combination.genres.map((genre) => genre.name),
    ['Dark Ambient', 'Zamrock']
  );
  assert.match(combination.summary, /ambient/i);
  assert.ok(combination.chartGenres.length > 0);
});

test('shuffleTasteGenreCombination prefers actual fringe genres in fringe mode', () => {
  const combination = shuffleTasteGenreCombination(tasteStats, rymGenres, {
    count: 1,
    mode: 'fringe',
    rng: () => 0,
  });

  assert.deepEqual(
    combination.genres.map((genre) => genre.name),
    ['Lowercase']
  );
  assert.equal(combination.genres[0]?.distance, 'fringe');
});

test('shuffleTasteGenreCombination mixes taste picks with a random discovery genre by default', () => {
  const combination = shuffleTasteGenreCombination(tasteStats, rymGenres, {
    count: 3,
    mode: 'balanced',
    rng: () => 0,
  });

  assert.equal(combination.genres.length, 3);
  assert.equal(
    combination.genres.filter((genre) => genre.distance === 'random').length,
    1
  );
  assert.ok(combination.genres.some((genre) => genre.name === 'Zamrock'));
});

test('shuffleTasteGenreCombination keeps locked genres while filling the remaining slots', () => {
  const combination = shuffleTasteGenreCombination(tasteStats, rymGenres, {
    count: 3,
    mode: 'balanced',
    lockedGenreNames: ['Lowercase'],
    rng: () => 0,
  });

  assert.equal(combination.genres.length, 3);
  assert.equal(combination.genres[0]?.name, 'Lowercase');
  assert.ok(combination.chartGenres.includes('Lowercase'));
  assert.equal(
    new Set(combination.chartGenres).size,
    combination.chartGenres.length
  );
});
