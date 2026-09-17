import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import type { Database, UserRecord } from '@soundscape/scrapes-db';
import { createAuthRouter } from './auth.js';

function makeDb(): Database {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, string>();
  return {
    async init() {},
    async createUser({ id, username, passwordHash }) {
      if ([...users.values()].some((user) => user.username === username)) {
        const error = new Error('duplicate username') as Error & {
          code: string;
        };
        error.code = '23505';
        throw error;
      }
      const user: UserRecord = {
        id,
        username,
        password_hash: passwordHash,
        agent_token_hash: null,
        agent_last_seen_at: null,
        created_at: new Date(),
      };
      users.set(id, user);
      return user;
    },
    async getUserByUsername(username) {
      return (
        [...users.values()].find((user) => user.username === username) ?? null
      );
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
      const user = users.get(userId);
      if (!user) throw new Error('user not found');
      user.agent_token_hash = tokenHash;
      user.agent_last_seen_at = null;
      return user;
    },
    async clearAgentTokenHash(userId) {
      const user = users.get(userId);
      if (user) user.agent_token_hash = null;
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
    async close() {},
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
        isConnected: (ownerKey) => connected.has(ownerKey),
        unregisterOwner: (ownerKey) => connected.delete(ownerKey),
      },
    })
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('server did not start');
  return {
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

async function json(response: Response): Promise<Record<string, any>> {
  return (await response.json()) as Record<string, any>;
}

test('sessions and agent tokens are isolated per account', async () => {
  const server = await startAuthServer();
  try {
    const aliceRegistration = await fetch(`${server.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Alice', password: 'password-one' }),
    });
    assert.equal(aliceRegistration.status, 200);
    const aliceCookie = cookieFrom(aliceRegistration);
    const alice = await json(aliceRegistration);

    const aliceTokenResponse = await fetch(`${server.baseUrl}/auth/agent`, {
      method: 'POST',
      headers: { cookie: aliceCookie },
      body: '{}',
    });
    assert.equal(aliceTokenResponse.status, 200);
    const aliceToken = (await json(aliceTokenResponse)).token;
    assert.equal(typeof aliceToken, 'string');

    const bobRegistration = await fetch(`${server.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Bob', password: 'password-two' }),
    });
    assert.equal(bobRegistration.status, 200);
    const bobCookie = cookieFrom(bobRegistration);
    const bob = await json(bobRegistration);
    assert.notEqual(bobCookie, aliceCookie);

    const aliceMe = await json(
      await fetch(`${server.baseUrl}/auth/me`, {
        headers: { cookie: aliceCookie },
      })
    );
    const bobMe = await json(
      await fetch(`${server.baseUrl}/auth/me`, {
        headers: { cookie: bobCookie },
      })
    );
    assert.equal(aliceMe.user.username, 'alice');
    assert.equal(bobMe.user.username, 'bob');
    assert.notEqual(alice.user.id, bob.user.id);

    const aliceAgent = await json(
      await fetch(`${server.baseUrl}/auth/agent`, {
        headers: { cookie: aliceCookie },
      })
    );
    const bobAgent = await json(
      await fetch(`${server.baseUrl}/auth/agent`, {
        headers: { cookie: bobCookie },
      })
    );
    assert.equal(aliceAgent.configured, true);
    assert.equal(bobAgent.configured, false);

    const unauthenticated = await fetch(`${server.baseUrl}/auth/agent`);
    assert.equal(unauthenticated.status, 401);
  } finally {
    await server.close();
  }
});
