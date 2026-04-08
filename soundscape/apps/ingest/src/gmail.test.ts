import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSyncRunById,
  openInitializedNewsletterDatabase,
} from '@soundscape/newsletters-db';
import {
  buildGmailSearchQuery,
  getPersistedRawGmailMessage,
  persistRawGmailMessage,
} from './gmail.js';
import {
  finalizeSyncRun,
  readLastSuccessfulSyncCursor,
  startSyncRun,
} from './sync-state.js';

function createTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), 'soundscape-ingest-'));
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

test('empty sync state returns a null cursor and label-only Gmail query', () => {
  const { db, cleanup } = createTestDatabase();

  try {
    assert.equal(readLastSuccessfulSyncCursor(db), null);
    assert.equal(
      buildGmailSearchQuery({ label: 'music', lastSuccessfulSyncAt: null }),
      'label:music'
    );
  } finally {
    cleanup();
  }
});

test('successful sync updates the last successful cursor', () => {
  const { db, cleanup } = createTestDatabase();

  try {
    const syncRunId = startSyncRun(db, '2026-04-08T10:00:00.000Z');

    finalizeSyncRun(db, {
      syncRunId,
      status: 'succeeded',
      completedAt: '2026-04-08T10:05:00.000Z',
      messageCount: 2,
      newestMessageTimestamp: '2026-04-08T09:59:59.000Z',
    });

    assert.equal(
      readLastSuccessfulSyncCursor(db),
      '2026-04-08T09:59:59.000Z'
    );

    const syncRun = getSyncRunById(db, syncRunId);
    assert.equal(syncRun?.status, 'succeeded');
    assert.equal(syncRun?.messageCount, 2);
    assert.equal(
      buildGmailSearchQuery({
        label: 'music',
        lastSuccessfulSyncAt: '2026-04-08T09:59:59.000Z',
      }),
      'label:music after:1775642399'
    );
  } finally {
    cleanup();
  }
});

test('failed sync does not update the successful cursor', () => {
  const { db, cleanup } = createTestDatabase();

  try {
    const syncRunId = startSyncRun(db, '2026-04-08T11:00:00.000Z');

    finalizeSyncRun(db, {
      syncRunId,
      status: 'failed',
      completedAt: '2026-04-08T11:02:00.000Z',
      errorText: 'gmail unavailable',
      newestMessageTimestamp: '2026-04-08T10:59:00.000Z',
    });

    assert.equal(readLastSuccessfulSyncCursor(db), null);

    const syncRun = getSyncRunById(db, syncRunId);
    assert.equal(syncRun?.status, 'failed');
    assert.equal(syncRun?.errorText, 'gmail unavailable');
  } finally {
    cleanup();
  }
});

test('duplicate Gmail message ids upsert idempotently', () => {
  const { db, cleanup } = createTestDatabase();

  try {
    const first = persistRawGmailMessage(db, {
      id: 'gmail-123',
      threadId: 'thread-1',
      internalDate: '1712571000000',
      sentAt: '2026-04-08T12:10:00.000Z',
      subject: 'Fresh Friday picks',
      senderName: 'Pitchfork',
      senderEmail: 'newsletter@pitchfork.com',
      rawText: 'Original body',
      headers: [{ name: 'From', value: 'Pitchfork <newsletter@pitchfork.com>' }],
    });

    const second = persistRawGmailMessage(db, {
      id: 'gmail-123',
      threadId: 'thread-1',
      internalDate: '1712571000000',
      sentAt: '2026-04-08T12:10:00.000Z',
      subject: 'Fresh Friday picks',
      senderName: 'Pitchfork',
      senderEmail: 'newsletter@pitchfork.com',
      rawText: 'Updated body',
      cleanedText: 'Updated cleaned body',
      headers: [{ name: 'From', value: 'Pitchfork <newsletter@pitchfork.com>' }],
    });

    assert.equal(first.newsletterMessageId, second.newsletterMessageId);

    const row = getPersistedRawGmailMessage(db, 'gmail-123');
    assert.ok(row);
    assert.equal(row.id, first.newsletterMessageId);
    assert.equal(row.rawText, 'Updated body');
    assert.equal(row.cleanedText, 'Updated cleaned body');

    const countRow = db
      .prepare<[string], { count: number }>(
        'SELECT COUNT(*) as count FROM newsletter_messages WHERE gmail_message_id = ?'
      )
      .get('gmail-123');

    assert.equal(countRow?.count, 1);
  } finally {
    cleanup();
  }
});
