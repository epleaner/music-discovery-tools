import assert from 'node:assert/strict';
import test from 'node:test';
import viteConfig from '../vite.config.ts';

test('vite dev server binds to 127.0.0.1 so the app is reachable via IPv4 localhost', () => {
  assert.equal(viteConfig.server?.host, '127.0.0.1');
});
