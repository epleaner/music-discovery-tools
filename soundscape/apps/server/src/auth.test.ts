import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import {
  hashToken,
  type Database,
  type UserRecord,
} from '@soundscape/scrapes-db';
import { createAuthRouter, ownerKeyForUser } from './auth.js';

class UniqueViolation extends Error {
  code = '23505';
}

function makeDb(): Database {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, string>();
  return {
    async getOrCreateUserByAgentTokenHash({ id, tokenHash }) {
      const existing = [...users.values()].find(
        (user) => user.agent_token_hash === tokenHash
      );
      if (existing) return existing;
      const user: UserRecord = {
        id,
        agent_token_hash: tokenHash,
        agent_last_seen_at: null,
        created_at: new Date(),
      };
      users.set(id, user);
      return user;
    },
    async getUserBySession(tokenHash) {
      const userId = sessions.get(tokenHash);
      return userId ? (users.get(userId) ?? null) : null;
    },
    async createSession({ tokenHash, userId }) {
      sessions.set(tokenHash, userId);
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
    async setAgentTokenHash(userId, tokenHash) {
      const conflict = [...users.values()].some(
        (user) => user.id !== userId && user.agent_token_hash === tokenHash
      );
      if (conflict) throw new UniqueViolation('duplicate passphrase');
      const user = users.get(userId);
      if (!user) throw new Error('user not found');
      user.agent_token_hash = tokenHash;
      user.agent_last_seen_at = null;
      return user;
    },
    async getUserByAgentTokenHash(tokenHash) {
      return (
        [...users.values()].find(
          (user) => user.agent_token_hash === tokenHash
        ) ?? null
      );
    },
    async touchAgent(userId) {
      const user = users.get(userId);
      if (user) user.agent_last_seen_at = new Date();
    },
    async createQueued() {
      throw new Error('not used');
    },
    async markCached() {},
    async claimNext() {
      return null;
    },
    async complete() {
      return false;
    },
    async fail() {
      return false;
    },
    async getById() {
      return null;
    },
    async listByUser() {
      return [];
    },
    async getFresh() {
      return null;
    },
  };
}

async function startAuthServer() {
  const db = makeDb();
  const connected = new Set<string>();
  const app = express();
  app.use(express.json());
  app.use(
    '/auth',
    createAuthRouter({
      getDb: () => db,
      agentRegistry: {
        isConnected: async (ownerKey) => connected.has(ownerKey),
        rotate: async (userId, tokenHash) => { await db.setAgentTokenHash(userId, tokenHash); connected.delete(ownerKeyForUser(userId)); },
      },
    })
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server did not start');
  }
  return {
    db,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
}

function cookieFrom(response: Response): string {
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  return cookie.split(';', 1)[0];
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function createSession(baseUrl: string, passphrase: string) {
  const response = await fetch(`${baseUrl}/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });
  assert.equal(response.status, 200);
  return {
    cookie: cookieFrom(response),
    body: await json<{ user: { id: string } }>(response),
  };
}

test('shared passphrase API generates and normalizes credentials', async () => {
  const server = await startAuthServer();
  try {
    const generate = () =>
      fetch(`${server.baseUrl}/auth/passphrase`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }).then((response) => json<{ passphrase: string }>(response));
    const first = await generate();
    const second = await generate();
    assert.match(first.passphrase, /^[0-9a-f]{48}$/);
    assert.match(second.passphrase, /^[0-9a-f]{48}$/);
    assert.notEqual(first.passphrase, second.passphrase);

    const existing = 'abacus abdomen ability abrasion abrasive absentee';
    const normalizedResponse = await fetch(
      `${server.baseUrl}/auth/passphrase`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passphrase: `  ${existing} \n` }),
      }
    );
    assert.equal(normalizedResponse.status, 200);
    assert.equal(
      (await json<{ passphrase: string }>(normalizedResponse)).passphrase,
      existing
    );

    const invalid = await fetch(`${server.baseUrl}/auth/passphrase`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase: 'too-short' }),
    });
    assert.equal(invalid.status, 400);
  } finally {
    await server.close();
  }
});

test('pairing passphrases provision isolated repeatable sessions', async () => {
  const server = await startAuthServer();
  try {
    const invalid = await fetch(`${server.baseUrl}/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase: 'too-short' }),
    });
    assert.equal(invalid.status, 400);

    const alicePassphrase = 'abacus abdomen ability abrasion abrasive absentee';
    const alice = await createSession(server.baseUrl, alicePassphrase);
    const aliceAgain = await createSession(server.baseUrl, alicePassphrase);
    assert.equal(aliceAgain.body.user.id, alice.body.user.id);
    assert.notEqual(aliceAgain.cookie, alice.cookie);

    const bob = await createSession(
      server.baseUrl,
      'backdrop bagpipe banter barefoot beehive bicycle'
    );
    assert.notEqual(bob.body.user.id, alice.body.user.id);

    const aliceSession = await json<{ user: { id: string } }>(
      await fetch(`${server.baseUrl}/auth/session`, {
        headers: { cookie: alice.cookie },
      })
    );
    assert.equal(aliceSession.user.id, alice.body.user.id);

    const aliceAgent = await json<{ configured: boolean }>(
      await fetch(`${server.baseUrl}/auth/agent`, {
        headers: { cookie: alice.cookie },
      })
    );
    assert.equal(aliceAgent.configured, true);

    assert.equal(
      (await fetch(`${server.baseUrl}/auth/register`, { method: 'POST' }))
        .status,
      404
    );
    assert.equal(
      (await fetch(`${server.baseUrl}/auth/login`, { method: 'POST' })).status,
      404
    );
    assert.equal((await fetch(`${server.baseUrl}/auth/agent`)).status, 401);
  } finally {
    await server.close();
  }
});

test('authenticated sessions can replace but not remove their passphrase', async () => {
  const server = await startAuthServer();
  try {
    const original = 'cabbage cabinet cactus cadence camera canary';
    const replacement = 'daring daylight deacon decade december dolphin';
    const account = await createSession(server.baseUrl, original);

    const replace = await fetch(`${server.baseUrl}/auth/agent`, {
      method: 'POST',
      headers: {
        cookie: account.cookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ passphrase: replacement }),
    });
    assert.equal(replace.status, 204);
    assert.equal(
      (await server.db.getUserByAgentTokenHash(hashToken(replacement)))?.id,
      account.body.user.id
    );
    assert.equal(
      await server.db.getUserByAgentTokenHash(hashToken(original)),
      null
    );

    const other = await createSession(
      server.baseUrl,
      'earache early earthly easel eating eclipse'
    );
    const conflict = await fetch(`${server.baseUrl}/auth/agent`, {
      method: 'POST',
      headers: {
        cookie: other.cookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ passphrase: replacement }),
    });
    assert.equal(conflict.status, 409);
    assert.equal(
      (
        await fetch(`${server.baseUrl}/auth/agent`, {
          method: 'DELETE',
          headers: { cookie: account.cookie },
        })
      ).status,
      404
    );

    const logout = await fetch(`${server.baseUrl}/auth/session`, {
      method: 'DELETE',
      headers: { cookie: account.cookie },
    });
    assert.equal(logout.status, 204);
    assert.equal(
      (
        await fetch(`${server.baseUrl}/auth/session`, {
          headers: { cookie: account.cookie },
        })
      ).status,
      401
    );
  } finally {
    await server.close();
  }
});
