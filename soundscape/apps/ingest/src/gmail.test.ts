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
  buildGmailApiQuery,
  buildGmailSearchQuery,
  createGmailApiClient,
  fetchGmailSyncData,
  getPersistedRawGmailMessage,
  mapGmailApiMessageToNewsletterMessage,
  parseFromHeader,
  parseGmailTimestamp,
  persistRawGmailMessage,
  type GmailApiClient,
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
    assert.equal(
      buildGmailApiQuery({ label: 'music', lastSuccessfulSyncAt: null }),
      ''
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
    assert.equal(
      buildGmailApiQuery({
        label: 'music',
        lastSuccessfulSyncAt: '2026-04-08T09:59:59.000Z',
      }),
      'after:1775642399'
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

test('fetchGmailSyncData resolves the configured label and loads matching messages', async () => {
  const calls: string[] = [];
  const client: GmailApiClient = {
    async resolveLabelByName(labelName) {
      calls.push(`label:${labelName}`);
      return { id: 'Label_42', name: labelName };
    },
    async listMessageRefs(input) {
      calls.push(`list:${input.labelId}:${input.query}`);
      return [{ id: 'gmail-1' }, { id: 'gmail-2' }];
    },
    async getMessage(messageId) {
      calls.push(`get:${messageId}`);
      return {
        id: messageId,
        threadId: `thread-${messageId}`,
        internalDate: '1712571000000',
        payload: null,
      };
    },
  };

  const result = await fetchGmailSyncData(client, {
    label: 'music',
    lastSuccessfulSyncAt: '2026-04-08T09:59:59.000Z',
  });

  assert.equal(result.label.id, 'Label_42');
  assert.equal(result.query, 'after:1775642399');
  assert.deepEqual(
    result.messages.map((message) => message.id),
    ['gmail-1', 'gmail-2']
  );
  assert.deepEqual(calls, [
    'label:music',
    'list:Label_42:after:1775642399',
    'get:gmail-1',
    'get:gmail-2',
  ]);
});

test('createGmailApiClient resolves labels case-insensitively', async () => {
  const requests: Array<{ url: string; method?: string }> = [];
  const client = createGmailApiClient(
    {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
      redirectUri: 'https://developers.google.com/oauthplayground',
    },
    async (url, init) => {
      requests.push({ url: String(url), method: init?.method });

      if (String(url) === 'https://oauth2.googleapis.com/token') {
        return new Response(JSON.stringify({ access_token: 'token-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (String(url) === 'https://gmail.googleapis.com/gmail/v1/users/me/labels') {
        return new Response(
          JSON.stringify({
            labels: [
              { id: 'Label_1', name: 'INBOX' },
              { id: 'Label_2', name: 'Music' },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      throw new Error(`Unexpected URL: ${String(url)}`);
    }
  );

  const label = await client.resolveLabelByName('music');

  assert.deepEqual(label, { id: 'Label_2', name: 'Music' });
  assert.deepEqual(requests, [
    { url: 'https://oauth2.googleapis.com/token', method: 'POST' },
    { url: 'https://gmail.googleapis.com/gmail/v1/users/me/labels', method: undefined },
  ]);
});

test('mapGmailApiMessageToNewsletterMessage derives newsletter metadata from headers', () => {
  const mapped = mapGmailApiMessageToNewsletterMessage({
    id: 'gmail-555',
    threadId: 'thread-555',
    internalDate: '1712571000000',
    payload: {
      headers: [
        { name: 'Subject', value: 'Weekly discoveries' },
        { name: 'From', value: 'The Quietus <mail@quietus.com>' },
        { name: 'Date', value: 'Tue, 08 Apr 2026 12:10:00 +0000' },
      ],
    },
  });

  assert.deepEqual(mapped, {
    id: 'gmail-555',
    threadId: 'thread-555',
    internalDate: '1712571000000',
    sentAt: '2026-04-08T12:10:00.000Z',
    subject: 'Weekly discoveries',
    senderName: 'The Quietus',
    senderEmail: 'mail@quietus.com',
    sourceName: 'The Quietus',
    headers: [
      { name: 'Subject', value: 'Weekly discoveries' },
      { name: 'From', value: 'The Quietus <mail@quietus.com>' },
      { name: 'Date', value: 'Tue, 08 Apr 2026 12:10:00 +0000' },
    ],
  });
});

test('parseFromHeader and parseGmailTimestamp handle fallback inputs', () => {
  assert.deepEqual(parseFromHeader('newsletter@example.com'), {
    name: null,
    email: 'newsletter@example.com',
  });
  assert.deepEqual(parseFromHeader('"Aquarium Drunkard" <mail@aquariumdrunkard.com>'), {
    name: 'Aquarium Drunkard',
    email: 'mail@aquariumdrunkard.com',
  });
  assert.equal(
    parseGmailTimestamp(undefined, '1712571000000'),
    '2024-04-08T10:10:00.000Z'
  );
  assert.equal(parseGmailTimestamp('not-a-date', undefined), null);
});
