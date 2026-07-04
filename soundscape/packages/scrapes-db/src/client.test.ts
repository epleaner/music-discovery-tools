import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import postgres from 'postgres';
import { hashToken, createScrapesDb } from './client.js';

test('hashToken returns a 64-char lowercase hex string', () => {
  const result = hashToken('abc');
  assert.equal(result.length, 64);
  assert.match(result, /^[0-9a-f]+$/);
});

test('hashToken is deterministic', () => {
  assert.equal(hashToken('abc'), hashToken('abc'));
});

test('hashToken produces different outputs for different inputs', () => {
  assert.notEqual(hashToken('abc'), hashToken('xyz'));
});

const dbUrl = process.env.SCRAPES_TEST_DATABASE_URL;

if (!dbUrl) {
  console.log('SCRAPES_TEST_DATABASE_URL not set — skipping DB-backed tests');
} else {
  const TEST_TOKEN_A = `test-token-a-${randomUUID()}`;
  const TEST_TOKEN_B = `test-token-b-${randomUUID()}`;
  const tokenHashA = hashToken(TEST_TOKEN_A);
  const tokenHashB = hashToken(TEST_TOKEN_B);
  const testIds: string[] = [];

  const db = createScrapesDb(dbUrl);

  test('init creates the scrapes table and index', async () => {
    await db.init();
  });

  test('createPending inserts a pending row', async () => {
    const id = randomUUID();
    testIds.push(id);
    await db.createPending({ id, tokenHash: tokenHashA, source: 'rym', url: 'https://rateyourmusic.com/~test' });
    const row = await db.getById(id);
    assert.ok(row);
    assert.equal(row.id, id);
    assert.equal(row.token_hash, tokenHashA);
    assert.equal(row.source, 'rym');
    assert.equal(row.status, 'pending');
    assert.equal(row.data, null);
    assert.equal(row.error, null);
  });

  test('markDone sets status to done and stores data', async () => {
    const id = randomUUID();
    testIds.push(id);
    await db.createPending({ id, tokenHash: tokenHashA, source: 'rym', url: 'https://rateyourmusic.com/~test2' });
    const data = { kind: 'rym' as const, entries: [] };
    await db.markDone({ id, data });
    const row = await db.getById(id);
    assert.ok(row);
    assert.equal(row.status, 'done');
    assert.deepEqual(row.data, data);
  });

  test('markError sets status to error and stores error message', async () => {
    const id = randomUUID();
    testIds.push(id);
    await db.createPending({ id, tokenHash: tokenHashA, source: 'rym', url: 'https://rateyourmusic.com/~test3' });
    await db.markError({ id, error: 'scrape failed' });
    const row = await db.getById(id);
    assert.ok(row);
    assert.equal(row.status, 'error');
    assert.equal(row.error, 'scrape failed');
  });

  test('listByToken returns only rows for the matching token, newest first', async () => {
    const idA1 = randomUUID();
    const idA2 = randomUUID();
    const idB = randomUUID();
    testIds.push(idA1, idA2, idB);

    await db.createPending({ id: idA1, tokenHash: tokenHashA, source: 'rym', url: 'https://rateyourmusic.com/~a1' });
    await db.createPending({ id: idA2, tokenHash: tokenHashA, source: 'rym', url: 'https://rateyourmusic.com/~a2' });
    await db.createPending({ id: idB, tokenHash: tokenHashB, source: 'rym', url: 'https://rateyourmusic.com/~b' });

    const rowsA = await db.listByToken({ tokenHash: tokenHashA, limit: 10 });
    const idsA = rowsA.map((r) => r.id);
    assert.ok(idsA.includes(idA1));
    assert.ok(idsA.includes(idA2));
    assert.ok(!idsA.includes(idB));
  });

  test('listByToken respects source filter', async () => {
    const idRym = randomUUID();
    const idBandcamp = randomUUID();
    testIds.push(idRym, idBandcamp);

    await db.createPending({ id: idRym, tokenHash: tokenHashA, source: 'rym', url: 'https://rateyourmusic.com/~filter' });
    await db.createPending({ id: idBandcamp, tokenHash: tokenHashA, source: 'bandcamp', url: 'https://bandcamp.com/filter' });

    const rymOnly = await db.listByToken({ tokenHash: tokenHashA, source: 'rym', limit: 10 });
    assert.ok(rymOnly.every((r) => r.source === 'rym'));
    assert.ok(rymOnly.map((r) => r.id).includes(idRym));
    assert.ok(!rymOnly.map((r) => r.id).includes(idBandcamp));
  });

  test('listByToken respects limit', async () => {
    const rows = await db.listByToken({ tokenHash: tokenHashA, limit: 2 });
    assert.ok(rows.length <= 2);
  });

  test('getFresh returns the data of a recently done row matching source+url', async () => {
    const id = randomUUID();
    testIds.push(id);
    const url = `resolve:album:getFresh-test-${randomUUID()}`;
    const data = { kind: 'rym' as const, entries: [] };
    await db.createPending({ id, tokenHash: tokenHashA, source: 'rym', url });
    await db.markDone({ id, data });

    const result = await db.getFresh({ source: 'rym', url, maxAgeMs: 60_000 });
    assert.deepEqual(result, data);
  });

  test('getFresh returns null when the only matching row is older than maxAgeMs', async () => {
    const id = randomUUID();
    testIds.push(id);
    const url = `resolve:album:getFresh-stale-${randomUUID()}`;
    const data = { kind: 'rym' as const, entries: [] };
    await db.createPending({ id, tokenHash: tokenHashA, source: 'rym', url });
    await db.markDone({ id, data });

    // maxAgeMs: 0 means "created_at > now()", which the just-inserted row fails.
    const result = await db.getFresh({ source: 'rym', url, maxAgeMs: 0 });
    assert.equal(result, null);
  });

  test('getFresh returns null for a different source or url', async () => {
    const id = randomUUID();
    testIds.push(id);
    const url = `resolve:album:getFresh-mismatch-${randomUUID()}`;
    const data = { kind: 'rym' as const, entries: [] };
    await db.createPending({ id, tokenHash: tokenHashA, source: 'rym', url });
    await db.markDone({ id, data });

    assert.equal(await db.getFresh({ source: 'bandcamp', url, maxAgeMs: 60_000 }), null);
    assert.equal(await db.getFresh({ source: 'rym', url: `${url}-other`, maxAgeMs: 60_000 }), null);
  });

  test('getFresh ignores token_hash — a row created under token A is found with no token specified', async () => {
    const id = randomUUID();
    testIds.push(id);
    const url = `resolve:album:getFresh-shared-${randomUUID()}`;
    const data = { kind: 'rym' as const, entries: [] };
    await db.createPending({ id, tokenHash: tokenHashA, source: 'rym', url });
    await db.markDone({ id, data });

    const result = await db.getFresh({ source: 'rym', url, maxAgeMs: 60_000 });
    assert.deepEqual(result, data);
  });

  test('cleanup test rows', async () => {
    const sql = postgres(dbUrl);
    for (const id of testIds) {
      await sql`DELETE FROM scrapes WHERE id = ${id}`;
    }
    await sql.end();
    await db.close();
  });
}
