import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScrapeErrorMsg, ScrapeResultMsg } from '@soundscape/types';
import type { ScrapesDb, ScrapeRow } from '@soundscape/scrapes-db';
import { ScrapeDispatcher } from './scrape-dispatcher.js';
import { AgentRegistry, type Sender } from './ws-rooms.js';

function makeRow(overrides: Partial<ScrapeRow> = {}): ScrapeRow {
  return {
    id: 'job-1',
    user_id: 'user-a',
    token_hash: 'token-hash',
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
    expires_at: new Date(Date.now() + 60_000),
    data: null,
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
    fetched_at: new Date(),
    ...overrides,
  };
}

function makeDb(row: ScrapeRow): ScrapesDb {
  return {
    async init() {},
    async createQueued() {
      return { row, created: false };
    },
    async markCached() {},
    async claimNext({ agentId }) {
      if (row.status !== 'queued') return null;
      row.status = 'running';
      row.lease_owner = agentId;
      row.attempts += 1;
      return row;
    },
    async complete({ agentId, data }) {
      if (row.lease_owner !== agentId) return false;
      row.status = 'done';
      row.data = data;
      row.lease_owner = null;
      return true;
    },
    async fail({ agentId, error }) {
      if (row.lease_owner !== agentId) return false;
      row.status = 'error';
      row.error = error;
      row.lease_owner = null;
      return true;
    },
    async getById(id) {
      return id === row.id ? row : null;
    },
    async listByUser() {
      return [row];
    },
    async getFresh() {
      return null;
    },
    async close() {},
  };
}

function makeSender(): Sender & { received: string[] } {
  const received: string[] = [];
  return {
    received,
    send(json: string) {
      received.push(json);
    },
  };
}

test('dispatcher sends claimed jobs only to the matching agent', async () => {
  const row = makeRow();
  const db = makeDb(row);
  const registry = new AgentRegistry();
  const sender = makeSender();
  registry.register('token-hash', 'user-a', 'agent-a', sender);
  const dispatcher = new ScrapeDispatcher(registry, {
    getDb: () => db,
    leaseMs: 10_000,
  });

  await dispatcher.dispatch('token-hash');
  assert.deepEqual(JSON.parse(sender.received[0]), {
    type: 'scrape',
    requestId: 'job-1',
    source: 'rym',
    url: 'https://rateyourmusic.com/album/foo',
    force: false,
  });
});

test('accepted result completes the lease and rejects a different agent', async () => {
  const row = makeRow();
  const db = makeDb(row);
  const registry = new AgentRegistry();
  const sender = makeSender();
  registry.register('token-hash', 'user-a', 'agent-a', sender);
  const dispatcher = new ScrapeDispatcher(registry, {
    getDb: () => db,
    leaseMs: 10_000,
  });
  await dispatcher.dispatch('token-hash');

  const result: ScrapeResultMsg = {
    type: 'scrape_result',
    requestId: 'job-1',
    source: 'rym',
    data: { kind: 'rym', entries: [] },
  };
  assert.equal(await dispatcher.handleResult(makeSender(), result), false);
  assert.equal(await dispatcher.handleResult(sender, result), true);
  assert.equal(row.status, 'done');
});

test('agent errors become visible terminal failures', async () => {
  const row = makeRow();
  const db = makeDb(row);
  const registry = new AgentRegistry();
  const sender = makeSender();
  registry.register('token-hash', 'user-a', 'agent-a', sender);
  const dispatcher = new ScrapeDispatcher(registry, {
    getDb: () => db,
    leaseMs: 10_000,
  });
  await dispatcher.dispatch('token-hash');

  const error: ScrapeErrorMsg = {
    type: 'scrape_error',
    requestId: 'job-1',
    message: 'browser failed',
  };
  assert.equal(await dispatcher.handleResult(sender, error), true);
  assert.equal(row.status, 'error');
  assert.equal(row.error, 'browser failed');
});
