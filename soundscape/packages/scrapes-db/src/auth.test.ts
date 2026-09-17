import assert from 'node:assert/strict';
import test from 'node:test';
import { createToken, hashPassword, verifyPassword } from './auth.js';

test('password hashes verify only the original password', async () => {
  const encoded = await hashPassword('correct horse battery staple');
  assert.equal(
    await verifyPassword('correct horse battery staple', encoded),
    true
  );
  assert.equal(await verifyPassword('wrong password', encoded), false);
});

test('agent tokens are high-entropy and unique', () => {
  const first = createToken();
  const second = createToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.ok(second.length >= 40);
});
