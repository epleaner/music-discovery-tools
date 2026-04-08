import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openInitializedNewsletterDatabase } from './client.js';
import {
  getNewsletterDetail,
  listNewsletterSources,
  listNewsletters,
  replaceMessageAlbums,
  replaceMessageArtists,
  replaceMessageTracks,
  replaceNewsletterLinks,
  upsertNewsletterMessage,
  upsertNewsletterSource,
  insertNewsletterExtraction,
} from './queries.js';

function createTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), 'soundscape-newsletters-db-'));
  const dbPath = join(tempDir, 'newsletters.sqlite');
  const db = openInitializedNewsletterDatabase({ dbPath });

  return {
    db,
    cleanup() {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function seedNewsletterFixture() {
  const { db, cleanup } = createTestDatabase();

  const pitchforkSourceId = upsertNewsletterSource(db, {
    canonicalName: 'Pitchfork',
    senderEmail: 'news@pitchfork.com',
  });
  const bandcampSourceId = upsertNewsletterSource(db, {
    canonicalName: 'Bandcamp Daily',
    senderEmail: 'daily@bandcamp.com',
  });

  const newerMessageId = upsertNewsletterMessage(db, {
    gmailMessageId: 'gmail-pitchfork-1',
    gmailThreadId: 'thread-pitchfork-1',
    sourceId: pitchforkSourceId,
    subject: 'Best New Music',
    senderName: 'Pitchfork',
    senderEmail: 'news@pitchfork.com',
    sentAt: '2026-04-08T12:00:00.000Z',
    cleanedText: 'Jessica Pratt leads this week\'s picks.',
    extractionStatus: 'extracted',
  });

  insertNewsletterExtraction(db, {
    newsletterMessageId: newerMessageId,
    modelName: 'test-model',
    promptVersion: 'v1',
    extractionJson: JSON.stringify({
      sourceName: 'Pitchfork',
      summary: 'Jessica Pratt leads this week\'s picks.',
      artists: [],
      albums: [],
      tracks: [],
      genres: [],
      links: [],
      releases: [],
      events: [],
    }),
    summary: 'Jessica Pratt leads this week\'s picks.',
  });

  replaceMessageArtists(db, newerMessageId, [
    {
      name: 'Jessica Pratt',
      confidence: 0.94,
      evidence: 'Lead artist mention.',
    },
  ]);
  replaceMessageAlbums(db, newerMessageId, [
    {
      name: 'Here in the Pitch',
      primaryArtistName: 'Jessica Pratt',
      confidence: 0.91,
      evidence: 'Album of the week.',
    },
  ]);
  replaceMessageTracks(db, newerMessageId, [
    {
      name: 'Life Is',
      primaryArtistName: 'Jessica Pratt',
      confidence: 0.89,
      evidence: 'Lead single mention.',
    },
  ]);
  replaceNewsletterLinks(db, {
    newsletterMessageId: newerMessageId,
    links: [
      {
        url: 'https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/',
        domain: 'pitchfork.com',
        title: 'Jessica Pratt: Here in the Pitch',
        confidence: 0.97,
      },
    ],
  });

  const olderMessageId = upsertNewsletterMessage(db, {
    gmailMessageId: 'gmail-bandcamp-1',
    gmailThreadId: 'thread-bandcamp-1',
    sourceId: bandcampSourceId,
    subject: 'Bandcamp Daily',
    senderName: 'Bandcamp Daily',
    senderEmail: 'daily@bandcamp.com',
    sentAt: '2026-04-07T12:00:00.000Z',
    cleanedText: 'Nala Sinephro and more ambient highlights.',
    extractionStatus: 'extracted',
  });

  insertNewsletterExtraction(db, {
    newsletterMessageId: olderMessageId,
    modelName: 'test-model',
    promptVersion: 'v1',
    extractionJson: JSON.stringify({
      sourceName: 'Bandcamp Daily',
      summary: 'Nala Sinephro anchors today\'s ambient recommendations.',
      artists: [],
      albums: [],
      tracks: [],
      genres: [],
      links: [],
      releases: [],
      events: [],
    }),
    summary: 'Nala Sinephro anchors today\'s ambient recommendations.',
  });

  replaceMessageArtists(db, olderMessageId, [
    {
      name: 'Nala Sinephro',
      confidence: 0.88,
      evidence: 'Primary recommendation.',
    },
  ]);

  return {
    db,
    cleanup,
    pitchforkSourceId,
    bandcampSourceId,
    newerMessageId,
    olderMessageId,
  };
}

test('listNewsletters returns UI-ready summaries ordered newest first', () => {
  const { db, cleanup, newerMessageId, olderMessageId } = seedNewsletterFixture();

  try {
    const newsletters = listNewsletters(db);

    assert.equal(newsletters.length, 2);
    assert.deepEqual(
      newsletters.map((newsletter) => newsletter.id),
      [newerMessageId, olderMessageId]
    );
    assert.deepEqual(newsletters[0], {
      id: newerMessageId,
      gmailMessageId: 'gmail-pitchfork-1',
      source: {
        id: newsletters[0]?.source.id ?? null,
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
          confidence: 0.94,
          evidence: 'Lead artist mention.',
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
          confidence: 0.89,
          evidence: 'Lead single mention.',
        },
      ],
      links: [
        {
          url: 'https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/',
          domain: 'pitchfork.com',
          title: 'Jessica Pratt: Here in the Pitch',
          confidence: 0.97,
        },
      ],
    });
  } finally {
    cleanup();
  }
});

test('listNewsletters applies a source filter explicitly', () => {
  const { db, cleanup, bandcampSourceId, olderMessageId } = seedNewsletterFixture();

  try {
    const newsletters = listNewsletters(db, { sourceId: bandcampSourceId });

    assert.deepEqual(newsletters.map((newsletter) => newsletter.id), [olderMessageId]);
    assert.equal(newsletters[0]?.source.canonicalName, 'Bandcamp Daily');
  } finally {
    cleanup();
  }
});

test('getNewsletterDetail returns extracted entities and links for one message', () => {
  const { db, cleanup, newerMessageId } = seedNewsletterFixture();

  try {
    const detail = getNewsletterDetail(db, newerMessageId);

    assert.deepEqual(detail, {
      id: newerMessageId,
      gmailMessageId: 'gmail-pitchfork-1',
      source: {
        id: detail?.source.id ?? null,
        canonicalName: 'Pitchfork',
        senderEmail: 'news@pitchfork.com',
      },
      subject: 'Best New Music',
      summary: 'Jessica Pratt leads this week\'s picks.',
      sentAt: '2026-04-08T12:00:00.000Z',
      cleanedText: 'Jessica Pratt leads this week\'s picks.',
      extractionStatus: 'extracted',
      artists: [
        {
          name: 'Jessica Pratt',
          confidence: 0.94,
          evidence: 'Lead artist mention.',
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
          confidence: 0.89,
          evidence: 'Lead single mention.',
        },
      ],
      links: [
        {
          url: 'https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/',
          domain: 'pitchfork.com',
          title: 'Jessica Pratt: Here in the Pitch',
          confidence: 0.97,
        },
      ],
    });
  } finally {
    cleanup();
  }
});

test('listNewsletterSources returns source options with counts', () => {
  const { db, cleanup, pitchforkSourceId, bandcampSourceId } = seedNewsletterFixture();

  try {
    const sources = listNewsletterSources(db);

    assert.deepEqual(sources, [
      {
        id: bandcampSourceId,
        canonicalName: 'Bandcamp Daily',
        senderEmail: 'daily@bandcamp.com',
        newsletterCount: 1,
      },
      {
        id: pitchforkSourceId,
        canonicalName: 'Pitchfork',
        senderEmail: 'news@pitchfork.com',
        newsletterCount: 1,
      },
    ]);
  } finally {
    cleanup();
  }
});

test('read helpers make empty state behavior explicit', () => {
  const { db, cleanup } = createTestDatabase();

  try {
    assert.deepEqual(listNewsletters(db), []);
    assert.equal(getNewsletterDetail(db, 9999), null);
    assert.deepEqual(listNewsletterSources(db), []);
  } finally {
    cleanup();
  }
});
