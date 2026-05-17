import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRateYourMusicChartsUrl,
  buildRateYourMusicYearOptions,
} from './rym-charts.js';

test('buildRateYourMusicChartsUrl builds year chart URLs for selected genres', () => {
  assert.equal(
    buildRateYourMusicChartsUrl({
      genres: ['Hip Hop', 'Singer/Songwriter'],
      year: 2024,
      timeRange: 'year',
    }),
    'https://rateyourmusic.com/charts/top/album/2024/ge:hip-hop%2Csingersongwriter/'
  );
});

test('buildRateYourMusicChartsUrl builds decade chart URLs from the selected year', () => {
  assert.equal(
    buildRateYourMusicChartsUrl({
      genres: ['Ambient & Drone'],
      year: 1987,
      timeRange: 'decade',
    }),
    'https://rateyourmusic.com/charts/top/album/1980s/ge:ambient-and-drone/'
  );
});

test('buildRateYourMusicYearOptions includes every year from current year through 1950', () => {
  assert.deepEqual(buildRateYourMusicYearOptions(1952), [1952, 1951, 1950]);
});
