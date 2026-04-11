import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    summary: null,
    sentAt: '2026-04-08T12:00:00.000Z',
    extractionStatus: 'processed',
    artists: [],
    albums: [],
    tracks: [],
    links: [
      {
        url: 'https://artist.bandcamp.com/album/here-in-the-pitch',
        domain: 'artist.bandcamp.com',
        title: 'Jessica Pratt — Here in the Pitch',
        confidence: 1,
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

test('buildNewsletterPanelModel renders link-only newsletter rows', () => {
  const first = createNewsletterSummary();
  const second = createNewsletterSummary({
    id: 8,
    gmailMessageId: 'gmail-8',
    subject: 'New Songs You Need',
    links: [
      {
        url: 'https://artist.bandcamp.com/track/sunshine-and-rain',
        domain: 'artist.bandcamp.com',
        title: null,
        confidence: 1,
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
  assert.equal(model.listItems[0]?.summary, null);
  assert.deepEqual(model.listItems[0]?.links, [
    {
      label: 'Jessica Pratt — Here in the Pitch',
      url: 'https://artist.bandcamp.com/album/here-in-the-pitch',
    },
  ]);
  assert.deepEqual(model.listItems[1]?.links, [
    {
      label: 'Sunshine And Rain',
      url: 'https://artist.bandcamp.com/track/sunshine-and-rain',
    },
  ]);
});

test('buildNewsletterPanelModel derives a readable label from Bandcamp URLs when title is missing', () => {
  const model = buildNewsletterPanelModel({
    newsletters: [
      createNewsletterSummary({
        links: [
          {
            url: 'https://artist.bandcamp.com/album/a-grand-dont-come-for-free',
            domain: 'artist.bandcamp.com',
            title: null,
            confidence: 1,
          },
        ],
      }),
    ],
    listStatus: 'ready',
  });

  assert.deepEqual(model.listItems[0]?.links, [
    {
      label: 'A Grand Dont Come For Free',
      url: 'https://artist.bandcamp.com/album/a-grand-dont-come-for-free',
    },
  ]);
});

test('NewsletterList removes the Links toggle and inline collapsed state', () => {
  const source = readFileSync(
    new URL('./NewsletterList.tsx', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /SectionToggle/);
  assert.doesNotMatch(source, /showLinks/);
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
