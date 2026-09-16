import assert from 'node:assert/strict';
import test from 'node:test';
import { isScrapeUrlAllowed, scrapeCacheKey } from './scrape.js';

test('isScrapeUrlAllowed accepts source hosts and rejects suffix attacks', () => {
  assert.equal(
    isScrapeUrlAllowed('rym', 'https://rateyourmusic.com/list/x'),
    true
  );
  assert.equal(
    isScrapeUrlAllowed('rym', 'https://www.rateyourmusic.com/charts/x'),
    true
  );
  assert.equal(
    isScrapeUrlAllowed('bandcamp', 'https://artist.bandcamp.com/album/y'),
    true
  );
  assert.equal(
    isScrapeUrlAllowed('rym', 'https://rateyourmusic.com.evil.com/x'),
    false
  );
  assert.equal(
    isScrapeUrlAllowed('rym', 'https://artist.bandcamp.com/album/y'),
    false
  );
});

test('scrapeCacheKey keeps modes and resolve queries distinct', () => {
  const url = 'https://bandcamp.com/tag/ambient';
  assert.equal(scrapeCacheKey({ url }), url);
  assert.equal(scrapeCacheKey({ url, mode: 'label' }), `${url}#label`);
  assert.equal(scrapeCacheKey({ url, mode: 'related' }), `${url}#related`);
  assert.equal(
    scrapeCacheKey({ mode: 'resolve', query: { artist: 'A', kind: 'artist' } }),
    'resolve:artist:A'
  );
});
