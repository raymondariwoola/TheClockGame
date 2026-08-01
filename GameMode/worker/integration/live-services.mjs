import assert from 'node:assert/strict';
import WebSocket from 'ws';

const HTTP = process.env.CHRONOS_WORKER_URL || 'http://127.0.0.1:8787';
const WS = HTTP.replace(/^http/, 'ws');
const ORIGIN = process.env.CHRONOS_TEST_ORIGIN || 'http://localhost:8000';
const TIMEOUT = 6000;

async function api(path, options = {}) {
  const response = await fetch(HTTP + path, { ...options, headers: { Origin: ORIGIN, ...(options.headers || {}) } });
  const value = await response.json(); return { response, value };
}
function post(value, token) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(value) };
}
class Inbox {
  constructor(socket) {
    this.socket = socket; this.messages = []; this.waiters = [];
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString()); const index = this.waiters.findIndex((waiter) => waiter.type === message.type);
      if (index >= 0) this.waiters.splice(index, 1)[0].resolve(message); else this.messages.push(message);
    });
  }
  next(type) {
    const index = this.messages.findIndex((value) => value.type === type);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { type, resolve: (value) => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => { this.waiters = this.waiters.filter((item) => item !== waiter); reject(new Error(`timeout:${type}`)); }, TIMEOUT);
      this.waiters.push(waiter);
    });
  }
  send(type, seq, payload = {}) { this.socket.send(JSON.stringify({ v: 1, type, seq, payload })); }
}
async function open(code, ticket) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${WS}/v1/matches/${code}/socket`, ['chronos-clash.v1', `chronos-ticket.${ticket}`], { origin: ORIGIN, handshakeTimeout: TIMEOUT });
    socket.once('open', () => resolve(new Inbox(socket))); socket.once('error', reject);
  });
}
const score = (value) => ({ score: value, round: 10, perfect: 4, perfectStreak: 0, combo: 3, acc: 80, attempts: 10, cheated: true, cheatMenu: 'must-not-persist' });

let host; let guest;
try {
  const health = await api('/v1/health'); assert.equal(health.value.features.multiplayer, true); assert.equal(health.value.features.ghosts, true);

  const ghostDraft = await api('/v1/ghosts', post({ name: 'Integration Host', mode: 'classic', difficulty: 'normal', identity: 'integration-ghost', seed: 'integration-ghost', rulesetVersion: 1, hideHostScore: true }));
  assert.equal(ghostDraft.response.status, 201);
  const replay = { identity: 'integration-ghost', mode: 'classic', hardcore: false, gameVersion: '1.0', rulesetVersion: 1, score: 100, rounds: 1, strikes: [{ round: 1, angle: 45, kind: 'perfect', t: 100, s: 100, cheated: true }] };
  const ghostOpen = await api(`/v1/ghosts/${ghostDraft.value.code}/finish`, post({ replay, result: { score: 100, round: 1, perfect: 1, combo: 1, acc: 100, cheated: true } }, ghostDraft.value.hostToken));
  assert.equal(ghostOpen.value.challenge.state, 'open');
  const ghostPublic = await api(`/v1/ghosts/${ghostDraft.value.code}`);
  assert.equal(ghostPublic.value.challenge.host.result, null);
  const ghostJoin = await api(`/v1/ghosts/${ghostDraft.value.code}/join`, post({ name: 'Integration Guest' }));
  const ghostFinish = await api(`/v1/ghosts/${ghostDraft.value.code}/finish`, post({ result: { score: 120, round: 1, perfect: 1, combo: 1, acc: 100 } }, ghostJoin.value.guestToken));
  assert.equal(ghostFinish.value.challenge.result.winner, 'guest'); assert.equal(JSON.stringify(ghostFinish.value).toLowerCase().includes('cheated'), false);

  const created = await api('/v1/matches', post({ name: 'Live Host', difficulty: 'normal' }));
  const joined = await api(`/v1/matches/${created.value.code}/join`, post({ name: 'Live Guest' }));
  const hostTicket = await api(`/v1/matches/${created.value.code}/ticket`, post({}, created.value.hostToken));
  const guestTicket = await api(`/v1/matches/${created.value.code}/ticket`, post({}, joined.value.playerToken));
  host = await open(created.value.code, hostTicket.value.ticket); await host.next('snapshot');
  guest = await open(created.value.code, guestTicket.value.ticket); await guest.next('snapshot');
  host.send('ready', 0); guest.send('ready', 0);
  const countdown = await host.next('countdown'); await guest.next('countdown');
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, countdown.payload.startAt - Date.now() + 80)));
  host.send('progress', 1, { ...score(100), round: 5, attempts: 5 });
  assert.equal((await guest.next('opponent_progress')).payload.progress.score, 100);
  host.send('finish', 2, score(300)); await guest.next('opponent_finished'); guest.send('finish', 1, score(200));
  const result = await host.next('result'); assert.equal(result.payload.room.result.winner, 'host');
  assert.equal(JSON.stringify(result).toLowerCase().includes('cheat'), false);
  host.send('rematch_vote', 3); guest.send('rematch_vote', 2);
  const rematch = await host.next('countdown'); await guest.next('countdown'); assert.notEqual(rematch.payload.seed, countdown.payload.seed);
  guest.send('forfeit', 3); const forfeit = await host.next('result'); assert.equal(forfeit.payload.room.result.winner, 'host');
  console.log(`✓ live Wrangler integration passed (match ${created.value.code}, ghost ${ghostDraft.value.code})`);
} finally {
  host?.socket.close(); guest?.socket.close();
}
