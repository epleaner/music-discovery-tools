import { mkdtempSync, rmSync } from 'node:fs';
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
  decodeGmailBodyData,
  normalizeGmailMessagePayload,
  type GmailMessagePayload,
} from './normalize-email.js';

function encodeGmailBodyData(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function createPayload(input: Partial<GmailMessagePayload>): GmailMessagePayload {
  return {
    mimeType: 'text/plain',
    headers: [],
    body: {},
    parts: [],
    ...input,
  };
}

function createTestDatabase() {
  const tempDir = mkdtempSync(join(tmpdir(), 'soundscape-normalize-email-'));
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

test('decodeGmailBodyData decodes base64url payloads', () => {
  assert.equal(decodeGmailBodyData(encodeGmailBodyData('hello world')), 'hello world');
  assert.equal(decodeGmailBodyData(''), null);
  assert.equal(decodeGmailBodyData(undefined), null);
});

test('normalizeGmailMessagePayload extracts deterministic text from html-only emails', () => {
  const payload = createPayload({
    mimeType: 'text/html',
    body: {
      data: encodeGmailBodyData(`
        <html>
          <head><title>ignore me</title><style>.x { color: red; }</style></head>
          <body>
            <h1>Fresh Finds</h1>
            <p>The new album <strong>Moon Safari</strong> is out now.</p>
            <div>Listen here<br>https://example.com/listen</div>
            <script>window.alert('ignore me')</script>
          </body>
        </html>
      `),
    },
  });

  const normalized = normalizeGmailMessagePayload(payload);

  assert.match(normalized.rawHtml ?? '', /Moon Safari/);
  assert.equal(normalized.rawText, null);
  assert.equal(
    normalized.cleanedText,
    'Fresh Finds\nThe new album Moon Safari is out now.\nListen here\nhttps://example.com/listen'
  );
});

test('normalizeGmailMessagePayload preserves text-only emails', () => {
  const payload = createPayload({
    mimeType: 'text/plain',
    body: {
      data: encodeGmailBodyData('Line one\n\nLine two\twith extra spacing  '),
    },
  });

  const normalized = normalizeGmailMessagePayload(payload);

  assert.equal(normalized.rawHtml, null);
  assert.equal(normalized.rawText, 'Line one\n\nLine two\twith extra spacing  ');
  assert.equal(normalized.cleanedText, 'Line one\nLine two with extra spacing');
});

test('normalizeGmailMessagePayload prefers multipart html while keeping raw text', () => {
  const payload = createPayload({
    mimeType: 'multipart/alternative',
    parts: [
      {
        mimeType: 'text/plain',
        body: {
          data: encodeGmailBodyData('Text fallback with less detail'),
        },
      },
      {
        mimeType: 'text/html',
        body: {
          data: encodeGmailBodyData(
            '<div><p>Curated Picks</p><p>Broadcast - Tender Buttons</p></div>'
          ),
        },
      },
    ],
  });

  const normalized = normalizeGmailMessagePayload(payload);

  assert.equal(normalized.rawText, 'Text fallback with less detail');
  assert.match(normalized.rawHtml ?? '', /Broadcast/);
  assert.equal(normalized.cleanedText, 'Curated Picks\nBroadcast - Tender Buttons');
});

test('normalizeGmailMessagePayload handles missing bodies gracefully', () => {
  const payload = createPayload({
    mimeType: 'multipart/mixed',
    parts: [{ mimeType: 'application/pdf', filename: 'newsletter.pdf', body: {} }],
  });

  const normalized = normalizeGmailMessagePayload(payload);

  assert.deepEqual(normalized, {
    rawHtml: null,
    rawText: null,
    cleanedText: null,
  });
});

test('persistRawGmailMessage stores normalized raw and cleaned bodies', () => {
  const { db, cleanup } = createTestDatabase();

  try {
    const payload = createPayload({
      mimeType: 'multipart/alternative',
      parts: [
        {
          mimeType: 'text/plain',
          body: {
            data: encodeGmailBodyData('Plain summary'),
          },
        },
        {
          mimeType: 'text/html',
          body: {
            data: encodeGmailBodyData('<p>Plain <strong>summary</strong></p>'),
          },
        },
      ],
    });

    const normalized = normalizeGmailMessagePayload(payload);

    persistRawGmailMessage(db, {
      id: 'gmail-normalized-1',
      subject: 'Normalized body',
      senderEmail: 'news@example.com',
      ...normalized,
    });

    const row = getNewsletterMessageByGmailMessageId(db, 'gmail-normalized-1');
    assert.ok(row);
    assert.match(row.rawHtml ?? '', /<strong>summary<\/strong>/);
    assert.equal(row.rawText, 'Plain summary');
    assert.equal(row.cleanedText, 'Plain summary');
  } finally {
    cleanup();
  }
});
