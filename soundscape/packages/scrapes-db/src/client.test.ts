import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import { Miniflare } from 'miniflare';
import { hashToken, createScrapesDb, type CreateQueuedScrapeArgs, type Database } from './client.js';

const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("ok") } }', d1Databases: ['DB'] });
let database: D1Database;
let db: Database;
const userId = 'user-a';
const otherUserId = 'user-b';

before(async () => {
  database = await mf.getD1Database('DB');
  const schema = (await readFile(new URL('../schema.sql', import.meta.url), 'utf8'))
    .split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
  await database.batch(schema.split(';').filter(sql => sql.trim()).map(sql => database.prepare(sql)));
  db = createScrapesDb(database);
});
after(async () => { await mf.dispose(); });

async function queue(ownerId = userId, options: Partial<CreateQueuedScrapeArgs> = {}) {
  return db.createQueued({ id: randomUUID(), userId: ownerId, source: 'rym', url: `https://rateyourmusic.com/~${randomUUID()}`, ...options });
}

test('hashToken returns deterministic lowercase SHA-256', () => {
  assert.match(hashToken('abc'), /^[0-9a-f]{64}$/);
  assert.equal(hashToken('abc'), hashToken('abc'));
  assert.notEqual(hashToken('abc'), hashToken('xyz'));
});

test('one passphrase provisions one user, sessions expire and remain isolated', async () => {
  const tokenHash = hashToken('pairing-passphrase');
  const [first, second] = await Promise.all([
    db.getOrCreateUserByAgentTokenHash({ id: 'auth-a', tokenHash }),
    db.getOrCreateUserByAgentTokenHash({ id: 'auth-b', tokenHash }),
  ]);
  assert.equal(first.id, second.id);
  assert.ok(first.created_at instanceof Date);
  await db.createSession({ tokenHash: 'valid-session', userId: first.id, expiresAt: new Date(Date.now() + 60_000) });
  await db.createSession({ tokenHash: 'expired-session', userId: first.id, expiresAt: new Date(Date.now() - 60_000) });
  assert.equal((await db.getUserBySession('valid-session'))?.id, first.id);
  assert.equal(await db.getUserBySession('expired-session'), null);
  assert.equal(await db.getUserBySession('other-session'), null);
  await db.deleteSession('valid-session');
  assert.equal(await db.getUserBySession('valid-session'), null);
});

test('idempotency is isolated per user and JSON/boolean/date values round-trip', async () => {
  const input = { idempotencyKey: 'repeat', force: true, query: { artist: 'A', kind: 'artist' } } as Partial<CreateQueuedScrapeArgs>;
  const first = await queue(userId, input);
  const replay = await queue(userId, input);
  const other = await queue(otherUserId, input);
  assert.equal(replay.created, false);
  assert.equal(replay.row.id, first.row.id);
  assert.notEqual(other.row.id, first.row.id);
  assert.equal(first.row.force, true);
  assert.deepEqual(first.row.query, input.query);
  assert.ok(first.row.expires_at instanceof Date);
});

test('concurrent atomic claims select distinct jobs; only the current lease owner may finish', async () => {
  const ownerId = `claim-${randomUUID()}`;
  await queue(ownerId);
  await queue(ownerId);
  const [a, b] = await Promise.all([
    db.claimNext({ userId: ownerId, agentId: 'agent-a', leaseMs: 60_000 }),
    db.claimNext({ userId: ownerId, agentId: 'agent-b', leaseMs: 60_000 }),
  ]);
  assert.ok(a && b);
  assert.notEqual(a.id, b.id);
  assert.equal(a.attempts, 1);
  const data = { kind: 'rym' as const, entries: [] };
  assert.equal(await db.complete({ id: a.id, agentId: 'agent-b', data }), false);
  assert.equal(await db.fail({ id: a.id, agentId: 'agent-b', error: 'wrong' }), false);
  assert.equal(await db.complete({ id: a.id, agentId: 'agent-a', data }), true);
  assert.equal((await db.getById(a.id))?.status, 'done');
  assert.deepEqual((await db.getById(a.id))?.data, data);
});

test('expired leases can be reclaimed and stale owner results rejected', async () => {
  const ownerId = `reclaim-${randomUUID()}`;
  const job = await queue(ownerId);
  await db.claimNext({ userId: ownerId, agentId: 'old', leaseMs: -1 });
  const reclaimed = await db.claimNext({ userId: ownerId, agentId: 'new', leaseMs: 60_000 });
  assert.equal(reclaimed?.id, job.row.id);
  assert.equal(reclaimed?.attempts, 2);
  assert.equal(await db.fail({ id: job.row.id, agentId: 'old', error: 'late' }), false);
  assert.equal(await db.fail({ id: job.row.id, agentId: 'new', error: 'browser' }), true);
});

test('cache and listing never expose another user’s jobs', async () => {
  const ownerId = `cache-${randomUUID()}`;
  const url = `https://rateyourmusic.com/release/album/${randomUUID()}`;
  const job = await queue(ownerId, { url });
  const data = { kind: 'rym' as const, entries: [] };
  await db.markCached({ id: job.row.id, data });
  assert.deepEqual((await db.getFresh({ userId: ownerId, source: 'rym', url, maxAgeMs: 60_000 }))?.data, data);
  assert.equal(await db.getFresh({ userId: otherUserId, source: 'rym', url, maxAgeMs: 60_000 }), null);
  assert.equal((await db.listByUser({ userId: otherUserId, limit: 20 })).some(row => row.id === job.row.id), false);
});

test('historical Bandcamp rows round-trip without dispatching or rewriting their data', async () => {
  const ownerId = `legacy-${randomUUID()}`;
  const legacyData = { kind: 'bandcamp' as const, releases: [{ title: 'Archived', url: 'https://artist.bandcamp.com/album/archived' }] };
  const legacy = await queue(ownerId, { source: 'bandcamp', url: 'https://artist.bandcamp.com/album/archived' });
  await db.markCached({ id: legacy.row.id, data: legacyData });
  const pending = await queue(ownerId, { source: 'bandcamp', url: 'https://artist.bandcamp.com/album/pending' });
  const unsupportedMode = await queue(ownerId, { mode: 'resolve', url: 'resolve:artist:Archived' });
  const active = await queue(ownerId);
  assert.equal((await db.claimNext({ userId: ownerId, agentId: 'agent', leaseMs: 60_000 }))?.id, active.row.id);
  assert.equal(await db.claimNext({ userId: ownerId, agentId: 'agent', leaseMs: 60_000 }), null);
  assert.equal((await db.getById(pending.row.id))?.status, 'queued');
  assert.equal((await db.getById(unsupportedMode.row.id))?.status, 'queued');
  assert.deepEqual((await db.getById(legacy.row.id))?.data, legacyData);
  assert.deepEqual((await db.listByUser({ userId: ownerId, limit: 10 })).find(row => row.id === legacy.row.id)?.data, legacyData);
});
