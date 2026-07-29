import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardRoom } from '../src/leaderboard-room.js';
import { normalizeBoardQuery, parseBoardQuery, partitionKey, sanitizeEntry, validateProgress } from '../src/validation.js';

class FakeStorage {
  constructor() { this.values = new Map(); this.queue = Promise.resolve(); }
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  transaction(callback) {
    const result = this.queue.then(() => callback(this));
    this.queue = result.catch(() => {});
    return result;
  }
}

function entry(overrides = {}) {
  return {
    id: 'entry-one', name: 'Ada Player', score: 4200, mode: 'classic', round: 40,
    combo: 12, acc: 91, perfect: 28, rulesetVersion: 1, seed: 'seed-one',
    date: '2026-07-30T00:00:00.000Z', ...overrides,
  };
}

test('sanitizer accepts bounded cheat-altered results without persisting cheat metadata', () => {
  const value = sanitizeEntry(entry({ score: 999999, cheat: true, cheated: true }));
  assert.equal(value.score, 999999);
  assert.equal(Object.hasOwn(value, 'cheat'), false);
  assert.equal(Object.hasOwn(value, 'cheated'), false);
});

test('board partitions keep daily, difficulty, and ruleset separate', () => {
  const standard = normalizeBoardQuery({ mode: 'classic', difficulty: 'normal', rulesetVersion: 1 });
  const hardcore = normalizeBoardQuery({ mode: 'classic', difficulty: 'hardcore', rulesetVersion: 1 });
  const daily = normalizeBoardQuery({ scope: 'daily', dailyDate: '2026-07-30', rulesetVersion: 1 });
  assert.notEqual(partitionKey(standard), partitionKey(hardcore));
  assert.notEqual(partitionKey(standard), partitionKey(daily));
  assert.equal(parseBoardQuery({ mode: 'invented' }), null);
  assert.equal(parseBoardQuery({ scope: 'daily' }), null);
});

test('progress validation requires bounded monotonic cumulative values', () => {
  const final = entry();
  assert.equal(validateProgress([{ score: 100, round: 1 }, { score: 4200, round: 40 }], final), true);
  assert.equal(validateProgress([{ score: 500, round: 2 }, { score: 400, round: 3 }], entry({ score: 400, round: 3 })), false);
  assert.equal(validateProgress(Array.from({ length: 513 }, (_, round) => ({ score: round, round })), entry({ score: 512, round: 512 })), false);
});

test('Durable Object submits atomically, returns top twenty, and makes retries idempotent', async () => {
  const storage = new FakeStorage();
  const room = new LeaderboardRoom({ storage });
  const url = 'https://worker.test/submit?mode=classic&difficulty=normal&rulesetVersion=1';
  const submissions = [];
  for (let index = 0; index < 25; index++) {
    const candidate = entry({ id: `entry-${index}`, score: 1000 + index, date: new Date(2026, 0, index + 1).toISOString() });
    submissions.push(room.fetch(new Request(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry: candidate, submissionKey: `run-${index}` }),
    })));
  }
  for (const response of await Promise.all(submissions)) {
    assert.equal(response.status, 200);
  }
  const board = await room.fetch(new Request('https://worker.test/entries?mode=classic&difficulty=normal&rulesetVersion=1'));
  const data = await board.json();
  assert.equal(data.entries.length, 20);
  assert.equal(data.total, 25);
  assert.equal(data.entries[0].score, 1024);

  const retry = await room.fetch(new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry: entry({ id: 'replacement', score: 999999 }), submissionKey: 'run-24' }),
  }));
  assert.equal((await retry.json()).entryId, 'entry-24');
});
