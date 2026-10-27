import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import cors from 'cors';
import express from 'express';
import { allowsBrowserOrigin } from './cors-origin.js';

const workerOrigin = 'https://soundscape.example.workers.dev';

test('credentialed browser requests accept their Worker origin and local Vite, not arbitrary origins', async () => {
  const app = express();
  app.use(cors({
    origin: (origin, callback) => callback(null, allowsBrowserOrigin(origin, workerOrigin)),
    credentials: true,
  }));
  app.post('/auth/session', (_req, res) => { res.status(204).end(); });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/auth/session`;

  try {
    for (const origin of [workerOrigin, 'http://localhost:3000']) {
      const response = await fetch(url, { method: 'POST', headers: { Origin: origin } });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    }
    const denied = await fetch(url, {
      method: 'POST',
      headers: { Origin: 'https://attacker.example', 'X-Forwarded-Proto': 'https', Host: 'attacker.example' },
    });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const preflight = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: workerOrigin, 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.headers.get('access-control-allow-origin'), workerOrigin);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
