import assert from 'node:assert/strict';
import test from 'node:test';
import { isScrapeUrlAllowed } from './scrape.js';

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
    false
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

test('isScrapeUrlAllowed rejects non-HTTPS RYM URLs', () => {
  assert.equal(isScrapeUrlAllowed('rym', 'http://rateyourmusic.com/'), false);
});
