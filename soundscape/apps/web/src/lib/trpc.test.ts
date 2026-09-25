import assert from 'node:assert/strict';
import test from 'node:test';
import { createTrpcClient, resolveApiUrl } from './trpc.js';

test('resolveApiUrl keeps loopback API requests on the browser hostname', () => {
  assert.equal(resolveApiUrl(undefined), 'http://localhost:3001');
  assert.equal(
    resolveApiUrl('http://localhost:3001', '127.0.0.1'),
    'http://127.0.0.1:3001'
  );
  assert.equal(
    resolveApiUrl('http://127.0.0.1:3001', 'localhost'),
    'http://localhost:3001'
  );
  assert.equal(
    resolveApiUrl('https://api.example.com', '127.0.0.1'),
    'https://api.example.com'
  );
});

test('createTrpcClient wires query traffic through httpLink', () => {
  let receivedUrl: string | null = null;
  let clientInput: { links: unknown[] } | null = null;
  const sentinelLink = { kind: 'http-link' } as unknown;

  const client = createTrpcClient({
    apiUrl: 'http://127.0.0.1:3001',
    createLink: (options) => {
      receivedUrl = options.url;
      return sentinelLink as never;
    },
    createClient: (input) => {
      clientInput = input;
      return { ok: true };
    },
  });

  assert.deepEqual(client, { ok: true });
  assert.equal(receivedUrl, 'http://127.0.0.1:3001/trpc');
  assert.deepEqual(clientInput, {
    links: [sentinelLink],
  });
});
