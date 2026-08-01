import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchRoom, MATCH_TIMES } from '../src/match-room.js';
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
const result = (score) => ({ score, round: 1, perfect: 1, perfectStreak: 1, combo: 2, acc: 100, attempts: 1, cheated: true, cheats: ['hidden'] });
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1]);

test('match room runs a tie through sudden death and accepts cheat-altered ordinary progress', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 1_000_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  let response = await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', roundLimit: MATCH_LIMITS.rounds, hostTokenHash: 'a'.repeat(64) }));
  assert.equal(response.status, 201);
  response = await room.fetch(request('/join', { name: 'Guest', maxRoundLimit: MATCH_LIMITS.rounds, tokenHash: 'b'.repeat(64) }));
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
  assert.equal(stored.result.story.suddenDeath, 1);
  assert.equal(stored.result.story.margin, 100);

  const publicState = await (await room.fetch(request('/state'))).json();
  assert.equal(JSON.stringify(publicState).includes('tokenHash'), false);
  assert.equal(JSON.stringify(publicState).toLowerCase().includes('cheat'), false);
});

test('match room creates a fresh full-length seed after both rematch votes', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 2_000_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'hardcore', roundLimit: MATCH_LIMITS.rounds, hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', maxRoundLimit: MATCH_LIMITS.rounds, tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);
  await room.webSocketMessage(host, envelope('ready', 0)); await room.webSocketMessage(guest, envelope('ready', 0));
  let stored = await ctx.storage.get('room'); const firstSeed = stored.seed; env.__TEST_NOW = stored.startAt + 1;
  await room.webSocketMessage(host, envelope('finish', 1, result(1000))); await room.webSocketMessage(guest, envelope('finish', 1, result(900)));
  await room.webSocketMessage(host, envelope('rematch_vote', 2)); await room.webSocketMessage(guest, envelope('rematch_vote', 2));
  stored = await ctx.storage.get('room');
  assert.equal(stored.matchNumber, 2); assert.equal(stored.roundLimit, MATCH_LIMITS.rounds); assert.notEqual(stored.seed, firstSeed);
});

test('full-length rooms reject an outdated guest while legacy rooms remain playable', async () => {
  const modernContext = new Context(); const env = { __TEST_NOW: 2_250_000, MULTIPLAYER_ENABLED: 'true' };
  const modern = new MatchRoom(modernContext, env);
  await modern.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', roundLimit: MATCH_LIMITS.rounds, hostTokenHash: 'a'.repeat(64) }));
  let response = await modern.fetch(request('/join', { name: 'Old Guest', tokenHash: 'b'.repeat(64) }));
  assert.equal(response.status, 409); assert.equal((await response.json()).error, 'client_update_required');
  response = await modern.fetch(request('/join', { name: 'New Guest', maxRoundLimit: MATCH_LIMITS.rounds, tokenHash: 'c'.repeat(64) }));
  assert.equal(response.status, 200);

  const legacyContext = new Context(); const legacy = new MatchRoom(legacyContext, env);
  await legacy.fetch(request('/init', { code: 'JKLM-NPQR', name: 'Old Host', difficulty: 'normal', hostTokenHash: 'd'.repeat(64) }));
  response = await legacy.fetch(request('/join', { name: 'Old Guest', tokenHash: 'e'.repeat(64) }));
  assert.equal(response.status, 200);
  assert.equal((await legacyContext.storage.get('room')).roundLimit, MATCH_LIMITS.legacyRounds);
});

test('active heartbeats extend a 45-minute inactivity window', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 2_500_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);
  await room.webSocketMessage(host, envelope('ready', 0)); await room.webSocketMessage(guest, envelope('ready', 0));
  let stored = await ctx.storage.get('room'); env.__TEST_NOW = stored.startAt + 1;
  await room.webSocketMessage(host, envelope('heartbeat', 1));
  stored = await ctx.storage.get('room');
  assert.equal(MATCH_TIMES.active, 45 * 60 * 1000);
  assert.equal(stored.expiresAt, env.__TEST_NOW + MATCH_TIMES.active);

  env.__TEST_NOW += 25 * 60 * 1000;
  await room.webSocketMessage(guest, envelope('heartbeat', 1));
  stored = await ctx.storage.get('room');
  assert.equal(stored.state, 'playing');
  assert.equal(stored.expiresAt, env.__TEST_NOW + MATCH_TIMES.active);
});

test('a dropped live connection gets the full two-minute grace before forfeit', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 2_750_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);
  await room.webSocketMessage(host, envelope('ready', 0)); await room.webSocketMessage(guest, envelope('ready', 0));
  let stored = await ctx.storage.get('room'); env.__TEST_NOW = stored.startAt + 1;
  await room.webSocketMessage(guest, envelope('progress', 1, result(100)));
  host.readyState = 3; await room.webSocketClose(host, 1006, 'network changed');
  stored = await ctx.storage.get('room'); const disconnectedAt = stored.seats.host.disconnectedAt;
  assert.equal(MATCH_TIMES.disconnect, 2 * 60 * 1000);
  assert.equal(stored.state, 'playing');

  env.__TEST_NOW = disconnectedAt + MATCH_TIMES.disconnect - 1;
  await room.alarm();
  assert.equal((await ctx.storage.get('room')).state, 'playing');

  env.__TEST_NOW = disconnectedAt + MATCH_TIMES.disconnect;
  await room.alarm(); stored = await ctx.storage.get('room');
  assert.equal(stored.state, 'forfeit');
  assert.equal(stored.result.reason, 'disconnect');
  assert.equal(stored.result.loser, 'host');
});

test('preset reactions are allowlisted, ephemeral, opponent-only, and throttled', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 3_000_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);

  await room.webSocketMessage(host, envelope('reaction', 0, { id: 'nice' }));
  assert.deepEqual(guest.sent.at(-1), { v: MATCH_PROTOCOL_VERSION, type: 'reaction', payload: { seat: 'host', id: 'nice' } });
  assert.deepEqual(host.sent.at(-1), { v: MATCH_PROTOCOL_VERSION, type: 'reaction_ack', payload: { id: 'nice', delivered: true } });
  let stored = await ctx.storage.get('room');
  assert.equal(JSON.stringify(stored).includes('reaction'), false, 'reactions are not stored in room history');

  await room.webSocketMessage(host, envelope('reaction', 1, { id: 'custom text' }));
  assert.equal(host.sent.at(-1).payload.code, 'invalid_reaction');
  await room.webSocketMessage(host, envelope('reaction', 2, { id: 'gg' }));
  assert.equal(host.sent.at(-1).payload.code, 'reaction_rate_limited');

  env.__TEST_NOW += 1200;
  await room.webSocketMessage(host, envelope('reaction', 3, { id: 'gg' }));
  assert.equal(guest.sent.at(-1).payload.id, 'gg');
  assert.equal(host.sent.at(-1).payload.delivered, true);
});

test('three-Perfect streaks earn capped Time Shards and sabotage one telegraphed next round', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 4_000_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);
  await room.webSocketMessage(host, envelope('ready', 0)); await room.webSocketMessage(guest, envelope('ready', 0));
  let stored = await ctx.storage.get('room'); env.__TEST_NOW = stored.startAt + 1;
  const streak = (round, seq) => room.webSocketMessage(host, envelope('progress', seq, {
    score: round * 100, round, perfect: round, perfectStreak: round, combo: 1 + Math.floor(round / 3), acc: 100, attempts: round,
  }));
  await streak(1, 1); await streak(2, 2); await streak(3, 3);
  stored = await ctx.storage.get('room');
  assert.equal(stored.seats.host.shards, 1); assert.equal(stored.seats.host.shardsEarned, 1);
  assert.equal(host.sent.some((message) => message.type === 'shard_state'), true);

  await room.webSocketMessage(host, envelope('sabotage', 4, { effect: 'reverse' }));
  stored = await ctx.storage.get('room');
  assert.equal(stored.seats.host.shards, 0); assert.equal(stored.seats.host.sabotagesUsed, 1);
  assert.deepEqual(stored.sabotages[0], { id: '1-host-1', by: 'host', target: 'guest', effect: 'reverse', round: 4, at: env.__TEST_NOW });
  const telegraph = guest.sent.findLast((message) => message.type === 'sabotage');
  assert.equal(telegraph.payload.sabotage.round, 4); assert.equal(telegraph.payload.sabotage.effect, 'reverse');

  await room.webSocketMessage(host, envelope('sabotage', 5, { effect: 'haste' }));
  assert.equal(host.sent.at(-1).payload.code, 'no_shards');
  await room.webSocketMessage(guest, envelope('sabotage', 1, { effect: 'not-real' }));
  assert.equal(guest.sent.at(-1).payload.code, 'invalid_sabotage');
});

test('legacy Clash progress without perfectStreak remains valid during a rolling deployment', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 4_500_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);
  await room.webSocketMessage(host, envelope('ready', 0)); await room.webSocketMessage(guest, envelope('ready', 0));
  const stored = await ctx.storage.get('room'); env.__TEST_NOW = stored.startAt + 1;
  await room.webSocketMessage(host, envelope('progress', 1, { score: 100, round: 1, perfect: 1, combo: 1, acc: 100, attempts: 1 }));
  assert.equal(host.sent.some((message) => message.type === 'error' && message.payload.code === 'invalid_progress'), false);
  assert.equal((await ctx.storage.get('room')).seats.host.progress.perfectStreak, 0);
});

test('match room retains compact lead-change counters without a progress timeline', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 5_000_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);
  await room.webSocketMessage(host, envelope('ready', 0)); await room.webSocketMessage(guest, envelope('ready', 0));
  let stored = await ctx.storage.get('room'); env.__TEST_NOW = stored.startAt + 1;
  const progress = (score, round, attempts) => ({ score, round, perfect: 0, perfectStreak: 0, combo: 1, acc: 50, attempts });
  await room.webSocketMessage(host, envelope('progress', 1, progress(100, 1, 1)));
  await room.webSocketMessage(guest, envelope('progress', 1, progress(200, 1, 1)));
  await room.webSocketMessage(host, envelope('progress', 2, progress(300, 2, 2)));
  stored = await ctx.storage.get('room');
  assert.deepEqual(stored.story, { leader: 'host', leadChanges: 2, closestGap: 100 });
  assert.equal('history' in stored.story, false); assert.equal('timeline' in stored.story, false);
});

test('voluntary handicap presets are frozen per seat and survive rematch acceptance', async () => {
  const ctx = new Context(); const env = { __TEST_NOW: 5_500_000, MULTIPLAYER_ENABLED: 'true' };
  const room = new MatchRoom(ctx, env);
  await room.fetch(request('/init', { code: 'ABCD-EFGH', name: 'Host', difficulty: 'normal', handicap: 'headstart', hostTokenHash: 'a'.repeat(64) }));
  await room.fetch(request('/join', { name: 'Guest', handicap: 'wider', tokenHash: 'b'.repeat(64) }));
  const host = new Socket('host'); const guest = new Socket('guest'); ctx.sockets.push(host, guest);
  await room.webSocketMessage(host, envelope('ready', 0)); await room.webSocketMessage(guest, envelope('ready', 0));
  let stored = await ctx.storage.get('room');
  assert.equal(stored.seats.host.handicap, 'headstart'); assert.equal(stored.seats.guest.handicap, 'wider');
  assert.equal(stored.seats.host.ready, true); assert.equal(stored.seats.guest.ready, true);
  env.__TEST_NOW = stored.startAt + 1;
  await room.webSocketMessage(host, envelope('finish', 1, result(1000))); await room.webSocketMessage(guest, envelope('finish', 1, result(900)));
  await room.webSocketMessage(host, envelope('rematch_vote', 2)); await room.webSocketMessage(guest, envelope('rematch_vote', 2));
  stored = await ctx.storage.get('room');
  assert.equal(stored.seats.host.handicap, 'headstart'); assert.equal(stored.seats.guest.handicap, 'wider');
});
