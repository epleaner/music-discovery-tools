import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterNormalizedExtraction,
  isHighConfidence,
  safeParseNewsletterExtraction,
} from './extraction-schema.js';

const rawExtraction = {
  sourceName: 'Pitchfork',
  summary: 'Highlights from this week in music.',
  artists: [
    {
      name: 'Jessica Pratt',
      confidence: 0.93,
      evidence: 'Jessica Pratt returns with a new single.',
    },
    {
      name: 'Unknown Band',
      confidence: 0.52,
      evidence: 'Possibly featured in the roundup.',
    },
  ],
  albums: [
    {
      name: 'Here in the Pitch',
      primaryArtistName: 'Jessica Pratt',
      confidence: 0.91,
      evidence: 'Album of the week.',
    },
  ],
  tracks: [
    {
      name: 'Life Is',
      primaryArtistName: 'Jessica Pratt',
      confidence: 0.87,
      evidence: 'Lead single.',
    },
    {
      name: 'Rumored Demo',
      primaryArtistName: 'Unknown Band',
      confidence: 0.4,
      evidence: 'Mentioned in passing.',
    },
  ],
  genres: [
    {
      name: 'folk',
      confidence: 0.88,
      evidence: 'Described as folk-forward songwriting.',
    },
  ],
  links: [
    {
      url: 'https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/',
      domain: 'pitchfork.com',
      title: 'Jessica Pratt: Here in the Pitch',
      confidence: 0.95,
      evidence: 'Primary review link.',
    },
    {
      url: 'https://example.com/uncertain',
      title: 'Maybe relevant',
      confidence: 0.45,
      evidence: 'Listed in a footer.',
    },
  ],
  releases: [
    {
      title: 'Here in the Pitch',
      artistName: 'Jessica Pratt',
      releaseDate: '2026-05-03',
      confidence: 0.89,
      evidence: 'Out May 3.',
    },
  ],
  events: [
    {
      title: 'Brooklyn Album Release Show',
      venue: 'Warsaw',
      city: 'Brooklyn, NY',
      startDate: '2026-05-09',
      confidence: 0.79,
      evidence: 'Release show announced for May 9.',
    },
  ],
};

test('safeParseNewsletterExtraction accepts a valid extraction object', () => {
  const parsed = safeParseNewsletterExtraction(rawExtraction);

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }

  assert.equal(parsed.data.summary, 'Highlights from this week in music.');
  assert.equal(parsed.data.artists.length, 2);
  assert.equal(parsed.data.links.length, 2);
  assert.equal(parsed.data.releases[0]?.title, 'Here in the Pitch');
});

test('safeParseNewsletterExtraction rejects malformed extraction objects', () => {
  const parsed = safeParseNewsletterExtraction({
    sourceName: 'Pitchfork',
    summary: 123,
    artists: 'not-an-array',
    albums: [],
    tracks: [],
    genres: [],
    links: [],
    releases: [],
    events: [],
  });

  assert.equal(parsed.success, false);
});

test('filterNormalizedExtraction excludes low-confidence normalized entities and links', () => {
  const parsed = safeParseNewsletterExtraction(rawExtraction);
  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }

  const filtered = filterNormalizedExtraction(parsed.data, 0.8);

  assert.deepEqual(
    filtered.artists.map((artist) => artist.name),
    ['Jessica Pratt']
  );
  assert.deepEqual(
    filtered.tracks.map((track) => track.name),
    ['Life Is']
  );
  assert.deepEqual(
    filtered.links.map((link) => link.url),
    ['https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/']
  );
});

test('filterNormalizedExtraction leaves the raw validated extraction unchanged', () => {
  const parsed = safeParseNewsletterExtraction(rawExtraction);
  assert.equal(parsed.success, true);
  if (!parsed.success) {
    return;
  }

  const before = JSON.stringify(parsed.data);
  const filtered = filterNormalizedExtraction(parsed.data, 0.8);

  assert.equal(JSON.stringify(parsed.data), before);
  assert.equal(filtered.artists.length, 1);
  assert.equal(parsed.data.artists.length, 2);
  assert.equal(parsed.data.links.length, 2);
});

test('isHighConfidence uses an explicit threshold', () => {
  assert.equal(isHighConfidence(0.8, 0.8), true);
  assert.equal(isHighConfidence(0.79, 0.8), false);
  assert.equal(isHighConfidence(undefined, 0.8), false);
});
