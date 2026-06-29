import assert from 'node:assert/strict';
import test from 'node:test';
import { Rooms, type Sender } from './ws-rooms.js';

function makeSender(): Sender & { received: string[] } {
  const received: string[] = [];
  return { received, send(json: string) { received.push(json); } };
}

test('sendToMenubar: reaches only menubar in same token, not another token', () => {
  const rooms = new Rooms();
  const mbA = makeSender();
  const mbB = makeSender();
  rooms.registerMenubar('A', mbA);
  rooms.registerMenubar('B', mbB);
  const result = rooms.sendToMenubar('A', { type: 'ping' });
  assert.equal(result, true);
  assert.equal(mbA.received.length, 1);
  assert.equal(mbB.received.length, 0);
});

test('sendToWebs: reaches all webs in same token, not webs in another token', () => {
  const rooms = new Rooms();
  const w1 = makeSender();
  const w2 = makeSender();
  const wB = makeSender();
  rooms.registerWeb('A', w1);
  rooms.registerWeb('A', w2);
  rooms.registerWeb('B', wB);
  rooms.sendToWebs('A', { type: 'hello' });
  assert.equal(w1.received.length, 1);
  assert.equal(w2.received.length, 1);
  assert.equal(wB.received.length, 0);
  assert.deepEqual(JSON.parse(w1.received[0]), { type: 'hello' });
});

test('registerMenubar emits presence(true) to existing webs in that token', () => {
  const rooms = new Rooms();
  const w1 = makeSender();
  const w2 = makeSender();
  rooms.registerWeb('A', w1);
  rooms.registerWeb('A', w2);
  const mb = makeSender();
  rooms.registerMenubar('A', mb);
  assert.equal(w1.received.length, 1);
  assert.deepEqual(JSON.parse(w1.received[0]), { type: 'menubar_presence', online: true });
  assert.equal(w2.received.length, 1);
  assert.deepEqual(JSON.parse(w2.received[0]), { type: 'menubar_presence', online: true });
});

test('unregister menubar emits presence(false) to webs and menubarFor returns null', () => {
  const rooms = new Rooms();
  const w = makeSender();
  const mb = makeSender();
  rooms.registerWeb('A', w);
  rooms.registerMenubar('A', mb);
  // clear presence(true) notification
  w.received.length = 0;
  rooms.unregister(mb);
  assert.equal(w.received.length, 1);
  assert.deepEqual(JSON.parse(w.received[0]), { type: 'menubar_presence', online: false });
  assert.equal(rooms.menubarFor('A'), null);
});

test('sendToMenubar returns false when no menubar registered', () => {
  const rooms = new Rooms();
  rooms.registerWeb('A', makeSender());
  const result = rooms.sendToMenubar('A', { type: 'ping' });
  assert.equal(result, false);
});

test('unregister web removes it from websFor and does not emit presence', () => {
  const rooms = new Rooms();
  const w1 = makeSender();
  const w2 = makeSender();
  const mb = makeSender();
  rooms.registerWeb('A', w1);
  rooms.registerWeb('A', w2);
  rooms.registerMenubar('A', mb);
  // clear presence notifications
  w1.received.length = 0;
  w2.received.length = 0;
  rooms.unregister(w1);
  assert.deepEqual(rooms.websFor('A'), [w2]);
  assert.equal(w1.received.length, 0);
  assert.equal(w2.received.length, 0);
});
