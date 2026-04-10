import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findNewsletterEntityLink,
  matchNewsletterEntityLinks,
  normalizeNewsletterLinkText,
} from './newsletter-link-matcher.js';
import type { NewsletterSummary } from './newsletters.js';

function createLinks(): NewsletterSummary['links'] {
  return [
    {
      url: 'https://records.example.com/releases/jessica-pratt-here-in-the-pitch',
      domain: 'records.example.com',
      title: 'Jessica Pratt — Here in the Pitch',
      confidence: 0.9,
    },
    {
      url: 'https://songs.example.com/deniz-cuylan/no-such-thing-as-free-will',
      domain: 'songs.example.com',
      title: 'No Such Thing As Free Will | Deniz Cuylan',
      confidence: 0.88,
    },
    {
      url: 'https://artists.example.com/jessica-pratt',
      domain: 'artists.example.com',
      title: 'Jessica Pratt',
      confidence: 0.95,
    },
  ];
}

test('normalizeNewsletterLinkText decodes URLs and strips punctuation into comparable text', () => {
  assert.equal(
    normalizeNewsletterLinkText('https://example.com/Deniz-Cuylan/No%20Such%20Thing%20As%20Free%20Will'),
    'https example com deniz cuylan no such thing as free will'
  );
});

test('findNewsletterEntityLink uses the first exact matching URL for an artist', () => {
  const match = findNewsletterEntityLink(
    { name: 'Jessica Pratt', primaryArtistName: null },
    createLinks()
  );

  assert.equal(
    match?.url,
    'https://records.example.com/releases/jessica-pratt-here-in-the-pitch'
  );
});

test('findNewsletterEntityLink matches album only when album and artist are both present', () => {
  const match = findNewsletterEntityLink(
    { name: 'Here in the Pitch', primaryArtistName: 'Jessica Pratt' },
    createLinks()
  );

  assert.equal(
    match?.url,
    'https://records.example.com/releases/jessica-pratt-here-in-the-pitch'
  );
});

test('findNewsletterEntityLink matches track only when track and artist are both present', () => {
  const match = findNewsletterEntityLink(
    { name: 'No Such Thing As Free Will', primaryArtistName: 'Deniz Cuylan' },
    createLinks()
  );

  assert.equal(
    match?.url,
    'https://songs.example.com/deniz-cuylan/no-such-thing-as-free-will'
  );
});

test('findNewsletterEntityLink does not match partial text', () => {
  const match = findNewsletterEntityLink(
    { name: 'Free Will', primaryArtistName: 'Deniz Cuylan' },
    createLinks()
  );

  assert.equal(match, null);
});

test('matchNewsletterEntityLinks allows one URL to map to multiple entities', () => {
  const sharedUrl = 'https://label.example.com/jessica-pratt-here-in-the-pitch';
  const links: NewsletterSummary['links'] = [
    {
      url: sharedUrl,
      domain: 'label.example.com',
      title: 'Jessica Pratt — Here in the Pitch',
      confidence: 0.91,
    },
  ];

  const result = matchNewsletterEntityLinks({
    artists: [{ name: 'Jessica Pratt', primaryArtistName: null }],
    albums: [{ name: 'Here in the Pitch', primaryArtistName: 'Jessica Pratt' }],
    tracks: [],
    links,
  });

  assert.equal(result.artists[0]?.url, sharedUrl);
  assert.equal(result.albums[0]?.url, sharedUrl);
});

test('findNewsletterEntityLink ignores malformed URLs when title does not match', () => {
  const match = findNewsletterEntityLink(
    { name: 'Jessica Pratt', primaryArtistName: null },
    [
      {
        url: 'not a url',
        domain: null,
        title: null,
        confidence: 0.4,
      },
    ]
  );

  assert.equal(match, null);
});
