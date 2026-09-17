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

const register = (
  registry: AgentRegistry,
  ownerKey: string,
  userId: string,
  agentId: string,
  sender: Sender
) => registry.register(ownerKey, userId, agentId, sender);

test('send reaches only the agent for the same user owner key', () => {
  const registry = new AgentRegistry();
  const agentA = makeSender();
  const agentB = makeSender();
  register(registry, 'owner-a', 'user-a', 'agent-a', agentA);
  register(registry, 'owner-b', 'user-b', 'agent-b', agentB);

  assert.equal(
    registry.send('owner-a', { type: 'scrape', requestId: 'a' }),
    true
  );
  assert.deepEqual(JSON.parse(agentA.received[0]), {
    type: 'scrape',
    requestId: 'a',
  });
  assert.equal(agentB.received.length, 0);
});

test('a new connection replaces the previous agent for one user', () => {
  const registry = new AgentRegistry();
  const first = makeSender();
  const second = makeSender();
  register(registry, 'owner', 'user', 'first', first);
  register(registry, 'owner', 'user', 'second', second);

  assert.equal(registry.get('owner')?.agentId, 'second');
  assert.equal(registry.forSender(first), null);
  assert.equal(registry.send('owner', { type: 'next' }), true);
  assert.equal(first.received.length, 0);
  assert.equal(second.received.length, 1);
});

test('unregisterOwner revokes the active agent connection', () => {
  const registry = new AgentRegistry();
  const sender = makeSender();
  register(registry, 'owner', 'user', 'agent', sender);

  registry.unregisterOwner('owner');

  assert.equal(registry.isConnected('owner'), false);
  assert.equal(registry.forSender(sender), null);
  assert.equal(registry.send('owner', { type: 'after-revoke' }), false);
});

test('unregister removes only the active sender', () => {
  const registry = new AgentRegistry();
  const sender = makeSender();
  register(registry, 'owner', 'user', 'agent', sender);

  const connection = registry.unregister(sender);

  assert.equal(connection?.userId, 'user');
  assert.equal(registry.get('owner'), null);
});
