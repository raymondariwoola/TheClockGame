const assert = require('node:assert/strict');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

global.localStorage = new MemoryStorage();
global.sessionStorage = new MemoryStorage();
delete require.cache[require.resolve('../js/cheat-state.js')];
let Cheats = require('../js/cheat-state.js');

assert.equal(Cheats.isUnlocked(), false);
assert.equal(Cheats.setMaster(true), false, 'locked state cannot be armed');
Cheats.unlock();
Cheats.setMaster(true);
Cheats.setValue('autoPerfect', true);
Cheats.setValue('scoreMultiplier', 10);
assert.equal(Cheats.enabled('autoPerfect'), true);
assert.equal(Cheats.effectValue('scoreMultiplier'), 10);
assert.equal(Cheats.engaged(), true);
assert.equal(global.sessionStorage.getItem('cs_private_cheats_v2'), null, 'new state is not session-only');
assert.ok(global.localStorage.getItem('cs_private_cheats_v3'), 'new state is stored durably');

// A full module/page reload restores unlock, master, toggles, and selectors.
delete require.cache[require.resolve('../js/cheat-state.js')];
Cheats = require('../js/cheat-state.js');
assert.equal(Cheats.isUnlocked(), true, 'unlock survives browser restarts');
assert.equal(Cheats.isMaster(), true, 'master switch survives browser restarts');
assert.equal(Cheats.enabled('autoPerfect'), true, 'toggle survives browser restarts');
assert.equal(Cheats.effectValue('scoreMultiplier'), 10, 'selector survives browser restarts');

Cheats.setMaster(false);
assert.equal(Cheats.enabled('autoPerfect'), false, 'master disarms but preserves selection');
assert.equal(Cheats.getValue('autoPerfect'), true);
Cheats.setMaster(true);
assert.equal(Cheats.enabled('autoPerfect'), true, 'selection re-arms without a reset');

delete require.cache[require.resolve('../js/cheat-state.js')];
Cheats = require('../js/cheat-state.js');
assert.equal(Cheats.isMaster(), true);
assert.equal(Cheats.getValue('autoPerfect'), true, 're-armed favorites remain durable');

assert.equal(Cheats.setValue('scoreMultiplier', 999), false, 'unregistered values are rejected');
assert.equal(Cheats.clampScore(Infinity), 0);
assert.equal(Cheats.clampScore(9_000_000_000), Cheats.SCORE_CEILING);

Cheats.disableAll();
assert.equal(Cheats.isUnlocked(), true, 'disable all does not lock the menu');
assert.equal(Cheats.engaged(), false);
assert.equal(Cheats.getValue('scoreMultiplier'), 1);

delete require.cache[require.resolve('../js/cheat-state.js')];
Cheats = require('../js/cheat-state.js');
assert.equal(Cheats.isUnlocked(), true, 'disable all keeps durable menu access');
assert.equal(Cheats.isMaster(), false, 'disable all persists the disarmed state');
assert.equal(Cheats.getValue('autoPerfect'), false, 'disable all durably clears toggles');
assert.equal(Cheats.getValue('scoreMultiplier'), 1, 'disable all durably restores selectors');

// An already-open v2 tab migrates its validated selections once to v3.
global.localStorage = new MemoryStorage();
global.sessionStorage = new MemoryStorage();
global.sessionStorage.setItem('cs_private_cheats_v2', JSON.stringify({
  unlocked: true,
  master: true,
  values: { infiniteLives: true, zoneSize: 'full', scoreMultiplier: 999, invented: true },
}));
delete require.cache[require.resolve('../js/cheat-state.js')];
Cheats = require('../js/cheat-state.js');
assert.equal(Cheats.enabled('infiniteLives'), true);
assert.equal(Cheats.effectValue('zoneSize'), 'full');
assert.equal(Cheats.getValue('scoreMultiplier'), 1, 'invalid legacy selector values are rejected');
assert.equal(Cheats.getValue('invented'), undefined, 'unknown legacy cheats are rejected');
assert.ok(global.localStorage.getItem('cs_private_cheats_v3'), 'legacy state is upgraded to durable storage');
assert.equal(global.sessionStorage.getItem('cs_private_cheats_v2'), null, 'migrated session state is retired');

console.log('✓ cheat state tests passed');
