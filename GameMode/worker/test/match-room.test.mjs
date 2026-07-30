import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchRoom } from '../src/match-room.js';
import { MATCH_LIMITS, MATCH_PROTOCOL_VERSION } from '../../shared/match-protocol.mjs';

class Storage {
  constructor() { this.map = new Map(); this.alarm = null; }
  async get(key) { return this.map.get(key); }
  async put(key, value) { this.map.set(key, structuredClone(value)); }
  async delete(key) { this.map.delete(key); }
  async deleteAll() { this.map.clear(); }
  async setAlarm(value) { this.alarm = value; }
  async deleteAlarm() { this.alarm = null; }
}
class Socket {
  constructor(seat) { this.info = { seat, windowAt: 0, messages: 0 }; this.sent = []; this.readyState = 1; }
  deserializeAttachment() { return this.info; }
  serializeAttachment(value) { this.info = value; }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; }
}
class Context {
  constructor() { this.storage = new Storage(); this.sockets = []; }
  getWebSockets(tag) { return tag ? this.sockets.filter((socket) => `seat:${socket.info.seat}` === tag) : this.sockets; }
  acceptWebSocket(socket) { this.sockets.push(socket); }
}
const request = (path, value, method = value == null ? 'GET' : 'POST') => new Request(`https://match.internal${path}`, {
  method, headers: value == null ? undefined : { 'Content-Type': 'application/json' }, body: value == null ? undefined : JSON.stringify(value),
});
const envelope = (type, seq, payload = {}) => JSON.stringify({ v: MATCH_PROTOCOL_VERSION, type, seq, payload });
const result = (score) => ({ score, round: 1, perfect: 1, combo: 2, acc: 100, attempts: 1, cheated: true, cheats: ['hidden'] });
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1]);

test('match room runs a tie through sudden death and accepts cheat-altered ordinary progress', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 1_000_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  let response = await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', hostTokenHash: 'a'.repeat(64) }));
  assert.equal(response.status, 201);
  response = await room.fetch(request('/join', { name: 'Guest', tokenHash: 'b'.repeat(64) }));
  assert.equal(response.status, 200);
  response = await room.fetch(new Request('https://match.internal/share-card', { method: 'PUT', headers: { 'Content-Type': 'image/png', 'X-Host-Token-Hash': 'a'.repeat(64) }, body: png }));
  assert.equal(response.status, 201);
  response = await room.fetch(new Request('https://match.internal/share-card'));
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);

  await room.webSocketMessage(host, envelope('ready', 0));
  await room.webSocketMessage(guest, envelope('ready', 0));
  let stored = await ctx.storage.get('room');
  assert.equal(stored.state, 'countdown');
  assert.equal(stored.roundLimit, MATCH_LIMITS.rounds);
  env.__TEST_NOW = stored.startAt + 1;
  await room.webSocketMessage(host, envelope('finish', 1, result(1000)));
  await room.webSocketMessage(guest, envelope('finish', 1, result(1000)));
  stored = await ctx.storage.get('room');
  assert.equal(stored.state, 'countdown');
  assert.equal(stored.suddenDeath, 1);
  assert.equal(stored.roundLimit, 1);
  assert.equal('cheated' in stored.seats.host.progress, false);
  assert.equal('cheats' in stored.seats.host.progress, false);

  env.__TEST_NOW = stored.startAt + 1;
  await room.webSocketMessage(host, envelope('finish', 2, result(1000)));
  await room.webSocketMessage(guest, envelope('finish', 2, result(1100)));
  stored = await ctx.storage.get('room');
  assert.equal(stored.state, 'finished');
  assert.equal(stored.result.winner, 'guest');
  assert.equal(stored.result.reason, 'score');

  const publicState = await (await room.fetch(request('/state'))).json();
  assert.equal(JSON.stringify(publicState).includes('tokenHash'), false);
  assert.equal(JSON.stringify(publicState).toLowerCase().includes('cheat'), false);
});

test('match room creates a fresh ten-round seed after both rematch votes', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 2_000_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'hardcore', hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);
  await room.webSocketMessage(host, envelope('ready', 0)); await room.webSocketMessage(guest, envelope('ready', 0));
  let stored = await ctx.storage.get('room'); const firstSeed = stored.seed; env.__TEST_NOW = stored.startAt + 1;
  await room.webSocketMessage(host, envelope('finish', 1, result(1000))); await room.webSocketMessage(guest, envelope('finish', 1, result(900)));
  await room.webSocketMessage(host, envelope('rematch_vote', 2)); await room.webSocketMessage(guest, envelope('rematch_vote', 2));
  stored = await ctx.storage.get('room');
  assert.equal(stored.matchNumber, 2); assert.equal(stored.roundLimit, 10); assert.notEqual(stored.seed, firstSeed);
});
