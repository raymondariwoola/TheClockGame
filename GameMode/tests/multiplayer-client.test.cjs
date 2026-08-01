const assert = require('node:assert/strict');
const { MultiplayerClient, REACTIONS, buildUrl, codeFromUrl } = require('../js/multiplayer.js');
class Store { constructor() { this.map = new Map(); } getItem(k) { return this.map.get(k) || null; } setItem(k, v) { this.map.set(k, v); } removeItem(k) { this.map.delete(k); } }
class Socket {
  static values = []; constructor(url, protocols) { this.url = url; this.protocols = protocols; this.readyState = 0; this.listeners = new Map(); this.sent = []; Socket.values.push(this); }
  addEventListener(k, fn) { if (!this.listeners.has(k)) this.listeners.set(k, []); this.listeners.get(k).push(fn); }
  emit(k, value = {}) { if (k === 'open') this.readyState = 1; for (const fn of this.listeners.get(k) || []) fn(value); }
  send(value) { this.sent.push(JSON.parse(value)); } close() { this.readyState = 3; }
}
const response = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

(async () => {
  assert.equal(buildUrl('https://game.test/GameMode/?old=1#x', 'abcd efgh'), 'https://game.test/GameMode/?duel=ABCD-EFGH');
  assert.equal(codeFromUrl('https://game.test/?duel=abcd-efgh&token=nope'), 'ABCD-EFGH');
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/v1/matches')) return response(201, { ok: true, code: 'ABCD-EFGH', hostToken: 'a'.repeat(48), room: { state: 'waiting' } });
    if (url.endsWith('/ticket')) return response(201, { ok: true, ticket: 'b'.repeat(48) });
    if (url.endsWith('/share-card')) return response(201, { ok: true });
    throw new Error('unexpected');
  };
  const client = new MultiplayerClient({ baseUrl: 'https://worker.test', fetchImpl, WebSocketImpl: Socket, sessionStore: new Store(), heartbeatMs: 0 });
  await client.create({ name: 'Host', difficulty: 'normal' });
  await client.uploadShareCard(new Blob(['png'], { type: 'image/png' }), client.code);
  const connecting = client.connect();
  for (let i = 0; i < 10 && !Socket.values.length; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = Socket.values[0];
  assert.equal(socket.url, 'wss://worker.test/v1/matches/ABCD-EFGH/socket');
  assert.equal(socket.url.includes('ticket'), false); assert.equal(socket.protocols[1], `chronos-ticket.${'b'.repeat(48)}`);
  assert.equal(requests[1].options.method, 'PUT');
  assert.equal(requests[2].options.headers.Authorization, `Bearer ${'a'.repeat(48)}`);
  socket.emit('open'); await connecting; client.ready(); client.progress({ score: 1 }); client.reaction('nice');
  assert.deepEqual(socket.sent.map((value) => value.seq), [0, 1, 2]);
  assert.deepEqual(socket.sent[2].payload, { id: 'nice' });
  assert.equal(REACTIONS.gg.label, 'Good game!');
  assert.throws(() => client.reaction('custom text'), /invalid_reaction/);
  assert.equal(buildUrl('https://game.test/', client.code).includes('token'), false);
  client.disconnect();
  console.log('✓ multiplayer client tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
