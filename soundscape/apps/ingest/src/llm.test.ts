import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNewsletterMessageByGmailMessageId,
  openInitializedNewsletterDatabase,
} from '@soundscape/newsletters-db';
import { persistRawGmailMessage } from './gmail.js';
import {
  extractAndPersistNewsletterMessage,
  readSampleFixture,
  resolveSampleFixturePath,
  type NewsletterLlmClient,
} from './llm.js';

function createTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), 'soundscape-llm-'));
  const dbPath = join(tempDir, 'newsletters.sqlite');
  const db = openInitializedNewsletterDatabase({ dbPath });

  return {
    db,
    tempDir,
    cleanup() {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

test('extractAndPersistNewsletterMessage stores validated extraction JSON and normalized entities', async () => {
  const { db, cleanup } = createTestDatabase();
  let cleanedTextSentToLlm: string | null = null;

  const client: NewsletterLlmClient = {
    modelName: 'test-model',
    async extract(input) {
      cleanedTextSentToLlm = input.cleanedText;

      return {
        sourceName: 'Pitchfork',
        summary: 'Jessica Pratt leads this week\'s picks.',
        artists: [
          {
            name: 'Jessica Pratt',
            confidence: 0.94,
            evidence: 'Jessica Pratt returns with a new single.',
          },
          {
            name: 'Maybe Someone Else',
            confidence: 0.41,
            evidence: 'Briefly mentioned in a footer.',
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
            evidence: 'Lead single.',
          },
        ],
        genres: [],
        links: [
          {
            url: 'https://pitchfork.com/reviews/albums/jessica-pratt-here-in-the-pitch/',
            domain: 'pitchfork.com',
            title: 'Jessica Pratt: Here in the Pitch',
            confidence: 0.97,
            evidence: 'Primary review link.',
          },
          {
            url: 'https://example.com/uncertain',
            title: 'Maybe relevant',
            confidence: 0.2,
            evidence: 'Footer link.',
          },
        ],
        releases: [],
        events: [],
      };
    },
  };

  try {
    const persisted = persistRawGmailMessage(db, {
      id: 'gmail-llm-success',
      subject: 'Best New Music',
      senderName: 'Pitchfork',
      senderEmail: 'news@pitchfork.com',
      cleanedText: 'Jessica Pratt returns with a new single and album details.',
      rawText: 'Jessica Pratt returns with a new single and album details.',
    });

    const result = await extractAndPersistNewsletterMessage({
      db,
      newsletterMessageId: persisted.newsletterMessageId,
      message: {
        id: 'gmail-llm-success',
        subject: 'Best New Music',
        sourceName: 'Pitchfork',
        cleanedText: 'Jessica Pratt returns with a new single and album details.',
      },
      llmClient: client,
      entityConfidenceThreshold: 0.8,
    });

    assert.equal(cleanedTextSentToLlm, 'Jessica Pratt returns with a new single and album details.');
    assert.equal(result.normalizedCounts.artists, 1);
    assert.equal(result.normalizedCounts.links, 1);

    const extractionRow = db
      .prepare<[number], { summary: string; extraction_json: string }>(
        `SELECT summary, extraction_json
         FROM newsletter_extractions
         WHERE newsletter_message_id = ?`
      )
      .get(persisted.newsletterMessageId);

    assert.equal(extractionRow?.summary, 'Jessica Pratt leads this week\'s picks.');
    assert.match(extractionRow?.extraction_json ?? '', /Maybe Someone Else/);

    const artistCount = db
      .prepare<[number], { count: number }>(
        'SELECT COUNT(*) as count FROM newsletter_message_artists WHERE newsletter_message_id = ?'
      )
      .get(persisted.newsletterMessageId);
    const albumCount = db
      .prepare<[number], { count: number }>(
        'SELECT COUNT(*) as count FROM newsletter_message_albums WHERE newsletter_message_id = ?'
      )
      .get(persisted.newsletterMessageId);
    const trackCount = db
      .prepare<[number], { count: number }>(
        'SELECT COUNT(*) as count FROM newsletter_message_tracks WHERE newsletter_message_id = ?'
      )
      .get(persisted.newsletterMessageId);
    const linkCount = db
      .prepare<[number], { count: number }>(
        'SELECT COUNT(*) as count FROM newsletter_links WHERE newsletter_message_id = ?'
      )
      .get(persisted.newsletterMessageId);

    assert.equal(artistCount?.count, 1);
    assert.equal(albumCount?.count, 1);
    assert.equal(trackCount?.count, 1);
    assert.equal(linkCount?.count, 1);

    const messageRow = getNewsletterMessageByGmailMessageId(db, 'gmail-llm-success');
    assert.equal(messageRow?.extractionStatus, 'extracted');
  } finally {
    cleanup();
  }
});

test('extractAndPersistNewsletterMessage marks extraction failure without removing raw message data', async () => {
  const { db, cleanup } = createTestDatabase();

  const client: NewsletterLlmClient = {
    modelName: 'test-model',
    async extract() {
      return {
        sourceName: 'Pitchfork',
        summary: 'missing required arrays',
      };
    },
  };

  try {
    const persisted = persistRawGmailMessage(db, {
      id: 'gmail-llm-failure',
      subject: 'Broken extraction',
      senderEmail: 'news@pitchfork.com',
      rawText: 'Original message body',
      cleanedText: 'Original message body',
    });

    await assert.rejects(
      extractAndPersistNewsletterMessage({
        db,
        newsletterMessageId: persisted.newsletterMessageId,
        message: {
          id: 'gmail-llm-failure',
          subject: 'Broken extraction',
          cleanedText: 'Original message body',
        },
        llmClient: client,
        entityConfidenceThreshold: 0.8,
      })
    );

    const messageRow = getNewsletterMessageByGmailMessageId(db, 'gmail-llm-failure');
    assert.equal(messageRow?.rawText, 'Original message body');
    assert.equal(messageRow?.cleanedText, 'Original message body');
    assert.equal(messageRow?.extractionStatus, 'failed');

    const extractionCount = db
      .prepare<[number], { count: number }>(
        'SELECT COUNT(*) as count FROM newsletter_extractions WHERE newsletter_message_id = ?'
      )
      .get(persisted.newsletterMessageId);

    assert.equal(extractionCount?.count, 0);
  } finally {
    cleanup();
  }
});

test('resolveSampleFixturePath supports repo-root-relative fixture paths', () => {
  const resolvedPath = resolveSampleFixturePath('apps/ingest/fixtures/sample-newsletter.json');

  assert.match(resolvedPath, /apps\/ingest\/fixtures\/sample-newsletter\.json$/);
});

test('readSampleFixture loads local sample content for CLI verification', () => {
  const { cleanup, tempDir } = createTestDatabase();

  try {
    const fixturePath = join(tempDir, 'sample-newsletter.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        message: {
          id: 'fixture-1',
          subject: 'Fixture newsletter',
          payload: {
            mimeType: 'text/plain',
            body: {
              data: Buffer.from('Fixture body', 'utf8').toString('base64url'),
            },
          },
        },
        extraction: {
          sourceName: 'Fixture Source',
          summary: 'Fixture summary',
          artists: [],
          albums: [],
          tracks: [],
          genres: [],
          links: [],
          releases: [],
          events: [],
        },
      }),
      'utf8'
    );

    const fixture = readSampleFixture(fixturePath);
    assert.equal(fixture.message.id, 'fixture-1');
    assert.equal(fixture.extraction.summary, 'Fixture summary');
  } finally {
    cleanup();
  }
});
