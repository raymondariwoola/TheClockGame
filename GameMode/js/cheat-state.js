(function initChronosCheats(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChronosCheats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCheatState(root) {
  'use strict';

  const STORAGE_KEY = 'cs_private_cheats_v3';
  const LEGACY_SESSION_KEY = 'cs_private_cheats_v2';
  const SCORE_CEILING = 2_000_000_000;
  const REGISTRY = Object.freeze([
    { key: 'autoPerfect', label: 'Auto-Perfect', type: 'toggle', hint: 'Every strike chooses the best valid target.' },
    { key: 'easyPerfect', label: 'Easy Perfect Window', type: 'toggle', hint: 'A much wider invisible Perfect window.' },
    { key: 'infiniteLives', label: 'Infinite Lives', type: 'toggle', hint: 'Misses cannot end this run.' },
    { key: 'noMissPenalty', label: 'No Miss Penalty', type: 'toggle', hint: 'Keep score, combo, Overdrive, and powers.' },
    { key: 'lockCombo', label: 'Lock Combo', type: 'toggle', hint: 'Your combo never drops on a miss.' },
    { key: 'alwaysOverdrive', label: 'Always Overdrive', type: 'toggle', hint: 'Hold the 1.5x Overdrive bonus.' },
    { key: 'infinitePowers', label: 'Infinite Powers', type: 'toggle', hint: 'Timers and shields never expire.' },
    { key: 'revealHiddenZones', label: 'Reveal Hidden Zones', type: 'toggle', hint: 'Keep Phantom targets visible locally.' },
    { key: 'bossNerf', label: 'Boss Nerf', type: 'toggle', hint: 'Neutralize boss motion and pressure.' },
    { key: 'timeScale', label: 'Time Scale', type: 'select', default: 1, values: [1, 0.75, 0.5, 0.25], format: (v) => `${v}x` },
    { key: 'scoreMultiplier', label: 'Score Multiplier', type: 'select', default: 1, values: [1, 2, 3, 5, 10], format: (v) => `${v}x` },
    { key: 'handSpeed', label: 'Hand Speed', type: 'select', default: 'normal', values: ['normal', 0.25, 0.5, 1, 1.5, 2], format: (v) => v === 'normal' ? 'Normal' : `${v}x` },
    { key: 'zoneSize', label: 'Zone Size', type: 'select', default: 'normal', values: ['normal', 2, 4, 'full'], format: (v) => v === 'normal' ? 'Normal' : v === 'full' ? 'Near full clock' : `${v}x` },
  ]);
  const BY_KEY = Object.freeze(Object.fromEntries(REGISTRY.map((item) => [item.key, item])));
  const defaults = () => Object.fromEntries(REGISTRY.map((item) => [item.key, item.type === 'toggle' ? false : item.default]));

  let unlocked = false;
  let master = false;
  let values = defaults();
  const listeners = new Set();

  function persistentStorage() {
    try { return root && root.localStorage ? root.localStorage : null; } catch { return null; }
  }

  function legacyStorage() {
    try { return root && root.sessionStorage ? root.sessionStorage : null; } catch { return null; }
  }

  function persist() {
    try {
      const store = persistentStorage();
      if (!store) return false;
      store.setItem(STORAGE_KEY, JSON.stringify({ version: 3, unlocked, master, values }));
      return true;
    } catch { return false; }
  }

  function read(store, key) {
    try {
      return JSON.parse(store?.getItem(key) || 'null');
    } catch { return null; }
  }

  function restore(saved) {
    if (!saved || saved.unlocked !== true) return false;
    unlocked = true;
    master = saved.master === true;
    for (const [key, value] of Object.entries(saved.values || {})) setValue(key, value, false);
    return true;
  }

  function load() {
    const saved = read(persistentStorage(), STORAGE_KEY);
    // A durable record (including an explicit locked record) is authoritative.
    if (saved) { restore(saved); return; }

    // One-time upgrade for a tab that still has the old session-only state
    // when this release arrives. The passphrase itself is never stored.
    const legacyStore = legacyStorage();
    if (!restore(read(legacyStore, LEGACY_SESSION_KEY))) return;
    if (persist()) {
      try { legacyStore?.removeItem(LEGACY_SESSION_KEY); } catch {}
    }
  }

  function emit(key) {
    persist();
    const state = snapshot();
    for (const listener of listeners) listener(state, key);
  }

  function unlock() { unlocked = true; emit('unlock'); }
  function lock() { unlocked = false; master = false; values = defaults(); emit('lock'); }
  function setMaster(next) { if (!unlocked) return false; master = next === true; emit('master'); return true; }

  function setValue(key, value, notify = true) {
    const def = BY_KEY[key];
    if (!def || !unlocked) return false;
    if (def.type === 'toggle') values[key] = value === true;
    else if (def.values.some((candidate) => candidate === value)) values[key] = value;
    else return false;
    if (notify) emit(key);
    return true;
  }

  function getValue(key) { return values[key]; }
  function enabled(key) { return master && (BY_KEY[key]?.type === 'toggle' ? values[key] === true : values[key] !== BY_KEY[key]?.default); }
  function effectValue(key) { return master ? values[key] : BY_KEY[key]?.default; }
  function engaged() { return master && REGISTRY.some((item) => enabled(item.key)); }
  function disableAll() { values = defaults(); master = false; emit('disableAll'); }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function clampScore(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(SCORE_CEILING, Math.trunc(number))) : 0;
  }
  function snapshot() { return Object.freeze({ unlocked, master, engaged: engaged(), values: Object.freeze({ ...values }) }); }

  load();
  return Object.freeze({
    REGISTRY, SCORE_CEILING, unlock, lock,
    isUnlocked: () => unlocked,
    isMaster: () => master,
    setMaster, setValue, getValue, enabled, effectValue, engaged,
    disableAll, subscribe, clampScore, snapshot,
  });
});
