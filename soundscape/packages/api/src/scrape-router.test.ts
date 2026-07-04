import assert from 'node:assert/strict';
import test from 'node:test';
import { hashToken } from '@soundscape/scrapes-db';
import type { ScrapesDb, ScrapeRow } from '@soundscape/scrapes-db';
import { appRouter } from './router.js';
import type { Context } from './context.js';
import type { NewsletterDatabase } from '@soundscape/newsletters-db';

// Minimal fake NewsletterDatabase — only used to satisfy Context typing
const fakeDb = {} as NewsletterDatabase;

function makeRow(overrides: Partial<ScrapeRow> = {}): ScrapeRow {
  return {
    id: 'test-id',
    token_hash: 'hash',
    source: 'rym',
    url: 'https://rateyourmusic.com/album/foo',
    status: 'done',
    data: null,
    error: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeScrapesDb(rows: ScrapeRow[]): ScrapesDb {
  return {
    async init() {},
    async createPending() {},
    async markDone() {},
    async markError() {},
    async getFresh() {
      return null;
    },
    async getById(id) {
      return rows.find(r => r.id === id) ?? null;
    },
    async listByToken({ tokenHash, source, limit }) {
      return rows
        .filter(r => r.token_hash === tokenHash && (source === undefined || r.source === source))
        .slice(0, limit);
    },
    async close() {},
  };
}

test('scrape.getResult returns null when scrapesDb is undefined', async () => {
  const caller = appRouter.createCaller({ db: fakeDb } satisfies Context);
  const result = await caller.scrape.getResult({ requestId: 'anything' });
  assert.equal(result, null);
});

test('scrape.getResult returns mapped row when present', async () => {
  const row = makeRow({ id: 'req-1', status: 'done', data: { type: 'rym' } as never, error: null });
  const scrapesDb = makeScrapesDb([row]);
  const caller = appRouter.createCaller({ db: fakeDb, scrapesDb } satisfies Context);
  const result = await caller.scrape.getResult({ requestId: 'req-1' });
  assert.ok(result !== null);
  assert.equal(result.status, 'done');
  assert.equal(result.source, 'rym');
  assert.equal(result.url, 'https://rateyourmusic.com/album/foo');
  assert.deepEqual(result.data, { type: 'rym' });
  assert.equal(result.error, null);
});

test('scrape.getResult returns null for unknown id', async () => {
  const scrapesDb = makeScrapesDb([makeRow({ id: 'req-1' })]);
  const caller = appRouter.createCaller({ db: fakeDb, scrapesDb } satisfies Context);
  const result = await caller.scrape.getResult({ requestId: 'unknown' });
  assert.equal(result, null);
});

test('scrape.listScrapes returns [] when scrapesDb is undefined', async () => {
  const caller = appRouter.createCaller({ db: fakeDb } satisfies Context);
  const result = await caller.scrape.listScrapes({ token: 'my-token' });
  assert.deepEqual(result, []);
});

test('scrape.listScrapes passes hashed token and returns only matching rows', async () => {
  const tokenA = 'token-alpha';
  const tokenB = 'token-beta';
  const hashA = hashToken(tokenA);
  const hashB = hashToken(tokenB);

  const rowA = makeRow({ id: 'id-a', token_hash: hashA, source: 'rym' });
  const rowB = makeRow({ id: 'id-b', token_hash: hashB, source: 'bandcamp' });
  const scrapesDb = makeScrapesDb([rowA, rowB]);

  const caller = appRouter.createCaller({ db: fakeDb, scrapesDb } satisfies Context);

  const resultA = await caller.scrape.listScrapes({ token: tokenA });
  assert.equal(resultA.length, 1);
  assert.equal(resultA[0]?.requestId, 'id-a');

  const resultB = await caller.scrape.listScrapes({ token: tokenB });
  assert.equal(resultB.length, 1);
  assert.equal(resultB[0]?.requestId, 'id-b');
});

test('scrape.listScrapes maps rows correctly including createdAt', async () => {
  const token = 'my-token';
  const tokenHash = hashToken(token);
  const createdAt = new Date('2026-06-01T12:00:00Z');
  const row = makeRow({ id: 'r1', token_hash: tokenHash, created_at: createdAt });
  const scrapesDb = makeScrapesDb([row]);

  const caller = appRouter.createCaller({ db: fakeDb, scrapesDb } satisfies Context);
  const result = await caller.scrape.listScrapes({ token });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.requestId, 'r1');
  assert.deepEqual(result[0]?.createdAt, createdAt);
});
