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
  createPiNewsletterLlmClient,
  extractAndPersistNewsletterMessage,
  normalizePiExtractionShape,
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

test('createPiNewsletterLlmClient shells out through pi --print with the configured model', async () => {
  const invocations: Array<{ command: string; args: string[] }> = [];
  const client = createPiNewsletterLlmClient(
    { model: 'gpt-5.4-medium' },
    async (command, args) => {
      invocations.push({ command, args });
      return {
        stdout: JSON.stringify({
          sourceName: 'Pi Source',
          summary: 'Pi summary',
          artists: [],
          albums: [],
          tracks: [],
          genres: [],
          links: [],
          releases: [],
          events: [],
        }),
        stderr: '',
        exitCode: 0,
      };
    }
  );

  const extraction = await client.extract({
    sourceName: 'Pi Source',
    subject: 'Pi subject',
    cleanedText: 'Pi body',
  });

  assert.equal(client.modelName, 'gpt-5.4-medium');
  assert.deepEqual(extraction, {
    sourceName: 'Pi Source',
    summary: 'Pi summary',
    artists: [],
    albums: [],
    tracks: [],
    genres: [],
    links: [],
    releases: [],
    events: [],
  });
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0]?.command, 'pi');
  assert.deepEqual(invocations[0]?.args.slice(0, 8), [
    '--provider',
    'openai',
    '--model',
    'gpt-5.4-medium',
    '--print',
    '--no-session',
    '--no-tools',
    '--mode',
  ]);
  assert.equal(invocations[0]?.args[8], 'text');
  assert.match(invocations[0]?.args.at(-1) ?? '', /Return strict JSON only/);
});

test('createPiNewsletterLlmClient extracts the first JSON object from noisy pi output', async () => {
  const client = createPiNewsletterLlmClient(
    { model: 'gpt-5.4-medium' },
    async () => ({
      stdout: `${JSON.stringify({
        sourceName: 'Noisy Source',
        summary: 'Noisy summary',
        artists: [],
        albums: [],
        tracks: [],
        genres: [],
        links: [],
        releases: [],
        events: [],
      })}\n\u001b]9;Strict JSON Response Only\u0007`,
      stderr: '',
      exitCode: 0,
    })
  );

  const extraction = await client.extract({
    sourceName: 'Noisy Source',
    subject: 'Noisy subject',
    cleanedText: 'Noisy body',
  });

  assert.equal((extraction as { summary: string }).summary, 'Noisy summary');
});

test('normalizePiExtractionShape maps album and track title/artist fields to schema keys', () => {
  const normalized = normalizePiExtractionShape({
    sourceName: 'Schema Drift Source',
    summary: 'Schema Drift summary',
    artists: [{ name: 'Artist Only', confidence: 0.91, evidence: 'artist evidence' }],
    albums: [
      {
        title: 'Album With Drifted Keys',
        artist: 'Album Artist',
        confidence: 0.89,
        evidence: 'album evidence',
      },
    ],
    tracks: [
      {
        title: 'Track With Drifted Keys',
        artist: 'Track Artist',
        confidence: 0.87,
        evidence: 'track evidence',
      },
    ],
    genres: [],
    links: [],
    releases: [],
    events: [],
  });

  assert.deepEqual(normalized, {
    sourceName: 'Schema Drift Source',
    summary: 'Schema Drift summary',
    artists: [{ name: 'Artist Only', confidence: 0.91, evidence: 'artist evidence' }],
    albums: [
      {
        name: 'Album With Drifted Keys',
        primaryArtistName: 'Album Artist',
        confidence: 0.89,
        evidence: 'album evidence',
      },
    ],
    tracks: [
      {
        name: 'Track With Drifted Keys',
        primaryArtistName: 'Track Artist',
        confidence: 0.87,
        evidence: 'track evidence',
      },
    ],
    genres: [],
    links: [],
    releases: [],
    events: [],
  });
});

test('extractAndPersistNewsletterMessage accepts pi output with album title/artist schema drift', async () => {
  const { db, cleanup } = createTestDatabase();

  const client: NewsletterLlmClient = {
    modelName: 'test-model',
    async extract() {
      return {
        sourceName: 'Schema Drift Source',
        summary: 'Schema Drift summary',
        artists: [{ name: 'Artist Only', confidence: 0.91, evidence: 'artist evidence' }],
        albums: [
          {
            title: 'Album With Drifted Keys',
            artist: 'Album Artist',
            confidence: 0.89,
            evidence: 'album evidence',
          },
        ],
        tracks: [
          {
            title: 'Track With Drifted Keys',
            artist: 'Track Artist',
            confidence: 0.87,
            evidence: 'track evidence',
          },
        ],
        genres: [],
        links: [],
        releases: [],
        events: [],
      };
    },
  };

  try {
    const persisted = persistRawGmailMessage(db, {
      id: 'gmail-llm-schema-drift',
      subject: 'Schema drift extraction',
      senderEmail: 'news@pitchfork.com',
      rawText: 'Original message body',
      cleanedText: 'Original message body',
    });

    const result = await extractAndPersistNewsletterMessage({
      db,
      newsletterMessageId: persisted.newsletterMessageId,
      message: {
        id: 'gmail-llm-schema-drift',
        subject: 'Schema drift extraction',
        cleanedText: 'Original message body',
      },
      llmClient: client,
      entityConfidenceThreshold: 0.8,
    });

    assert.equal(result.normalizedCounts.albums, 1);
    assert.equal(result.normalizedCounts.tracks, 1);

    const extractionJson = getNewsletterMessageByGmailMessageId(db, 'gmail-llm-schema-drift');
    assert.equal(extractionJson?.extractionStatus, 'extracted');

    const albumRow = db
      .prepare<[number], { title: string; primary_artist_name: string | null }>(
        `SELECT albums.title, albums.primary_artist_name
         FROM newsletter_message_albums
         JOIN albums ON albums.id = newsletter_message_albums.album_id
         WHERE newsletter_message_albums.newsletter_message_id = ?`
      )
      .get(persisted.newsletterMessageId);
    const trackRow = db
      .prepare<[number], { title: string; primary_artist_name: string | null }>(
        `SELECT tracks.title, tracks.primary_artist_name
         FROM newsletter_message_tracks
         JOIN tracks ON tracks.id = newsletter_message_tracks.track_id
         WHERE newsletter_message_tracks.newsletter_message_id = ?`
      )
      .get(persisted.newsletterMessageId);

    assert.deepEqual(albumRow, {
      title: 'Album With Drifted Keys',
      primary_artist_name: 'Album Artist',
    });
    assert.deepEqual(trackRow, {
      title: 'Track With Drifted Keys',
      primary_artist_name: 'Track Artist',
    });
  } finally {
    cleanup();
  }
});

test('createPiNewsletterLlmClient retries once before failing', async () => {
  let attempts = 0;
  const logs: string[] = [];
  const client = createPiNewsletterLlmClient(
    {
      model: 'gpt-5.4-medium',
      logger: (line) => logs.push(line),
      verbose: true,
    },
    async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error('transient pi failure');
      }

      return {
        stdout: JSON.stringify({
          sourceName: 'Retry Source',
          summary: 'Recovered',
          artists: [],
          albums: [],
          tracks: [],
          genres: [],
          links: [],
          releases: [],
          events: [],
        }),
        stderr: '',
        exitCode: 0,
      };
    }
  );

  const extraction = await client.extract({
    sourceName: 'Retry Source',
    subject: 'Retry subject',
    cleanedText: 'Retry body',
  });

  assert.equal(attempts, 2);
  assert.equal((extraction as { summary: string }).summary, 'Recovered');
  assert.ok(logs.some((line) => line.includes('event=pi_extract.attempt attempt=1')));
  assert.ok(logs.some((line) => line.includes('event=pi_extract.retry attempt=1')));
  assert.ok(logs.some((line) => line.includes('event=pi_extract.attempt attempt=2')));
  assert.ok(logs.some((line) => line.includes('event=pi_extract.succeeded attempt=2')));
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
