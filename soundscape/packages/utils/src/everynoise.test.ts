import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchEveryNoiseGenre, setCorsProxyApiKey } from './everynoise.js';

const artist = 'Hiroshi Yoshimura (吉村弘)';
const genreHtml =
  '<a href="engenremap-japaneseambient.html" target=_parent>japanese ambient</a>';

test('a successful genre lookup returns the genre and its map', async (t) => {
  setCorsProxyApiKey('test-only-key');
  t.after(() => setCorsProxyApiKey(''));
  t.mock.method(globalThis, 'fetch', async () => new Response(genreHtml));

  assert.deepEqual(await fetchEveryNoiseGenre(artist), {
    genre: 'japanese ambient',
    url: 'https://everynoise.com/engenremap-japaneseambient.html',
  });
});

test('a successful lookup without a genre returns no match', async (t) => {
  setCorsProxyApiKey('test-only-key');
  t.after(() => setCorsProxyApiKey(''));
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('<p>No matches</p>')
  );

  assert.equal(await fetchEveryNoiseGenre(artist), null);
});

test('a rejected proxy request is an error rather than a missing genre', async (t) => {
  setCorsProxyApiKey('test-only-key');
  t.after(() => setCorsProxyApiKey(''));
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('Forbidden', { status: 403 })
  );

  await assert.rejects(
    fetchEveryNoiseGenre(artist),
    (error: unknown) => error instanceof Error && error.message.includes('403')
  );
});

test('an unconfigured proxy key fails instead of attempting an anonymous lookup', async (t) => {
  setCorsProxyApiKey('');
  t.mock.method(globalThis, 'fetch', async () => new Response(genreHtml));

  await assert.rejects(fetchEveryNoiseGenre(artist), Error);
});
