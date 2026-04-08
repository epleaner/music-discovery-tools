import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  insertNewsletterExtraction,
  openInitializedNewsletterDatabase,
  replaceMessageArtists,
  replaceNewsletterLinks,
  upsertNewsletterMessage,
  upsertNewsletterSource,
  type NewsletterDatabase,
} from '@soundscape/newsletters-db';
import { appRouter } from './router.js';
import type { Context } from './context.js';

function createTestDatabase(): { db: NewsletterDatabase; cleanup: () => void } {
  const tempDir = mkdtempSync(join(tmpdir(), 'soundscape-api-router-'));
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

function seedNewsletterData(db: NewsletterDatabase) {
  const sourceId = upsertNewsletterSource(db, {
    canonicalName: 'Pitchfork',
    senderEmail: 'news@pitchfork.com',
  });

  const messageId = upsertNewsletterMessage(db, {
    gmailMessageId: 'gmail-api-1',
    sourceId,
    subject: 'Best New Music',
    senderName: 'Pitchfork',
    senderEmail: 'news@pitchfork.com',
    sentAt: '2026-04-08T12:00:00.000Z',
    cleanedText: 'Jessica Pratt leads this week\'s picks.',
    extractionStatus: 'extracted',
  });

  insertNewsletterExtraction(db, {
    newsletterMessageId: messageId,
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

  replaceMessageArtists(db, messageId, [
    {
      name: 'Jessica Pratt',
      confidence: 0.94,
      evidence: 'Lead artist mention.',
    },
  ]);

  replaceNewsletterLinks(db, {
    newsletterMessageId: messageId,
    links: [
      {
        url: 'https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/',
        domain: 'pitchfork.com',
        title: 'Jessica Pratt: Here in the Pitch',
        confidence: 0.97,
      },
    ],
  });

  return { sourceId, messageId };
}

function createCaller(db: NewsletterDatabase) {
  return appRouter.createCaller({ db } satisfies Context);
}

test('newsletterList returns paginated newsletter summaries', async () => {
  const { db, cleanup } = createTestDatabase();

  try {
    seedNewsletterData(db);
    const caller = createCaller(db);

    const result = await caller.newsletterList({ limit: 10, offset: 0 });

    assert.equal(result.newsletters.length, 1);
    assert.equal(result.newsletters[0]?.subject, 'Best New Music');
    assert.equal(result.newsletters[0]?.artists[0]?.name, 'Jessica Pratt');
  } finally {
    cleanup();
  }
});

test('newsletterDetail returns one newsletter and null for missing ids', async () => {
  const { db, cleanup } = createTestDatabase();

  try {
    const { messageId } = seedNewsletterData(db);
    const caller = createCaller(db);

    const detail = await caller.newsletterDetail({ id: messageId });
    const missing = await caller.newsletterDetail({ id: 9999 });

    assert.equal(detail?.id, messageId);
    assert.equal(detail?.links.length, 1);
    assert.equal(missing, null);
  } finally {
    cleanup();
  }
});

test('newsletterSources returns source filters and newsletterList applies sourceId filtering', async () => {
  const { db, cleanup } = createTestDatabase();

  try {
    const { sourceId } = seedNewsletterData(db);
    const caller = createCaller(db);

    const sources = await caller.newsletterSources();
    const filtered = await caller.newsletterList({ sourceId, limit: 10, offset: 0 });
    const empty = await caller.newsletterList({ sourceId: sourceId + 100, limit: 10, offset: 0 });

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.id, sourceId);
    assert.equal(filtered.newsletters.length, 1);
    assert.deepEqual(empty.newsletters, []);
  } finally {
    cleanup();
  }
});
