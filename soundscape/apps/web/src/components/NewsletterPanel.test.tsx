import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNewsletterPanelModel } from './newsletter-panel-model.js';
import type { NewsletterSummary } from '../lib/newsletters.js';

function createNewsletterSummary(
  overrides: Partial<NewsletterSummary> = {}
): NewsletterSummary {
  return {
    id: 7,
    gmailMessageId: 'gmail-7',
    source: {
      id: 2,
      canonicalName: 'Pitchfork',
      senderEmail: 'news@pitchfork.com',
    },
    subject: 'Best New Music',
    summary: "Jessica Pratt leads this week's picks.",
    sentAt: '2026-04-08T12:00:00.000Z',
    extractionStatus: 'extracted',
    artists: [
      {
        name: 'Jessica Pratt',
        confidence: 0.96,
        evidence: 'Lead blurb',
      },
    ],
    albums: [
      {
        name: 'Here in the Pitch',
        primaryArtistName: 'Jessica Pratt',
        confidence: 0.93,
        evidence: 'Album of the week',
      },
    ],
    tracks: [],
    links: [
      {
        url: 'https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/',
        domain: 'pitchfork.com',
        title: 'Review',
        confidence: 0.92,
      },
    ],
    ...overrides,
  };
}

test('buildNewsletterPanelModel exposes compact loading state before data is ready', () => {
  const model = buildNewsletterPanelModel({
    newsletters: [],
    listStatus: 'loading',
  });

  assert.equal(model.listState, 'loading');
  assert.equal(model.listMessage, 'Loading newsletters…');
  assert.deepEqual(model.listItems, []);
});

test('buildNewsletterPanelModel renders inline newsletter rows with expandable section content', () => {
  const first = createNewsletterSummary();
  const second = createNewsletterSummary({
    id: 8,
    gmailMessageId: 'gmail-8',
    subject: 'New Songs You Need',
    summary: 'Kali Uchis and Nourished by Time headline this week.',
    artists: [
      { name: 'Kali Uchis', confidence: 0.94, evidence: 'Lead item' },
      {
        name: 'Nourished by Time',
        confidence: 0.9,
        evidence: 'Secondary item',
      },
    ],
    albums: [],
    tracks: [
      {
        name: 'Sunshine & Rain...',
        primaryArtistName: 'Kali Uchis',
        confidence: 0.91,
        evidence: 'Single callout',
      },
    ],
    links: [
      {
        url: 'https://example.com/kali-uchis',
        domain: 'example.com',
        title: 'Feature',
        confidence: 0.85,
      },
    ],
  });

  const model = buildNewsletterPanelModel({
    newsletters: [first, second],
    listStatus: 'ready',
  });

  assert.equal(model.listState, 'ready');
  assert.deepEqual(
    model.listItems.map((item) => item.subject),
    ['Best New Music', 'New Songs You Need']
  );
  assert.equal(
    model.listItems[1]?.summary,
    'Kali Uchis and Nourished by Time headline this week.'
  );
  assert.equal(model.listItems[1]?.summary?.endsWith('week.'), true);
  assert.deepEqual(model.listItems[1]?.artists, [
    'Kali Uchis',
    'Nourished by Time',
  ]);
  assert.deepEqual(model.listItems[1]?.tracks, [
    'Sunshine & Rain... — Kali Uchis',
  ]);
  assert.deepEqual(model.listItems[1]?.links, [
    {
      label: 'Feature',
      url: 'https://example.com/kali-uchis',
    },
  ]);
});

test('buildNewsletterPanelModel renders explicit empty state when no newsletters are available', () => {
  const model = buildNewsletterPanelModel({
    newsletters: [],
    listStatus: 'empty',
  });

  assert.equal(model.listState, 'empty');
  assert.equal(
    model.listMessage,
    'Run the local ingest worker to populate this panel.'
  );
  assert.deepEqual(model.listItems, []);
});

test('buildNewsletterPanelModel renders explicit error states', () => {
  const model = buildNewsletterPanelModel({
    newsletters: [],
    listStatus: 'error',
    listError: new Error('newsletter list unavailable'),
  });

  assert.equal(model.listState, 'error');
  assert.equal(model.listMessage, 'newsletter list unavailable');
  assert.deepEqual(model.listItems, []);
});
