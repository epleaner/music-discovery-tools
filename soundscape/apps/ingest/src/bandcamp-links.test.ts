import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractBandcampLinksFromNewsletter,
  extractCandidateLinksFromHtml,
  extractCandidateLinksFromText,
  resolveUrlWithRedirects,
} from './bandcamp-links.js';

test('extractCandidateLinksFromHtml reads direct Bandcamp anchors with anchor text', () => {
  const links = extractCandidateLinksFromHtml(`
    <div>
      <a href="https://artist.bandcamp.com/album/record">Buy on Bandcamp</a>
    </div>
  `);

  assert.deepEqual(links, [
    {
      url: 'https://artist.bandcamp.com/album/record',
      title: 'Buy on Bandcamp',
    },
  ]);
});

test('extractCandidateLinksFromText reads plain text Bandcamp URLs', () => {
  const links = extractCandidateLinksFromText(
    'Listen here https://artist.bandcamp.com/track/song and share it'
  );

  assert.deepEqual(links, [
    {
      url: 'https://artist.bandcamp.com/track/song',
      title: null,
    },
  ]);
});

test('resolveUrlWithRedirects follows redirects and falls back from HEAD to GET', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method });

    if (method === 'HEAD') {
      return new Response('', {
        status: 405,
        headers: {
          location: 'https://artist.bandcamp.com/album/record',
        },
      });
    }

    if (url === 'https://tracker.example.com/out?id=1') {
      return new Response('', {
        status: 302,
        headers: {
          location: 'https://artist.bandcamp.com/album/record',
        },
      });
    }

    return new Response('', {
      status: 200,
    });
  };

  const resolved = await resolveUrlWithRedirects(
    'https://tracker.example.com/out?id=1',
    {
      fetchImpl,
      timeoutMs: 50,
      maxRedirects: 5,
    }
  );

  assert.equal(resolved, 'https://artist.bandcamp.com/album/record');
  assert.deepEqual(calls, [
    {
      url: 'https://tracker.example.com/out?id=1',
      method: 'HEAD',
    },
    {
      url: 'https://tracker.example.com/out?id=1',
      method: 'GET',
    },
    {
      url: 'https://artist.bandcamp.com/album/record',
      method: 'GET',
    },
  ]);
});

test('resolveUrlWithRedirects returns null after exceeding the redirect limit', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response('', {
      status: 302,
      headers: {
        location: 'https://tracker.example.com/next',
      },
    });

  const resolved = await resolveUrlWithRedirects(
    'https://tracker.example.com/out?id=1',
    {
      fetchImpl,
      timeoutMs: 50,
      maxRedirects: 1,
    }
  );

  assert.equal(resolved, null);
});

test('extractBandcampLinksFromNewsletter keeps direct Bandcamp URLs and dedupes by final URL', async () => {
  const result = await extractBandcampLinksFromNewsletter({
    rawHtml: `
      <a href="https://artist.bandcamp.com/album/record">Album</a>
      <a href="https://artist.bandcamp.com/album/record">Album again</a>
    `,
    rawText: 'https://artist.bandcamp.com/album/record',
  });

  assert.deepEqual(result, [
    {
      url: 'https://artist.bandcamp.com/album/record',
      domain: 'artist.bandcamp.com',
      title: 'Album',
      confidence: 1,
    },
  ]);
});

test('extractBandcampLinksFromNewsletter strips known Bandcamp tracking params before deduping', async () => {
  const result = await extractBandcampLinksFromNewsletter({
    rawHtml: `
      <a href="https://marineeyes.bandcamp.com/track/around-the-lake?from=fanactv-hushhushrecords">Tracked</a>
      <a href="https://marineeyes.bandcamp.com/track/around-the-lake?utm_source=substack&utm_medium=email">Campaign</a>
    `,
    rawText: 'https://marineeyes.bandcamp.com/track/around-the-lake?ref=homepage',
  });

  assert.deepEqual(result, [
    {
      url: 'https://marineeyes.bandcamp.com/track/around-the-lake',
      domain: 'marineeyes.bandcamp.com',
      title: 'Tracked',
      confidence: 1,
    },
  ]);
});

test('extractBandcampLinksFromNewsletter preserves non-tracking Bandcamp query params', async () => {
  const result = await extractBandcampLinksFromNewsletter({
    rawText: 'https://artist.bandcamp.com/album/record?t=1',
  });

  assert.deepEqual(result, [
    {
      url: 'https://artist.bandcamp.com/album/record?t=1',
      domain: 'artist.bandcamp.com',
      title: null,
      confidence: 1,
    },
  ]);
});

test('extractBandcampLinksFromNewsletter resolves tracking links to final Bandcamp destinations', async () => {
  const resolvedUrls: string[] = [];
  const result = await extractBandcampLinksFromNewsletter(
    {
      rawHtml: '<a href="https://tracker.example.com/out?id=1">Tracked link</a>',
      rawText: null,
    },
    {
      resolveUrl: async (url) => {
        resolvedUrls.push(url);
        return 'https://artist.bandcamp.com/album/record';
      },
    }
  );

  assert.deepEqual(resolvedUrls, ['https://tracker.example.com/out?id=1']);
  assert.deepEqual(result, [
    {
      url: 'https://artist.bandcamp.com/album/record',
      domain: 'artist.bandcamp.com',
      title: 'Tracked link',
      confidence: 1,
    },
  ]);
});

test('extractBandcampLinksFromNewsletter ignores non-Bandcamp links after resolution', async () => {
  const result = await extractBandcampLinksFromNewsletter(
    {
      rawHtml: '<a href="https://tracker.example.com/out?id=1">Other</a>',
      rawText: 'https://example.com/not-bandcamp',
    },
    {
      resolveUrl: async () => 'https://example.com/not-bandcamp',
    }
  );

  assert.deepEqual(result, []);
});

test('extractBandcampLinksFromNewsletter skips resolver failures', async () => {
  const result = await extractBandcampLinksFromNewsletter(
    {
      rawHtml: '<a href="https://tracker.example.com/out?id=1">Broken</a>',
      rawText: null,
    },
    {
      resolveUrl: async () => {
        throw new Error('timeout');
      },
    }
  );

  assert.deepEqual(result, []);
});
