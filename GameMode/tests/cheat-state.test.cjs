const assert = require('node:assert/strict');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

global.sessionStorage = new MemoryStorage();
delete require.cache[require.resolve('../js/cheat-state.js')];
const Cheats = require('../js/cheat-state.js');

assert.equal(Cheats.isUnlocked(), false);
assert.equal(Cheats.setMaster(true), false, 'locked state cannot be armed');
Cheats.unlock();
Cheats.setMaster(true);
Cheats.setValue('autoPerfect', true);
Cheats.setValue('scoreMultiplier', 10);
assert.equal(Cheats.enabled('autoPerfect'), true);
assert.equal(Cheats.effectValue('scoreMultiplier'), 10);
assert.equal(Cheats.engaged(), true);

Cheats.setMaster(false);
assert.equal(Cheats.enabled('autoPerfect'), false, 'master disarms but preserves selection');
assert.equal(Cheats.getValue('autoPerfect'), true);
Cheats.setMaster(true);
assert.equal(Cheats.enabled('autoPerfect'), true, 'selection re-arms without a reset');

assert.equal(Cheats.setValue('scoreMultiplier', 999), false, 'unregistered values are rejected');
assert.equal(Cheats.clampScore(Infinity), 0);
assert.equal(Cheats.clampScore(9_000_000_000), Cheats.SCORE_CEILING);

Cheats.disableAll();
assert.equal(Cheats.isUnlocked(), true, 'disable all does not lock the menu');
assert.equal(Cheats.engaged(), false);
assert.equal(Cheats.getValue('scoreMultiplier'), 1);

console.log('✓ cheat state tests passed');
