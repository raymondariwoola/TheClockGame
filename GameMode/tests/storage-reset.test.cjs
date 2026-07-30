const assert = require('node:assert/strict');

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

global.localStorage = new MemoryStorage({
  cs_best_score: '5000',
  cs_best_combo: '12',
  cs_best_round: '40',
  cs_player_name: '{"first":"Family","last":"Player"}',
  cs_achievements_v1: '{"first_strike":true}',
});

const storage = require('../js/storage.js');
const configSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '..', 'local-reset-config.js'), 'utf8');
const statKeys = ['cs_best_score', 'cs_best_combo', 'cs_best_round'];
const marker = 'cs_local_stats_reset_applied';

assert.match(configSource, /personalStatsId:\s*'2026-07-31-family-reset-1'/, 'the initial production reset is explicit');
assert.match(configSource, /brand-new unique/, 'future owner reset instructions stay beside the flag');

const first = storage.resetKeysOnce('reset-1', statKeys, marker);
assert.equal(first.applied, true);
assert.deepEqual(first.removed.sort(), [...statKeys].sort());
for (const key of statKeys) assert.equal(global.localStorage.getItem(key), null);
assert.equal(global.localStorage.getItem(marker), 'reset-1');
assert.ok(global.localStorage.getItem('cs_player_name'), 'player identity is preserved');
assert.ok(global.localStorage.getItem('cs_achievements_v1'), 'achievements are preserved');

// Scores earned after the reset must survive every ordinary reload carrying
// the same reset ID.
global.localStorage.setItem('cs_best_score', '750');
global.localStorage.setItem('cs_best_combo', '4');
global.localStorage.setItem('cs_best_round', '8');
const reload = storage.resetKeysOnce('reset-1', statKeys, marker);
assert.deepEqual(reload, { applied: false, resetId: 'reset-1', removed: [] });
assert.equal(global.localStorage.getItem('cs_best_score'), '750');
assert.equal(global.localStorage.getItem('cs_best_combo'), '4');
assert.equal(global.localStorage.getItem('cs_best_round'), '8');

// A deliberately changed owner ID starts exactly one new reset cycle.
const future = storage.resetKeysOnce('reset-2', statKeys, marker);
assert.equal(future.applied, true);
for (const key of statKeys) assert.equal(global.localStorage.getItem(key), null);
assert.equal(global.localStorage.getItem(marker), 'reset-2');
assert.equal(storage.resetKeysOnce('reset-2', statKeys, marker).applied, false);

console.log('✓ versioned personal-stat reset runs once per reset ID');
