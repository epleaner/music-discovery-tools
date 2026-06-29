import assert from 'node:assert/strict';
import test from 'node:test';
import { isUrlAllowed } from './scrape-allowlist.js';

test('rym: allows rateyourmusic.com', () => {
  assert.equal(isUrlAllowed('rym', 'https://rateyourmusic.com/list/x'), true);
});

test('rym: allows www.rateyourmusic.com subdomain', () => {
  assert.equal(isUrlAllowed('rym', 'https://www.rateyourmusic.com/charts/x'), true);
});

test('rym: rejects evil.com', () => {
  assert.equal(isUrlAllowed('rym', 'https://evil.com/x'), false);
});

test('rym: rejects rateyourmusic.com.evil.com (suffix attack)', () => {
  assert.equal(isUrlAllowed('rym', 'https://rateyourmusic.com.evil.com/x'), false);
});

test('rym: rejects malformed url', () => {
  assert.equal(isUrlAllowed('rym', 'not a url'), false);
});

test('bandcamp: allows artist.bandcamp.com subdomain', () => {
  assert.equal(isUrlAllowed('bandcamp', 'https://artist.bandcamp.com/album/y'), true);
});

test('bandcamp: allows bandcamp.com', () => {
  assert.equal(isUrlAllowed('bandcamp', 'https://bandcamp.com/discover'), true);
});

test('rym: rejects bandcamp url (wrong source)', () => {
  assert.equal(isUrlAllowed('rym', 'https://artist.bandcamp.com/album/y'), false);
});
