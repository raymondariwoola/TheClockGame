import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMatchRequest } from '../src/match-api.js';
import { MATCH_LIMITS } from '../../shared/match-protocol.mjs';

function environment(calls) {
  return {
    MULTIPLAYER_ENABLED: 'true',
    MATCH_ROOM: {
      getByName: () => ({
        fetch: async (request) => {
          calls.push({ path: new URL(request.url).pathname, value: request.method === 'POST' ? await request.json() : null });
          return Response.json({ ok: true, room: { state: 'waiting' } }, { status: request.url.endsWith('/init') ? 201 : 200 });
        },
      }),
    },
  };
}

test('match API negotiates full-length and legacy clients during a rolling update', async () => {
  const calls = []; const env = environment(calls);
  let response = await handleMatchRequest(new Request('https://worker.test/v1/matches', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': 'round-host' },
    body: JSON.stringify({ name: 'Host', difficulty: 'normal', roundLimit: MATCH_LIMITS.rounds }),
  }), env, {});
  assert.equal(response.status, 201);
  assert.equal(calls[0].value.roundLimit, MATCH_LIMITS.rounds);

  response = await handleMatchRequest(new Request('https://worker.test/v1/matches', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': 'legacy-host' },
    body: JSON.stringify({ name: 'Old Host', difficulty: 'normal' }),
  }), env, {});
  assert.equal(response.status, 201);
  assert.equal(calls[1].value.roundLimit, MATCH_LIMITS.legacyRounds);

  response = await handleMatchRequest(new Request('https://worker.test/v1/matches/ABCD-EFGH/join', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': 'round-guest' },
    body: JSON.stringify({ name: 'Guest', maxRoundLimit: MATCH_LIMITS.rounds }),
  }), env, {});
  assert.equal(response.status, 200);
  assert.equal(calls[2].value.maxRoundLimit, MATCH_LIMITS.rounds);
});
