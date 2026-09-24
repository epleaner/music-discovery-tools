import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionToken } from './auth.js';

test('session tokens are high-entropy and unique', () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.ok(second.length >= 40);
});
