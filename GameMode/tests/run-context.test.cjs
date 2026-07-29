const assert = require('node:assert/strict');
const { RunContextStore } = require('../js/run-context.js');

const store = new RunContextStore();
const active = store.start({
  runId: 'r1', runType: 'daily', clientVersion: '1.1.0', rulesetVersion: 1,
  seed: 'daily|1|2026-07-30', identity: 'daily|1|2026-07-30', mode: 'classic',
  difficulty: 'normal', roundLimit: 40, assists: { visualBeat: true },
});
assert.equal(active.mode, 'classic');
assert.equal(Object.isFrozen(active), true);
assert.equal(Object.isFrozen(active.assists), true);
assert.throws(() => store.start({ runId: 'r2', seed: 'x', mode: 'classic' }), /run_already_active/);
const done = store.complete({ score: 123 });
assert.equal(done.score, 123);
assert.equal(store.snapshot(), null);
assert.equal(store.lastCompleted.runId, 'r1');
assert.equal(store.abandon(), null);
console.log('✓ run context tests passed');
