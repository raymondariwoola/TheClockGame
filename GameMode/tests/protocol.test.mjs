import assert from 'node:assert/strict';
import {
  LIMITS, cleanName, compareResults, envelope, normalizeProgress, normalizeRoomCode, parseEnvelope,
} from '../shared/protocol.mjs';

assert.equal(normalizeRoomCode('abcd efgh'), 'ABCD-EFGH');
assert.equal(normalizeRoomCode('bad'), null);
assert.equal(cleanName('<b>Ada</b>'), 'bAda/b');
assert.deepEqual(normalizeProgress({ score: Infinity, round: -1, perfects: 2, bestCombo: 4, accuracy: 140, cheated: true }), {
  score: 0, round: 0, perfects: 2, bestCombo: 4, accuracy: 100, finished: false,
});
assert.equal(Object.hasOwn(normalizeProgress({ cheated: true }), 'cheated'), false);
assert.equal(compareResults({ score: 10 }, { score: 9 }), 1);
assert.equal(compareResults({ score: 10, perfects: 2 }, { score: 10, perfects: 3 }), -1);
assert.equal(compareResults({ score: 10 }, { score: 10 }), 0);
const valid = envelope('ready', { ok: true }, 1);
assert.deepEqual(parseEnvelope(valid), valid);
assert.equal(parseEnvelope({ ...valid, v: 999 }), null);
assert.equal(LIMITS.maxScore, 2_000_000_000);
console.log('✓ shared protocol tests passed');
