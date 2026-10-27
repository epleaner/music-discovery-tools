import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiUrl } from './trpc.js';

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
  assert.equal(resolveApiUrl(undefined, 'tunes.elipleaner.com'), 'https://tunes.elipleaner.com');
});
