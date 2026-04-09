import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBandcampSearchQuery,
  lookupNewsletterBandcampLinks,
  parseBandcampSearchResults,
} from './bandcamp-lookup.js';

test('buildBandcampSearchQuery scopes album and track lookups with artist context', () => {
  assert.equal(
    buildBandcampSearchQuery({
      kind: 'album',
      name: 'Here in the Pitch',
      primaryArtistName: 'Jessica Pratt',
    }),
    'site:bandcamp.com "Jessica Pratt" "Here in the Pitch"'
  );

  assert.equal(
    buildBandcampSearchQuery({
      kind: 'track',
      name: 'Sunset',
      primaryArtistName: 'Caroline Polachek',
    }),
    'site:bandcamp.com "Caroline Polachek" "Sunset"'
  );

  assert.equal(
    buildBandcampSearchQuery({
      kind: 'artist',
      name: 'Jessica Pratt',
      primaryArtistName: null,
    }),
    'site:bandcamp.com "Jessica Pratt"'
  );
});

test('parseBandcampSearchResults keeps only bandcamp results and unwraps DuckDuckGo redirects', () => {
  const html = `
    <html>
      <body>
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fjessicapratt.bandcamp.com%2Falbum%2Fhere-in-the-pitch">Jessica Pratt - Here in the Pitch</a>
        <a class="result__a" href="https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/">Pitchfork review</a>
        <a class="result__a" href="https://jessicapratt.bandcamp.com/track/sunset">Sunset</a>
      </body>
    </html>
  `;

  assert.deepEqual(parseBandcampSearchResults(html), [
    {
      url: 'https://jessicapratt.bandcamp.com/album/here-in-the-pitch',
      label: 'Jessica Pratt - Here in the Pitch',
    },
    {
      url: 'https://jessicapratt.bandcamp.com/track/sunset',
      label: 'Sunset',
    },
  ]);
});

test('lookupNewsletterBandcampLinks searches and caches artist album and track results per newsletter', async () => {
  const requestedQueries: string[] = [];
  let fetchCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    fetchCalls += 1;
    const url = String(input);
    const query = new URL(url).searchParams.get('q') ?? '';
    requestedQueries.push(query);

    const htmlByQuery: Record<string, string> = {
      'site:bandcamp.com "Jessica Pratt"':
        '<a class="result__a" href="https://jessicapratt.bandcamp.com/">Jessica Pratt</a>',
      'site:bandcamp.com "Jessica Pratt" "Here in the Pitch"':
        '<a class="result__a" href="https://jessicapratt.bandcamp.com/album/here-in-the-pitch">Here in the Pitch</a>',
      'site:bandcamp.com "Jessica Pratt" "World on a String"':
        '<a class="result__a" href="https://jessicapratt.bandcamp.com/track/world-on-a-string">World on a String</a>',
    };

    return new Response(htmlByQuery[query] ?? '', { status: 200 });
  };

  const first = await lookupNewsletterBandcampLinks(
    {
      artists: [{ name: 'Jessica Pratt', primaryArtistName: null }],
      albums: [{ name: 'Here in the Pitch', primaryArtistName: 'Jessica Pratt' }],
      tracks: [{ name: 'World on a String', primaryArtistName: 'Jessica Pratt' }],
    },
    { fetchImpl }
  );

  const second = await lookupNewsletterBandcampLinks(
    {
      artists: [{ name: 'Jessica Pratt', primaryArtistName: null }],
      albums: [{ name: 'Here in the Pitch', primaryArtistName: 'Jessica Pratt' }],
      tracks: [{ name: 'World on a String', primaryArtistName: 'Jessica Pratt' }],
    },
    { fetchImpl }
  );

  assert.deepEqual(first, {
    artists: [
      {
        name: 'Jessica Pratt',
        primaryArtistName: null,
        url: 'https://jessicapratt.bandcamp.com/',
        label: 'Jessica Pratt',
      },
    ],
    albums: [
      {
        name: 'Here in the Pitch',
        primaryArtistName: 'Jessica Pratt',
        url: 'https://jessicapratt.bandcamp.com/album/here-in-the-pitch',
        label: 'Here in the Pitch',
      },
    ],
    tracks: [
      {
        name: 'World on a String',
        primaryArtistName: 'Jessica Pratt',
        url: 'https://jessicapratt.bandcamp.com/track/world-on-a-string',
        label: 'World on a String',
      },
    ],
  });
  assert.deepEqual(second, first);
  assert.deepEqual(requestedQueries, [
    'site:bandcamp.com "Jessica Pratt"',
    'site:bandcamp.com "Jessica Pratt" "Here in the Pitch"',
    'site:bandcamp.com "Jessica Pratt" "World on a String"',
  ]);
  assert.equal(fetchCalls, 3);
});
