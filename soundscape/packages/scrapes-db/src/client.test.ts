import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';
import postgres from 'postgres';
import {
  hashToken,
  createScrapesDb,
  type CreateQueuedScrapeArgs,
} from './client.js';

test('hashToken returns deterministic lowercase SHA-256', () => {
  const result = hashToken('abc');
  assert.match(result, /^[0-9a-f]{64}$/);
  assert.equal(result, hashToken('abc'));
  assert.notEqual(result, hashToken('xyz'));
});

const dbUrl = process.env.SCRAPES_TEST_DATABASE_URL;

if (!dbUrl) {
  console.log('SCRAPES_TEST_DATABASE_URL not set — skipping DB-backed tests');
} else {
  const userId = `user-${randomUUID()}`;
  const otherUserId = `other-user-${randomUUID()}`;
  const testIds: string[] = [];
  const db = createScrapesDb(dbUrl);

  async function queue(
    source: 'rym' | 'bandcamp' = 'rym',
    url = `https://rateyourmusic.com/~${randomUUID()}`,
    options: Partial<
      Omit<CreateQueuedScrapeArgs, 'id' | 'userId' | 'source' | 'url'>
    > = {},
    ownerId = userId
  ) {
    const input: CreateQueuedScrapeArgs = {
      ...options,
      id: randomUUID(),
      userId: ownerId,
      source,
      url,
    };
    testIds.push(input.id);
    return db.createQueued(input);
  }

  before(async () => {
    await db.init();
  });

  test('init creates the queue and auth schema', { concurrency: false }, async () => {
    await db.init();
  });

  test('createQueued inserts a queued row with lease fields clear', { concurrency: false }, async () => {
    const { row, created } = await queue();
    assert.equal(created, true);
    assert.equal(row.user_id, userId);
    assert.equal(row.status, 'queued');
    assert.equal(row.attempts, 0);
    assert.equal(row.lease_owner, null);
    assert.equal(row.data, null);
  });

  test('idempotency returns the existing row for one user', { concurrency: false }, async () => {
    const key = `retry-${randomUUID()}`;
    const first = await queue('rym', undefined, { idempotencyKey: key });
    const second = await queue('rym', undefined, { idempotencyKey: key });
    assert.equal(second.created, false);
    assert.equal(second.row.id, first.row.id);
  });

  test('claim and complete transition a job for the owning agent', { concurrency: false }, async () => {
    const ownerId = `claim-user-${randomUUID()}`;
    const queued = await queue('rym', undefined, {}, ownerId);
    const claimed = await db.claimNext({
      userId: ownerId,
      agentId: 'agent-a',
      leaseMs: 60_000,
    });
    assert.equal(claimed?.id, queued.row.id);
    assert.equal(claimed?.status, 'running');
    assert.equal(claimed?.attempts, 1);

    const data = { kind: 'rym' as const, entries: [] };
    assert.equal(
      await db.complete({ id: queued.row.id, agentId: 'agent-a', data }),
      true
    );
    const row = await db.getById(queued.row.id);
    assert.equal(row?.status, 'done');
    assert.deepEqual(row?.data, data);
  });

  test('stale leases can be reclaimed by a reconnecting agent', { concurrency: false }, async () => {
    const ownerId = `stale-user-${randomUUID()}`;
    const queued = await queue('rym', undefined, {}, ownerId);
    assert.equal(
      (await db.claimNext({ userId: ownerId, agentId: 'agent-a', leaseMs: -1 }))
        ?.id,
      queued.row.id
    );
    const reclaimed = await db.claimNext({
      userId: ownerId,
      agentId: 'agent-b',
      leaseMs: 60_000,
    });
    assert.equal(reclaimed?.id, queued.row.id);
    assert.equal(reclaimed?.lease_owner, 'agent-b');
    assert.equal(reclaimed?.attempts, 2);
  });

  test('completion and failure require the current lease owner', { concurrency: false }, async () => {
    const ownerId = `lease-user-${randomUUID()}`;
    const queued = await queue('rym', undefined, {}, ownerId);
    await db.claimNext({ userId: ownerId, agentId: 'agent-a', leaseMs: 60_000 });
    const data = { kind: 'rym' as const, entries: [] };
    assert.equal(
      await db.complete({ id: queued.row.id, agentId: 'agent-b', data }),
      false
    );
    assert.equal(
      await db.fail({
        id: queued.row.id,
        agentId: 'agent-b',
        error: 'wrong agent',
      }),
      false
    );
    assert.equal(
      await db.fail({
        id: queued.row.id,
        agentId: 'agent-a',
        error: 'browser failed',
      }),
      true
    );
  });

  test('listByUser isolates users and supports source and limit filters', { concurrency: false }, async () => {
    const first = await queue('rym');
    const second = await queue('bandcamp', 'https://bandcamp.com/filter');
    const other = randomUUID();
    testIds.push(other);
    await db.createQueued({
      id: other,
      userId: otherUserId,
      source: 'rym',
      url: 'https://rateyourmusic.com/other',
    });

    const rows = await db.listByUser({ userId, source: 'rym', limit: 10 });
    assert.ok(rows.some((row) => row.id === first.row.id));
    assert.ok(!rows.some((row) => row.id === second.row.id));
    assert.ok(!rows.some((row) => row.id === other));
    assert.ok((await db.listByUser({ userId, limit: 1 })).length <= 1);
  });

  test('getFresh reads recent cache data by source and cache URL', { concurrency: false }, async () => {
    const ownerId = `cache-user-${randomUUID()}`;
    const url = `resolve:album:${randomUUID()}`;
    const queued = await queue('rym', url, {}, ownerId);
    const data = { kind: 'rym' as const, entries: [] };
    await db.claimNext({ userId: ownerId, agentId: 'agent-a', leaseMs: 60_000 });
    await db.complete({ id: queued.row.id, agentId: 'agent-a', data });

    const result = await db.getFresh({
      userId: ownerId,
      source: 'rym',
      url,
      maxAgeMs: 60_000,
    });
    assert.deepEqual(result?.data, data);
    assert.ok(result?.fetchedAt instanceof Date);
    assert.equal(
      await db.getFresh({
        userId: ownerId,
        source: 'bandcamp',
        url,
        maxAgeMs: 60_000,
      }),
      null
    );
  });

  after(async () => {
    const sql = postgres(dbUrl);
    await sql`DELETE FROM scrapes WHERE id IN ${sql(testIds)}`;
    await sql.end();
    await db.close();
  });
}
