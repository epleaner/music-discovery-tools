import assert from 'node:assert/strict';
import test from 'node:test';
import { hashToken } from '@soundscape/scrapes-db';
import type {
  CreateQueuedScrapeArgs,
  ScrapesDb,
  ScrapeRow,
} from '@soundscape/scrapes-db';
import type { ScrapeData } from '@soundscape/types';
import { appRouter } from './router.js';
import type { Context } from './context.js';

function makeRow(overrides: Partial<ScrapeRow> = {}): ScrapeRow {
  return {
    id: 'test-id',
    token_hash: 'hash',
    source: 'rym',
    url: 'https://rateyourmusic.com/album/foo',
    target_url: 'https://rateyourmusic.com/album/foo',
    mode: null,
    query: null,
    force: false,
    status: 'queued',
    attempts: 0,
    lease_owner: null,
    lease_until: null,
    idempotency_key: null,
    expires_at: new Date('2026-12-01T00:00:00Z'),
    data: null,
    error: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    fetched_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeScrapesDb(
  rows: ScrapeRow[] = [],
  fresh: { data: ScrapeData; fetchedAt: Date } | null = null
): ScrapesDb {
  return {
    async init() {},
    async createQueued(input: CreateQueuedScrapeArgs) {
      const existing =
        input.idempotencyKey &&
        rows.find(
          (row) =>
            row.token_hash === input.tokenHash &&
            row.idempotency_key === input.idempotencyKey
        );
      if (existing) return { row: existing, created: false };
      const row = makeRow({
        id: input.id,
        token_hash: input.tokenHash,
        source: input.source,
        url: input.url,
        target_url: input.targetUrl ?? null,
        mode: input.mode ?? null,
        query: input.query ?? null,
        force: input.force ?? false,
        idempotency_key: input.idempotencyKey ?? null,
      });
      rows.push(row);
      return { row, created: true };
    },
    async markCached({ id, data, fetchedAt }) {
      const row = rows.find((item) => item.id === id);
      if (row)
        Object.assign(row, {
          status: 'done',
          data,
          fetched_at: fetchedAt ?? row.fetched_at,
        });
    },
    async claimNext() {
      return null;
    },
    async complete() {
      return false;
    },
    async fail() {
      return false;
    },
    async getFresh() {
      return fresh;
    },
    async getById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async listByToken({ tokenHash, source, limit }) {
      return rows
        .filter(
          (row) =>
            row.token_hash === tokenHash && (!source || row.source === source)
        )
        .slice(0, limit);
    },
    async close() {},
  };
}

test('scrape.createJob queues offline without requiring an agent', async () => {
  const rows: ScrapeRow[] = [];
  let notified = '';
  const caller = appRouter.createCaller({
    scrapesDb: makeScrapesDb(rows),
    onScrapeJobCreated: (tokenHash) => {
      notified = tokenHash;
    },
  } satisfies Context);
  const result = await caller.scrape.createJob({
    token: 'my-token',
    source: 'rym',
    url: 'https://rateyourmusic.com/album/foo',
    idempotencyKey: 'job-1',
  });
  assert.equal(result.status, 'queued');
  assert.equal(result.requestId, rows[0]?.id);
  assert.equal(notified, hashToken('my-token'));
});

test('scrape.createJob turns a fresh cache hit into a terminal job', async () => {
  const rows: ScrapeRow[] = [];
  const fetchedAt = new Date('2026-09-15T00:00:00Z');
  const data: ScrapeData = { kind: 'rym', entries: [] };
  let notified = false;
  const caller = appRouter.createCaller({
    scrapesDb: makeScrapesDb(rows, { data, fetchedAt }),
    onScrapeJobCreated: () => {
      notified = true;
    },
  } satisfies Context);
  const result = await caller.scrape.createJob({
    token: 'my-token',
    source: 'rym',
    url: 'https://rateyourmusic.com/album/foo',
  });
  assert.equal(result.status, 'done');
  assert.deepEqual(result.data, data);
  assert.deepEqual(result.fetchedAt, fetchedAt);
  assert.equal(notified, false);
});

test('scrape.createJob rejects an unapproved URL', async () => {
  const caller = appRouter.createCaller({
    scrapesDb: makeScrapesDb(),
  } satisfies Context);
  await assert.rejects(
    caller.scrape.createJob({
      token: 'token',
      source: 'rym',
      url: 'https://evil.example/scrape',
    }),
    /URL is not allowed/
  );
});

test('scrape.createJob returns the same job for a repeated idempotency key', async () => {
  const rows: ScrapeRow[] = [];
  const caller = appRouter.createCaller({
    scrapesDb: makeScrapesDb(rows),
  } satisfies Context);
  const input = {
    token: 'token',
    source: 'rym' as const,
    url: 'https://rateyourmusic.com/album/foo',
    idempotencyKey: 'same',
  };
  const first = await caller.scrape.createJob(input);
  const second = await caller.scrape.createJob(input);
  assert.equal(second.requestId, first.requestId);
  assert.equal(rows.length, 1);
});

test('scrape.getJob authorizes the pairing token', async () => {
  const token = 'token-alpha';
  const row = makeRow({
    id: 'req-1',
    token_hash: hashToken(token),
    status: 'done',
    data: { kind: 'rym', entries: [] },
  });
  const caller = appRouter.createCaller({
    scrapesDb: makeScrapesDb([row]),
  } satisfies Context);
  const result = await caller.scrape.getJob({ token, requestId: 'req-1' });
  assert.equal(result?.status, 'done');
  assert.deepEqual(result?.data, { kind: 'rym', entries: [] });
  assert.equal(
    await caller.scrape.getJob({ token: 'wrong-token', requestId: 'req-1' }),
    null
  );
});

test('scrape.getJob returns null without persistence or for unknown IDs', async () => {
  const noDb = appRouter.createCaller({} satisfies Context);
  assert.equal(
    await noDb.scrape.getJob({ token: 'token', requestId: 'anything' }),
    null
  );
  const caller = appRouter.createCaller({
    scrapesDb: makeScrapesDb(),
  } satisfies Context);
  assert.equal(
    await caller.scrape.getJob({ token: 'token', requestId: 'unknown' }),
    null
  );
});

test('scrape.listScrapes hashes the token and maps rows', async () => {
  const token = 'my-token';
  const row = makeRow({
    id: 'r1',
    token_hash: hashToken(token),
    created_at: new Date('2026-06-01T12:00:00Z'),
  });
  const caller = appRouter.createCaller({
    scrapesDb: makeScrapesDb([row]),
  } satisfies Context);
  const result = await caller.scrape.listScrapes({ token });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.requestId, 'r1');
  assert.deepEqual(result[0]?.createdAt, row.created_at);
});
