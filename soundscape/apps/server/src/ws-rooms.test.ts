import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentRegistry, type Sender } from './ws-rooms.js';

function makeSender(): Sender & { received: string[] } {
  const received: string[] = [];
  return {
    received,
    send(json: string) {
      received.push(json);
    },
  };
}

test('send reaches only the agent for the same pairing token', () => {
  const registry = new AgentRegistry();
  const agentA = makeSender();
  const agentB = makeSender();
  registry.register('hash-a', 'agent-a', agentA);
  registry.register('hash-b', 'agent-b', agentB);

  assert.equal(
    registry.send('hash-a', { type: 'scrape', requestId: 'a' }),
    true
  );
  assert.deepEqual(JSON.parse(agentA.received[0]), {
    type: 'scrape',
    requestId: 'a',
  });
  assert.equal(agentB.received.length, 0);
});

test('a new connection replaces the previous agent for one token', () => {
  const registry = new AgentRegistry();
  const first = makeSender();
  const second = makeSender();
  registry.register('hash', 'first', first);
  registry.register('hash', 'second', second);

  assert.equal(registry.get('hash')?.agentId, 'second');
  assert.equal(registry.forSender(first), null);
  assert.equal(registry.send('hash', { type: 'next' }), true);
  assert.equal(first.received.length, 0);
  assert.equal(second.received.length, 1);
});

test('unregister removes only the active sender', () => {
  const registry = new AgentRegistry();
  const sender = makeSender();
  registry.register('hash', 'agent', sender);
  const connection = registry.unregister(sender);

  assert.equal(connection?.agentId, 'agent');
  assert.equal(registry.get('hash'), null);
  assert.equal(registry.send('hash', { type: 'after-close' }), false);
});
