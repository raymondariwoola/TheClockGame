import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const env = {
  RUN_SIGNING_SECRET: 'unit-test-signing-secret-that-is-long-enough',
  LEADERBOARD_ROOM: {
    getByName() {
      return { fetch: async () => Response.json({ entries: [], total: 0 }) };
    },
  },
};

test('public leaderboard reads reject obsolete rulesets', async () => {
  const oldBoard = await worker.fetch(new Request('https://worker.test/v1/leaderboards?scope=standard&mode=classic&difficulty=normal&rulesetVersion=2'), env);
  assert.equal(oldBoard.status, 409);
  assert.deepEqual(await oldBoard.json(), { error: 'unsupported_ruleset' });

  const currentBoard = await worker.fetch(new Request('https://worker.test/v1/leaderboards?scope=standard&mode=classic&difficulty=normal&rulesetVersion=3'), env);
  assert.equal(currentBoard.status, 200);
});

test('run issuance rejects stale clients before they create hidden boards', async () => {
  const body = (rulesetVersion) => ({
    runType: 'classic', mode: 'classic', difficulty: 'normal', rulesetVersion, seed: 'unit-seed',
  });
  const oldRun = await worker.fetch(new Request('https://worker.test/v1/runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(2)),
  }), env);
  assert.equal(oldRun.status, 400);
  assert.deepEqual(await oldRun.json(), { error: 'invalid_run_context' });

  const currentRun = await worker.fetch(new Request('https://worker.test/v1/runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(3)),
  }), env);
  assert.equal(currentRun.status, 200);
  assert.ok((await currentRun.json()).finishToken);
});
