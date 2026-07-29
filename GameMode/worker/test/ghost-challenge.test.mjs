import test from 'node:test';
import assert from 'node:assert/strict';
import { GhostChallengeRoom, GHOST_DRAFT_MS, GHOST_LIFETIME_MS } from '../src/ghost-challenge-room.js';
import { sanitizeReplay } from '../src/ghost-validation.js';

class Storage {
  constructor() { this.values = new Map(); this.alarm = null; }
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async setAlarm(value) { this.alarm = value; }
  async deleteAlarm() { this.alarm = null; }
  async deleteAll() { this.values.clear(); }
}

const draft = {
  code: '2345-6789', name: 'Host Player', hostTokenHash: 'host-hash',
  mode: 'classic', difficulty: 'normal', identity: '1.1.0|1|classic|n|seed',
  seed: 'seed', rulesetVersion: 1, hideHostScore: true,
};
const replay = {
  identity: draft.identity, mode: 'classic', hardcore: false, gameVersion: '1.1.0', rulesetVersion: 1,
  score: 160, rounds: 2,
  strikes: [
    { round: 1, angle: 20, kind: 'perfect', t: 100, s: 100, cheat: true },
    { round: 2, angle: 40, kind: 'great', t: 200, s: 160 },
  ],
};
const hostResult = { score: 160, round: 2, perfect: 1, combo: 2, acc: 100 };

function post(path, body) {
  return new Request(`https://ghost.test${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('replay sanitizer bounds events and strips undeclared cheat metadata', () => {
  const clean = sanitizeReplay(replay, draft);
  assert.equal(clean.strikes.length, 2);
  assert.equal(Object.hasOwn(clean.strikes[0], 'cheat'), false);
  assert.equal(sanitizeReplay({ ...replay, strikes: Array(513).fill(replay.strikes[0]) }, draft), null);
});

test('ghost room supports draft, idempotent host finish, hidden score, guest result, and expiry', async () => {
  const storage = new Storage();
  const env = { __TEST_NOW: 1_000_000 };
  const room = new GhostChallengeRoom({ storage }, env);
  const created = await room.fetch(post('/init', draft));
  assert.equal(created.status, 201);
  assert.equal(storage.alarm, env.__TEST_NOW + GHOST_DRAFT_MS);

  const hostFinish = await room.fetch(post('/finish', { tokenHash: 'host-hash', result: hostResult, replay }));
  assert.equal(hostFinish.status, 200);
  assert.equal((await hostFinish.json()).challenge.state, 'open');
  assert.equal(storage.alarm, env.__TEST_NOW + GHOST_LIFETIME_MS);
  const retry = await room.fetch(post('/finish', { tokenHash: 'host-hash', result: { score: 999 }, replay }));
  assert.equal((await retry.json()).idempotent, true);

  const joined = await room.fetch(post('/join', { guestName: 'Guest', guestTokenHash: 'guest-hash' }));
  const joinedData = await joined.json();
  assert.equal(joinedData.challenge.host.result, null, 'hidden host final stays hidden before guest finish');
  assert.equal(joinedData.challenge.replay.strikes[1].s, 0, 'cumulative replay score is hidden too');

  const guestFinish = await room.fetch(post('/finish', {
    tokenHash: 'guest-hash', result: { score: 200, round: 2, perfect: 2, combo: 2, acc: 100 },
  }));
  const finished = await guestFinish.json();
  assert.equal(finished.challenge.state, 'finished');
  assert.equal(finished.challenge.result.winner, 'guest');
  assert.equal(finished.challenge.host.result.score, 160);

  await room.alarm();
  assert.equal(await storage.get('challenge'), undefined);
  assert.equal(storage.alarm, null);
});
