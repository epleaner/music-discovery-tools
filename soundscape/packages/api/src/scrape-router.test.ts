import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CreateQueuedScrapeArgs,
  ScrapesDb,
  ScrapeRow,
} from '@soundscape/scrapes-db';
import type { ScrapeData } from '@soundscape/types';
import { appRouter } from './router.js';
import type { Context, UserIdentity } from './context.js';

function makeRow(overrides: Partial<ScrapeRow> = {}): ScrapeRow {
  return {
    id: 'test-id',
    user_id: 'user-a',
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
    async createQueued(input: CreateQueuedScrapeArgs) {
      const existing =
        input.idempotencyKey &&
        rows.find(
          (row) =>
            row.user_id === input.userId &&
            row.idempotency_key === input.idempotencyKey
        );
      if (existing) return { row: existing, created: false };
      const row = makeRow({
        id: input.id,
        user_id: input.userId,
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
    async listByUser({ userId, source, limit }) {
      return rows
        .filter(
          (row) => row.user_id === userId && (!source || row.source === source)
        )
        .slice(0, limit);
    },
  };
}

const userA: UserIdentity = { id: 'user-a' };
const userB: UserIdentity = { id: 'user-b' };

function caller(
  scrapesDb: ScrapesDb,
  user: UserIdentity | null = userA,
  onScrapeJobCreated?: Context['onScrapeJobCreated']
) {
  return appRouter.createCaller({
    scrapesDb,
    user,
    onScrapeJobCreated,
  } satisfies Context);
}

test('scrape procedures require an authenticated user', async () => {
  const unauthenticated = appRouter.createCaller({
    scrapesDb: makeScrapesDb(),
    user: null,
  });
  await assert.rejects(
    unauthenticated.scrape.listScrapes({}),
    (error: unknown) => (error as { code?: string }).code === 'UNAUTHORIZED'
  );
});

test('scrape.createJob queues offline for the authenticated user', async () => {
  const rows: ScrapeRow[] = [];
  let notified = '';
  const result = await caller(makeScrapesDb(rows), userA, (ownerKey) => {
    notified = ownerKey;
  }).scrape.createJob({
    source: 'rym',
    url: 'https://rateyourmusic.com/album/foo',
    idempotencyKey: 'job-1',
  });
  assert.equal(result.status, 'queued');
  assert.equal(result.requestId, rows[0]?.id);
  assert.equal(notified.length, 64);
});

test('scrape.createJob turns a fresh cache hit into a terminal job', async () => {
  const rows: ScrapeRow[] = [];
  const fetchedAt = new Date('2026-09-15T00:00:00Z');
  const data: ScrapeData = { kind: 'rym', entries: [] };
  let notified = false;
  const result = await caller(
    makeScrapesDb(rows, { data, fetchedAt }),
    userA,
    () => {
      notified = true;
    }
  ).scrape.createJob({
    source: 'rym',
    url: 'https://rateyourmusic.com/album/foo',
  });
  assert.equal(result.status, 'done');
  assert.deepEqual(result.data, data);
  assert.deepEqual(result.fetchedAt, fetchedAt);
  assert.equal(notified, false);
});

test('scrape.createJob rejects an unapproved URL', async () => {
  await assert.rejects(
    caller(makeScrapesDb()).scrape.createJob({
      source: 'rym',
      url: 'https://evil.example/scrape',
    }),
    /URL is not allowed/
  );
});

test('scrape.createJob rejects removed Bandcamp jobs and obsolete modes', async () => {
  const rows: ScrapeRow[] = [];
  const scrape = caller(makeScrapesDb(rows)).scrape;
  await assert.rejects(
    scrape.createJob({ source: 'bandcamp', url: 'https://artist.bandcamp.com/album/y' } as never),
    /Invalid literal value/
  );
  await assert.rejects(
    scrape.createJob({ source: 'rym', url: 'https://rateyourmusic.com/', mode: 'resolve' } as never),
    /Unrecognized key/
  );
  assert.equal(rows.length, 0);
});

test('idempotency cannot reactivate a legacy source, but historical jobs remain readable', async () => {
  const legacy = makeRow({
    id: 'legacy',
    source: 'bandcamp',
    url: 'https://artist.bandcamp.com/album/archived',
    idempotency_key: 'old-key',
    status: 'done',
    data: { kind: 'bandcamp', releases: [{ title: 'Archived', url: 'https://artist.bandcamp.com/album/archived' }] },
  });
  const rows = [legacy];
  const scrape = caller(makeScrapesDb(rows)).scrape;
  await assert.rejects(
    scrape.createJob({ source: 'rym', url: 'https://rateyourmusic.com/', idempotencyKey: 'old-key' }),
    /Job source is no longer supported/
  );
  assert.equal(rows.length, 1);
  assert.deepEqual((await scrape.getJob({ requestId: 'legacy' }))?.data, legacy.data);
  assert.equal((await scrape.listScrapes({}))[0]?.source, 'bandcamp');
  await assert.rejects(scrape.listScrapes({ source: 'bandcamp' } as never), /Invalid literal value/);
});

test('idempotency is isolated per authenticated user', async () => {
  const rows: ScrapeRow[] = [];
  const db = makeScrapesDb(rows);
  const input = {
    source: 'rym' as const,
    url: 'https://rateyourmusic.com/album/foo',
    idempotencyKey: 'same',
  };
  const first = await caller(db, userA).scrape.createJob(input);
  const repeat = await caller(db, userA).scrape.createJob(input);
  const otherUser = await caller(db, userB).scrape.createJob(input);
  assert.equal(repeat.requestId, first.requestId);
  assert.notEqual(otherUser.requestId, first.requestId);
  assert.equal(rows.length, 2);
});

test('scrape.getJob and listScrapes only expose the current user', async () => {
  const rowA = makeRow({
    id: 'req-a',
    user_id: userA.id,
    status: 'done',
    data: { kind: 'rym', entries: [] },
  });
  const rowB = makeRow({ id: 'req-b', user_id: userB.id });
  const db = makeScrapesDb([rowA, rowB]);
  const alice = caller(db, userA);
  const bob = caller(db, userB);

  assert.equal(
    (await alice.scrape.getJob({ requestId: 'req-a' }))?.requestId,
    'req-a'
  );
  assert.equal(await alice.scrape.getJob({ requestId: 'req-b' }), null);
  assert.deepEqual(
    (await alice.scrape.listScrapes({})).map((job) => job.requestId),
    ['req-a']
  );
  assert.deepEqual(
    (await bob.scrape.listScrapes({})).map((job) => job.requestId),
    ['req-b']
  );
});
