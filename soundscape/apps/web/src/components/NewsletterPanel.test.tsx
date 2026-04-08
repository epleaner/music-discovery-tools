import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNewsletterPanelModel,
  resolveSelectedNewsletterId,
} from './newsletter-panel-model.js';
import type { NewsletterDetail, NewsletterSummary } from '../lib/newsletters.js';

function createNewsletterSummary(overrides: Partial<NewsletterSummary> = {}): NewsletterSummary {
  return {
    id: 7,
    gmailMessageId: 'gmail-7',
    source: {
      id: 2,
      canonicalName: 'Pitchfork',
      senderEmail: 'news@pitchfork.com',
    },
    subject: 'Best New Music',
    summary: 'Jessica Pratt leads this week\'s picks.',
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

function createNewsletterDetail(overrides: Partial<NewsletterDetail> = {}): NewsletterDetail {
  return {
    ...createNewsletterSummary(),
    cleanedText: 'Jessica Pratt leads this week\'s picks with a hushed new record.',
    ...overrides,
  };
}

test('resolveSelectedNewsletterId falls back to the first newsletter', () => {
  const first = createNewsletterSummary();
  const second = createNewsletterSummary({ id: 8, gmailMessageId: 'gmail-8' });

  assert.equal(resolveSelectedNewsletterId([], null), null);
  assert.equal(resolveSelectedNewsletterId([first, second], null), first.id);
  assert.equal(resolveSelectedNewsletterId([first, second], 999), first.id);
  assert.equal(resolveSelectedNewsletterId([first, second], second.id), second.id);
});

test('buildNewsletterPanelModel exposes compact loading state before data is ready', () => {
  const model = buildNewsletterPanelModel({
    newsletters: [],
    listStatus: 'loading',
    detailStatus: 'idle',
    detail: null,
  });

  assert.equal(model.listState, 'loading');
  assert.equal(model.listMessage, 'Loading newsletters…');
  assert.equal(model.detail.state, 'empty');
  assert.equal(model.detail.title, 'Select a newsletter');
});

test('buildNewsletterPanelModel renders list and selected detail content', () => {
  const first = createNewsletterSummary();
  const second = createNewsletterSummary({
    id: 8,
    gmailMessageId: 'gmail-8',
    subject: 'New Songs You Need',
    summary: 'Kali Uchis and Nourished by Time headline this week.',
    artists: [
      { name: 'Kali Uchis', confidence: 0.94, evidence: 'Lead item' },
      { name: 'Nourished by Time', confidence: 0.9, evidence: 'Secondary item' },
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
    links: [],
  });

  const model = buildNewsletterPanelModel({
    newsletters: [first, second],
    selectedId: second.id,
    listStatus: 'ready',
    detailStatus: 'ready',
    detail: createNewsletterDetail({
      ...second,
      cleanedText: 'Kali Uchis and Nourished by Time headline this week.',
    }),
  });

  assert.equal(model.listState, 'ready');
  assert.equal(model.selectedId, second.id);
  assert.deepEqual(
    model.listItems.map((item) => ({ subject: item.subject, isSelected: item.isSelected })),
    [
      { subject: 'Best New Music', isSelected: false },
      { subject: 'New Songs You Need', isSelected: true },
    ]
  );
  assert.deepEqual(model.listItems[1]?.entityLabels, [
    'Kali Uchis',
    'Nourished by Time',
    'Kali Uchis / Sunshine & Rain...',
  ]);
  assert.equal(model.detail.state, 'ready');
  assert.equal(model.detail.title, 'New Songs You Need');
  assert.deepEqual(model.detail.artists, ['Kali Uchis', 'Nourished by Time']);
  assert.deepEqual(model.detail.tracks, ['Sunshine & Rain... — Kali Uchis']);
  assert.equal(model.detail.excerpt, 'Kali Uchis and Nourished by Time headline this week.');
});

test('buildNewsletterPanelModel renders explicit empty state when no newsletters are available', () => {
  const model = buildNewsletterPanelModel({
    newsletters: [],
    listStatus: 'empty',
    detailStatus: 'idle',
    detail: null,
  });

  assert.equal(model.listState, 'empty');
  assert.equal(model.listMessage, 'Run the local ingest worker to populate this panel.');
  assert.equal(model.detail.state, 'empty');
  assert.equal(model.detail.title, 'Select a newsletter');
});

test('buildNewsletterPanelModel renders explicit error states', () => {
  const model = buildNewsletterPanelModel({
    newsletters: [],
    listStatus: 'error',
    listError: new Error('newsletter list unavailable'),
    detailStatus: 'error',
    detailError: new Error('newsletter detail unavailable'),
    detail: null,
  });

  assert.equal(model.listState, 'error');
  assert.equal(model.listMessage, 'newsletter list unavailable');
  assert.equal(model.detail.state, 'error');
  assert.equal(model.detail.errorMessage, 'newsletter detail unavailable');
});
