import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePairingPassphrase } from './auth.js';

test('generated pairing passphrases are 192-bit lowercase hex values', () => {
  const passphrases = new Set(
    Array.from({ length: 32 }, () => generatePairingPassphrase())
  );

  assert.equal(passphrases.size, 32);
  for (const passphrase of passphrases) {
    assert.match(passphrase, /^[0-9a-f]{48}$/);
  }
});
