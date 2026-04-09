import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppState,
  getSyncRunById,
  openInitializedNewsletterDatabase,
} from '@soundscape/newsletters-db';
import {
  formatVerboseError,
  parseCliOptions,
  resetNewsletterDatabase,
  runLiveNewsletterSync,
  runRetryFailedNewsletterExtractions,
} from './index.js';
import { persistRawGmailMessage, type GmailApiClient } from './gmail.js';
import { getPersistedExtractionJson } from './llm.js';
import { startSyncRun } from './sync-state.js';

function createTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), 'soundscape-live-sync-'));
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

test('parseCliOptions accepts explicit sync mode flags', () => {
  assert.deepEqual(parseCliOptions(['--sync-now']), {
    dryRun: false,
    syncNow: true,
    retryFailed: false,
    verbose: false,
    fromScratch: false,
    samplePath: undefined,
  });
  assert.deepEqual(parseCliOptions(['--dry-run']), {
    dryRun: true,
    syncNow: false,
    retryFailed: false,
    verbose: false,
    fromScratch: false,
    samplePath: undefined,
  });
  assert.deepEqual(parseCliOptions(['--sample', 'fixture.json']), {
    dryRun: false,
    syncNow: false,
    retryFailed: false,
    verbose: false,
    fromScratch: false,
    samplePath: 'fixture.json',
  });
  assert.deepEqual(parseCliOptions(['--sync-now', '--verbose']), {
    dryRun: false,
    syncNow: true,
    retryFailed: false,
    verbose: true,
    fromScratch: false,
    samplePath: undefined,
  });
  assert.deepEqual(
    parseCliOptions(['--sync-now', '--verbose', '--from-scratch']),
    {
      dryRun: false,
      syncNow: true,
      retryFailed: false,
      verbose: true,
      fromScratch: true,
      samplePath: undefined,
    }
  );
  assert.deepEqual(parseCliOptions(['--retry-failed', '--verbose']), {
    dryRun: false,
    syncNow: false,
    retryFailed: true,
    verbose: true,
    fromScratch: false,
    samplePath: undefined,
  });
  assert.throws(
    () => parseCliOptions(['--sync-now', '--dry-run']),
    /either --sync-now or --dry-run/
  );
  assert.throws(
    () => parseCliOptions(['--sync-now', '--sample', 'fixture.json']),
    /either --sync-now or --sample/
  );
  assert.throws(
    () => parseCliOptions(['--retry-failed', '--sync-now']),
    /--retry-failed cannot be combined with --sync-now/
  );
  assert.throws(
    () => parseCliOptions(['--retry-failed', '--dry-run']),
    /--retry-failed cannot be combined with --dry-run/
  );
  assert.throws(
    () => parseCliOptions(['--retry-failed', '--sample', 'fixture.json']),
    /--retry-failed cannot be combined with --sample/
  );
  assert.throws(
    () => parseCliOptions(['--retry-failed', '--from-scratch']),
    /--retry-failed cannot be combined with --from-scratch/
  );
});

test('runRetryFailedNewsletterExtractions retries only failed messages without advancing the cursor', async () => {
  const { db, cleanup } = createTestDatabase();

  try {
    persistRawGmailMessage(db, {
      id: 'gmail-retry-failed',
      subject: 'Retry me',
      senderName: 'Retry Sender',
      senderEmail: 'retry@example.com',
      sentAt: '2026-04-08T12:10:00.000Z',
      rawText: 'Retry Artist',
      cleanedText: 'Retry Artist',
    });
    persistRawGmailMessage(db, {
      id: 'gmail-retry-pending',
      subject: 'Leave me pending',
      senderName: 'Pending Sender',
      senderEmail: 'pending@example.com',
      sentAt: '2026-04-08T12:11:00.000Z',
      rawText: 'Pending Artist',
      cleanedText: 'Pending Artist',
    });

    db.prepare(
      'UPDATE newsletter_messages SET extraction_status = ? WHERE gmail_message_id = ?'
    ).run('failed', 'gmail-retry-failed');
    db.prepare(
      'UPDATE newsletter_messages SET extraction_status = ? WHERE gmail_message_id = ?'
    ).run('pending', 'gmail-retry-pending');
    db.prepare('INSERT INTO app_state (key, value) VALUES (?, ?)').run(
      'newsletters.lastSuccessfulSyncAt',
      '2026-04-08T12:11:00.000Z'
    );

    const syncRunId = startSyncRun(db, '2026-04-09T09:00:00.000Z');
    const extractedMessageIds: string[] = [];
    const result = await runRetryFailedNewsletterExtractions({
      db,
      config: {
        gmailLabel: 'music',
        dbPath: undefined,
        entityConfidenceThreshold: 0.8,
        gmail: {
          clientId: 'unused',
          clientSecret: 'unused',
          refreshToken: 'unused',
          redirectUri: 'unused',
        },
        llm: {
          model: 'gpt-5.4-medium',
        },
      },
      llmClient: {
        modelName: 'test-retry-model',
        async extract(input) {
          extractedMessageIds.push(input.subject ?? 'unknown');
          return {
            sourceName: input.sourceName ?? 'Retry Sender',
            summary: 'Retried summary',
            artists: [
              {
                name: 'Retry Artist',
                confidence: 0.95,
                evidence: 'Retry Artist',
              },
            ],
            albums: [],
            tracks: [],
            genres: [],
            links: [],
            releases: [],
            events: [],
          };
        },
      },
      syncRunId,
    });

    const failedRow = db
      .prepare<
        [string],
        { extraction_status: string; id: number }
      >('SELECT extraction_status, id FROM newsletter_messages WHERE gmail_message_id = ?')
      .get('gmail-retry-failed');
    const pendingRow = db
      .prepare<
        [string],
        { extraction_status: string }
      >('SELECT extraction_status FROM newsletter_messages WHERE gmail_message_id = ?')
      .get('gmail-retry-pending');
    const syncRun = getSyncRunById(db, syncRunId);

    assert.deepEqual(extractedMessageIds, ['Retry me']);
    assert.equal(result.messageCount, 1);
    assert.equal(result.extractionFailureCount, 0);
    assert.equal(result.syncRunStatus, 'succeeded');
    assert.equal(failedRow?.extraction_status, 'extracted');
    assert.equal(pendingRow?.extraction_status, 'pending');
    assert.match(
      getPersistedExtractionJson(db, failedRow!.id) ?? '',
      /Retry Artist/
    );
    assert.equal(
      getAppState(db, 'newsletters.lastSuccessfulSyncAt'),
      '2026-04-08T12:11:00.000Z'
    );
    assert.equal(syncRun?.status, 'succeeded');
    assert.equal(syncRun?.newestMessageTimestamp, null);
  } finally {
    cleanup();
  }
});

test('runRetryFailedNewsletterExtractions emits readable verbose progress logs', async () => {
  const { db, cleanup } = createTestDatabase();
  const logs: string[] = [];

  try {
    persistRawGmailMessage(db, {
      id: 'gmail-retry-verbose-1',
      subject: 'Verbose retry',
      senderName: 'Verbose Retry Sender',
      senderEmail: 'retry-verbose@example.com',
      sentAt: '2026-04-08T12:12:00.000Z',
      rawText: 'Verbose Retry Artist',
      cleanedText: 'Verbose Retry Artist',
    });

    db.prepare(
      'UPDATE newsletter_messages SET extraction_status = ? WHERE gmail_message_id = ?'
    ).run('failed', 'gmail-retry-verbose-1');

    const syncRunId = startSyncRun(db, '2026-04-09T09:10:00.000Z');

    await runRetryFailedNewsletterExtractions({
      db,
      config: {
        gmailLabel: 'music',
        dbPath: undefined,
        entityConfidenceThreshold: 0.8,
        gmail: {},
        llm: {
          model: 'gpt-5.4-medium',
        },
      },
      llmClient: {
        modelName: 'test-retry-model',
        async extract() {
          return {
            sourceName: 'Verbose Retry Sender',
            summary: 'Retried summary',
            artists: [
              {
                name: 'Verbose Retry Artist',
                confidence: 0.95,
                evidence: 'Verbose Retry Artist',
              },
            ],
            albums: [],
            tracks: [],
            genres: [],
            links: [],
            releases: [],
            events: [],
          };
        },
      },
      syncRunId,
      verbose: true,
      logger: (line) => logs.push(line),
    });

    assert.ok(
      logs.some((line) =>
        line.includes('Retrying failed newsletter extractions')
      )
    );
    assert.ok(
      logs.some((line) =>
        line.includes('[1/1] Verbose Retry Sender — Verbose retry')
      )
    );
    assert.ok(logs.some((line) => line.includes('Starting extraction')));
    assert.ok(logs.some((line) => line.includes('Extraction saved')));
    assert.ok(logs.some((line) => line.includes('Retry run complete')));
  } finally {
    cleanup();
  }
});

test('resetNewsletterDatabase removes sqlite db and sidecar files', () => {
  const { cleanup } = createTestDatabase();
  const tempDir = mkdtempSync(join(tmpdir(), 'soundscape-reset-db-'));
  const dbPath = join(tempDir, 'newsletters.sqlite');
  writeFileSync(dbPath, 'placeholder', 'utf8');
  writeFileSync(`${dbPath}-wal`, 'wal', 'utf8');
  writeFileSync(`${dbPath}-shm`, 'shm', 'utf8');

  try {
    assert.equal(existsSync(dbPath), true);
    assert.equal(existsSync(`${dbPath}-wal`), true);
    assert.equal(existsSync(`${dbPath}-shm`), true);
    resetNewsletterDatabase(dbPath);
    assert.equal(existsSync(dbPath), false);
    assert.equal(existsSync(`${dbPath}-wal`), false);
    assert.equal(existsSync(`${dbPath}-shm`), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    cleanup();
  }
});

test('formatVerboseError collapses issue arrays into a single readable line', () => {
  assert.equal(
    formatVerboseError({
      issues: [
        {
          path: ['links', 0, 'url'],
          message: 'Invalid url',
        },
        {
          path: [],
          message: 'Expected object, received array',
        },
      ],
    }),
    'links.0.url: Invalid url; Expected object, received array'
  );
});

test('runLiveNewsletterSync emits readable verbose progress logs', async () => {
  const { db, cleanup } = createTestDatabase();
  const logs: string[] = [];

  try {
    const gmailClient: GmailApiClient = {
      async resolveLabelByName(labelName) {
        return { id: 'Label_music', name: labelName };
      },
      async listMessageRefs() {
        return [{ id: 'gmail-live-verbose-1' }];
      },
      async getMessage() {
        return {
          id: 'gmail-live-verbose-1',
          threadId: 'thread-live-verbose-1',
          internalDate: '1775650200000',
          payload: {
            headers: [
              { name: 'Subject', value: 'Verbose picks' },
              { name: 'From', value: 'Verbose Sender <verbose@example.com>' },
              { name: 'Date', value: 'Tue, 08 Apr 2026 12:10:00 +0000' },
            ],
            parts: [
              {
                mimeType: 'text/plain',
                body: {
                  data: Buffer.from('Verbose Artist', 'utf8').toString(
                    'base64url'
                  ),
                },
              },
            ],
          },
        };
      },
    };

    const llmClient = {
      modelName: 'test-live-model',
      async extract() {
        return {
          sourceName: 'Verbose Sender',
          summary: 'Verbose summary',
          artists: [
            {
              name: 'Verbose Artist',
              confidence: 0.95,
              evidence: 'Verbose Artist',
            },
          ],
          albums: [],
          tracks: [],
          genres: [],
          links: [],
          releases: [],
          events: [],
        };
      },
    };

    const syncRunId = startSyncRun(db, '2026-04-08T12:15:00.000Z');

    await runLiveNewsletterSync({
      db,
      config: {
        gmailLabel: 'music',
        dbPath: undefined,
        entityConfidenceThreshold: 0.8,
        gmail: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          refreshToken: 'refresh-token',
          redirectUri: 'http://localhost/callback',
        },
        llm: {
          model: 'gpt-5.4-medium',
        },
      },
      gmailClient,
      llmClient,
      syncRunId,
      lastSuccessfulSyncAt: null,
      verbose: true,
      logger: (line) => logs.push(line),
    });

    assert.ok(logs.some((line) => line.includes('Starting Gmail sync')));
    assert.ok(logs.some((line) => line.includes('Found Gmail messages')));
    assert.ok(
      logs.some((line) => line.includes('[1/1] Verbose Sender — Verbose picks'))
    );
    assert.ok(logs.some((line) => line.includes('Saved raw newsletter as #1')));
    assert.ok(logs.some((line) => line.includes('Extraction saved')));
    assert.ok(logs.some((line) => line.includes('Sync complete')));
  } finally {
    cleanup();
  }
});

test('runLiveNewsletterSync does not advance the cursor when extraction fails', async () => {
  const { db, cleanup } = createTestDatabase();

  try {
    const gmailClient: GmailApiClient = {
      async resolveLabelByName(labelName) {
        return { id: 'Label_music', name: labelName };
      },
      async listMessageRefs() {
        return [{ id: 'gmail-live-fail-1' }];
      },
      async getMessage() {
        return {
          id: 'gmail-live-fail-1',
          threadId: 'thread-live-fail-1',
          internalDate: '1775650200000',
          payload: {
            headers: [
              { name: 'Subject', value: 'Broken picks' },
              { name: 'From', value: 'Broken Sender <broken@example.com>' },
              { name: 'Date', value: 'Tue, 08 Apr 2026 12:10:00 +0000' },
            ],
            parts: [
              {
                mimeType: 'text/plain',
                body: {
                  data: Buffer.from('Broken Artist', 'utf8').toString(
                    'base64url'
                  ),
                },
              },
            ],
          },
        };
      },
    };

    const llmClient = {
      modelName: 'test-live-model',
      async extract() {
        throw new Error('pi parse failed');
      },
    };

    const syncRunId = startSyncRun(db, '2026-04-08T12:15:00.000Z');

    const result = await runLiveNewsletterSync({
      db,
      config: {
        gmailLabel: 'music',
        dbPath: undefined,
        entityConfidenceThreshold: 0.8,
        gmail: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          refreshToken: 'refresh-token',
          redirectUri: 'http://localhost/callback',
        },
        llm: {
          model: 'gpt-5.4-medium',
        },
      },
      gmailClient,
      llmClient,
      syncRunId,
      lastSuccessfulSyncAt: null,
    });

    const syncRun = getSyncRunById(db, syncRunId);
    assert.equal(result.extractionFailureCount, 1);
    assert.equal(result.syncRunStatus, 'failed');
    assert.equal(getAppState(db, 'newsletters.lastSuccessfulSyncAt'), null);
    assert.equal(syncRun?.status, 'failed');
    assert.match(syncRun?.errorText ?? '', /failed extraction/);
  } finally {
    cleanup();
  }
});

test('runLiveNewsletterSync persists live Gmail messages, extractions, and the successful cursor', async () => {
  const { db, cleanup } = createTestDatabase();

  try {
    const gmailClient: GmailApiClient = {
      async resolveLabelByName(labelName) {
        return { id: 'Label_music', name: labelName };
      },
      async listMessageRefs() {
        return [{ id: 'gmail-live-1' }];
      },
      async getMessage() {
        return {
          id: 'gmail-live-1',
          threadId: 'thread-live-1',
          internalDate: '1775650200000',
          payload: {
            headers: [
              { name: 'Subject', value: 'Live picks' },
              { name: 'From', value: 'Test Sender <sender@example.com>' },
              { name: 'Date', value: 'Tue, 08 Apr 2026 12:10:00 +0000' },
            ],
            parts: [
              {
                mimeType: 'text/plain',
                body: {
                  data: Buffer.from(
                    'Artist Alpha\nAlbum Beta\nTrack Gamma',
                    'utf8'
                  ).toString('base64url'),
                },
              },
            ],
          },
        };
      },
    };

    const llmClient = {
      modelName: 'test-live-model',
      async extract() {
        return {
          sourceName: 'Test Sender',
          summary: 'A concise summary',
          artists: [
            {
              name: 'Artist Alpha',
              confidence: 0.95,
              evidence: 'Artist Alpha',
            },
          ],
          albums: [
            {
              name: 'Album Beta',
              primaryArtistName: 'Artist Alpha',
              confidence: 0.93,
              evidence: 'Album Beta',
            },
          ],
          tracks: [
            {
              name: 'Track Gamma',
              primaryArtistName: 'Artist Alpha',
              confidence: 0.91,
              evidence: 'Track Gamma',
            },
          ],
          genres: [],
          links: [
            {
              url: 'https://example.com/listen',
              domain: 'example.com',
              title: 'Listen',
              confidence: 0.88,
            },
          ],
          releases: [],
          events: [],
        };
      },
    };

    const syncRunId = startSyncRun(db, '2026-04-08T12:15:00.000Z');

    const result = await runLiveNewsletterSync({
      db,
      config: {
        gmailLabel: 'music',
        dbPath: undefined,
        entityConfidenceThreshold: 0.8,
        gmail: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          refreshToken: 'refresh-token',
          redirectUri: 'http://localhost/callback',
        },
        llm: {
          model: 'gpt-5.4-medium',
        },
      },
      gmailClient,
      llmClient,
      syncRunId,
      lastSuccessfulSyncAt: null,
    });

    const row = db
      .prepare<
        [string],
        { id: number; extraction_status: string; cleaned_text: string | null }
      >('SELECT id, extraction_status, cleaned_text FROM newsletter_messages WHERE gmail_message_id = ?')
      .get('gmail-live-1');

    assert.equal(result.messageCount, 1);
    assert.equal(result.extractionFailureCount, 0);
    assert.equal(result.syncRunStatus, 'succeeded');
    assert.equal(result.resolvedLabelId, 'Label_music');
    assert.equal(row?.extraction_status, 'extracted');
    assert.equal(row?.cleaned_text, 'Artist Alpha\nAlbum Beta\nTrack Gamma');
    assert.equal(
      getAppState(db, 'newsletters.lastSuccessfulSyncAt'),
      '2026-04-08T12:10:00.000Z'
    );
    assert.match(getPersistedExtractionJson(db, row!.id) ?? '', /Artist Alpha/);
  } finally {
    cleanup();
  }
});
